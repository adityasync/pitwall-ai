"use client";

import { useMemo } from "react";

export type TraceLap = {
  code: string;
  colour: string;
  dist: number[];
  speed: number[];
  throttle?: number[];
  brake?: number[];
  gear?: number[];
};

/** Telemetry traces vs distance with cursor readout (docs/03: uPlot-class
 *  speed via custom SVG — fast enough for ~500 pts × few laps). */
export function TraceChart({
  laps,
  cursor,
  onCursor,
  height = 260,
}: {
  laps: TraceLap[];
  cursor: number | null;
  onCursor: (dist: number | null) => void;
  height?: number;
}) {
  const W = 800;
  const H = 220;
  const PADL = 44;
  const PADR = 8;
  const PADT = 8;
  const PADB = 22;
  const { maxD, maxS, paths } = useMemo(() => {
    const maxD = Math.max(1, ...laps.flatMap((l) => l.dist));
    const maxS = Math.max(1, ...laps.flatMap((l) => l.speed));
    const X = (d: number) => PADL + (d / maxD) * (W - PADL - PADR);
    const Y = (s: number) => H - PADB - (s / maxS) * (H - PADT - PADB);
    const paths = laps.map((l) => ({
      code: l.code,
      colour: l.colour,
      d: l.dist.map((d, i) => `${i === 0 ? "M" : "L"}${X(d).toFixed(1)},${Y(l.speed[i]).toFixed(1)}`).join(" "),
    }));
    return { maxD, maxS, paths };
  }, [laps]);

  const xOf = (d: number) => PADL + (d / maxD) * (W - PADL - PADR);

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      style={{ height, width: "100%" }}
      role="img"
      aria-label="Speed traces versus track distance"
      onMouseMove={(e) => {
        const r = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
        const px = ((e.clientX - r.left) / r.width) * W;
        const d = ((px - PADL) / (W - PADL - PADR)) * maxD;
        onCursor(d >= 0 && d <= maxD ? d : null);
      }}
      onMouseLeave={() => onCursor(null)}
    >
      {[0, 0.5, 1].map((f) => {
        const y = H - PADB - f * (H - PADT - PADB);
        return (
          <g key={f}>
            <line x1={PADL} x2={W - PADR} y1={y} y2={y} stroke="var(--border)" strokeWidth={1} />
            <text x={2} y={y + 4} fontSize={11} fill="var(--muted)" fontFamily="JetBrains Mono, monospace">
              {Math.round(f * maxS)}
            </text>
          </g>
        );
      })}
      {[0, 0.5, 1].map((f) => (
        <text
          key={f}
          x={PADL + f * (W - PADL - PADR)}
          y={H - 6}
          fontSize={11}
          fill="var(--muted)"
          textAnchor="middle"
          fontFamily="JetBrains Mono, monospace"
        >
          {f === 0 ? "0 m" : `${Math.round(f * maxD).toLocaleString()} m`}
        </text>
      ))}
      {paths.map((p) => (
        <path key={p.code} d={p.d} fill="none" stroke={p.colour} strokeWidth={2} />
      ))}
      {cursor != null && (
        <line x1={xOf(cursor)} x2={xOf(cursor)} y1={PADT} y2={H - PADB} stroke="var(--accent)" strokeWidth={1.5} />
      )}
    </svg>
  );
}

/** Cumulative time-delta between two laps (B ahead when below zero convention
 *  follows the canvas: label states who is ahead). */
export function deltaSeries(a: TraceLap, b: TraceLap): { dist: number[]; delta: number[] } {
  const n = Math.min(a.dist.length, b.dist.length);
  const dist: number[] = [];
  const delta: number[] = [];
  let ta = 0;
  let tb = 0;
  for (let i = 1; i < n; i++) {
    const dd = a.dist[i] - a.dist[i - 1];
    const va = Math.max(5, (a.speed[i] + a.speed[i - 1]) / 2 / 3.6);
    const vb = Math.max(5, (b.speed[i] + b.speed[i - 1]) / 2 / 3.6);
    ta += dd / va;
    tb += dd / vb;
    dist.push(a.dist[i]);
    delta.push(tb - ta);
  }
  return { dist, delta };
}
