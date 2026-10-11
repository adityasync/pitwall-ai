"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useReplayStore } from "@/stores/replayStore";
import { useSelectionStore } from "@/stores/selectionStore";
import { useUiStore } from "@/stores/uiStore";
import { indexAtT, lapAtT } from "@/lib/clock";
import { fmtGap, fmtLapTime } from "@/lib/format";
import { SPEEDS } from "@/lib/config";
import { loadJson } from "@/lib/data";
import { loadRaceBundle, type RaceBundle } from "@/lib/race";
import type { Moment } from "@/lib/types";
import { AiCard } from "@/components/AiCard";
import { PlaybackBar } from "@/components/PlaybackBar";
import { StateCard } from "@/components/StateCard";
import { TimingRow } from "@/components/TimingRow";
import { TrackMap, type MapDot } from "@/components/TrackMap";

type TeleLap = { dist: number[]; speed: number[]; throttle: number[]; brake: number[]; gear: number[]; drs: number[] };
type TeleFile = { lap: Record<string, TeleLap> };

export function ProClient({ raceId }: { raceId: string }) {
  const { t, playing, speed, lap, set, play, pause } = useReplayStore();
  const { momentId, set: setSel } = useSelectionStore();
  const { lang } = useUiStore();
  const [bundle, setBundle] = useState<RaceBundle | null>(null);
  const [tele, setTele] = useState<Record<string, { file: TeleFile; colour: string }>>({});
  const [driver, setDriver] = useState<string | null>(null);
  const [corner, setCorner] = useState<number | null>(null);
  const [whyId, setWhyId] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>("ALL");

  useEffect(() => {
    let live = true;
    (async () => {
      const b = await loadRaceBundle(raceId);
      if (!live) return;
      setBundle(b);
      if (b.status === "ready" && b.meta && b.positions) {
        set({ raceId, t: 0, lap: 1, lapStarts: b.meta.lapStarts, playing: false });
        // telemetry: only fetch files the pipeline wrote (coverage list) — no 404 probing
        const covered: string[] = b.meta.coverage.telemetryDrivers ?? [];
        const got: Record<string, { file: TeleFile; colour: string }> = {};
        for (const code of covered.slice(0, 4)) {
          const r = await loadJson<TeleFile>(`${raceId}/telemetry/${code}.json`);
          if (!live) return;
          if (r.status === "ready" && r.data && Object.keys(r.data.lap).length > 0) {
            got[code] = { file: r.data, colour: b.drivers.find((d) => d.code === code)?.teamColour ?? "#fff" };
          }
        }
        setTele(got);
        const order = [...b.drivers].sort((a, c) => (a.finish ?? 99) - (c.finish ?? 99)).map((d) => d.code);
        if (!driver && order.length > 0) setDriver(order[0]);
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
    if (!playing || !meta) return;
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
  }, [playing, meta, endT]);

  const scrub = (nt: number) => {
    if (!meta) return;
    set({ t: nt, lap: lapAtT(meta.lapStarts, nt) });
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
        const gapL = iv ? iv.gapLeader[Math.min(indexAtT(iv.t, t), iv.gapLeader.length - 1)] : null;
        const rows = bundle.laps[d.code] ?? [];
        const lapRow = rows.find((r) => r.lap === lapNow) ?? [...rows].reverse().find((r) => r.lap <= lapNow);
        return { driver: d, pos, gap: gapL == null ? null : gapL === 0 ? "LEADER" : fmtGap(gapL),
                 compound: lapRow?.compound ?? null, age: lapRow?.tyreAge ?? null,
                 trend: d.grid != null && pos != null ? d.grid - pos : null };
      })
      .filter((r) => r.pos != null)
      .sort((a, b) => (a.pos as number) - (b.pos as number));
  }, [bundle, positions, meta, t]);

  const dots: MapDot[] = useMemo(() => {
    if (!positions) return [];
    const i = indexAtT(positions.t, t);
    if (i < 0) return [];
    const out: MapDot[] = [];
    for (const [code, s] of Object.entries(positions.drivers)) {
      if (!s.x || !s.y) continue;
      const j = Math.min(i, s.x.length - 1);
      const d = bundle?.drivers.find((x) => x.code === code);
      out.push({ code, x: s.x[j], y: s.y[j], colour: d?.teamColour ?? "#fff" });
    }
    return out;
  }, [positions, bundle, t]);

  const cornerRows = useMemo(() => {
    const c = bundle?.track?.corners.find((x) => x.n === corner);
    if (!c || Object.keys(tele).length === 0) return null;
    const zone = bundle?.track?.brakingZones.find((z) => z.corner === c.n) ?? null;
    const rows = Object.entries(tele).map(([code, { file }]) => {
      const lapKeys = Object.keys(file.lap).sort((a, b) => Number(a) - Number(b));
      const lk = lapKeys[0];
      const L = file.lap[lk];
      let bi = 0;
      for (let i = 0; i < L.dist.length; i++) {
        if (Math.abs(L.dist[i] - c.dist) < Math.abs(L.dist[bi] - c.dist)) bi = i;
      }
      return { code, lap: lk, apex: L.speed[bi], brake: zone ? zone.startDist : null };
    });
    const best = rows.reduce((a, b) => (b.apex < a.apex ? b : a), rows[0]);
    return { corner: c, rows, zone, best: best.code };
  }, [bundle, tele, corner]);

  const feed = useMemo(() => {
    if (!bundle) return [];
    return bundle.moments
      .filter((m) => m.confidence !== "low" && (filter === "ALL" || m.type.toUpperCase() === filter))
      .sort((a, b) => b.t - a.t)
      .slice(0, 12);
  }, [bundle, filter]);

  const openMoment = (m: Moment) => {
    scrub(m.t);
    setSel({ momentId: m.id, drivers: m.drivers });
    setWhyId(m.id);
  };

  if (!bundle) {
    return (
      <main className="mx-auto w-full max-w-[1360px] px-4 py-10">
        <StateCard kind="loading" title="Loading workstation" text={`Fetching ${raceId}…`} progress={70} />
      </main>
    );
  }
  if (bundle.status !== "ready" || !meta || !positions) {
    return (
      <main className="mx-auto w-full max-w-[1360px] px-4 py-10">
        <StateCard kind="error" title="Could not load this race" text="Build the race files first." />
      </main>
    );
  }

  const sel = tower.find((r) => r.driver.code === driver) ?? tower[0];
  const pace = sel && bundle.stats ? bundle.stats.pace[sel.driver.code] : null;

  return (
    <main className="mx-auto w-full max-w-[1360px] px-4 pb-10 pt-4">
      <h1 className="sr-only">{meta.name} — Pro workstation</h1>

      <div className="mt-4">
        <PlaybackBar t={t} endT={endT} lap={lap} laps={meta.laps} moments={bundle.moments}
          onScrub={scrub} onMoment={(id) => { const m = bundle.moments.find((x) => x.id === id); if (m) openMoment(m); }} />
        <div className="mt-2 flex gap-2">
          <button className="touch rounded-md bg-[var(--accent)] px-4 text-sm font-bold text-black"
            onClick={() => (playing ? pause() : play())}>
            {playing ? "Pause" : "Play"}
          </button>
          {SPEEDS.map((s) => (
            <button key={s} className="touch rounded-md border border-[var(--border-strong)] px-3 text-sm"
              onClick={() => set({ speed: s })} aria-pressed={speed === s}>
              {s}x
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[320px_1fr_340px]">
        {/* Tower */}
        <section aria-label="Timing tower">
          <p className="panel-label mb-2">Timing tower · gap / tyre</p>
          <ol className="overflow-hidden rounded-md border border-[var(--border)]">
            {tower.map((r) => (
              <TimingRow key={r.driver.code}
                pos={r.pos as number} teamColour={r.driver.teamColour} code={r.driver.code}
                gap={r.gap} tyre={r.compound} age={r.age} trend={r.trend}
                selected={driver === r.driver.code}
                onSelect={() => setDriver(r.driver.code)} />
            ))}
          </ol>
          <p className="panel-label mb-2 mt-4">Tyre strategy</p>
          <div className="flex flex-wrap gap-1.5">
            {tower.map((r) => (
              <span key={r.driver.code} title={`${r.driver.code} ${r.compound ?? "?"} age ${r.age ?? "?"}`}
                className="tnum rounded border border-[var(--border)] px-1.5 py-1 text-[11px]">
                {r.driver.code}·{(r.compound ?? "?")[0]}{r.age ?? ""}
              </span>
            ))}
          </div>
        </section>

        {/* Map */}
        <section aria-label="Track map">
          <p className="panel-label mb-2">Track map · tap a corner or a car</p>
          <TrackMap track={bundle.track} dots={dots} height={380} showZones
            selectedCorner={corner} onCorner={setCorner}
            label={dots.length === 0 ? undefined : `${dots.length} cars on map (telemetry drivers). Braking zones DERIVED from on/off brake signal.`} />
          {!bundle.track?.corners.length && (
            <p className="mt-2 text-sm text-[var(--muted)]">Corner catalogue is being derived for this race.</p>
          )}
          {cornerRows && (
            <div className="mt-2 rounded-md border border-[var(--border)] bg-[var(--panel)] p-4">
              <p className="display text-xl font-bold">TURN {cornerRows.corner.n}</p>
              <table className="tnum mt-2 w-full text-sm">
                <thead>
                  <tr className="text-left text-[var(--muted)]">
                    <th>DRIVER</th><th>BRAKE POINT</th><th>LOWEST SPEED</th><th>FASTER</th>
                  </tr>
                </thead>
                <tbody>
                  {cornerRows.rows.map((r) => (
                    <tr key={r.code} className="border-t border-[var(--border)]">
                      <td className="py-1 font-bold">{r.code} <span className="text-[var(--muted)]">lap {r.lap}</span></td>
                      <td>{r.brake != null ? `${Math.round(r.brake)} m` : "—"}</td>
                      <td>{Math.round(r.apex)} km/h</td>
                      <td>{r.code === cornerRows.best ? <span className="text-[var(--good)]">▲ apex</span> : ""}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="mt-2 text-xs text-[var(--muted)]">
                Apex speeds from each driver&apos;s fastest stored lap. Braking points come from the brake on/off
                signal and distance, so distances are approximate.
              </p>
              <div className="mt-2 flex gap-2">
                <Link href={`/race/${raceId}/corners`} className="touch inline-flex items-center rounded-md border border-[var(--border-strong)] px-4 text-sm font-semibold">
                  Full corner analysis →
                </Link>
                <Link href={`/race/${raceId}/compare?d=${cornerRows.rows.map((r) => r.code).slice(0, 2).join(",")}`}
                  className="touch inline-flex items-center rounded-md border border-[var(--accent)] px-4 text-sm font-bold text-[var(--accent)]">
                  Compare →
                </Link>
              </div>
            </div>
          )}
        </section>

        {/* Driver + AI feed */}
        <div className="flex flex-col gap-4">
          {sel && (
            <section aria-label="Selected driver" className="rounded-md border border-[var(--border)] bg-[var(--panel)] p-4">
              <p className="panel-label">Selected driver</p>
              <p className="display text-2xl font-bold">
                {sel.driver.code} · P{sel.pos}
              </p>
              <dl className="tnum mt-2 grid grid-cols-2 gap-2 text-sm">
                <div><dt className="text-[var(--muted)]">GAP</dt><dd>{sel.gap}</dd></div>
                <div><dt className="text-[var(--muted)]">TYRE</dt><dd>{sel.compound ?? "—"} {sel.age != null ? `${sel.age} laps` : ""}</dd></div>
                <div><dt className="text-[var(--muted)]">BEST</dt><dd>{pace ? fmtLapTime(pace.bestLap) : "—"}</dd></div>
                <div><dt className="text-[var(--muted)]">MEDIAN</dt><dd>{pace ? fmtLapTime(pace.median) : "—"}</dd></div>
              </dl>
            </section>
          )}
          <section aria-label="AI pit wall">
            <p className="panel-label mb-2">AI pit wall · grounded in lap data</p>
            <div className="mb-2 flex flex-wrap gap-1.5">
              {["ALL", "OVERTAKE", "PIT", "GAP", "FLAG", "FASTEST"].map((f) => (
                <button key={f} onClick={() => setFilter(f)} aria-pressed={filter === f}
                  className={`touch rounded-full border px-3 text-xs font-bold ${filter === f ? "border-[var(--accent)] text-[var(--accent)]" : "border-[var(--border-strong)] text-[var(--muted)]"}`}>
                  {f}
                </button>
              ))}
            </div>
            <ul className="flex flex-col gap-2">
              {feed.map((m) => (
                <li key={m.id} className="rounded-md border border-[var(--border)] bg-[var(--panel)] p-3">
                  <p className="tnum text-[11px] text-[var(--muted)]">LAP {m.lap} · {m.type.toUpperCase()}</p>
                  <p className="text-sm font-semibold">{m.headline}</p>
                  <div className="mt-1 flex gap-3 text-sm">
                    <button className="font-bold text-[var(--accent)]" onClick={() => { openMoment(m); setWhyId(m.id); }}>
                      WHY?{momentId === m.id ? " ✓" : ""}
                    </button>
                    <Link className="text-[var(--muted)] underline"
                      href={`/ask?race=${raceId}&q=${encodeURIComponent(m.headline)}`}>
                      Ask about this moment
                    </Link>
                  </div>
                  {whyId === m.id && (
                    <div className="mt-2">
                      <AiCard headline={m.headline} text={m.explain.pro.en} hinglish={m.explain.pro.hi}
                        evidence={m.evidence} lang={lang} />
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>
    </main>
  );
}
