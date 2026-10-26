"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useReplayStore } from "@/stores/replayStore";
import { useSelectionStore } from "@/stores/selectionStore";
import { useUiStore } from "@/stores/uiStore";
import { commitIntervalMs, indexAtT, lapAtT } from "@/lib/clock";
import { dotsAtT, moversAt, trailsAtT } from "@/lib/map";
import { DRS_GAP_S, SPEEDS, TYRE_HEALTH_LAPS } from "@/lib/config";
import { GLOSSARY } from "@/lib/glossary";
import { loadRaceBundle, type RaceBundle } from "@/lib/race";
import { AiCard, TrustBadge } from "@/components/AiCard";
import { PlaybackBar } from "@/components/PlaybackBar";
import { StateCard } from "@/components/StateCard";
import { TimingRow } from "@/components/TimingRow";
import { TrackMap, type MapDot } from "@/components/TrackMap";
function seriesAt<T>(ts: number[], vs: T[], t: number): T | null {
  const i = indexAtT(ts, t);
  return i < 0 ? null : (vs[i] ?? null);
}
export function EasyClient({ raceId }: { raceId: string }) {
  const router = useRouter();
  const search = useSearchParams();
  // Granular subscriptions: the 10 Hz clock only re-renders what reads t.
  const t = useReplayStore((s) => s.t);
  const playing = useReplayStore((s) => s.playing);
  const speed = useReplayStore((s) => s.speed);
  const lap = useReplayStore((s) => s.lap);
  const set = useReplayStore((s) => s.set);
  const play = useReplayStore((s) => s.play);
  const pause = useReplayStore((s) => s.pause);
  const momentId = useSelectionStore((s) => s.momentId);
  const setSel = useSelectionStore((s) => s.set);
  const lang = useUiStore((s) => s.lang);
  const setUi = useUiStore((s) => s.set);
  const [bundle, setBundle] = useState<RaceBundle | null>(null);
  const [term, setTerm] = useState("DRS");
  const [selected, setSelected] = useState<string | null>(null);
  const [follow, setFollow] = useState<string | null>(null);
  const [myDriver, setMyDriver] = useState<string | null>(null);
  const [followRace, setFollowRace] = useState(true);
  const [onboarded, setOnboarded] = useState(() =>
    typeof window === "undefined" ? true : window.localStorage.getItem("pitwall-easy-onboard") === "1"
  );
  const aiRef = useRef<HTMLElement>(null);
  const learnRef = useRef<HTMLElement>(null);
  const toggleSelect = useCallback(
    (c: string) => setSelected((s) => (s === c ? null : c)),
    []
  );
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
    let committed = 0;
    const tick = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      const cur = useReplayStore.getState();
      const nt = Math.min(cur.t + dt * cur.speed, endT);
      // Throttled commits — see commitIntervalMs. Same smooth dots, ~6x fewer renders.
      if (now - committed >= commitIntervalMs(cur.speed) || nt >= endT) {
        committed = now;
        cur.set({ t: nt, lap: lapAtT(meta.lapStarts, nt), playing: nt < endT });
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, meta, positions, endT]);

  const scrub = useCallback((nt: number) => {
    const starts = useReplayStore.getState().lapStarts;
    if (starts.length === 0) return;
    useReplayStore.getState().set({ t: nt, lap: lapAtT(starts, nt) });
  }, []);

  const scrollTo = (el: HTMLElement | null) => {
    if (!el) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "nearest" });
  };

  const openMoment = useCallback((id: string) => {
    const m = bundle?.moments.find((x) => x.id === id);
    if (!m) return;
    scrub(m.t);
    setSel({ momentId: id, drivers: m.drivers });
    const d = m.drivers.length > 0 ? `&d=${m.drivers.join(",")}` : "";
    router.replace(`/race/${raceId}/easy?t=${Math.round(m.t)}&m=${id}${d}`, { scroll: false });
    scrollTo(aiRef.current);
  }, [bundle, scrub, setSel, router, raceId]);

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
        const ahead = iv ? seriesAt(iv.t, iv.gapAhead, t) : null;
        const lapRow = bundle.laps[d.code]?.find((r) => r.lap === lapNow)
          ?? [...(bundle.laps[d.code] ?? [])].reverse().find((r) => r.lap <= lapNow);
        const age = lapRow?.tyreAge ?? null;
        const health = age == null ? null : Math.max(0, Math.min(1, 1 - age / TYRE_HEALTH_LAPS));
        const status =
          lapRow?.pitLane ? ("PIT" as const)
          : ahead != null && ahead > 0 && ahead <= 1 ? ("DRS" as const)
          : null;
        return {
          driver: d,
          pos,
          gap: pos === 1 ? "LEADER" : ahead == null ? null : `+${ahead.toFixed(1)}`,
          compound: lapRow?.compound ?? null,
          age,
          health,
          status,
          trend: d.grid != null && pos != null ? d.grid - pos : null,
        };
      })
      .filter((r) => r.pos != null)
      .sort((a, b) => (a.pos as number) - (b.pos as number));
  }, [bundle, positions, meta, t]);

  const storyMoments = useMemo(() => {
    if (!bundle) return [];
    return bundle.moments
      .filter((m) => m.confidence !== "low" && ["gap", "overtake", "pit", "fastest", "flag"].includes(m.type))
      .sort((a, b) => a.t - b.t);
  }, [bundle]);

  const featured = useMemo(() => {
    if (!bundle) return null;
    const pool = myDriver ? storyMoments.filter((m) => m.drivers.includes(myDriver)) : storyMoments;
    const cands = pool.length > 0 ? pool : storyMoments;
    const past = cands.filter((m) => m.t <= t + 30);
    return past[past.length - 1] ?? cands[0] ?? bundle.moments[0] ?? null;
  }, [bundle, storyMoments, myDriver, t]);

  // The card follows the selected moment; with Follow on it tracks the replay.
  const active = useMemo(() => {
    if (!bundle) return null;
    if (momentId) return storyMoments.find((m) => m.id === momentId) ?? featured;
    return featured;
  }, [bundle, momentId, storyMoments, featured]);
  const activeIndex = useMemo(
    () => (active ? storyMoments.findIndex((m) => m.id === active.id) : -1),
    [storyMoments, active]
  );

  useEffect(() => {
    if (featured && !momentId) setSel({ momentId: featured.id, drivers: featured.drivers });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [featured?.id]);

  // Follow-race: as the clock moves, the story card tracks the latest moment.
  useEffect(() => {
    if (!followRace || !featured || featured.id === momentId) return;
    setSel({ momentId: featured.id, drivers: featured.drivers });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [featured?.id, followRace]);

  const stepMoment = useCallback((dir: 1 | -1) => {
    if (storyMoments.length === 0) return;
    const next =
      activeIndex < 0
        ? dir > 0 ? storyMoments[0] : storyMoments[storyMoments.length - 1]
        : storyMoments[Math.min(storyMoments.length - 1, Math.max(0, activeIndex + dir))];
    if (next) openMoment(next.id);
  }, [storyMoments, activeIndex, openMoment]);

  const stepLap = useCallback((dir: 1 | -1) => {
    const starts = useReplayStore.getState().lapStarts;
    const cur = useReplayStore.getState();
    if (starts.length === 0) return;
    const idx = Math.min(starts.length - 1, Math.max(0, lapAtT(starts, cur.t) - 1 + dir));
    scrub(starts[idx] + 0.1);
  }, [scrub]);

  // Space = play/pause, ←/→ = prev/next moment (never hijack typing).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable)) return;
      if (e.code === "Space" && !el?.closest("button, a")) {
        e.preventDefault();
        const cur = useReplayStore.getState();
        if (cur.playing) cur.pause(); else cur.play();
      } else if (e.key === "ArrowRight" && !el?.closest("input")) {
        stepMoment(1);
      } else if (e.key === "ArrowLeft" && !el?.closest("input")) {
        stepMoment(-1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [stepMoment]);

  const battle = useMemo(() => {
    if (!bundle || !active || active.drivers.length === 0) return null;
    const [a, b] = active.drivers;
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
  }, [bundle, active, t]);

  // Glossary terms actually used in this story — tap to learn them below.
  const newWords = useMemo(() => {
    if (!active) return [];
    const hay = `${active.headline} ${active.explain.easy.en}`.toLowerCase();
    return GLOSSARY.filter((g) => hay.includes(g.term.toLowerCase())).slice(0, 3);
  }, [active]);

  // Prefilled Ask question for the dead "Why?" button — grounded via raceId.
  const askQ = useMemo(() => {
    if (!active) return "";
    if (battle) {
      const verb = battle.rate != null && battle.rate > 0.02 ? "closing on" : "behind";
      return `Why is ${battle.a} ${verb} ${battle.b ?? "the car ahead"} on lap ${active.lap}?`;
    }
    return `Why did "${active.headline}" happen on lap ${active.lap}?`;
  }, [active, battle]);

  const dots: MapDot[] = useMemo(() => {
    if (!positions || !bundle) return [];
    const all = dotsAtT(positions, bundle.drivers, t);
    const hot = new Set<string>();
    if (battle) {
      if (battle.a) hot.add(battle.a);
      if (battle.b) hot.add(battle.b);
    }
    if (selected) hot.add(selected);
    if (myDriver) hot.add(myDriver);
    if (hot.size === 0) return all.map((d) => ({ ...d, dim: all.length > 6 }));
    return all.map((d) => ({ ...d, highlight: hot.has(d.code), dim: !hot.has(d.code) }));
  }, [positions, bundle, battle, selected, myDriver, t]);
  const leaderCode = useMemo(() => tower[0]?.driver.code ?? null, [tower]);
  const trails = useMemo(() => {
    if (!positions) return null;
    const codes = new Set<string>();
    if (battle?.a) codes.add(battle.a);
    if (battle?.b) codes.add(battle.b);
    if (selected) codes.add(selected);
    if (myDriver) codes.add(myDriver);
    if (leaderCode) codes.add(leaderCode);
    if (codes.size === 0) return null;
    if (typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return null;
    return trailsAtT(positions, [...codes].slice(0, 4), t, 12, 12);
  }, [positions, battle, selected, myDriver, leaderCode, t]);
  const drsCodes = useMemo(
    () => tower.filter((r) => r.status === "DRS").map((r) => r.driver.code),
    [tower]
  );
  const gapLabels = useMemo(() => {
    const out: Record<string, string> = {};
    if (!battle) return out;
    for (const r of tower) {
      if ((r.driver.code === battle.a || r.driver.code === battle.b) && r.gap && r.gap !== "LEADER") {
        out[r.driver.code] = r.gap;
      }
    }
    return out;
  }, [tower, battle]);
  const pulses = useMemo(
    () => (positions ? moversAt(positions, t) : null),
    [positions, t]
  );

  const driveOfDay = useMemo(() => {
    if (tower.length === 0) return null;
    const cands = tower.filter((r) => (r.trend ?? 0) > 0);
    if (cands.length === 0) return null;
    return cands.sort((a, b) => (b.trend as number) - (a.trend as number))[0];
  }, [tower]);

  const myRow = useMemo(
    () => (myDriver ? tower.find((r) => r.driver.code === myDriver) ?? null : null),
    [tower, myDriver]
  );

  const missed = useMemo(() => {
    if (!bundle) return [];
    const pool = myDriver ? bundle.moments.filter((m) => m.drivers.includes(myDriver)) : bundle.moments;
    return pool
      .filter((m) => m.confidence !== "low" && m.t <= t)
      .sort((a, b) => b.t - a.t)
      .slice(0, 6);
  }, [bundle, myDriver, t]);

  const dismissOnboard = useCallback(() => {
    try { window.localStorage.setItem("pitwall-easy-onboard", "1"); } catch { /* private mode */ }
    setOnboarded(true);
  }, []);

  const pickDriver = useCallback((code: string | null) => {
    setMyDriver(code);
    if (code) {
      setSelected(code);
      setSel({ drivers: code ? [code] : [] });
    }
  }, [setSel]);

  if (!bundle) {
    return (
      <main className="mx-auto w-full max-w-5xl px-4 sm:px-6 py-10">
        <StateCard kind="loading" title="Loading replay" text={`Fetching ${raceId}…`} progress={64} />
      </main>
    );
  }
  if (bundle.status !== "ready" || !meta || !positions) {
    return (
      <main className="mx-auto w-full max-w-5xl px-4 sm:px-6 py-10">
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
    <main className="mx-auto w-full max-w-5xl px-4 sm:px-6 pb-24 pt-5 sm:pb-12">
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
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <button
            className="btn btn-primary px-5 text-sm"
            onClick={() => (playing ? pause() : play())}
            aria-pressed={playing}
          >
            {playing ? "Pause" : "Play"}
          </button>
          {SPEEDS.map((s) => (
            <button
              key={s}
              className={`touch rounded-lg border px-3 text-sm ${speed === s ? "border-[var(--accent)] text-[var(--accent)]" : "border-[var(--border-strong)] bg-[var(--panel)]"}`}
              onClick={() => set({ speed: s })}
              aria-pressed={speed === s}
              aria-label={`Play at ${s} times speed`}
            >
              {s}x
            </button>
          ))}
          <span className="tnum mx-1 hidden text-[var(--faint)] sm:inline">·</span>
          <button
            className="touch rounded-lg border border-[var(--border-strong)] bg-[var(--panel)] px-3 text-sm"
            onClick={() => stepLap(-1)}
            aria-label="Go back one lap"
          >
            −1 lap
          </button>
          <button
            className="touch rounded-lg border border-[var(--border-strong)] bg-[var(--panel)] px-3 text-sm"
            onClick={() => stepLap(1)}
            aria-label="Go forward one lap"
          >
            +1 lap
          </button>
        </div>
      </div>

      {/* First-run coach — 3 steps, dismisses to localStorage. */}
      {!onboarded && (
        <section aria-label="New to F1? Start here" className="card mt-6 p-5 sm:p-6">
          <p className="panel-label">New to F1? · 30-second start</p>
          <ol className="mt-3 grid gap-3 text-[15px] leading-relaxed sm:grid-cols-3">
            <li className="rounded-lg border border-[var(--border)] bg-[var(--raised)]/40 p-4">
              <p className="tnum text-xs font-bold text-[var(--accent)]">1 · TAP A MOMENT</p>
              <p className="mt-1">{lang === "hi" ? "Neeche story par tap karo — hum batayenge hua kya aur kyun." : "Tap any story below — we explain what happened and why."}</p>
            </li>
            <li className="rounded-lg border border-[var(--border)] bg-[var(--raised)]/40 p-4">
              <p className="tnum text-xs font-bold text-[var(--accent)]">2 · GAP UNDER 1S</p>
              <p className="mt-1">{lang === "hi" ? "Gap 1 second se kam matlab battle — DRS se pass ho sakta hai." : "A gap under 1 second means a battle — a DRS pass may be coming."}</p>
            </li>
            <li className="rounded-lg border border-[var(--border)] bg-[var(--raised)]/40 p-4">
              <p className="tnum text-xs font-bold text-[var(--accent)]">3 · TYRES MATTER</p>
              <p className="mt-1">{lang === "hi" ? "Fresh tyres tez hote hain. Green bar = fresh, red = worn." : "Fresh tyres are fast. Green bar = fresh, red = worn out."}</p>
            </li>
          </ol>
          <button className="btn btn-secondary mt-4 px-5 text-sm" onClick={dismissOnboard}>
            {lang === "hi" ? "Samajh gaya — race dekho" : "Got it — show me the race"}
          </button>
        </section>
      )}

      {/* Follow my driver */}
      <section aria-label="Follow a driver" className="mt-6">
        <p className="panel-label">Follow my driver</p>
        <div className="mt-2 flex gap-2 overflow-x-auto pb-1" role="listbox" aria-label="Pick a driver to follow">
          <button
            role="option"
            aria-selected={myDriver === null}
            onClick={() => pickDriver(null)}
            className={`touch shrink-0 rounded-full border px-4 text-sm font-semibold ${myDriver === null ? "border-[var(--accent)] text-[var(--accent)]" : "border-[var(--border-strong)] text-[var(--muted)]"}`}
          >
            Whole race
          </button>
          {tower.map((r) => (
            <button
              key={r.driver.code}
              role="option"
              aria-selected={myDriver === r.driver.code}
              onClick={() => pickDriver(myDriver === r.driver.code ? null : r.driver.code)}
              className={`touch flex shrink-0 items-center gap-2 rounded-full border px-4 text-sm font-semibold ${myDriver === r.driver.code ? "border-[var(--accent)] text-[var(--accent)]" : "border-[var(--border-strong)] text-[var(--muted)]"}`}
            >
              <span aria-hidden className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: r.driver.teamColour }} />
              {r.driver.code}
              <span className="tnum text-xs font-normal">P{r.pos}</span>
            </button>
          ))}
        </div>
        {myDriver && (
          <p className="mt-1 text-sm text-[var(--muted)]">
            Showing {myDriver}&apos;s story{missed.length > 0 ? ` · ${missed.length} moment${missed.length === 1 ? "" : "s"} so far` : ""} ·{" "}
            <button className="touch underline" onClick={() => pickDriver(null)}>clear</button>
          </p>
        )}
      </section>

      {/* Happening now + AI card */}
      <section id="now" ref={aiRef} aria-label="What's happening right now" className="mt-6 scroll-mt-20">
        <div className="flex flex-wrap items-center gap-2">
          <p className="panel-label">What&apos;s happening right now</p>
          {active && activeIndex >= 0 && (
            <p className="tnum ml-auto text-[11px] tracking-widest text-[var(--muted)]">
              MOMENT {activeIndex + 1} OF {storyMoments.length}
            </p>
          )}
        </div>
        {/* Story stepper */}
        {storyMoments.length > 0 && (
          <div className="mt-2 flex items-center gap-2">
            <button
              className="touch rounded-lg border border-[var(--border-strong)] bg-[var(--panel)] px-4 text-sm font-semibold"
              onClick={() => stepMoment(-1)}
              disabled={activeIndex <= 0}
              aria-label="Previous moment"
            >
              ← Prev
            </button>
            <button
              className="touch rounded-lg border border-[var(--border-strong)] bg-[var(--panel)] px-4 text-sm font-semibold"
              onClick={() => stepMoment(1)}
              disabled={activeIndex < 0 || activeIndex >= storyMoments.length - 1}
              aria-label="Next moment"
            >
              Next →
            </button>
            <button
              className={`touch ml-auto rounded-full border px-4 text-xs font-bold tracking-widest ${followRace ? "border-[var(--accent)] text-[var(--accent)]" : "border-[var(--border-strong)] text-[var(--muted)]"}`}
              onClick={() => setFollowRace((f) => !f)}
              aria-pressed={followRace}
              title="When on, the story card tracks the replay as it plays"
            >
              {followRace ? "● FOLLOWING RACE" : "○ FOLLOW OFF"}
            </button>
          </div>
        )}
        {active ? (
          <div className="mt-2">
            <AiCard
              headline={active.headline}
              text={active.explain.easy.en}
              hinglish={active.explain.easy.hi}
              evidence={active.evidence}
              footer={`Based on laps ${Math.max(1, active.lap - 3)} to ${active.lap}. Brake is an on/off signal, so braking distances are approximate.`}
              lang={lang}
            />
            {newWords.length > 0 && (
              <p className="mt-2 text-sm text-[var(--muted)]">
                New words in this story:{" "}
                {newWords.map((g, i) => (
                  <span key={g.term}>
                    {i > 0 && " · "}
                    <button
                      className="touch font-semibold text-[var(--accent)] underline"
                      onClick={() => { setTerm(g.term); scrollTo(learnRef.current); }}
                    >
                      {g.term}
                    </button>
                  </span>
                ))}
              </p>
            )}
            {battle && (
              <>
                <dl className="tnum mt-4 grid grid-cols-3 gap-3 text-center">
                  <div className="card p-4 text-center">
                    <dt className="text-[11px] tracking-widest text-[var(--muted)]">GAP NOW</dt>
                    <dd className="mt-1 text-xl font-bold">{battle.gapNow != null ? `${battle.gapNow.toFixed(1)} s` : "—"}</dd>
                    <dd className="mt-1.5 flex justify-center"><TrustBadge trust="MEASURED" /></dd>
                  </div>
                  <div className="card p-4 text-center">
                    <dt className="text-[11px] tracking-widest text-[var(--muted)]">CLOSING</dt>
                    <dd className="mt-1 text-xl font-bold">
                      {battle.rate != null && battle.rate > 0.02 ? `~${battle.rate.toFixed(1)} s/lap` : "holding"}
                    </dd>
                    <dd className="mt-1.5 flex justify-center"><TrustBadge trust="DERIVED" /></dd>
                  </div>
                  <div className="card p-4 text-center">
                    <dt className="text-[11px] tracking-widest text-[var(--muted)]">LIKELY PASS IN</dt>
                    <dd className="mt-1 text-xl font-bold">{battle.passIn != null ? `~${battle.passIn} laps` : "—"}</dd>
                    <dd className="mt-1.5 flex justify-center"><TrustBadge trust="ESTIMATE" /></dd>
                  </div>
                </dl>
                <p className="mt-1 text-xs text-[var(--muted)]">Pass prediction is an estimate, not a promise.</p>
              </>
            )}
            <div className="mt-3 flex flex-wrap gap-2">
              <Link
                className="btn btn-secondary border-[var(--accent)] px-5 text-sm font-bold text-[var(--accent)] hover:text-[var(--accent)]"
                href={`/ask?race=${raceId}&q=${encodeURIComponent(askQ)}`}
              >
                {battle ? "Why is he faster?" : "Why did this happen?"}
              </Link>
              <button
                className="btn btn-secondary px-5 text-sm"
                onClick={() => scrollTo(mapRef.current)}
              >
                Show me on the track
              </button>
              {active.links?.page && (
                <Link
                  className="btn btn-secondary px-5 text-sm"
                  href={`/race/${raceId}/${active.links.page}?${new URLSearchParams(Object.entries(active.links.params ?? {}).map(([k, v]) => [k, String(v)])).toString()}`}
                >
                  Open analysis →
                </Link>
              )}
            </div>
          </div>
        ) : (
          <StateCard kind="empty" title="No featured moment yet" text="Scrub forward — moments appear as the race unfolds." />
        )}
      </section>

      {/* Battle on track */}
      <section aria-label="The battle on track" className="mt-10" ref={mapRef}>
        <p className="panel-label">The battle on track · tap a car to follow it</p>
        <div className="mt-2">
          <TrackMap
            track={bundle.track}
            dots={dots}
            battle={battle ? [battle.a, battle.b].filter(Boolean) : []}
            leader={leaderCode}
            trails={trails}
            onSelect={toggleSelect}
            selected={selected}
            drsCodes={drsCodes}
            gapLabels={gapLabels}
            follow={follow}
            onFollow={setFollow}
            pulses={pulses}
            label={
              battle && battle.gapNow != null && battle.gapNow < DRS_GAP_S
                ? "Straight ahead: DRS zone — under a second, a pass may be coming. Dashed ring = DRS."
                : dots.length === 0
                  ? `Car positions on the map are available for ${(meta?.coverage.telemetryDrivers ?? []).join(", ") || "telemetry drivers"} in this replay.`
                  : `${dots.length} cars · battle pair highlighted · trails show the last 12 s · tap a car, FOLLOW to track it.`
            }
          />
        </div>
      </section>

      {/* Tower */}
      <section id="tower" aria-label="Who is where" className="mt-10 scroll-mt-20">
        <p className="panel-label">Running order · interval to the car ahead MEASURED · tap a row to find them on the map</p>
        <ol className="mt-3 overflow-hidden rounded-xl border border-[var(--border)]">
          {tower.map((r) => (
            <TimingRow
              key={r.driver.code}
              pos={r.pos as number}
              teamColour={r.driver.teamColour}
              code={r.driver.code}
              gap={r.gap}
              tyre={r.compound}
              age={r.age}
              health={r.health}
              trend={r.trend}
              status={r.status}
              onSelect={toggleSelect}
              selected={selected === r.driver.code || myDriver === r.driver.code}
            />
          ))}
        </ol>
        <p className="mt-2 text-sm text-[var(--muted)]">
          Tyre bars are an <span className="font-semibold text-[var(--text)]">estimate</span> from tyre age — green is fresh, red is nearly worn out. Gaps are measured from timing.
        </p>
      </section>

      {/* Your driver / Drive of the day */}
      {myRow ? (
        <section aria-label="Your driver" className="mt-10">
          <p className="panel-label">Your driver · {myRow.driver.code}</p>
          <div className="card mt-3 flex items-center gap-4 p-5">
            <span className="tnum text-3xl font-bold">P{myRow.pos}</span>
            <div className="min-w-0">
              <p className="truncate text-lg font-bold">{myRow.driver.name}</p>
              <p className="tnum text-sm text-[var(--muted)]">
                {myRow.gap ?? "—"}{myRow.compound ? ` · ${myRow.compound}${myRow.age != null ? ` · ${myRow.age} laps old` : ""}` : ""}
                {myRow.trend != null && myRow.trend !== 0 ? (myRow.trend > 0 ? ` · ▲${myRow.trend}` : ` · ▼${Math.abs(myRow.trend)}`) : ""}
              </p>
              <p className="mt-1 text-sm text-[var(--muted)]">
                {lang === "hi"
                  ? `${myRow.driver.grid != null ? `${myRow.driver.grid} se start, ` : ""}ab ${myRow.pos} par.`
                  : `${myRow.driver.grid != null ? `Started ${myRow.driver.grid}, ` : ""}now ${myRow.pos}.`}
              </p>
            </div>
            <button className="touch ml-auto shrink-0 text-sm text-[var(--muted)] underline" onClick={() => pickDriver(null)}>
              Unfollow
            </button>
          </div>
        </section>
      ) : driveOfDay ? (
        <section aria-label="Drive of the day so far" className="mt-10">
          <p className="panel-label">Drive of the day so far</p>
          <div className="card mt-3 flex items-center gap-4 p-5">
            <span className="tnum text-2xl font-bold text-[var(--good)]">+{driveOfDay.trend}</span>
            <div>
              <p className="text-lg font-bold">{driveOfDay.driver.name.split(" ").slice(-1)}</p>
              <p className="text-sm text-[var(--muted)]">
                {lang === "hi"
                  ? `${driveOfDay.driver.grid}th se start karke ab ${driveOfDay.pos} par.`
                  : `Started ${driveOfDay.driver.grid}, now ${driveOfDay.pos}. Fresh tyres doing the work.`}
              </p>
            </div>
            <button
              className="touch ml-auto shrink-0 rounded-full border border-[var(--border-strong)] px-4 text-sm font-semibold text-[var(--muted)]"
              onClick={() => pickDriver(driveOfDay.driver.code)}
            >
              Follow {driveOfDay.driver.code}
            </button>
          </div>
        </section>
      ) : null}

      {/* Learn */}
      <section id="learn" ref={learnRef} aria-label="Learn as you watch" className="mt-10 scroll-mt-20">
        <p className="panel-label">Learn as you watch</p>
        <div className="mt-4 flex flex-wrap gap-2">
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
        <p className="card mt-4 p-5">
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
      <section id="moments" aria-label="Moments you may have missed" className="mt-10 scroll-mt-20">
        <p className="panel-label">
          {myDriver ? `Moments you may have missed · ${myDriver}` : "Moments you may have missed"}
        </p>
        <ul className="mt-4 grid gap-3">
          {missed.map((m) => (
            <li key={m.id} className="card p-5">
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
            <li className="card p-5 text-[var(--muted)]">
              {myDriver ? `No ${myDriver} moments yet — scrub forward into the race.` : "Nothing yet — scrub forward into the race."}
            </li>
          )}
        </ul>
      </section>

      {/* Mobile bottom tab bar */}
      <nav aria-label="Easy sections" className="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--border)] bg-[var(--bar)] pb-[env(safe-area-inset-bottom)] sm:hidden">
        <div className="grid grid-cols-4">
          {[
            ["#now", "Now"],
            ["#tower", "Tower"],
            ["#moments", "Moments"],
            ["#learn", "Learn"],
          ].map(([href, label]) => (
            <a key={href} href={href} className="touch inline-flex min-h-[48px] items-center justify-center text-sm font-semibold text-[var(--muted)]">
              {label}
            </a>
          ))}
        </div>
      </nav>
    </main>
  );
}
