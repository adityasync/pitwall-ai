"use client";

import { useMemo } from "react";
import type { Track } from "@/lib/types";

export type MapDot = { code: string; x: number; y: number; colour: string };

/** Custom SVG track map (docs/03). All sizes derive from the track's own
 *  bounding box, so Marina Bay, Interlagos and Silverstone render alike —
 *  raw location units are not meters and differ per track. */
export function TrackMap({
  track,
  dots,
  height = 220,
  label,
  showZones = false,
  onCorner,
  selectedCorner,
}: {
  track: Track | null;
  dots: MapDot[];
  height?: number;
  label?: string;
  /** overlay DERIVED braking zones */
  showZones?: boolean;
  onCorner?: (n: number) => void;
  selectedCorner?: number | null;
}) {
  const view = useMemo(() => {
    if (!track || track.outline.length === 0) return null;
    const [minx, miny, maxx, maxy] = track.bounds;
    const w = maxx - minx || 1;
    const h = maxy - miny || 1;
    const s = Math.max(w, h); // scale unit: everything is a fraction of this
    const pad = s * 0.1;
    const pts = track.outline.map(([x, y]) => `${x},${-y}`).join(" ");
    const nearest = (x: number, y: number) => {
      let bi = 0;
      let bd = Infinity;
      for (let i = 0; i < track.outline.length; i++) {
        const ox = track.outline[i][0];
        const oy = track.outline[i][1];
        const d = (ox - x) ** 2 + (oy - y) ** 2;
        if (d < bd) {
          bd = d;
          bi = i;
        }
      }
      return { x: track.outline[bi][0], y: -track.outline[bi][1] };
    };
    const corners = (track.corners ?? []).map((c) => ({ ...c, p: nearest(c.x, c.y) }));
    return {
      vb: `${minx - pad} ${-(maxy + pad)} ${w + pad * 2} ${h + pad * 2}`,
      pts,
      corners,
      u: {
        casing: s * 0.008,
        line: s * 0.002,
        zoneR: s * 0.018,
        zoneW: s * 0.005,
        cornerR: s * 0.02,
        cornerW: s * 0.0035,
        cornerFont: s * 0.017,
        carR: s * 0.011,
        carW: s * 0.003,
        carLabelDy: s * 0.016,
        carFont: s * 0.02,
      },
    };
  }, [track]);

  if (!view) {
    return (
      <div
        role="img"
        aria-label="Track map unavailable"
        className="flex items-center justify-center rounded-md border border-[var(--border)] bg-[var(--panel)] p-6 text-sm text-[var(--muted)]"
        style={{ height }}
      >
        Track map is not available for this race.
      </div>
    );
  }
  const u = view.u;
  return (
    <figure className="overflow-hidden rounded-md border border-[var(--border)] bg-[var(--panel)]">
      <svg
        viewBox={view.vb}
        style={{ height, width: "100%" }}
        role="img"
        aria-label={label ?? "Track map with car positions"}
      >
        <polyline points={view.pts} fill="none" stroke="var(--border-strong)" strokeWidth={u.casing} strokeLinejoin="round" />
        <polyline points={view.pts} fill="none" stroke="#e4e4e7" strokeWidth={u.line} strokeLinejoin="round" opacity={0.85} />
        {showZones &&
          (track?.brakingZones ?? []).map((z, i) => {
            const c = view.corners.find((c) => c.n === z.corner);
            if (!c) return null;
            return (
              <circle
                key={i}
                cx={c.p.x}
                cy={c.p.y}
                r={u.zoneR}
                fill="none"
                stroke="var(--warn)"
                strokeWidth={u.zoneW}
                opacity={0.8}
              />
            );
          })}
        {view.corners.map((c) =>
          onCorner ? (
            <g
              key={c.n}
              onClick={() => onCorner(c.n)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onCorner(c.n);
                }
              }}
              tabIndex={0}
              role="button"
              aria-label={`Select Turn ${c.n}`}
              aria-pressed={selectedCorner === c.n}
              style={{ cursor: "pointer", outline: "none" }}
            >
              <circle
                cx={c.p.x}
                cy={c.p.y}
                r={u.cornerR}
                fill={selectedCorner === c.n ? "var(--accent)" : "var(--raised)"}
                stroke={selectedCorner === c.n ? "var(--accent)" : "var(--border-strong)"}
                strokeWidth={u.cornerW}
              />
              <text
                x={c.p.x}
                y={c.p.y + u.cornerFont * 0.38}
                textAnchor="middle"
                fontSize={u.cornerFont}
                fontWeight={700}
                fill={selectedCorner === c.n ? "#000" : "#e4e4e7"}
                fontFamily="JetBrains Mono, monospace"
                style={{ pointerEvents: "none" }}
              >
                {c.n}
              </text>
            </g>
          ) : null
        )}
        {dots.map((d) => (
          <g key={d.code}>
            <circle cx={d.x} cy={-d.y} r={u.carR} fill={d.colour} stroke="#09090b" strokeWidth={u.carW} />
            <text
              x={d.x}
              y={-d.y - u.carLabelDy}
              textAnchor="middle"
              fontSize={u.carFont}
              fontWeight={700}
              fill="#e4e4e7"
              fontFamily="JetBrains Mono, monospace"
              style={{ paintOrder: "stroke", stroke: "#09090b", strokeWidth: u.carFont * 0.25 }}
            >
              {d.code}
            </text>
          </g>
        ))}
      </svg>
      {label && (
        <figcaption className="tnum border-t border-[var(--border)] px-3 py-2 text-xs text-[var(--muted)]">
          {label}
        </figcaption>
      )}
    </figure>
  );
}
