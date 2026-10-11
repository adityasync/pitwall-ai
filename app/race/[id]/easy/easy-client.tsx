"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useReplayStore } from "@/stores/replayStore";
import { useSelectionStore } from "@/stores/selectionStore";
import { useUiStore } from "@/stores/uiStore";
import { indexAtT, lapAtT } from "@/lib/clock";
import { fmtGap } from "@/lib/format";
import { DRS_GAP_S, SPEEDS, TYRE_HEALTH_LAPS } from "@/lib/config";
import { GLOSSARY } from "@/lib/glossary";
import { loadRaceBundle, type RaceBundle } from "@/lib/race";
import { AiCard } from "@/components/AiCard";
import { PlaybackBar } from "@/components/PlaybackBar";
import { StateCard } from "@/components/StateCard";
import { TimingRow, TyreBars } from "@/components/TimingRow";
import { TrackMap, type MapDot } from "@/components/TrackMap";
function seriesAt<T>(ts: number[], vs: T[], t: number): T | null {
  const i = indexAtT(ts, t);
  return i < 0 ? null : (vs[i] ?? null);
}
export function EasyClient({ raceId }: { raceId: string }) {
  const router = useRouter();
  const search = useSearchParams();
  const { t, playing, speed, lap, set, play, pause } = useReplayStore();
  const { momentId, set: setSel } = useSelectionStore();
  const { lang, set: setUi } = useUiStore();
  const [bundle, setBundle] = useState<RaceBundle | null>(null);
  const [term, setTerm] = useState("DRS");
  const aiRef = useRef<HTMLElement>(null);
  const mapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let live = true;
    (async () => {
      const b = await loadRaceBundle(raceId);
      if (!live) return;
      setBundle(b);
      if (b.status === "ready" && b.meta && b.positions) {
        const t0 = Number(search.get("t") ?? "0");
        const m0 = search.get("m");
        const d0 = (search.get("d") ?? "").split(",").filter(Boolean);
        set({
          raceId,
          t: Math.min(Math.max(0, t0), b.positions.t[b.positions.t.length - 1]),
          lap: lapAtT(b.meta.lapStarts, t0),
          lapStarts: b.meta.lapStarts,
          playing: false,
        });
        if (m0) setSel({ momentId: m0, drivers: d0 });
      }
    })();
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [raceId]);

  const meta = bundle?.meta;
  const positions = bundle?.positions;
  const endT = positions ? positions.t[positions.t.length - 1] : 0;

  useEffect(() => {
    if (!playing || !meta || !positions) return;
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      const cur = useReplayStore.getState();
      const nt = Math.min(cur.t + dt * cur.speed, endT);
      cur.set({ t: nt, lap: lapAtT(meta.lapStarts, nt), playing: nt < endT });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, meta, positions, endT]);

  const scrub = (nt: number) => {
    if (!meta) return;
    set({ t: nt, lap: lapAtT(meta.lapStarts, nt) });
  };

  const scrollTo = (el: HTMLElement | null) => {
    if (!el) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "nearest" });
  };

  const openMoment = (id: string) => {
    const m = bundle?.moments.find((x) => x.id === id);
    if (!m || !meta) return;
    scrub(m.t);
    setSel({ momentId: id, drivers: m.drivers });
    const d = m.drivers.length > 0 ? `&d=${m.drivers.join(",")}` : "";
    router.replace(`/race/${raceId}/easy?t=${Math.round(m.t)}&m=${id}${d}`, { scroll: false });
    scrollTo(aiRef.current);
  };

  const tower = useMemo(() => {
    if (!bundle || !positions || !meta) return [];
    const i = indexAtT(positions.t, t);
    if (i < 0) return [];
    const lapNow = lapAtT(meta.lapStarts, t);
    return bundle.drivers
      .map((d) => {
        const s = positions.drivers[d.code];
        const pos = s ? s.pos[Math.min(i, s.pos.length - 1)] : null;
        const iv = bundle.intervals?.drivers[d.code];
        const gapL = iv ? seriesAt(iv.t, iv.gapLeader, t) : null;
        const lapRow = bundle.laps[d.code]?.find((r) => r.lap === lapNow)
          ?? [...(bundle.laps[d.code] ?? [])].reverse().find((r) => r.lap <= lapNow);
        const age = lapRow?.tyreAge ?? null;
        const health = age == null ? null : Math.max(0, Math.min(1, 1 - age / TYRE_HEALTH_LAPS));
        return {
          driver: d,
          pos,
          gap: gapL == null ? null : gapL === 0 ? "LEADER" : fmtGap(gapL),
          compound: lapRow?.compound ?? null,
          age,
          health,
          trend: d.grid != null && pos != null ? d.grid - pos : null,
        };
      })
      .filter((r) => r.pos != null)
      .sort((a, b) => (a.pos as number) - (b.pos as number));
  }, [bundle, positions, meta, t]);

  const featured = useMemo(() => {
    if (!bundle) return null;
    const cands = bundle.moments.filter(
      (m) => m.confidence !== "low" && ["gap", "overtake", "pit", "fastest", "flag"].includes(m.type)
    );
    const past = cands.filter((m) => m.t <= t + 30);
    return past[past.length - 1] ?? cands[0] ?? bundle.moments[0] ?? null;
  }, [bundle, t]);

  useEffect(() => {
    if (featured && !momentId) setSel({ momentId: featured.id, drivers: featured.drivers });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [featured?.id]);

  const battle = useMemo(() => {
    if (!bundle || !featured || featured.drivers.length === 0) return null;
    const [a, b] = featured.drivers;
    const iv = bundle.intervals?.drivers[a];
    const gapNow = iv ? seriesAt(iv.t, iv.gapAhead, t) : null;
    // closing rate: linear fit over last 8 samples (s per lap), DERIVED
    let rate: number | null = null;
    if (iv) {
      const idx = indexAtT(iv.t, t);
      const pts: [number, number][] = [];
      for (let k = Math.max(0, idx - 8); k <= idx && k >= 0; k++) {
        const g = iv.gapAhead[k];
        if (g != null) pts.push([iv.t[k], g]);
      }
      if (pts.length >= 4) {
        const n = pts.length;
        const mx = pts.reduce((s, p) => s + p[0], 0) / n;
        const my = pts.reduce((s, p) => s + p[1], 0) / n;
        const den = pts.reduce((s, p) => s + (p[0] - mx) ** 2, 0);
        if (den > 0) {
          const slope = pts.reduce((s, p) => s + (p[0] - mx) * (p[1] - my), 0) / den;
          // median lap of the chaser from computed pace — never a magic number
          const medLap = bundle.stats?.pace[a]?.median ?? null;
          rate = medLap != null ? -slope * medLap : null; // s gained per lap
        }
      }
    }
    const passIn =
      rate != null && rate > 0.02 && gapNow != null && gapNow > 0
        ? Math.round(gapNow / rate)
        : null;
    return { a, b, gapNow, rate, passIn };
  }, [bundle, featured, t]);

  const dots: MapDot[] = useMemo(() => {
    if (!positions || !bundle) return [];
    const i = indexAtT(positions.t, t);
    if (i < 0 || !battle) return [];
    return [battle.a, battle.b]
      .map((code) => {
        const s = positions.drivers[code];
        const d = bundle.drivers.find((x) => x.code === code);
        if (!s?.x || !s?.y || !d) return null;
        const j = Math.min(i, s.x.length - 1);
        return { code, x: s.x[j], y: s.y[j], colour: d.teamColour };
      })
      .filter((x): x is MapDot => x !== null);
  }, [positions, bundle, battle, t]);

  const driveOfDay = useMemo(() => {
    if (tower.length === 0) return null;
    const cands = tower.filter((r) => (r.trend ?? 0) > 0);
    if (cands.length === 0) return null;
    return cands.sort((a, b) => (b.trend as number) - (a.trend as number))[0];
  }, [tower]);

  const missed = useMemo(() => {
    if (!bundle) return [];
    return bundle.moments
      .filter((m) => m.confidence !== "low" && m.t <= t)
      .sort((a, b) => b.t - a.t)
      .slice(0, 6);
  }, [bundle, t]);

  if (!bundle) {
    return (
      <main className="mx-auto w-full max-w-5xl px-4 py-10">
        <StateCard kind="loading" title="Loading replay" text={`Fetching ${raceId}…`} progress={64} />
      </main>
    );
  }
  if (bundle.status !== "ready" || !meta || !positions) {
    return (
      <main className="mx-auto w-full max-w-5xl px-4 py-10">
        <StateCard
          kind="error"
          title="Could not load this race"
          text="The replay files are missing. Build them first, then try again."
        />
      </main>
    );
  }

  const glossary = GLOSSARY.find((g) => g.term === term) ?? GLOSSARY[0];
  return (
    <main className="mx-auto w-full max-w-5xl px-4 pb-24 pt-4 sm:pb-10">
      <h1 className="sr-only">{meta.name} — Easy mode</h1>

      <div className="mt-4">
        <PlaybackBar
          t={t}
          endT={endT}
          lap={lap}
          laps={meta.laps}
          moments={bundle.moments}
          onScrub={scrub}
          onMoment={openMoment}
        />
        <div className="mt-2 flex gap-2">
          <button
            className="touch rounded-md bg-[var(--accent)] px-4 text-sm font-bold text-black"
            onClick={() => (playing ? pause() : play())}
          >
            {playing ? "Pause" : "Play"}
          </button>
          {SPEEDS.map((s) => (
            <button
              key={s}
              className="touch rounded-md border border-[var(--border-strong)] px-3 text-sm"
              onClick={() => set({ speed: s })}
              aria-pressed={speed === s}
            >
              {s}x
            </button>
          ))}
        </div>
      </div>

      {/* Happening now + AI card */}
      <section id="now" ref={aiRef} aria-label="What's happening right now" className="mt-6 scroll-mt-20">
        <p className="panel-label">What&apos;s happening right now</p>
        {featured ? (
          <div className="mt-2">
            <AiCard
              headline={featured.headline}
              text={featured.explain.easy.en}
              hinglish={featured.explain.easy.hi}
              evidence={featured.evidence}
              footer={`Based on laps ${Math.max(1, featured.lap - 3)} to ${featured.lap}. Brake is an on/off signal, so braking distances are approximate.`}
              lang={lang}
            />
            {battle && (
              <>
                <dl className="tnum mt-3 grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-md border border-[var(--border)] bg-[var(--panel)] p-3">
                    <dt className="text-[11px] tracking-widest text-[var(--muted)]">GAP NOW</dt>
                    <dd className="text-xl font-bold">{battle.gapNow != null ? `${battle.gapNow.toFixed(1)} s` : "—"}</dd>
                  </div>
                  <div className="rounded-md border border-[var(--border)] bg-[var(--panel)] p-3">
                    <dt className="text-[11px] tracking-widest text-[var(--muted)]">CLOSING</dt>
                    <dd className="text-xl font-bold">
                      {battle.rate != null && battle.rate > 0.02 ? `~${battle.rate.toFixed(1)} s/lap` : "holding"}
                    </dd>
                  </div>
                  <div className="rounded-md border border-[var(--border)] bg-[var(--panel)] p-3">
                    <dt className="text-[11px] tracking-widest text-[var(--muted)]">LIKELY PASS IN</dt>
                    <dd className="text-xl font-bold">{battle.passIn != null ? `~${battle.passIn} laps` : "—"}</dd>
                  </div>
                </dl>
                <p className="mt-1 text-xs text-[var(--muted)]">Pass prediction is an estimate, not a promise.</p>
              </>
            )}
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                className="touch rounded-md border border-[var(--accent)] px-4 text-sm font-bold text-[var(--accent)]"
                onClick={() => scrollTo(aiRef.current)}
              >
                {battle ? "Why is he faster?" : "Why did this happen?"}
              </button>
              <button
                className="touch rounded-md border border-[var(--border-strong)] px-4 text-sm font-semibold"
                onClick={() => scrollTo(mapRef.current)}
              >
                Show me on the track
              </button>
            </div>
          </div>
        ) : (
          <StateCard kind="empty" title="No featured moment yet" text="Scrub forward — moments appear as the race unfolds." />
        )}
      </section>

      {/* Battle on track */}
      <section aria-label="The battle on track" className="mt-8" ref={mapRef}>
        <p className="panel-label">The battle on track</p>
        <div className="mt-2">
          <TrackMap
            track={bundle.track}
            dots={dots}
            label={
              battle && battle.gapNow != null && battle.gapNow < DRS_GAP_S
                ? "Straight ahead: DRS zone — under a second, a pass may be coming."
                : dots.length === 0
                  ? `Car positions on the map are available for ${(meta?.coverage.telemetryDrivers ?? []).join(", ") || "telemetry drivers"} in this replay.`
                  : undefined
            }
          />
        </div>
      </section>

      {/* Tower */}
      <section id="tower" aria-label="Who is where" className="mt-8 scroll-mt-20">
        <p className="panel-label">Who is where · gaps MEASURED · bars ESTIMATE</p>
        <ol className="mt-2 overflow-hidden rounded-md border border-[var(--border)]">
          {tower.map((r) => (
            <TimingRow
              key={r.driver.code}
              pos={r.pos as number}
              teamColour={r.driver.teamColour}
              code={r.driver.code}
              gap={r.gap}
              tyre={r.compound}
              age={r.age}
              trend={r.trend}
            />
          ))}
        </ol>
        <div className="mt-2 flex items-center gap-3 text-sm text-[var(--muted)]">
          <TyreBars health={0.8} />
          <span>Tyre bar is an estimate from lap times. Green is fresh, red is nearly worn out.</span>
        </div>
      </section>

      {/* Drive of the day */}
      {driveOfDay && (
        <section aria-label="Drive of the day so far" className="mt-8">
          <p className="panel-label">Drive of the day so far</p>
          <div className="mt-2 flex items-center gap-3 rounded-md border border-[var(--border)] bg-[var(--panel)] p-4">
            <span className="tnum text-2xl font-bold text-[var(--good)]">+{driveOfDay.trend}</span>
            <div>
              <p className="text-lg font-bold">{driveOfDay.driver.name.split(" ").slice(-1)}</p>
              <p className="text-sm text-[var(--muted)]">
                {lang === "hi"
                  ? `${driveOfDay.driver.grid}th se start karke ab ${driveOfDay.pos} par.`
                  : `Started ${driveOfDay.driver.grid}, now ${driveOfDay.pos}. Fresh tyres doing the work.`}
              </p>
            </div>
          </div>
        </section>
      )}

      {/* Learn */}
      <section id="learn" aria-label="Learn as you watch" className="mt-8 scroll-mt-20">
        <p className="panel-label">Learn as you watch</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {GLOSSARY.map((g) => (
            <button
              key={g.term}
              onClick={() => setTerm(g.term)}
              aria-pressed={term === g.term}
              className={`touch rounded-full border px-4 text-sm font-semibold ${term === g.term ? "border-[var(--accent)] text-[var(--accent)]" : "border-[var(--border-strong)] text-[var(--muted)]"}`}
            >
              {g.term}
            </button>
          ))}
        </div>
        <p className="mt-3 rounded-md border border-[var(--border)] bg-[var(--panel)] p-4">
          <strong>{glossary.term}:</strong> {lang === "hi" ? glossary.hi : glossary.en}
        </p>
        <button
          className="touch mt-2 text-sm text-[var(--muted)] underline"
          onClick={() => setUi({ lang: lang === "hi" ? "en" : "hi" })}
        >
          {lang === "hi" ? "Show in English" : "Hinglish mein dekho"}
        </button>
      </section>

      {/* Moments */}
      <section id="moments" aria-label="Moments you may have missed" className="mt-8 scroll-mt-20">
        <p className="panel-label">Moments you may have missed</p>
        <ul className="mt-2 grid gap-2">
          {missed.map((m) => (
            <li key={m.id} className="rounded-md border border-[var(--border)] bg-[var(--panel)] p-4">
              <p className="tnum text-xs text-[var(--muted)]">
                LAP {m.lap} · {m.type.toUpperCase()}
              </p>
              <p className="mt-1 font-semibold">{m.headline}</p>
              <button
                className="touch mt-2 text-sm font-semibold text-[var(--accent)]"
                onClick={() => openMoment(m.id)}
              >
                Replay this moment →
              </button>
            </li>
          ))}
          {missed.length === 0 && (
            <li className="rounded-md border border-[var(--border)] bg-[var(--panel)] p-4 text-[var(--muted)]">
              Nothing yet — scrub forward into the race.
            </li>
          )}
        </ul>
      </section>

      {/* Mobile bottom tab bar */}
      <nav aria-label="Easy sections" className="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--border)] bg-[var(--bar)] sm:hidden">
        <div className="grid grid-cols-4">
          {[
            ["#now", "Now"],
            ["#tower", "Tower"],
            ["#moments", "Moments"],
            ["#learn", "Learn"],
          ].map(([href, label]) => (
            <a key={href} href={href} className="touch inline-flex items-center justify-center text-sm font-semibold text-[var(--muted)]">
              {label}
            </a>
          ))}
        </div>
      </nav>
    </main>
  );
}
