"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useUiStore } from "@/stores/uiStore";
import { loadJson } from "@/lib/data";
import { StateCard } from "@/components/StateCard";
import { TraceChart, deltaSeries, type TraceLap } from "@/components/TraceChart";
import type { Driver, Meta, Track } from "@/lib/types";

type Channel = { dist: number[]; speed: number[]; throttle: number[]; brake: number[]; gear: number[]; drs: number[] };
type TeleFile = { lap: Record<string, Channel> };

const BRAKE_ON = 50;
const MAX_PARALLEL = 4;

type TelemetryStyle = { code: string; colour: string; dash?: string };

/** Team-mates share a team colour: give the second and third trace on the same
 *  colour a dash pattern so N overlaid drivers stay tellable apart (colour is
 *  never the only signal). */
function styleFor(active: string[], drivers: Driver[]): TelemetryStyle[] {
  const seen = new Map<string, number>();
  return active.map((code) => {
    const colour = drivers.find((d) => d.code === code)?.teamColour ?? "#d4d4dd";
    const n = seen.get(colour) ?? 0;
    seen.set(colour, n + 1);
    return { code, colour, dash: n === 0 ? undefined : n === 1 ? "7 4" : "2 3" };
  });
}

async function loadTelemetry(raceId: string, codes: string[]): Promise<Record<string, TeleFile>> {
  const got: Record<string, TeleFile> = {};
  let i = 0;
  const worker = async () => {
    while (i < codes.length) {
      const code = codes[i++];
      const r = await loadJson<TeleFile>(`${raceId}/telemetry/${code}.json`);
      if (r.status === "ready" && r.data && Object.keys(r.data.lap).length > 0) got[code] = r.data;
    }
  };
  await Promise.all(Array.from({ length: Math.min(MAX_PARALLEL, codes.length) }, worker));
  return got;
}

/** Nearest sample index for a distance, without allocating on every mouse move. */
function nearestIndex(dist: number[], target: number): number {
  let bi = 0;
  for (let i = 1; i < dist.length; i++) {
    if (Math.abs(dist[i] - target) < Math.abs(dist[bi] - target)) bi = i;
  }
  return bi;
}

export function ComparePage({ raceId }: { raceId: string }) {
  const search = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const { lang } = useUiStore();
  const [meta, setMeta] = useState<Meta | null>(null);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [track, setTrack] = useState<Track | null>(null);
  const [files, setFiles] = useState<Record<string, TeleFile>>({});
  const [failed, setFailed] = useState<string[]>([]);
  const [fetching, setFetching] = useState<string[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [cursor, setCursor] = useState<number | null>(null);
  const [showPro, setShowPro] = useState(false);
  const cacheRef = useRef<Record<string, TeleFile>>({});
  const runRef = useRef(0);

  // ?d=VER,LEC,ANT — any number of drivers, order preserved (first = delta reference).
  const requested = useMemo(() => {
    const raw = search.get("d") ?? "";
    const seen = new Set<string>();
    return raw
      .split(",")
      .map((s) => s.trim().toUpperCase())
      .filter((s) => s && !seen.has(s) && seen.add(s));
  }, [search]);

  useEffect(() => {
    let live = true;
    (async () => {
      const [m, dr, tr] = await Promise.all([
        loadJson<Meta>(`${raceId}/meta.json`),
        loadJson<Driver[]>(`${raceId}/drivers.json`),
        loadJson<Track>(`${raceId}/track.json`),
      ]);
      if (!live) return;
      if (m.status !== "ready" || !m.data) {
        setStatus("error");
        return;
      }
      setMeta(m.data);
      if (dr.status === "ready" && dr.data) setDrivers(dr.data);
      if (tr.status === "ready" && tr.data) setTrack(tr.data);
      setStatus("ready");
    })();
    return () => {
      live = false;
    };
  }, [raceId]);

  const covered = useMemo(() => meta?.coverage.telemetryDrivers ?? [], [meta]);
  const missing = useMemo(() => requested.filter((c) => !covered.includes(c)), [requested, covered]);

  // No ?d= -> open on the first two covered drivers. Explicit ?d= is respected
  // as-is, including a single driver while the user builds a comparison.
  const selection = useMemo(
    () => (requested.length === 0 ? covered.slice(0, 2) : requested.filter((c) => covered.includes(c))),
    [requested, covered]
  );

  useEffect(() => {
    if (status !== "ready") return;
    setFiles({ ...cacheRef.current });
    const needs = selection.filter((c) => !cacheRef.current[c]);
    if (needs.length === 0) {
      setFetching([]);
      return;
    }
    const run = ++runRef.current;
    setFetching(needs);
    loadTelemetry(raceId, needs).then((got) => {
      if (run !== runRef.current) return;
      Object.assign(cacheRef.current, got);
      setFiles({ ...cacheRef.current });
      setFailed(selection.filter((c) => !cacheRef.current[c]));
      setFetching([]);
    }).catch(() => {
      if (run !== runRef.current) return;
      setFailed(selection.filter((c) => !cacheRef.current[c]));
      setFetching([]);
    });
  }, [status, selection, raceId]);

  const active = useMemo(() => selection.filter((c) => files[c]), [selection, files]);
  const styles = useMemo(() => styleFor(active, drivers), [active, drivers]);

  const commonLaps = useMemo(() => {
    if (active.length === 0) return [];
    const sets = active.map((c) => new Set(Object.keys(files[c].lap)));
    return [...sets[0]]
      .filter((l) => sets.every((s) => s.has(l)))
      .sort((x, y) => Number(x) - Number(y));
  }, [active, files]);

  const lapParam = search.get("lap");
  const lap = lapParam && commonLaps.includes(lapParam) ? lapParam : commonLaps[commonLaps.length - 1] ?? null;

  const traces: TraceLap[] = useMemo(() => {
    if (!lap) return [];
    return active.map((code, i) => {
      const L = files[code].lap[lap];
      return {
        code,
        colour: styles[i].colour,
        dash: styles[i].dash,
        dist: L.dist,
        speed: L.speed,
        throttle: L.throttle,
        brake: L.brake,
        gear: L.gear,
      };
    });
  }, [files, active, lap, styles]);

  const deltas = useMemo(() => {
    if (traces.length < 2) return [];
    return traces.slice(1).map((tr) => ({
      code: tr.code,
      colour: tr.colour,
      dash: tr.dash,
      ...deltaSeries(traces[0], tr),
    }));
  }, [traces]);

  const atCursor = useMemo(() => {
    if (cursor == null || traces.length === 0) return null;
    return traces.map((tr, i) => {
      const bi = nearestIndex(tr.dist, cursor);
      let d: number | null = null;
      if (i > 0) {
        const ser = deltas[i - 1];
        d = ser.delta[nearestIndex(ser.dist, cursor)];
      }
      return {
        code: tr.code,
        colour: tr.colour,
        dash: tr.dash,
        speed: tr.speed[bi],
        gear: tr.gear?.[bi],
        brake: tr.brake?.[bi],
        delta: d,
      };
    });
  }, [cursor, traces, deltas]);

  const verdict = useMemo(() => {
    if (traces.length < 2 || deltas.length === 0 || !lap) return null;
    const ref = traces[0].code;
    const ends = [{ code: ref, end: 0 }, ...deltas.map((d) => ({ code: d.code, end: d.delta[d.delta.length - 1] ?? 0 }))];
    ends.sort((a, b) => a.end - b.end);
    const [lead, second] = ends;
    if (!second) return null;
    const by = Math.abs(second.end - lead.end);
    if (by < 0.005) {
      return {
        lead: lead.code,
        by: "0.00",
        en: `${lead.code} and ${second.code} end lap ${lap} level on comparable traces.`,
        hi: `Is lap mein ${lead.code} aur ${second.code} barabar rahe.`,
        pro: `Cumulative delta over lap ${lap} is flat between ${lead.code} and ${second.code}. Delta integrates speed over distance; brake is on/off so braking detail is approximate.`,
      };
    }
    return {
      lead: lead.code,
      by: by.toFixed(2),
      en: `${lead.code} ends lap ${lap} ahead of ${second.code} by ${by.toFixed(2)} s on comparable traces.`,
      hi: `Is lap mein ${lead.code} ${second.code} se ${by.toFixed(2)} second aage raha.`,
      pro: `Cumulative delta over lap ${lap}, ${ref} as reference: ${lead.code} +${by.toFixed(2)} s on ${second.code}. Delta integrates speed over distance; brake is on/off so braking detail is approximate.`,
    };
  }, [deltas, traces, lap]);

  const brakeRows = useMemo(() => {
    const maxD = Math.max(1, ...traces.map((t) => t.dist[t.dist.length - 1] ?? 0));
    return traces.map((tr) => {
      const runs: [number, number][] = [];
      const b = tr.brake;
      if (b) {
        let start: number | null = null;
        for (let i = 0; i < b.length; i++) {
          const on = b[i] >= BRAKE_ON;
          if (on && start == null) start = tr.dist[i];
          if (!on && start != null) {
            runs.push([start, tr.dist[i]]);
            start = null;
          }
        }
        if (start != null) runs.push([start, tr.dist[tr.dist.length - 1]]);
      }
      return { code: tr.code, colour: tr.colour, dash: tr.dash, runs, maxD };
    });
  }, [traces]);

  const deltaMax = useMemo(
    () => Math.max(0.05, ...deltas.flatMap((d) => d.delta.map((v) => Math.abs(v)))),
    [deltas]
  );
  const deltaMaxD = useMemo(
    () => Math.max(1, ...deltas.map((d) => d.dist[d.dist.length - 1] ?? 0)),
    [deltas]
  );
  const deltaPaths = useMemo(() => {
    const W = 800;
    const H = 140;
    const PADL = 44;
    const X = (d: number) => PADL + (d / deltaMaxD) * (W - PADL - 8);
    const Y = (v: number) => H / 2 - (v / deltaMax) * (H / 2 - 10);
    return deltas.map((d) => ({
      code: d.code,
      colour: d.colour,
      dash: d.dash,
      d: d.dist.map((x, i) => `${i === 0 ? "M" : "L"}${X(x).toFixed(1)},${Y(d.delta[i]).toFixed(1)}`).join(" "),
    }));
  }, [deltas, deltaMax, deltaMaxD]);

  const basePath = pathname ?? `/race/${raceId}/compare`;
  const toggle = (code: string) => {
    const next = selection.includes(code) ? selection.filter((c) => c !== code) : [...selection, code];
    const params = new URLSearchParams(search.toString());
    if (next.length > 0) params.set("d", next.join(","));
    else params.delete("d");
    const qs = params.toString();
    router.replace(qs ? `${basePath}?${qs}` : basePath, { scroll: false });
  };

  if (status === "loading") {
    return (
      <main className="mx-auto w-full max-w-5xl px-4 sm:px-6 py-10">
        <StateCard kind="loading" title="Loading traces" text="Fetching lap telemetry…" progress={70} />
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

  const ref = active[0] ?? null;
  const W = 800;
  const H = 140;
  const PADL = 44;
  const xAt = (d: number) => PADL + (d / deltaMaxD) * (W - PADL - 8);

  return (
    <main className="mx-auto w-full max-w-5xl px-4 sm:px-6 pb-12 pt-5">
      <Link href={`/race/${raceId}/easy`} className="touch inline-flex items-center text-sm text-[var(--accent)]">
        ← Back to race
      </Link>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <h1 className="display text-4xl font-bold">COMPARE</h1>
        <span className="tnum rounded border border-[var(--border-strong)] px-2 py-1 text-sm">LAP {lap ?? "—"}</span>
        <span className="display text-2xl font-bold">
          {active.length === 0
            ? "No traces"
            : active.length <= 4
              ? active.join(" · ")
              : `${active.length} DRIVERS`}
        </span>
      </div>

      <section aria-label="Drivers with telemetry" className="mt-4 card p-3">
        <p className="panel-label mb-2">
          Drivers · tap to overlay · {covered.length} with traces in this replay
        </p>
        <div className="flex flex-wrap gap-2">
          {covered.map((code) => {
            const on = selection.includes(code);
            const d = drivers.find((x) => x.code === code);
            return (
              <button
                key={code}
                type="button"
                aria-pressed={on}
                onClick={() => toggle(code)}
                title={d ? `${d.name} · ${d.team}` : code}
                className={`touch inline-flex items-center gap-2 rounded border px-3 text-sm font-bold ${
                  on
                    ? "border-[var(--accent)] bg-[var(--accent-dim)] text-[var(--foreground)]"
                    : "border-[var(--border-strong)] text-[var(--muted)]"
                }`}
              >
                <span
                  aria-hidden
                  className="inline-block h-2 w-2 rounded-full"
                  style={{ background: d?.teamColour ?? "#a8a8b3" }}
                />
                {code}
              </button>
            );
          })}
        </div>
        <p className="mt-2 text-xs text-[var(--muted)]">
          First pick is the delta reference. Tap again to remove. Brake is the measured on/off signal, not pressure.
        </p>
        {missing.length > 0 && (
          <p className="mt-1 text-xs text-[var(--bad)]">
            No telemetry file for {missing.join(", ")} in this replay.
          </p>
        )}
        {failed.length > 0 && (
          <p className="mt-1 text-xs text-[var(--bad)]">Could not load {failed.join(", ")}. Try again.</p>
        )}
        {fetching.length > 0 && (
          <p className="mt-1 text-xs text-[var(--muted)]">Loading {fetching.join(", ")}…</p>
        )}
      </section>

      {active.length === 0 ? (
        <div className="mt-4">
          <StateCard
            kind="empty"
            title="Pick two or more drivers"
            text={
              covered.length > 0
                ? `This replay has traces for ${covered.join(", ")}.`
                : "This replay has no lap telemetry."
            }
            action={
              covered.length > 0 ? (
                <button
                  type="button"
                  onClick={() => {
                    const params = new URLSearchParams(search.toString());
                    params.set("d", covered.slice(0, 2).join(","));
                    router.replace(`${basePath}?${params.toString()}`, { scroll: false });
                  }}
                  className="touch inline-flex items-center rounded-md bg-[var(--accent-deep)] px-5 font-semibold text-white"
                >
                  Use first two
                </button>
              ) : (
                <Link href={`/race/${raceId}/easy`} className="touch inline-flex items-center rounded-md bg-[var(--accent-deep)] px-5 font-semibold text-white">
                  Back to race
                </Link>
              )
            }
          />
        </div>
      ) : (
        <>
          <div className="tnum mt-3 flex flex-wrap gap-2 text-xs">
            <span className="panel-label w-full">Lap · common to every picked driver</span>
            {commonLaps.map((l) => (
              <Link
                key={l}
                href={`/race/${raceId}/compare?d=${active.join(",")}&lap=${l}`}
                className={`touch inline-flex items-center rounded border px-2.5 ${
                  l === lap
                    ? "border-[var(--accent)] text-[var(--accent)]"
                    : "border-[var(--border-strong)] text-[var(--muted)]"
                }`}
              >
                {l}
              </Link>
            ))}
          </div>

          <section aria-label="Speed traces" className="mt-4 card p-3">
            <p className="panel-label mb-1">Speed by distance · km/h · {traces.length} drivers</p>
            <div className="tnum mb-1 flex flex-wrap gap-x-4 gap-y-1 text-xs">
              {traces.map((tr) => (
                <span key={tr.code} className="inline-flex items-center gap-1.5" style={{ color: tr.colour }}>
                  <svg width="18" height="8" aria-hidden>
                    <line x1="0" y1="4" x2="18" y2="4" stroke="currentColor" strokeWidth="2" strokeDasharray={tr.dash} />
                  </svg>
                  {tr.code}
                  {tr.code === ref && <span className="text-[10px] uppercase text-[var(--muted)]">ref</span>}
                </span>
              ))}
            </div>
            <TraceChart laps={traces} cursor={cursor} onCursor={setCursor} />
          </section>

          <section aria-label="Brake traces" className="mt-3 card p-3">
            <p className="panel-label mb-2">Brake on/off by distance · MEASURED</p>
            <div className="space-y-1.5">
              {brakeRows.map((row) => (
                <div key={row.code} className="flex items-center gap-2">
                  <span className="w-10 shrink-0 text-[11px] font-bold" style={{ color: row.colour }}>
                    {row.code}
                  </span>
                  <div
                    className="relative h-2.5 flex-1 overflow-hidden rounded-sm bg-[var(--panel-solid)]"
                    role="img"
                    aria-label={`${row.code}: brake on for ${row.runs.length} zones${
                      row.runs.length ? `, first at ${Math.round(row.runs[0][0])} metres` : ""
                    }`}
                    title={
                      row.runs.length
                        ? row.runs.map(([a, b]) => `${Math.round(a)}–${Math.round(b)} m`).join(" · ")
                        : "No brake samples"
                    }
                  >
                    {row.runs.map(([a, b], i) => (
                      <span
                        key={i}
                        className="absolute inset-y-0 bg-[var(--accent-deep)]"
                        style={{
                          left: `${(a / row.maxD) * 100}%`,
                          width: `${Math.max(0.35, ((b - a) / row.maxD) * 100)}%`,
                        }}
                      />
                    ))}
                    {cursor != null && (
                      <span
                        className="absolute inset-y-0 w-px bg-white/80"
                        style={{ left: `${(cursor / row.maxD) * 100}%` }}
                      />
                    )}
                  </div>
                </div>
              ))}
            </div>
            <div className="tnum mt-1 flex justify-between pl-12 text-[10px] text-[var(--muted)]">
              <span>0 m</span>
              <span>{Math.round(brakeRows[0]?.maxD ?? 0).toLocaleString()} m</span>
            </div>
            {active.length === 1 && (
              <p className="mt-2 text-xs text-[var(--muted)]">Pick one more driver for the time delta and verdict.</p>
            )}
          </section>

          {deltas.length > 0 && (
            <section aria-label="Time delta" className="mt-3 card p-3">
              <p className="panel-label mb-1">
                Time delta vs {ref} · below zero = ahead · seconds
              </p>
              <div className="tnum mb-1 flex flex-wrap gap-x-4 gap-y-1 text-xs">
                {deltas.map((d) => (
                  <span key={d.code} className="inline-flex items-center gap-1.5" style={{ color: d.colour }}>
                    <svg width="18" height="8" aria-hidden>
                      <line x1="0" y1="4" x2="18" y2="4" stroke="currentColor" strokeWidth="2" strokeDasharray={d.dash} />
                    </svg>
                    {d.code}
                  </span>
                ))}
              </div>
              <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: 140 }} role="img" aria-label={`Cumulative time delta versus ${ref}`}>
                {[0, 0.5, 1].map((f) => {
                  const y = H / 2 - (f * 2 - 1) * (H / 2 - 10);
                  return (
                    <g key={f}>
                      <line x1={PADL} x2={W - 8} y1={y} y2={y} stroke="var(--border)" strokeWidth={1} />
                      <text x={2} y={y + 4} fontSize={11} fill="var(--muted)" fontFamily="JetBrains Mono, monospace">
                        {f === 0.5 ? "0" : `${(f * 2 - 1 > 0 ? "+" : "")}${((f * 2 - 1) * deltaMax).toFixed(1)}`}
                      </text>
                    </g>
                  );
                })}
                <line x1={PADL} x2={W - 8} y1={H / 2} y2={H / 2} stroke="var(--border-strong)" strokeWidth={1} />
                {deltaPaths.map((d) => (
                  <path
                    key={d.code}
                    d={d.d}
                    fill="none"
                    stroke={d.colour}
                    strokeDasharray={d.dash}
                    strokeWidth={2}
                  />
                ))}
                {cursor != null && (
                  <line x1={xAt(cursor)} x2={xAt(cursor)} y1={10} y2={H - 10} stroke="var(--foreground)" strokeWidth={1.5} />
                )}
              </svg>
            </section>
          )}

          {cursor != null && atCursor && (
            <section aria-label="At the cursor" className="mt-3 card p-0">
              <div className="tnum overflow-x-auto">
                <table className="w-full text-sm">
                  <caption className="sr-only">Telemetry at {Math.round(cursor).toLocaleString()} metres</caption>
                  <thead>
                    <tr className="text-left text-xs text-[var(--muted)]">
                      <th className="px-3 py-2 font-normal">Driver</th>
                      <th className="px-3 py-2 font-normal">Speed</th>
                      <th className="px-3 py-2 font-normal">Gear</th>
                      <th className="px-3 py-2 font-normal">Brake</th>
                      <th className="px-3 py-2 font-normal">Δ vs {ref}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {atCursor.map((r) => (
                      <tr key={r.code} className="border-t border-[var(--border)]">
                        <th scope="row" className="px-3 py-2 text-left font-bold" style={{ color: r.colour }}>
                          {r.code}
                          {r.code === ref && <span className="ml-1 text-[10px] uppercase text-[var(--muted)]">ref</span>}
                        </th>
                        <td className="px-3 py-2">{Math.round(r.speed)} km/h</td>
                        <td className="px-3 py-2">{r.gear ?? "—"}</td>
                        <td className={`px-3 py-2 font-bold ${r.brake && r.brake >= BRAKE_ON ? "text-[var(--bad)]" : "text-[var(--muted)]"}`}>
                          {r.brake == null ? "—" : r.brake >= BRAKE_ON ? "ON" : "OFF"}
                        </td>
                        <td className="px-3 py-2">
                          {r.delta == null ? "—" : `${r.delta >= 0 ? "+" : ""}${r.delta.toFixed(2)} s`}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {verdict && (
            <section aria-label="AI verdict" className="mt-3 rounded-md border border-[var(--border-strong)] bg-[var(--panel)] p-4">
              <p className="panel-label mb-1">AI verdict · beginner · Hinglish</p>
              <p>{lang === "hi" ? verdict.hi : verdict.en}</p>
              {showPro && <p className="mt-1 text-sm text-[var(--muted)]">{verdict.pro}</p>}
              <button onClick={() => setShowPro(!showPro)} className="touch mt-1 text-sm text-[var(--accent)] underline">
                {showPro ? "Hide pro version" : "Show pro version"}
              </button>
            </section>
          )}

          {track && track.brakingZones.length > 0 && (
            <section aria-label="Braking zones on this lap" className="mt-3 card p-4">
              <p className="panel-label mb-2">Braking zones on this lap · DERIVED reference lap</p>
              <ul className="tnum grid gap-1 text-sm sm:grid-cols-2">
                {track.brakingZones.map((z, i) => (
                  <li key={i}>
                    T{z.corner ?? "?"} · brake {Math.round(z.startDist).toLocaleString()} → {Math.round(z.endDist).toLocaleString()} m
                  </li>
                ))}
              </ul>
            </section>
          )}
          <p className="mt-3 text-xs text-[var(--muted)]">
            Traces resampled every 10 m of lap distance. Brake is an on/off signal, so very short events can be smoothed.
            Time delta is summed from speed over distance, not a measured lap time. See Methods.
          </p>
        </>
      )}
    </main>
  );
}
