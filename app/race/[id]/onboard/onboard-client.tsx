"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { fmtLapTime } from "@/lib/format";
import { loadJson } from "@/lib/data";
import { loadRaceBundle, type RaceBundle } from "@/lib/race";
import { StateCard } from "@/components/StateCard";
import { TrackMap } from "@/components/TrackMap";

type TeleLap = {
  dist: number[];
  speed: number[];
  throttle: number[];
  brake: number[];
  gear: number[];
  drs: number[];
  time?: number[];
};
type TeleFile = { lap: Record<string, TeleLap> };

const SPEEDS = [1, 2, 4, 8] as const;
/** at 1x a lap takes ~30 s — real-time laps are 90 s+ and nobody watches those */
const LAP_SECONDS_AT_1X = 30;

/** index of the sample at or before distance d (binary search) */
function idxAt(dist: number[], d: number): number {
  let lo = 0;
  let hi = dist.length - 1;
  if (d <= dist[0]) return 0;
  if (d >= dist[hi]) return hi;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (dist[mid] <= d) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

export function OnboardClient({ raceId }: { raceId: string }) {
  const search = useSearchParams();
  const [bundle, setBundle] = useState<RaceBundle | null>(null);
  const [file, setFile] = useState<TeleFile | null>(null);
  const [driver, setDriver] = useState<string>("");
  const [lapKey, setLapKey] = useState<string>("");
  const [dist, setDist] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<number>(2);
  const [status, setStatus] = useState<"loading" | "ready" | "empty" | "error">("loading");

  useEffect(() => {
    let live = true;
    (async () => {
      const b = await loadRaceBundle(raceId);
      if (!live) return;
      if (b.status !== "ready" || !b.meta) {
        setStatus("error");
        return;
      }
      setBundle(b);
      const covered: string[] = b.meta.coverage.telemetryDrivers ?? [];
      const want = (search.get("d") ?? "").toUpperCase();
      const code = covered.includes(want) ? want : (covered[0] ?? "");
      setDriver(code);
      setStatus(covered.length === 0 ? "empty" : "ready");
    })();
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [raceId]);

  useEffect(() => {
    if (!driver) return;
    let live = true;
    (async () => {
      const r = await loadJson<TeleFile>(`${raceId}/telemetry/${driver}.json`);
      if (!live) return;
      if (r.status !== "ready" || !r.data || Object.keys(r.data.lap).length === 0) {
        setFile(null);
        return;
      }
      setFile(r.data);
      const keys = Object.keys(r.data.lap).sort((a, b) => Number(a) - Number(b));
      const want = search.get("lap") ?? "";
      // honour ?lap= when valid, otherwise fall back to the driver's fastest
      if (keys.includes(want)) {
        setLapKey(want);
      } else {
        let bk = "";
        let bt = Infinity;
        for (const k of keys) {
          const Lk = r.data.lap[k];
          const tm = Lk.time;
          let v: number | null = tm && tm.length > 0 ? tm[tm.length - 1] : null;
          if (v == null && Lk.dist.length > 1) {
            v = 0;
            for (let i = 1; i < Lk.dist.length; i++) {
              const dd = Lk.dist[i] - Lk.dist[i - 1];
              v += dd / Math.max(8, (Lk.speed[i] + Lk.speed[i - 1]) / 2 / 3.6);
            }
          }
          if (v != null && v < bt) {
            bt = v;
            bk = k;
          }
        }
        setLapKey(bk || keys[keys.length - 1]);
      }
      setDist(0);
      setPlaying(false);
    })();
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [raceId, driver]);

  const lapKeys = useMemo(() => {
    if (!file) return [];
    return Object.keys(file.lap).sort((a, b) => Number(a) - Number(b));
  }, [file]);

  const lapTimes = useMemo(() => {
    if (!file) return { times: {} as Record<string, number | null>, est: {} as Record<string, boolean> };
    const times: Record<string, number | null> = {};
    const est: Record<string, boolean> = {};
    for (const k of lapKeys) {
      const L = file.lap[k];
      const tm = L.time;
      if (tm && tm.length > 0) {
        times[k] = tm[tm.length - 1];
      } else {
        // no clock channel in stored laps: integrate speed over distance (DERIVED)
        let s = 0;
        for (let i = 1; i < L.dist.length; i++) {
          const dd = L.dist[i] - L.dist[i - 1];
          const v = Math.max(8, (L.speed[i] + L.speed[i - 1]) / 2 / 3.6);
          s += dd / v;
        }
        times[k] = L.dist.length > 1 ? s : null;
        est[k] = true;
      }
    }
    return { times, est };
  }, [file, lapKeys]);

  const bestKey = useMemo(() => {
    let bk = "";
    let bt = Infinity;
    for (const k of lapKeys) {
      const v = lapTimes.times[k];
      if (v != null && v < bt) {
        bt = v;
        bk = k;
      }
    }
    return bk;
  }, [lapKeys, lapTimes]);

  // effective lap: explicit pick wins, otherwise the fastest stored lap
  const effLapKey = lapKey && lapKeys.includes(lapKey) ? lapKey : bestKey || lapKeys[lapKeys.length - 1] || "";

  const L = file && effLapKey ? (file.lap[effLapKey] ?? null) : null;
  const maxD = L && L.dist.length > 0 ? L.dist[L.dist.length - 1] : 1;
  const maxS = L ? Math.max(1, ...L.speed) : 1;
  const idx = L ? idxAt(L.dist, dist) : 0;

  const v = L ? L.speed[idx] ?? 0 : 0;
  const gear = L ? L.gear[idx] ?? 0 : 0;
  const thr = L ? (L.throttle[idx] ?? 0) : 0;
  const brk = L ? (L.brake[idx] ?? 0) : 0;
  const drs = L ? (L.drs[idx] ?? 0) === 1 : false;

  useEffect(() => {
    if (!playing || !L) return;
    let raf = 0;
    let last = performance.now();
    const step = (maxD / LAP_SECONDS_AT_1X) * speed;
    const tick = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      setDist((d) => {
        const nd = Math.min(d + dt * step, maxD);
        if (nd >= maxD) setPlaying(false);
        return nd;
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, L, maxD, speed]);

  /** track position: outline cumulative distance normalised to lap length */
  const outline = useMemo(() => {
    const pts = bundle?.track?.outline ?? [];
    if (pts.length === 0) return null;
    const cum: number[] = [0];
    for (let i = 1; i < pts.length; i++) {
      const dx = pts[i][0] - pts[i - 1][0];
      const dy = pts[i][1] - pts[i - 1][1];
      cum.push(cum[i - 1] + Math.hypot(dx, dy));
    }
    return { pts, cum, total: cum[cum.length - 1] || 1 };
  }, [bundle]);

  const car = useMemo(() => {
    if (!outline || !L) return null;
    const target = (dist / maxD) * outline.total;
    const { pts, cum } = outline;
    let lo = 0;
    let hi = cum.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (cum[mid] <= target) lo = mid;
      else hi = mid - 1;
    }
    const j = Math.min(lo, pts.length - 2);
    const span = cum[j + 1] - cum[j] || 1;
    const f = Math.min(1, Math.max(0, (target - cum[j]) / span));
    return {
      x: pts[j][0] + (pts[j + 1][0] - pts[j][0]) * f,
      y: pts[j][1] + (pts[j + 1][1] - pts[j][1]) * f,
    };
  }, [outline, L, dist, maxD]);

  const trail = useMemo(() => {
    if (!outline || !L || !driver) return null;
    const { pts, cum } = outline;
    const ptsOut: { x: number; y: number }[] = [];
    for (let k = 11; k >= 0; k--) {
      const dd = dist - k * (maxD * 0.008);
      if (dd < 0) continue;
      const target = (dd / maxD) * outline.total;
      let lo = 0;
      let hi = cum.length - 1;
      while (lo < hi) {
        const mid = (lo + hi + 1) >> 1;
        if (cum[mid] <= target) lo = mid;
        else hi = mid - 1;
      }
      const j = Math.min(lo, pts.length - 2);
      const span = cum[j + 1] - cum[j] || 1;
      const f = Math.min(1, Math.max(0, (target - cum[j]) / span));
      ptsOut.push({ x: pts[j][0] + (pts[j + 1][0] - pts[j][0]) * f, y: pts[j][1] + (pts[j + 1][1] - pts[j][1]) * f });
    }
    return ptsOut.length >= 2 ? { [driver]: ptsOut } : null;
  }, [outline, L, dist, maxD, driver]);

  const traces = useMemo(() => {
    if (!L) return null;
    const W = 760;
    const H = 190;
    const PADL = 40;
    const PADR = 8;
    // lanes: speed 0..86, throttle 92..128, brake 134..170, gear labels
    const X = (d: number) => PADL + (d / maxD) * (W - PADL - PADR);
    const path = (ys: number[], y0: number, h: number, max: number) =>
      ys.map((y, i) => `${i === 0 ? "M" : "L"}${X(L.dist[i]).toFixed(1)},${(y0 + h - (y / max) * h).toFixed(1)}`).join(" ");
    return {
      W, H, X,
      speed: path(L.speed, 0, 86, maxS),
      throttle: path(L.throttle, 92, 36, 100),
      brake: path(L.brake.map((b) => (b > 0.5 ? 100 : 0)), 134, 36, 100),
      gears: L.gear,
    };
  }, [L, maxD, maxS]);

  const corners = useMemo(() => {
    const cs = bundle?.track?.corners ?? [];
    return cs.filter((c) => c.dist <= maxD).sort((a, b) => a.dist - b.dist);
  }, [bundle, maxD]);

  const meta = bundle?.meta;
  const dmeta = bundle?.drivers.find((d) => d.code === driver);
  const covered: string[] = meta?.coverage.telemetryDrivers ?? [];
  const thisTime = effLapKey ? (lapTimes.times[effLapKey] ?? null) : null;
  const thisEst = effLapKey ? !!lapTimes.est[effLapKey] : false;
  const bestTime = bestKey ? (lapTimes.times[bestKey] ?? null) : null;

  if (status === "loading" || !bundle) {
    return (
      <main className="mx-auto w-full max-w-5xl px-4 sm:px-6 py-10">
        <StateCard kind="loading" title="Loading onboard" text="Warming up telemetry…" progress={60} />
      </main>
    );
  }
  if (status === "error" || !meta) {
    return (
      <main className="mx-auto w-full max-w-5xl px-4 sm:px-6 py-10">
        <StateCard kind="error" title="Could not load this race" text="Build the race files first." />
      </main>
    );
  }
  if (status === "empty" || covered.length === 0) {
    return (
      <main className="mx-auto w-full max-w-5xl px-4 sm:px-6 py-10">
        <StateCard kind="empty" title="No onboard telemetry" text="This replay has no stored telemetry laps." />
      </main>
    );
  }

  const xOf = traces ? traces.X(dist) : 0;

  return (
    <main className="mx-auto w-full max-w-[1280px] px-4 sm:px-6 pb-12 pt-5">
      <Link href={`/race/${raceId}/pro`} className="touch inline-flex items-center text-sm text-[var(--accent)]">
        ← Back to timing
      </Link>
      <div className="mt-2 flex flex-wrap items-end gap-x-5 gap-y-2">
        <h1 className="display text-4xl font-bold tracking-tight sm:text-5xl">
          <span style={{ color: dmeta?.teamColour ?? "#fff" }}>{driver || "—"}</span>
          <span className="text-[var(--muted)]"> onboard</span>
        </h1>
        <p className="tnum pb-1.5 text-sm text-[var(--muted)]">
          LAP {effLapKey || "—"}
          {thisTime != null && <> · {thisEst ? "≈" : ""}{fmtLapTime(thisTime)}</>}
          {effLapKey === bestKey && effLapKey !== "" && (
            <span className="ml-2 font-bold" style={{ color: "var(--fastest)" }}>FASTEST STORED</span>
          )}
          {thisTime != null && bestTime != null && effLapKey !== bestKey && (
            <span className="ml-2">+{(thisTime - bestTime).toFixed(3)}</span>
          )}
        </p>
      </div>

      <div className="mt-4 flex flex-wrap gap-1.5" role="group" aria-label="Driver">
        {covered.map((c) => (
          <button
            key={c}
            onClick={() => { setDriver(c); setLapKey(""); setDist(0); setPlaying(false); }}
            aria-pressed={driver === c}
            className={`touch rounded-lg border px-3 text-sm font-bold ${driver === c ? "border-[var(--accent-deep)] bg-[var(--accent-deep)] text-white" : "border-[var(--border-strong)] text-[var(--muted)] hover:text-[var(--text)]"}`}
          >
            {c}
          </button>
        ))}
      </div>
      {lapKeys.length > 0 && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5" role="group" aria-label="Lap">
          <span className="panel-label mr-1">Lap</span>
          {lapKeys.map((k) => (
            <button
              key={k}
              onClick={() => { setLapKey(k); setDist(0); setPlaying(false); }}
              aria-pressed={effLapKey === k}
              className={`touch min-w-[44px] rounded-lg border px-2 text-xs font-bold ${effLapKey === k ? "border-[var(--accent-deep)] text-[var(--accent)]" : "border-[var(--border)] text-[var(--muted)] hover:text-[var(--text)]"}`}
            >
              {k}
            </button>
          ))}
        </div>
      )}

      <div className="mt-5 grid gap-4 xl:grid-cols-[1fr_380px]">
        {/* track + play */}
        <div className="card overflow-hidden">
          <div className="flex items-center justify-between gap-3 border-b border-[var(--border)] px-4 py-2.5 sm:px-5">
            <div className="flex items-center gap-2">
              <button
                onClick={() => { if (dist >= maxD) setDist(0); setPlaying((p) => !p); }}
                className="btn btn-primary px-6 text-sm"
                aria-label={playing ? "Pause onboard lap" : "Play onboard lap"}
              >
                {playing ? "Pause" : "▶ Play lap"}
              </button>
              <div className="flex gap-1" role="group" aria-label="Replay speed">
                {SPEEDS.map((s) => (
                  <button
                    key={s}
                    onClick={() => setSpeed(s)}
                    aria-pressed={speed === s}
                    className={`touch rounded-lg border px-2.5 text-xs font-bold ${speed === s ? "border-[var(--accent-deep)] text-[var(--accent)]" : "border-[var(--border)] text-[var(--muted)]"}`}
                  >
                    {s}×
                  </button>
                ))}
              </div>
            </div>
            {drs && (
              <span className="tnum rounded-md border border-[var(--accent)]/60 bg-[var(--accent-dim)] px-2 py-1 text-xs font-bold tracking-widest text-[var(--accent)]">
                DRS OPEN
              </span>
            )}
          </div>
          <div className="p-3 sm:p-4">
            <TrackMap
              track={bundle.track}
              dots={car && driver ? [{ code: driver, x: car.x, y: car.y, colour: dmeta?.teamColour ?? "#fff" }] : []}
              height={340}
              trails={trail}
              selected={driver || null}
              label={driver ? `${driver} onboard · trail shows the last ~10% of the lap · MEASURED telemetry synced to the map.` : undefined}
            />
            <input
              type="range"
              min={0}
              max={maxD}
              step={maxD / 400}
              value={dist}
              onChange={(e) => setDist(Number(e.target.value))}
              aria-label="Scrub onboard lap"
              className="mt-2 w-full"
              style={{ ["--fill" as string]: `${(dist / maxD) * 100}%` }}
            />
          </div>
          {/* readouts */}
          <div className="tnum grid grid-cols-4 divide-x divide-[var(--border)] border-t border-[var(--border)] text-center">
            <div className="px-2 py-3">
              <p className="text-[10px] tracking-widest text-[var(--muted)]">KM/H</p>
              <p className="text-3xl font-bold sm:text-4xl">{Math.round(v)}</p>
            </div>
            <div className="px-2 py-3">
              <p className="text-[10px] tracking-widest text-[var(--muted)]">GEAR</p>
              <p className="text-3xl font-bold sm:text-4xl">{gear}</p>
            </div>
            <div className="px-2 py-3">
              <p className="text-[10px] tracking-widest text-[var(--muted)]">THROTTLE</p>
              <p className="text-3xl font-bold sm:text-4xl" style={{ color: "var(--good)" }}>{Math.round(thr)}<span className="text-base">%</span></p>
            </div>
            <div className="px-2 py-3">
              <p className="text-[10px] tracking-widest text-[var(--muted)]">BRAKE</p>
              <p className="text-3xl font-bold sm:text-4xl" style={{ color: brk > 0.5 ? "var(--bad)" : "var(--faint)" }}>
                {brk > 0.5 ? "ON" : "—"}
              </p>
            </div>
          </div>
        </div>

        {/* traces */}
        <div className="card p-4 sm:p-5">
          <p className="panel-label mb-2">Speed · throttle · brake · gear MEASURED</p>
          {traces && L ? (
            <svg
              viewBox={`0 0 ${traces.W} ${traces.H}`}
              style={{ width: "100%", height: 300 }}
              role="img"
              aria-label={`Telemetry traces for ${driver} lap ${effLapKey}`}
            >
              <text x={2} y={12} fontSize={10} fill="var(--muted)" fontFamily="JetBrains Mono, monospace">KM/H</text>
              <text x={2} y={104} fontSize={10} fill="var(--muted)" fontFamily="JetBrains Mono, monospace">THR</text>
              <text x={2} y={146} fontSize={10} fill="var(--muted)" fontFamily="JetBrains Mono, monospace">BRK</text>
              {[0, 86, 92, 128, 134, 170].map((y) => (
                <line key={y} x1={40} x2={traces.W - 8} y1={y} y2={y} stroke="var(--border)" strokeWidth={1} />
              ))}
              <path d={`${traces.speed} L${traces.X(maxD).toFixed(1)},86 L${traces.X(0).toFixed(1)},86 Z`} fill={dmeta?.teamColour ?? "#fff"} opacity={0.15} />
              <path d={traces.speed} fill="none" stroke={dmeta?.teamColour ?? "#fff"} strokeWidth={2} />
              <path d={traces.throttle} fill="none" stroke="var(--good)" strokeWidth={1.5} />
              <path d={`${traces.brake} L${traces.X(maxD).toFixed(1)},170 L${traces.X(0).toFixed(1)},170 Z`} fill="var(--bad)" opacity={0.7} />
              {corners.map((c) => (
                <g key={c.n}>
                  <line x1={traces.X(c.dist)} x2={traces.X(c.dist)} y1={0} y2={170} stroke="var(--border-strong)" strokeWidth={1} strokeDasharray="2 3" />
                  <text x={traces.X(c.dist)} y={184} fontSize={10} fill="var(--muted)" textAnchor="middle" fontFamily="JetBrains Mono, monospace">
                    {c.n}
                  </text>
                </g>
              ))}
              <line x1={xOf} x2={xOf} y1={0} y2={170} stroke="var(--accent)" strokeWidth={1.5} />
              <circle cx={xOf} cy={86 - (v / maxS) * 86} r={4} fill="var(--accent)" />
            </svg>
          ) : (
            <p className="text-sm text-[var(--muted)]">Pick a lap to load its traces.</p>
          )}
          <p className="tnum mt-2 text-[11px] leading-relaxed text-[var(--faint)]">
            Numbers = turn numbers at their track distance. Brake is an on/off
            signal — red blocks, not pressure. Lap times marked ≈ are integrated
            from speed (DERIVED), not clocked. Gear {gear} · {Math.round((dist / maxD) * 100)}% of lap.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link href={`/race/${raceId}/compare?d=${driver}`} className="btn btn-secondary px-4 text-sm">
              Compare traces →
            </Link>
            <Link href={`/race/${raceId}/corners`} className="touch inline-flex items-center px-2 text-sm text-[var(--muted)] underline">
              Corner analysis
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
