"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useReplayStore } from "@/stores/replayStore";
import { useSelectionStore } from "@/stores/selectionStore";
import { useUiStore } from "@/stores/uiStore";
import { indexAtT, lapAtT } from "@/lib/clock";
import { dotsAtT, trailsAtT } from "@/lib/map";
import { fmtLapTime } from "@/lib/format";
import { SPEEDS } from "@/lib/config";
import { loadJson } from "@/lib/data";
import { loadRaceBundle, type RaceBundle } from "@/lib/race";
import { lapAtTime, lastCompletedLap, sectorBests, statusStyle, trackStatusAtT, drsAtT, type RaceControlMsg } from "@/lib/timing";
import type { Moment } from "@/lib/types";
import { AiCard } from "@/components/AiCard";
import { PlaybackBar } from "@/components/PlaybackBar";
import { StateCard } from "@/components/StateCard";
import { TimingRow } from "@/components/TimingRow";
import { SectorCells } from "@/components/SectorCells";
import { LapChart } from "@/components/LapChart";
import { GapChart } from "@/components/GapChart";
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
  const [follow, setFollow] = useState<string | null>(null);
  const [whyId, setWhyId] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>("ALL");
  const [rc, setRc] = useState<RaceControlMsg[] | null>(null);

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
    const iPrev = indexAtT(positions.t, t - 30);
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
        const lastLap = lastCompletedLap(rows, t);
        const status =
          onTrack?.pitLane ? ("PIT" as const)
          : ahead != null && ahead > 0 && ahead <= 1 ? ("DRS" as const)
          : null;
        return { driver: d, pos,
                 gap: pos === 1 ? "LEADER" : ahead == null ? null : `+${ahead.toFixed(1)}`,
                 compound: lapRow?.compound ?? null, age: lapRow?.tyreAge ?? null,
                 trend: d.grid != null && pos != null ? d.grid - pos : null,
                 lastLap, status,
                 moved: iPrev >= 0 && s ? s.pos[Math.min(iPrev, s.pos.length - 1)] !== pos : false };
      })
      .filter((r) => r.pos != null)
      .sort((a, b) => (a.pos as number) - (b.pos as number));
  }, [bundle, positions, meta, t]);

  const bests = useMemo(() => (bundle ? sectorBests(bundle.laps) : null), [bundle]);

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

  const finishOrder = useMemo(
    () => [...(bundle?.drivers ?? [])].sort((a, c) => (a.finish ?? 99) - (c.finish ?? 99)).map((d) => d.code),
    [bundle]
  );
  const colours = useMemo(
    () => Object.fromEntries((bundle?.drivers ?? []).map((d) => [d.code, d.teamColour])),
    [bundle]
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

  const wx = useMemo(() => {
    const w = bundle?.weather;
    if (!w || w.t.length === 0) return null;
    const i = Math.max(0, indexAtT(w.t, t));
    const air = w.air[i];
    const track = w.track[i];
    return {
      air: typeof air === "number" ? air.toFixed(0) : "—",
      track: typeof track === "number" ? track.toFixed(0) : "—",
    };
  }, [bundle, t]);

  if (!bundle) {
    return (
      <main className="mx-auto w-full max-w-[1280px] px-4 sm:px-6 py-10">
        <StateCard kind="loading" title="Loading workstation" text={`Fetching ${raceId}…`} progress={70} />
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

  const sel = tower.find((r) => r.driver.code === driver) ?? tower[0];
  const pace = sel && bundle.stats ? bundle.stats.pace[sel.driver.code] : null;

  return (
    <main className="mx-auto w-full max-w-[1440px] px-4 sm:px-6 pb-12 pt-5">
      <h1 className="sr-only">{meta.name} — Pro workstation</h1>

      <div className="flex flex-wrap items-end gap-x-6 gap-y-3 border-b-2 border-[var(--accent-deep)] pb-4">
        <div className="flex items-center gap-3">
          <span className="slash" aria-hidden />
          <div>
            <p className="tnum text-[11px] font-bold tracking-widest text-[var(--muted)]">{meta.name.toUpperCase()} · {meta.circuit.toUpperCase()}</p>
            <p className="tnum mt-1 leading-none">
              <span className="display text-6xl font-bold">LAP {lap}</span>
              <span className="text-2xl text-[var(--faint)]">/{meta.laps}</span>
            </p>
          </div>
        </div>
        <div className="ml-auto flex items-center gap-3 pb-1">
          {wx && (
            <p className="tnum text-xs text-[var(--muted)]" title="Air and track temperature (MEASURED)">
              AIR {wx.air}° · TRACK {wx.track}°
            </p>
          )}
          {flagLive && (
            <p className={`tnum rounded border px-2.5 py-1.5 text-xs font-bold tracking-widest ${statusStyle(flagLive.key)}`}>
              ⚑ {flagLive.label}
            </p>
          )}
        </div>
      </div>

      <div className="mt-4">
        <PlaybackBar t={t} endT={endT} lap={lap} laps={meta.laps} moments={bundle.moments}
          onScrub={scrub} onMoment={(id) => { const m = bundle.moments.find((x) => x.id === id); if (m) openMoment(m); }} />
        <div className="mt-2 flex gap-2">
          <button className="btn btn-primary px-5 text-sm"
            onClick={() => (playing ? pause() : play())}>
            {playing ? "Pause" : "Play"}
          </button>
          {SPEEDS.map((s) => (
            <button key={s} className="touch rounded-lg border border-[var(--border-strong)] bg-[var(--panel)] px-3 text-sm"
              onClick={() => set({ speed: s })} aria-pressed={speed === s}>
              {s}x
            </button>
          ))}
        </div>
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-[290px_minmax(0,1fr)_360px]">
        {/* Tower */}
        <section aria-label="Timing tower" className="lg:sticky lg:top-36 lg:max-h-[calc(100vh-10rem)] lg:self-start lg:overflow-y-auto">
          <p className="panel-label mb-2">Timing · interval MEASURED · sectors purple/green</p>
          <ol className="overflow-hidden rounded-md border border-[var(--border)] bg-[var(--panel)]">
            {tower.map((r) => (
              <TimingRow key={r.driver.code}
                pos={r.pos as number} teamColour={r.driver.teamColour} code={r.driver.code}
                gap={r.gap} tyre={r.compound} age={r.age} trend={r.trend}
                status={r.status} dense
                flash={r.moved}
                sectors={bests ? (
                  <SectorCells row={r.lastLap} personal={bests.personal[r.driver.code]} session={bests.session} />
                ) : undefined}
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
          {flagLive && (
            <p className={`tnum mb-2 rounded-lg border px-3 py-2 text-xs font-bold tracking-widest ${statusStyle(flagLive.key)}`}>
              ⚑ {flagLive.label} · LAP {lap}
            </p>
          )}
          <TrackMap track={bundle.track} dots={dots} height={380} showZones
            selectedCorner={corner} onCorner={setCorner} battle={driver ? [driver] : []} leader={leaderCode}
            trails={trails} onSelect={(c) => setDriver(c)} selected={driver}
            drsCodes={drsCodes} gapLabels={gapLabels} follow={follow} onFollow={setFollow}
            label={`${dots.length} of ${bundle.drivers.length} cars on map · S/F + arrow MEASURED outline · Trails + DRS rings DERIVED presentation · Tap a car to select, FOLLOW to track it.`} />
          {!bundle.track?.corners.length && (
            <p className="mt-2 text-sm text-[var(--muted)]">Corner catalogue is being derived for this race.</p>
          )}
          {cornerRows && (
            <div className="card mt-3 p-5">
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
                <Link href={`/race/${raceId}/corners`} className="btn btn-secondary px-5 text-sm">
                  Full corner analysis →
                </Link>
                <Link href={`/race/${raceId}/compare?d=${cornerRows.rows.map((r) => r.code).slice(0, 2).join(",")}`}
                  className="btn btn-primary px-5 text-sm">
                  Compare →
                </Link>
              </div>
            </div>
          )}
        </section>

        {/* Driver + AI feed */}
        <div className="flex flex-col gap-4">
          {sel && (
            <section aria-label="Selected driver" className="card p-5">
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
                <li key={m.id} className="card p-4">
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

      <section aria-label="Race charts" className="mt-6">
        <p className="panel-label mb-2">Race charts · positions + gaps, every lap DERIVED</p>
        <div className="grid gap-4 xl:grid-cols-2">
          <div className="card p-4 sm:p-5">
            <p className="panel-label mb-2">Lap chart · who ran where</p>
            {positions && (
              <LapChart
                positions={positions}
                lapStarts={meta.lapStarts}
                laps={meta.laps}
                order={finishOrder}
                colours={colours}
                lap={lap}
              />
            )}
          </div>
          <div className="card p-4 sm:p-5">
            <p className="panel-label mb-2">Gap to leader · top 4 finishers</p>
            {bundle.intervals && (
              <GapChart
                intervals={bundle.intervals}
                lapStarts={meta.lapStarts}
                laps={meta.laps}
                codes={finishOrder.slice(0, 4)}
                colours={colours}
                lap={lap}
              />
            )}
            <Link
              href={`/race/${raceId}/battles`}
              className="touch mt-2 inline-flex items-center text-sm font-semibold text-[var(--accent)]"
            >
              Battles and overtakes →
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
