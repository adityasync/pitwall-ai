"use client";

import { useMemo } from "react";
import { indexAtT } from "@/lib/clock";

export type PosSeries = {
  t: number[];
  drivers: Record<string, { pos: (number | null)[] }>;
};

/** Lap chart: position (P1 top) vs lap number for every driver, team colours.
 *  Sampled from positions.json at each lap start (DERIVED trace of MEASURED data). */
export function LapChart({
  positions,
  lapStarts,
  laps,
  order,
  colours,
  lap,
  height = 240,
}: {
  positions: PosSeries;
  lapStarts: number[];
  laps: number;
  /** driver codes in finish order (top of this list = winner) */
  order: string[];
  colours: Record<string, string>;
  /** current lap cursor */
  lap: number;
  height?: number;
}) {
  const W = 760;
  const H = 240;
  const PADL = 34;
  const PADR = 10;
  const PADT = 10;
  const PADB = 22;
  const data = useMemo(() => {
    const n = Math.min(20, order.length);
    const X = (l: number) => PADL + ((l - 1) / Math.max(1, laps - 1)) * (W - PADL - PADR);
    const Y = (p: number) => PADT + ((p - 1) / Math.max(1, n - 1)) * (H - PADT - PADB);
    const series = order.slice(0, n).map((code) => {
      const arr = positions.drivers[code]?.pos ?? [];
      const pts: string[] = [];
      for (let l = 1; l <= laps; l++) {
        const i = indexAtT(positions.t, lapStarts[Math.min(l - 1, lapStarts.length - 1)] ?? 0);
        const p = i < 0 ? null : (arr[Math.min(i, arr.length - 1)] ?? null);
        if (p != null) pts.push(`${pts.length === 0 ? "M" : "L"}${X(l).toFixed(1)},${Y(p).toFixed(1)}`);
      }
      return { code, d: pts.join(" "), colour: colours[code] ?? "#fff" };
    });
    return { series, X, Y, n };
  }, [positions, lapStarts, laps, order, colours]);

  const xOf = (l: number) =>
    PADL + ((l - 1) / Math.max(1, laps - 1)) * (W - PADL - PADR);

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      style={{ height, width: "100%" }}
      role="img"
      aria-label="Position chart: every driver's position on every lap"
    >
      {[1, 5, 10, 15, 20].filter((p) => p <= data.n).map((p) => {
        const y = PADT + ((p - 1) / Math.max(1, data.n - 1)) * (H - PADT - PADB);
        return (
          <g key={p}>
            <line x1={PADL} x2={W - PADR} y1={y} y2={y} stroke="var(--border)" strokeWidth={1} />
            <text x={4} y={y + 4} fontSize={11} fill="var(--muted)" fontFamily="JetBrains Mono, monospace">
              P{p}
            </text>
          </g>
        );
      })}
      {Array.from({ length: Math.floor(laps / 10) + 1 }, (_, k) => k * 10).map((l) => (
        <text
          key={l}
          x={xOf(Math.max(1, l === 0 ? 1 : l))}
          y={H - 6}
          fontSize={11}
          fill="var(--muted)"
          textAnchor="middle"
          fontFamily="JetBrains Mono, monospace"
        >
          {l === 0 ? "L1" : `L${l}`}
        </text>
      ))}
      {data.series.map((s) => (
        <path key={s.code} d={s.d} fill="none" stroke={s.colour} strokeWidth={s.code === data.series[0]?.code ? 2.5 : 1.5} opacity={0.9}>
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
  );
}
