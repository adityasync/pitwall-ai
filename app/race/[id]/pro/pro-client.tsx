"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useReplayStore } from "@/stores/replayStore";
import { commitIntervalMs, indexAtT, lapAtT } from "@/lib/clock";
import { dotsAtT, moversAt, trailsAtT } from "@/lib/map";
import { SPEEDS } from "@/lib/config";
import { loadJson } from "@/lib/data";
import { loadRaceBundle, type RaceBundle } from "@/lib/race";
import { lapAtTime, statusStyle, trackStatusAtT, drsAtT, type RaceControlMsg } from "@/lib/timing";
import { PlaybackBar } from "@/components/PlaybackBar";
import { StateCard } from "@/components/StateCard";
import { TimingRow } from "@/components/TimingRow";
import { TrackMap, type MapDot } from "@/components/TrackMap";

/** Pro: the race, nothing else. Tower + map + playback.
 *  Analysis lives on its own pages (corners, battles, pace, onboard, compare)
 *  and AI lives on Easy/Ask — Pro stays a pure timing screen. */
export function ProClient({ raceId }: { raceId: string }) {
  // Granular subscriptions: the 10 Hz clock only re-renders what reads t.
  const t = useReplayStore((s) => s.t);
  const playing = useReplayStore((s) => s.playing);
  const speed = useReplayStore((s) => s.speed);
  const lap = useReplayStore((s) => s.lap);
  const set = useReplayStore((s) => s.set);
  const play = useReplayStore((s) => s.play);
  const pause = useReplayStore((s) => s.pause);
  const [bundle, setBundle] = useState<RaceBundle | null>(null);
  const [driver, setDriver] = useState<string | null>(null);
  const [follow, setFollow] = useState<string | null>(null);
  const [rc, setRc] = useState<RaceControlMsg[] | null>(null);

  useEffect(() => {
    let live = true;
    (async () => {
      const b = await loadRaceBundle(raceId);
      if (!live) return;
      setBundle(b);
      if (b.status === "ready" && b.meta && b.positions) {
        set({ raceId, t: 0, lap: 1, lapStarts: b.meta.lapStarts, playing: false });
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
    let committed = 0;
    const tick = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      const cur = useReplayStore.getState();
      const nt = Math.min(cur.t + dt * cur.speed, endT);
      // Commit the clock at most every commitIntervalMs: tower text, gaps and
      // dots all resolve to ≥1 s data, so 60 fps commits only burn renders.
      if (now - committed >= commitIntervalMs(cur.speed) || nt >= endT) {
        committed = now;
        cur.set({ t: nt, lap: lapAtT(meta.lapStarts, nt), playing: nt < endT });
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, meta, endT]);

  const scrub = useCallback((nt: number) => {
    const metaNow = useReplayStore.getState().lapStarts;
    useReplayStore.getState().set({ t: nt, lap: lapAtT(metaNow, nt) });
  }, []);

  const pickDriver = useCallback((code: string) => setDriver(code), []);
  const seekMoment = useCallback((id: string) => {
    const m = bundle?.moments.find((x) => x.id === id);
    if (m) scrub(m.t);
  }, [bundle, scrub]);

  const tower = useMemo(() => {
    if (!bundle || !positions || !meta) return [];
    const i = indexAtT(positions.t, t);
    if (i < 0) return [];
    const lapNow = lapAtT(meta.lapStarts, t);
    // Same 3 s window as the map pulses (moversAt) — tower flash and map
    // ring fire together for one overtake.
    const iPrev = indexAtT(positions.t, t - 3);
    return bundle.drivers
      .map((d) => {
        const s = positions.drivers[d.code];
        const pos = s ? s.pos[Math.min(i, s.pos.length - 1)] : null;
        const iv = bundle.intervals?.drivers[d.code];
        const ii = iv ? Math.min(indexAtT(iv.t, t), iv.gapAhead.length - 1) : -1;
        const ahead = iv && ii >= 0 ? (iv.gapAhead[ii] ?? null) : null;
        const rows = bundle.laps[d.code] ?? [];
        const lapRow = rows.find((r) => r.lap === lapNow) ?? [...rows].reverse().find((r) => r.lap <= lapNow);
        const onTrack = lapAtTime(rows, t);
        const status =
          onTrack?.pitLane ? ("PIT" as const)
          : ahead != null && ahead > 0 && ahead <= 1 ? ("DRS" as const)
          : null;
        return { driver: d, pos,
                 gap: pos === 1 ? "LEADER" : ahead == null ? null : `+${ahead.toFixed(1)}`,
                 compound: lapRow?.compound ?? null, age: lapRow?.tyreAge ?? null,
                 trend: d.grid != null && pos != null ? d.grid - pos : null,
                 status,
                 moved: iPrev >= 0 && s ? s.pos[Math.min(iPrev, s.pos.length - 1)] !== pos : false };
      })
      .filter((r) => r.pos != null)
      .sort((a, b) => (a.pos as number) - (b.pos as number));
  }, [bundle, positions, meta, t]);

  const dots: MapDot[] = useMemo(() => {
    if (!positions || !bundle) return [];
    return dotsAtT(positions, bundle.drivers, t);
  }, [positions, bundle, t]);
  const leaderCode = tower[0]?.driver.code ?? null;

  const trailCodes = useMemo(() => {
    const s = new Set<string>();
    if (driver) s.add(driver);
    if (leaderCode) s.add(leaderCode);
    return [...s];
  }, [driver, leaderCode]);
  const trails = useMemo(() => {
    if (!positions || trailCodes.length === 0) return null;
    const reduce = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return null;
    return trailsAtT(positions, trailCodes, t, 12, 12);
  }, [positions, trailCodes, t]);
  const drsOn = rc ? drsAtT(rc, t) : false;
  const drsCodes = useMemo(() => {
    if (!drsOn || !bundle?.intervals) return [];
    return tower
      .filter((r) => r.pos !== 1 && r.status === "DRS")
      .map((r) => r.driver.code);
  }, [drsOn, bundle, tower]);
  const gapLabels = useMemo(() => {
    const out: Record<string, string> = {};
    for (const r of tower) {
      if (r.driver.code === driver && r.gap && r.gap !== "LEADER") out[r.driver.code] = r.gap;
    }
    return out;
  }, [tower, driver]);
  const pulses = useMemo(
    () => (positions ? moversAt(positions, t) : null),
    [positions, t]
  );

  useEffect(() => {
    let live = true;
    (async () => {
      const r = await loadJson<RaceControlMsg[]>(`${raceId}/race_control.json`);
      if (live && r.status === "ready" && r.data) setRc(r.data);
    })();
    return () => {
      live = false;
    };
  }, [raceId]);

  const flag = rc ? trackStatusAtT(rc, t) : null;
  const flagLive = flag && flag.key !== "GREEN" && flag.key !== "PRE" ? flag : null;

  if (!bundle) {
    return (
      <main className="mx-auto w-full max-w-[1280px] px-4 sm:px-6 py-10">
        <StateCard kind="loading" title="Loading timing" text={`Fetching ${raceId}…`} progress={70} />
      </main>
    );
  }
  if (bundle.status !== "ready" || !meta || !positions) {
    return (
      <main className="mx-auto w-full max-w-[1280px] px-4 sm:px-6 py-10">
        <StateCard kind="error" title="Could not load this race" text="Build the race files first." />
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-[1440px] px-4 sm:px-6 pb-12 pt-5">
      <h1 className="sr-only">{meta.name} — Pro timing</h1>

      {/* Slim session strip: race, lap, flag. Nothing else. */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-[var(--border)] pb-3">
        <p className="tnum text-[11px] font-bold tracking-widest text-[var(--muted)]">
          {meta.name.toUpperCase()} · LAP {lap}/{meta.laps}
        </p>
        {flagLive && (
          <p className={`tnum rounded border px-2 py-1 text-[11px] font-bold tracking-widest ${statusStyle(flagLive.key)}`}>
            ⚑ {flagLive.label}
          </p>
        )}
        <div className="ml-auto flex items-center gap-2">
          <button className="touch rounded-full border border-[var(--border-strong)] px-4 text-sm font-bold"
            onClick={() => (playing ? pause() : play())} aria-pressed={playing}>
            {playing ? "Pause" : "Play"}
          </button>
          {SPEEDS.map((s) => (
            <button key={s} className="touch rounded-full px-2 text-sm text-[var(--muted)]"
              onClick={() => set({ speed: s })} aria-pressed={speed === s}
              aria-label={`Playback speed ${s}x`}>
              <span className={speed === s ? "font-bold text-white" : ""}>{s}x</span>
            </button>
          ))}
        </div>
      </div>

      <div className="mt-3">
        <PlaybackBar t={t} endT={endT} lap={lap} laps={meta.laps} moments={bundle.moments}
          onScrub={scrub} onMoment={seekMoment} />
      </div>

      <div className="mt-4 grid gap-5 lg:grid-cols-[290px_minmax(0,1fr)]">
        {/* Tower */}
        <section aria-label="Timing tower" className="nice-scroll lg:sticky lg:top-24 lg:max-h-[calc(100vh-8rem)] lg:self-start lg:overflow-y-auto">
          <ol className="overflow-hidden rounded-md border border-[var(--border)] bg-[var(--panel)]">
            {tower.map((r) => (
              <TimingRow key={r.driver.code}
                pos={r.pos as number} teamColour={r.driver.teamColour} code={r.driver.code}
                gap={r.gap} tyre={r.compound} age={r.age} trend={r.trend}
                status={r.status} dense
                flash={r.moved}
                selected={driver === r.driver.code}
                onSelect={pickDriver} />
            ))}
          </ol>
          <p className="tnum mt-2 text-[11px] text-[var(--faint)]">Intervals MEASURED · tap a row to follow</p>
        </section>

        {/* Map */}
        <section aria-label="Track map">
          <TrackMap track={bundle.track} dots={dots} height={480}
            battle={driver ? [driver] : []} leader={leaderCode}
            trails={trails} onSelect={pickDriver} selected={driver}
            drsCodes={drsCodes} gapLabels={gapLabels} follow={follow} onFollow={setFollow} pulses={pulses}
            label={`${dots.length} of ${bundle.drivers.length} cars · outline MEASURED · trails + DRS rings DERIVED.`} />
        </section>
      </div>
    </main>
  );
}
