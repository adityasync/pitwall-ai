"use client";

import { useMemo, useState } from "react";
import type { Track } from "@/lib/types";
import { smoothOutline, splitTrailOnGaps } from "@/lib/map";
export type MapDot = {
  code: string;
  x: number;
  y: number;
  colour: string;
  highlight?: boolean;
  dim?: boolean;
};

export type MapTrail = { x: number; y: number };

/** Track map v6 — smooth AND thin. Coarse telemetry polygons (70–110 pts,
 *  chords to 12% of span) are resampled through a closed Catmull-Rom spline
 *  (lib/map.ts, through every MEASURED vertex) so the silhouette curves like
 *  the authored pro vector sets. Constant 2px core + 8px halo via
 *  vector-effect="non-scaling-stroke". Corner pins with bad coordinates
 *  (>4% span off-loop) are dropped, survivors render subordinate to cars.
 *  Trails render for focus cars only (max 4). */
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
  pulses = null,
  minimal = false,
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
  /** position-changers from moversAt() — expanding ring, synced with tower flash */
  pulses?: Record<string, "up" | "down"> | null;
  /** minimal furniture (hero/landing): no corner pins, no direction arrow,
   *  no S/F caption — just the loop, the S/F tick and the cars. */
  minimal?: boolean;
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
    const pad = s * 0.16;
    // Smooth the coarse telemetry polygon through a closed Catmull-Rom
    // spline (lib/map.ts) — the curve passes through every MEASURED vertex,
    // so this is presentation, not invention. Without it, chords up to 12%
    // of the track span render as visible facets.
    const o = track.outline;
    const loop = smoothOutline(o);
    const ds: string[] = [];
    for (let i = 0; i < loop.length; i++) {
      ds.push(`${i === 0 ? "M" : "L"}${loop[i][0]},${-loop[i][1]}`);
    }
    ds.push("Z");
    const d = ds.join(" ");
    // start/finish: first outline sample + track direction from next samples
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
    const corners = (track.corners ?? [])
      .map((c) => ({ ...c, p: nearest(c.x, c.y) }))
      // Drop corner pins whose source coordinates lie far from the rendered
      // loop (>4% of track span) — bad data that otherwise floats in space.
      // (p.y is SVG-space, negated — compare in raw space.)
      .filter((c) => Math.hypot(c.p.x - c.x, -c.p.y - c.y) < s * 0.04);
    return {
      vb: `${minx - pad} ${-(maxy + pad)} ${w + pad * 2} ${h + pad * 2}`,
      baseW: w + pad * 2,
      baseH: h + pad * 2,
      d,
      corners,
      start: { x: p0[0], y: -p0[1], x1: sfx1.x, y1: sfx1.y, x2: sfx2.x, y2: sfx2.y },
      arrow,
      u: {
        zoneR: s * 0.018,
        cornerR: s * 0.007,
        cornerFont: s * 0.013,
        carR: s * 0.0085,
        carLabelDy: s * 0.02,
        carFont: s * 0.018,
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
    <figure className="relative overflow-hidden rounded-xl border border-white/[0.06] bg-[#08080b]/80">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{ background: "radial-gradient(55% 45% at 50% 45%, rgba(255,255,255,0.05), transparent 70%)" }}
      />
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
        {/* Hollow pro outline — the technique the vector sets use:
            a single centerline path, constant screen-pixel width via
            vector-effect="non-scaling-stroke". Same 2px on every track,
            at every zoom. Halo is a flat wide stroke, no blur filter. */}
        <path
          d={view.d}
          fill="none"
          stroke="#ffffff"
          strokeWidth={8}
          vectorEffect="non-scaling-stroke"
          strokeLinejoin="round"
          strokeLinecap="round"
          opacity={0.07}
        />
        <path
          d={view.d}
          fill="none"
          stroke="rgba(232,232,238,0.6)"
          strokeWidth={2}
          vectorEffect="non-scaling-stroke"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {/* start/finish — single accent tick (+ caption unless minimal) */}
        <line x1={view.start.x1} y1={view.start.y1} x2={view.start.x2} y2={view.start.y2}
          stroke="#ff2b2b" strokeWidth={2.5} vectorEffect="non-scaling-stroke" strokeLinecap="round" opacity={0.9} />
        {!minimal && (
          <text x={view.start.x} y={view.start.y - u.carLabelDy}
            textAnchor="middle" fontSize={u.carFont * 0.62} fontWeight={700}
            fill="rgba(255,255,255,0.45)" fontFamily="JetBrains Mono, monospace" letterSpacing="1">S/F</text>
        )}
        {/* direction arrow — whisper quiet, omitted when minimal */}
        {!minimal && (
          <>
            <line x1={al.x} y1={al.y} x2={ax2} y2={ay2} stroke="rgba(255,255,255,0.35)" strokeWidth={1.5} vectorEffect="non-scaling-stroke" strokeLinecap="round" />
            <polyline
              points={`${ax2},${ay2} ${ax2 - al.ux * wl + wx * wl * 0.6},${ay2 - al.uy * wl + wy * wl * 0.6} ${ax2 - al.ux * wl - wx * wl * 0.6},${ay2 - al.uy * wl - wy * wl * 0.6}`}
              fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth={1.5} vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />
          </>
        )}
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
                strokeWidth={1.5}
                vectorEffect="non-scaling-stroke"
                opacity={0.55}
                strokeDasharray="4 3"
              />
            );
          })}
        {/* motion trails — only focus cars (selected / follow / leader / battle), max 4.
            Rendering all 20 trails is what turned the map into spaghetti.
            Segments split at feed gaps (splitTrailOnGaps) so a sample gap
            never draws as a streak across the circuit. */}
        {trails &&
          Object.entries(trails)
            .filter(([code]) => code === selected || code === followOn || code === leader || battleSet.has(code))
            .slice(0, 4)
            .flatMap(([code, pts]) => {
              if (!pts || pts.length < 2) return [];
              return splitTrailOnGaps(pts).map((seg, si) => (
                <polyline
                  key={`trail-${code}-${si}`}
                  points={seg.map((p) => `${p.x},${-p.y}`).join(" ")}
                  fill="none"
                  stroke={colourOf.get(code) ?? "#fff"}
                  strokeWidth={2}
                  vectorEffect="non-scaling-stroke"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  opacity={0.5}
                />
              ));
            })}
        {/* corners: whisper dots by default; numbered chips only when interactive; none when minimal */}
        {!minimal && view.corners.map((c) => {
          const active = selectedCorner === c.n;
          if (!onCorner && !active) {
            return (
              <circle
                key={c.n}
                cx={c.p.x}
                cy={c.p.y}
                r={u.cornerR * 0.55}
                fill="rgba(255,255,255,0.16)"
                opacity={0.55}
              />
            );
          }
          const inner = (
            <>
              <circle
                cx={c.p.x}
                cy={c.p.y}
                r={u.cornerR}
                fill={active ? "var(--accent)" : "var(--raised)"}
                stroke={active ? "var(--accent)" : "var(--border-strong)"}
                strokeWidth={1.5}
                vectorEffect="non-scaling-stroke"
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
          const pulse = pulses?.[d.code] ?? null;
          const interactive = !!onSelect;
          const car = (
            <g opacity={d.dim && !hot && !lead && !sel ? 0.38 : 1}>
              {(hot || lead || sel || isFollow) && (
                <circle cx={d.x} cy={-d.y} r={u.carR * 2.1} fill={d.colour} opacity={0.16} />
              )}
              {pulse && (
                <circle cx={d.x} cy={-d.y} r={u.carR * 1.9} fill="none"
                  className="map-pulse"
                  vectorEffect="non-scaling-stroke"
                  stroke={pulse === "up" ? "var(--good)" : "var(--bad)"} strokeWidth={2}>
                  <title>{d.code} {pulse === "up" ? "gained a position ▲" : "lost a position ▼"}</title>
                </circle>
              )}
              {drs && (
                <circle cx={d.x} cy={-d.y} r={u.carR * 2.5} fill="none"
                  vectorEffect="non-scaling-stroke"
                  stroke="var(--accent)" strokeWidth={1.5} opacity={0.85}
                  strokeDasharray="4 3">
                  <title>{d.code} has DRS</title>
                </circle>
              )}
              <circle cx={d.x} cy={-d.y} r={hot || lead || sel ? u.carR * 1.3 : u.carR}
                fill={d.colour} stroke="#08080b" strokeWidth={2} vectorEffect="non-scaling-stroke">
                <title>{d.code}{drs ? " · DRS" : ""}{gap ? ` · ${gap}` : ""}{pulse === "up" ? " · gained a position ▲" : pulse === "down" ? " · lost a position ▼" : ""}</title>
              </circle>
              <circle cx={d.x} cy={-d.y} r={hot || lead || sel ? u.carR * 1.3 : u.carR}
                fill="none" stroke="rgba(255,255,255,0.85)" strokeWidth={0.75} vectorEffect="non-scaling-stroke" style={{ pointerEvents: "none" }} />
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
              aria-label={`Select ${d.code}${drs ? ", DRS open" : ""}${gap ? `, gap ${gap}` : ""}${pulse === "up" ? ", just gained a position" : pulse === "down" ? ", just lost a position" : ""}`}
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
