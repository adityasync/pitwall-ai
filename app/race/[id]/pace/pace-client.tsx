"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { fmtLapTime } from "@/lib/format";
import { loadRaceBundle, type RaceBundle } from "@/lib/race";
import { StateCard } from "@/components/StateCard";
import { BestLapsTable } from "@/components/BestLapsTable";

export function PaceClient({ raceId }: { raceId: string }) {
  const [bundle, setBundle] = useState<RaceBundle | null>(null);
  const [sel, setSel] = useState<string[]>([]);

  useEffect(() => {
    let live = true;
    (async () => {
      const b = await loadRaceBundle(raceId);
      if (!live) return;
      setBundle(b);
      if (b.status === "ready") {
        const top = [...b.drivers].sort((a, c) => (a.finish ?? 99) - (c.finish ?? 99)).slice(0, 2).map((d) => d.code);
        setSel(top);
      }
    })();
    return () => {
      live = false;
    };
  }, [raceId]);

  const chart = useMemo(() => {
    if (!bundle || sel.length === 0) return null;
    const series = sel.map((code) => ({
      code,
      colour: bundle.drivers.find((d) => d.code === code)?.teamColour ?? "#fff",
      pts: (bundle.laps[code] ?? []).filter((r) => r.time && !r.pitLane && !r.flagged),
    }));
    const all = series.flatMap((s) => s.pts.map((p) => p.time as number));
    if (all.length === 0) return null;
    const lo = Math.min(...all);
    const hi = Math.max(...all);
    const laps = bundle.meta?.laps ?? 62;
    const W = 700;
    const H = 200;
    const X = (l: number) => 40 + (l / laps) * (W - 50);
    const Y = (v: number) => H - 24 - ((v - lo) / Math.max(0.001, hi - lo)) * (H - 32);
    return { series, W, H, X, Y, lo, hi };
  }, [bundle, sel]);

  const order = useMemo(
    () => [...(bundle?.drivers ?? [])].sort((a, c) => (a.finish ?? 99) - (c.finish ?? 99)).map((d) => d.code),
    [bundle]
  );
  const colours = useMemo(
    () => Object.fromEntries((bundle?.drivers ?? []).map((d) => [d.code, d.teamColour])),
    [bundle]
  );

  if (!bundle) {
    return (
      <main className="mx-auto w-full max-w-5xl px-4 sm:px-6 py-10">
        <StateCard kind="loading" title="Loading pace" text="Reading lap times…" progress={70} />
      </main>
    );
  }
  if (bundle.status !== "ready" || !bundle.meta) {
    return (
      <main className="mx-auto w-full max-w-5xl px-4 sm:px-6 py-10">
        <StateCard kind="error" title="Could not load this race" text="Build the race files first." />
      </main>
    );
  }

  const toggle = (code: string) =>
    setSel((s) => (s.includes(code) ? s.filter((c) => c !== code) : [...s, code].slice(-4)));
  const degr = bundle?.stats?.degradation ?? {};

  return (
    <main className="mx-auto w-full max-w-5xl px-4 sm:px-6 pb-12 pt-5">
      <Link href={`/race/${raceId}/easy`} className="touch inline-flex items-center text-sm text-[var(--accent)]">
        ← Back to race
      </Link>
      <h1 className="display mt-2 text-4xl font-bold">Tyre and pace</h1>
      <p className="panel-label mb-2 mt-4">Showing · tap drivers to add</p>
      <div className="flex flex-wrap gap-1.5">
        {bundle.drivers.map((d) => (
          <button key={d.code} onClick={() => toggle(d.code)} aria-pressed={sel.includes(d.code)}
            className={`touch rounded-full border px-3 text-xs font-bold ${sel.includes(d.code) ? "border-[var(--accent)] text-[var(--accent)]" : "border-[var(--border-strong)] text-[var(--muted)]"}`}>
            {d.code}
          </button>
        ))}
      </div>

      <section aria-label="Fastest laps" className="card mt-6 p-4 sm:p-5">
        <p className="panel-label mb-2">Fastest laps · sectors purple/green MEASURED</p>
        <BestLapsTable laps={bundle.laps} order={order} colours={colours} />
      </section>

      {chart && (
        <section aria-label="Lap time by lap" className="mt-3 card p-3">
          <p className="panel-label mb-1">Lap time by lap, coloured by tyre · pit laps removed</p>
          <svg viewBox={`0 0 ${chart.W} ${chart.H}`} style={{ width: "100%", height: 220 }} role="img" aria-label="Lap times by lap">
            {chart.series.map((s) => (
              <g key={s.code}>
                {s.pts.map((p) => (
                  <circle key={p.lap} cx={chart.X(p.lap)} cy={chart.Y(p.time as number)} r={4}
                    fill={p.compound === "SOFT" ? "#DA291C" : p.compound === "MEDIUM" ? "#FFF000" : p.compound === "HARD" ? "#fff" : "#39B54A"}
                    opacity={0.9}>
                    <title>{`${s.code} lap ${p.lap}: ${fmtLapTime(p.time)} (${p.compound}, age ${p.tyreAge})`}</title>
                  </circle>
                ))}
              </g>
            ))}
          </svg>
          <p className="tnum mt-1 flex gap-4 text-xs">
            {chart.series.map((s) => (
              <span key={s.code} style={{ color: s.colour }}>■ {s.code}</span>
            ))}
            <span className="text-[var(--muted)]">dots: S red · M yellow · H white · I green</span>
          </p>
        </section>
      )}

      <section aria-label="Stint summary" className="mt-4">
        <p className="panel-label mb-2">Stint summary · wear per lap ESTIMATE</p>
        <div className="overflow-x-auto rounded-md border border-[var(--border)]">
          <table className="tnum w-full min-w-[640px] text-sm">
            <thead>
              <tr className="panel-label border-b border-[var(--border)] text-left">
                <th className="p-2">Driver</th><th className="p-2">Tyre</th><th className="p-2">Laps</th>
                <th className="p-2">Avg pace</th><th className="p-2">Wear/lap</th><th className="p-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {(bundle.drivers).map((d) => {
                const sts = bundle.stints[d.code] ?? [];
                return sts.map((s, i) => {
                  const rows = (bundle.laps[d.code] ?? []).filter((r) => r.lap >= s.lapStart && r.lap <= s.lapEnd && r.time && !r.pitLane && !r.flagged);
                  const avg = rows.length ? rows.reduce((a, r) => a + (r.time as number), 0) / rows.length : null;
                  const dg = degr[d.code]?.[`stint${s.stint}`];
                  return (
                    <tr key={`${d.code}-${s.stint}`} className="border-b border-[var(--border)] last:border-0">
                      <td className="p-2 font-bold">{i === 0 ? d.code : ""}</td>
                      <td className="p-2">{s.compound}</td>
                      <td className="p-2">{s.lapStart}–{s.lapEnd}</td>
                      <td className="p-2">{avg ? fmtLapTime(avg) : "—"}</td>
                      <td className="p-2">{dg ? `+${dg.slopeSPerLap.toFixed(3)}s` : "—"}</td>
                      <td className="p-2 text-[var(--muted)]">{rows.length < 5 ? "short stint" : "ok"}</td>
                    </tr>
                  );
                });
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section aria-label="AI read" className="mt-4 rounded-md border border-[var(--border-strong)] bg-[var(--panel)] p-4">
        <p className="panel-label mb-1">AI read · from lap times</p>
        <PaceRead bundle={bundle} sel={sel} />
      </section>
      <p className="mt-3 text-xs text-[var(--muted)]">
        The data has no tyre temperature or wear sensor. Life left is inferred from lap-time trend and stint length, so treat it as a guide.
      </p>
    </main>
  );
}

function PaceRead({ bundle, sel }: { bundle: RaceBundle; sel: string[] }) {
  const pace = bundle.stats?.pace ?? {};
  const rows = sel.filter((c) => pace[c]).map((c) => ({ c, ...pace[c] })).sort((a, b) => a.median - b.median);
  if (rows.length === 0) return <p>No pace data for the selected drivers.</p>;
  const [best, ...rest] = rows;
  return (
    <div>
      <p>
        {best.c}&apos;s tyres are holding best on median pace ({fmtLapTime(best.median)}).
        {rest.map((r) => ` ${r.c} averages ${fmtLapTime(r.median)}.`).join("")}
      </p>
      <p className="mt-1 text-sm text-[var(--muted)]">
        Degradation slopes are ESTIMATE models from clean-lap trends.
      </p>
    </div>
  );
}
