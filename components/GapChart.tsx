"use client";

import { useMemo } from "react";
import { indexAtT } from "@/lib/clock";

export type GapSeries = {
  t: number[];
  drivers: Record<string, { gapLeader: (number | null)[]; t?: number[] }>;
};

/** Gap-to-leader chart: seconds behind the leader on every lap, per driver.
 *  Sampled from intervals.json at each lap start (DERIVED of MEASURED gaps). */
export function GapChart({
  intervals,
  lapStarts,
  laps,
  codes,
  colours,
  lap,
  height = 220,
}: {
  intervals: GapSeries;
  lapStarts: number[];
  laps: number;
  codes: string[];
  colours: Record<string, string>;
  lap: number;
  height?: number;
}) {
  const W = 760;
  const H = 220;
  const PADL = 44;
  const PADR = 10;
  const PADT = 10;
  const PADB = 22;
  const data = useMemo(() => {
    const X = (l: number) => PADL + ((l - 1) / Math.max(1, laps - 1)) * (W - PADL - PADR);
    const series = codes.map((code) => {
      const s = intervals.drivers[code];
      const tt = s?.t ?? intervals.t;
      const pts: { l: number; g: number }[] = [];
      if (s) {
        for (let l = 1; l <= laps; l++) {
          const i = indexAtT(tt, lapStarts[Math.min(l - 1, lapStarts.length - 1)] ?? 0);
          const g = i < 0 ? null : (s.gapLeader[Math.min(i, s.gapLeader.length - 1)] ?? null);
          if (g != null && g >= 0 && g < 300) pts.push({ l, g });
        }
      }
      return { code, pts, colour: colours[code] ?? "#fff" };
    });
    const maxG = Math.max(10, ...series.flatMap((s) => s.pts.map((p) => p.g)));
    const Y = (g: number) => PADT + (g / maxG) * (H - PADT - PADB);
    return { series, X, Y, maxG };
  }, [intervals, lapStarts, laps, codes, colours]);

  const xOf = (l: number) =>
    PADL + ((l - 1) / Math.max(1, laps - 1)) * (W - PADL - PADR);

  return (
    <div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        style={{ height, width: "100%" }}
        role="img"
        aria-label={`Gap to leader per lap for ${codes.join(", ")}`}
      >
        {[0, 0.5, 1].map((f) => {
          const y = PADT + f * (H - PADT - PADB);
          return (
            <g key={f}>
              <line x1={PADL} x2={W - PADR} y1={y} y2={y} stroke="var(--border)" strokeWidth={1} />
              <text x={2} y={y + 4} fontSize={11} fill="var(--muted)" fontFamily="JetBrains Mono, monospace">
                {f === 0 ? "LEAD" : `+${(f * data.maxG).toFixed(0)}s`}
              </text>
            </g>
          );
        })}
        {data.series.map((s) => (
          <path
            key={s.code}
            d={s.pts.map((p, i) => `${i === 0 ? "M" : "L"}${data.X(p.l).toFixed(1)},${data.Y(p.g).toFixed(1)}`).join(" ")}
            fill="none"
            stroke={s.colour}
            strokeWidth={2.5}
          >
            <title>{s.code}</title>
          </path>
        ))}
        <line
          x1={xOf(Math.min(Math.max(1, lap), laps))}
          x2={xOf(Math.min(Math.max(1, lap), laps))}
          y1={PADT}
          y2={H - PADB}
          stroke="var(--accent)"
          strokeWidth={1.5}
          strokeDasharray="4 3"
        />
      </svg>
      <p className="tnum mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs">
        {data.series.map((s) => (
          <span key={s.code} style={{ color: s.colour }}>■ {s.code}</span>
        ))}
      </p>
    </div>
  );
}
