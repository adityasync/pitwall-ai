"use client";

import { useMemo, useState } from "react";
import type { Track } from "@/lib/types";

export type MapDot = {
  code: string;
  x: number;
  y: number;
  colour: string;
  highlight?: boolean;
  dim?: boolean;
};

export type MapTrail = { x: number; y: number };

/** Track map v3 — same data (track.outline + dots), more racecraft:
 *  Catmull-Rom dots (see lib/map.ts), motion trails, tap-a-car select,
 *  zoom + follow, DRS rings + gap labels. All presentation is DERIVED;
 *  samples stay MEASURED. Raw location units differ per track — every size
 *  derives from the track's own bounding box. */
export function TrackMap({
  track,
  dots,
  height = 220,
  label,
  showZones = false,
  onCorner,
  selectedCorner,
  battle = [],
  leader = null,
  trails = null,
  onSelect = null,
  selected = null,
  drsCodes = [],
  gapLabels = null,
  follow,
  onFollow = null,
  controls = true,
}: {
  track: Track | null;
  dots: MapDot[];
  height?: number;
  label?: string;
  /** overlay DERIVED braking zones */
  showZones?: boolean;
  onCorner?: (n: number) => void;
  selectedCorner?: number | null;
  battle?: string[];
  leader?: string | null;
  /** motion trails per driver (oldest first, raw x/y) */
  trails?: Record<string, MapTrail[]> | null;
  onSelect?: ((code: string) => void) | null;
  selected?: string | null;
  /** drivers with DRS open / eligible — dashed accent ring */
  drsCodes?: string[];
  /** small gap caption under a car, e.g. "+0.8" */
  gapLabels?: Record<string, string> | null;
  follow?: string | null;
  onFollow?: ((code: string | null) => void) | null;
  controls?: boolean;
}) {
  const [zoom, setZoom] = useState(1);
  // Follow is controlled when the parent passes `follow` (Easy/Pro/Live do);
  // otherwise the map tracks it internally (onboard). No prop-sync effect.
  const [innerFollow, setInnerFollow] = useState<string | null>(null);
  const followOn = follow !== undefined ? (follow ?? null) : innerFollow;
  const setFollow = (c: string | null) => {
    setInnerFollow(c);
    onFollow?.(c);
    if (c) setZoom((z) => Math.max(z, 2.2));
  };

  const view = useMemo(() => {
    if (!track || track.outline.length === 0) return null;
    const [minx, miny, maxx, maxy] = track.bounds;
    const w = maxx - minx || 1;
    const h = maxy - miny || 1;
    const s = Math.max(w, h);
    const pad = s * 0.12;
    const pts = track.outline.map(([x, y]) => `${x},${-y}`).join(" ");
    // start/finish: first outline sample + track direction from next samples
    const o = track.outline;
    const p0 = o[0];
    const p1 = o[Math.min(8, o.length - 1)];
    const dx = p1[0] - p0[0];
    const dy = -(p1[1] - p0[1]);
    const len = Math.hypot(dx, dy) || 1;
    const nx = dx / len;
    const ny = dy / len;
    // perpendicular tick for the start line (svg space: y already negated)
    const tick = s * 0.022;
    const px = -ny;
    const py = nx;
    const sfx1 = { x: p0[0] + px * tick, y: -p0[1] + py * tick };
    const sfx2 = { x: p0[0] - px * tick, y: -p0[1] - py * tick };
    // direction arrow ~12% along the lap
    const ai = Math.floor(o.length * 0.12);
    const a0 = o[ai];
    const a1 = o[Math.min(ai + 8, o.length - 1)];
    const adx = a1[0] - a0[0];
    const ady = -(a1[1] - a0[1]);
    const alen = Math.hypot(adx, ady) || 1;
    const arrow = { x: a0[0], y: -a0[1], ux: adx / alen, uy: ady / alen };
    const nearest = (x: number, y: number) => {
      let bi = 0;
      let bd = Infinity;
      // stride the search: outline is dense, every 4th point is plenty
      for (let i = 0; i < track.outline.length; i += 4) {
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
      baseW: w + pad * 2,
      baseH: h + pad * 2,
      pts,
      corners,
      start: { x: p0[0], y: -p0[1], x1: sfx1.x, y1: sfx1.y, x2: sfx2.x, y2: sfx2.y },
      arrow,
      u: {
        casing: s * 0.016,
        asphalt: s * 0.011,
        core: s * 0.0022,
        zoneR: s * 0.018,
        zoneW: s * 0.005,
        cornerR: s * 0.016,
        cornerFont: s * 0.013,
        carR: s * 0.012,
        carW: s * 0.0032,
        carLabelDy: s * 0.02,
        carFont: s * 0.018,
        startW: s * 0.006,
        arrowL: s * 0.035,
      },
    };
  }, [track]);

  const followCar = followOn ? dots.find((d) => d.code === followOn) ?? null : null;
  const effZoom = followCar ? Math.max(zoom, 2.2) : zoom;
  const vb = (() => {
    if (!view) return "";
    if (!followCar || effZoom <= 1.02) return view.vb;
    const fw = view.baseW / effZoom;
    const fh = view.baseH / effZoom;
    return `${followCar.x - fw / 2} ${-followCar.y - fh / 2} ${fw} ${fh}`;
  })();

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
  const battleSet = new Set(battle);
  const drsSet = new Set(drsCodes);
  const colourOf = new Map(dots.map((d) => [d.code, d.colour]));
  const ordered = [...dots].sort((a, b) => {
    const rank = (c: string) =>
      c === selected || c === followOn ? -1 : battleSet.has(c) || c === leader ? 0 : 1;
    return rank(a.code) - rank(b.code);
  });
  const al = view.arrow;
  const ax2 = al.x + al.ux * u.arrowL;
  const ay2 = al.y + al.uy * u.arrowL;
  // arrowhead wings
  const wl = u.arrowL * 0.35;
  const wx = -al.uy;
  const wy = al.ux;

  return (
    <figure className="relative overflow-hidden rounded-xl border border-white/[0.07] bg-black/40 backdrop-blur-md">
      {controls && (
        <div className="absolute right-2 top-2 z-10 flex gap-1">
          <button
            type="button"
            aria-label="Zoom map in"
            onClick={() => setZoom((z) => Math.min(5, +(z + 0.5).toFixed(1)))}
            className="touch inline-flex items-center justify-center rounded-md border border-[var(--border-strong)] bg-[var(--bg)]/90 px-2 text-base font-bold text-[var(--text)]"
          >
            +
          </button>
          <button
            type="button"
            aria-label="Zoom map out"
            onClick={() => setZoom((z) => Math.max(1, +(z - 0.5).toFixed(1)))}
            className="touch inline-flex items-center justify-center rounded-md border border-[var(--border-strong)] bg-[var(--bg)]/90 px-2 text-base font-bold text-[var(--text)]"
          >
            −
          </button>
          <button
            type="button"
            aria-label="Reset map view"
            onClick={() => {
              setZoom(1);
              setFollow(null);
            }}
            className="touch inline-flex items-center justify-center rounded-md border border-[var(--border-strong)] bg-[var(--bg)]/90 px-2 text-xs font-bold text-[var(--muted)]"
          >
            RESET
          </button>
          {followCar ? (
            <button
              type="button"
              aria-label={`Stop following ${followCar.code}`}
              aria-pressed
              onClick={() => setFollow(null)}
              className="touch inline-flex items-center justify-center rounded-md border border-[var(--accent)] bg-[var(--accent-dim)] px-2 text-xs font-bold text-[var(--accent)]"
            >
              ● {followCar.code}
            </button>
          ) : (
            selected && (
              <button
                type="button"
                aria-label={`Follow ${selected} on the map`}
                onClick={() => setFollow(selected)}
                className="touch inline-flex items-center justify-center rounded-md border border-[var(--border-strong)] bg-[var(--bg)]/90 px-2 text-xs font-bold text-[var(--muted)]"
              >
                FOLLOW {selected}
              </button>
            )
          )}
        </div>
      )}
      <svg
        viewBox={vb}
        style={{ height, width: "100%" }}
        role="img"
        aria-label={label ?? "Track map with car positions"}
      >
        {/* asphalt: dark casing, mid fill, lit centre line */}
        <polyline points={view.pts} fill="none" stroke="#000" strokeWidth={u.casing} strokeLinejoin="round" strokeLinecap="round" opacity={0.9} />
        <polyline points={view.pts} fill="none" stroke="var(--border-strong)" strokeWidth={u.asphalt} strokeLinejoin="round" strokeLinecap="round" />
        <polyline points={view.pts} fill="none" stroke="var(--text)" strokeWidth={u.core} strokeLinejoin="round" strokeLinecap="round" opacity={0.35} />
        {/* start/finish */}
        <line x1={view.start.x1} y1={view.start.y1} x2={view.start.x2} y2={view.start.y2}
          stroke="var(--text)" strokeWidth={u.startW} strokeLinecap="round" />
        <text x={view.start.x} y={view.start.y - u.carLabelDy}
          textAnchor="middle" fontSize={u.carFont * 0.8} fontWeight={700}
          fill="var(--muted)" fontFamily="JetBrains Mono, monospace">S/F</text>
        {/* direction arrow */}
        <line x1={al.x} y1={al.y} x2={ax2} y2={ay2} stroke="var(--muted)" strokeWidth={u.startW} strokeLinecap="round" opacity={0.8} />
        <polyline
          points={`${ax2},${ay2} ${ax2 - al.ux * wl + wx * wl * 0.6},${ay2 - al.uy * wl + wy * wl * 0.6} ${ax2 - al.ux * wl - wx * wl * 0.6},${ay2 - al.uy * wl - wy * wl * 0.6}`}
          fill="none" stroke="var(--muted)" strokeWidth={u.startW} strokeLinejoin="round" strokeLinecap="round" opacity={0.8} />
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
                opacity={0.55}
                strokeDasharray={`${u.zoneR * 0.4} ${u.zoneR * 0.3}`}
              />
            );
          })}
        {/* motion trails (DERIVED presentation, behind the cars) */}
        {trails &&
          Object.entries(trails).map(([code, pts]) => {
            if (!pts || pts.length < 2) return null;
            return (
              <polyline
                key={`trail-${code}`}
                points={pts.map((p) => `${p.x},${-p.y}`).join(" ")}
                fill="none"
                stroke={colourOf.get(code) ?? "#fff"}
                strokeWidth={u.carW * 0.9}
                strokeLinejoin="round"
                strokeLinecap="round"
                opacity={0.35}
              />
            );
          })}
        {/* corners: always visible, interactive in Pro */}
        {view.corners.map((c) => {
          const active = selectedCorner === c.n;
          const inner = (
            <>
              <circle
                cx={c.p.x}
                cy={c.p.y}
                r={u.cornerR}
                fill={active ? "var(--accent)" : "var(--raised)"}
                stroke={active ? "var(--accent)" : "var(--border-strong)"}
                strokeWidth={u.cornerR * 0.22}
                opacity={onCorner || active ? 1 : 0.75}
              />
              <text
                x={c.p.x}
                y={c.p.y + u.cornerFont * 0.38}
                textAnchor="middle"
                fontSize={u.cornerFont}
                fontWeight={700}
                fill={active ? "#fff" : "var(--muted)"}
                fontFamily="JetBrains Mono, monospace"
                style={{ pointerEvents: "none" }}
              >
                {c.n}
              </text>
            </>
          );
          return onCorner ? (
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
              aria-pressed={active}
              style={{ cursor: "pointer" }}
            >
              {inner}
            </g>
          ) : (
            <g key={c.n} opacity={0.9}>{inner}</g>
          );
        })}
        {ordered.map((d) => {
          const hot = battleSet.has(d.code) || d.highlight;
          const lead = d.code === leader;
          const sel = d.code === selected;
          const isFollow = d.code === followOn;
          const drs = drsSet.has(d.code);
          const gap = gapLabels?.[d.code];
          const interactive = !!onSelect;
          const car = (
            <g opacity={d.dim && !hot && !lead && !sel ? 0.45 : 1}>
              {(hot || lead || sel || isFollow) && (
                <circle cx={d.x} cy={-d.y} r={u.carR * 1.9} fill="none"
                  stroke={sel || isFollow ? "var(--text)" : lead ? "var(--accent)" : d.colour} strokeWidth={u.carW} opacity={0.5} />
              )}
              {drs && (
                <circle cx={d.x} cy={-d.y} r={u.carR * 2.5} fill="none"
                  stroke="var(--accent)" strokeWidth={u.carW * 0.8} opacity={0.85}
                  strokeDasharray={`${u.carR * 0.7} ${u.carR * 0.5}`}>
                  <title>{d.code} has DRS</title>
                </circle>
              )}
              <circle cx={d.x} cy={-d.y} r={hot || lead || sel ? u.carR * 1.15 : u.carR}
                fill={d.colour} stroke="var(--bg)" strokeWidth={u.carW}>
                <title>{d.code}{drs ? " · DRS" : ""}{gap ? ` · ${gap}` : ""}</title>
              </circle>
              {/* fat invisible hit area for touch */}
              {interactive && (
                <circle cx={d.x} cy={-d.y} r={u.carR * 2.6} fill="transparent" />
              )}
              {(hot || lead || sel || isFollow || ordered.length <= 6) && (
                <text
                  x={d.x}
                  y={-d.y - u.carLabelDy}
                  textAnchor="middle"
                  fontSize={u.carFont}
                  fontWeight={700}
                  fill="var(--text)"
                  fontFamily="JetBrains Mono, monospace"
                  style={{ paintOrder: "stroke", stroke: "var(--bg)", strokeWidth: u.carFont * 0.25, pointerEvents: "none" }}
                >
                  {d.code}
                </text>
              )}
              {gap && (
                <text
                  x={d.x}
                  y={-d.y + u.carLabelDy * 1.1}
                  textAnchor="middle"
                  fontSize={u.carFont * 0.72}
                  fontWeight={700}
                  fill="var(--muted)"
                  fontFamily="JetBrains Mono, monospace"
                  style={{ paintOrder: "stroke", stroke: "var(--bg)", strokeWidth: u.carFont * 0.22, pointerEvents: "none" }}
                >
                  {gap}
                </text>
              )}
              {drs && !gap && (
                <text
                  x={d.x}
                  y={-d.y + u.carLabelDy * 1.1}
                  textAnchor="middle"
                  fontSize={u.carFont * 0.62}
                  fontWeight={700}
                  fill="var(--accent)"
                  fontFamily="JetBrains Mono, monospace"
                  style={{ pointerEvents: "none" }}
                >
                  DRS
                </text>
              )}
            </g>
          );
          return interactive ? (
            <g
              key={d.code}
              onClick={() => onSelect?.(d.code)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onSelect?.(d.code);
                }
              }}
              tabIndex={0}
              role="button"
              aria-label={`Select ${d.code}${drs ? ", DRS open" : ""}${gap ? `, gap ${gap}` : ""}`}
              aria-pressed={sel}
              style={{ cursor: "pointer" }}
            >
              {car}
            </g>
          ) : (
            <g key={d.code}>{car}</g>
          );
        })}
      </svg>
      {label && (
        <figcaption className="tnum border-t border-[var(--border)] px-3 py-2 text-xs text-[var(--muted)]">
          {label}
        </figcaption>
      )}
    </figure>
  );
}
