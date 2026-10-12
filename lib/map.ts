import { indexAtT } from "./clock";
import { MAP_TRAIL_MAX_JUMP_U } from "./config";
import type { Positions } from "./types";
import type { MapDot } from "@/components/TrackMap";

/** Interpolate a car's x,y at time t from 1Hz samples (docs/05).
 *  Catmull-Rom through MEASURED samples — the curve passes through every
 *  sample, only the path *between* samples is smoothed (DERIVED presentation).
 *  Falls back to linear at the edges or when fewer than 4 samples exist. */
export function xyAt(
  xs: readonly number[] | undefined,
  ys: readonly number[] | undefined,
  ts: readonly number[],
  t: number
): { x: number; y: number } | null {
  if (!xs || !ys || xs.length === 0) return null;
  const i = indexAtT(ts, t);
  if (i < 0) return null;
  const n = xs.length;
  const j = Math.min(i, n - 1);
  if (j >= n - 1) return { x: xs[n - 1], y: ys[n - 1] };
  const t0 = ts[Math.min(i, ts.length - 1)];
  const t1 = ts[Math.min(i + 1, ts.length - 1)];
  const f = t1 > t0 ? Math.min(1, Math.max(0, (t - t0) / (t1 - t0))) : 0;
  // Need 4 points for Catmull-Rom; use linear near the edges.
  if (n < 4 || j === 0 || j + 2 >= n) {
    return { x: xs[j] + (xs[j + 1] - xs[j]) * f, y: ys[j] + (ys[j + 1] - ys[j]) * f };
  }
  const cr = (p0: number, p1: number, p2: number, p3: number) => {
    const f2 = f * f;
    const f3 = f2 * f;
    return (
      0.5 * (2 * p1 + (-p0 + p2) * f + (2 * p0 - 5 * p1 + 4 * p2 - p3) * f2 + (-p0 + 3 * p1 - 3 * p2 + p3) * f3)
    );
  };
  return { x: cr(xs[j - 1], xs[j], xs[j + 1], xs[j + 2]), y: cr(ys[j - 1], ys[j], ys[j + 1], ys[j + 2]) };
}

/** Straight-line interpolation (no smoothing) — for tests / perf fallback. */
export function xyAtLinear(
  xs: readonly number[] | undefined,
  ys: readonly number[] | undefined,
  ts: readonly number[],
  t: number
): { x: number; y: number } | null {
  if (!xs || !ys || xs.length === 0) return null;
  const i = indexAtT(ts, t);
  if (i < 0) return null;
  const j = Math.min(i, xs.length - 1);
  const k = Math.min(j + 1, xs.length - 1);
  if (j === k) return { x: xs[j], y: ys[j] };
  const t0 = ts[Math.min(i, ts.length - 1)];
  const t1 = ts[Math.min(i + 1, ts.length - 1)];
  const f = t1 > t0 ? Math.min(1, Math.max(0, (t - t0) / (t1 - t0))) : 0;
  return { x: xs[j] + (xs[k] - xs[j]) * f, y: ys[j] + (ys[k] - ys[j]) * f };
}

/** Trail behind a car: positions at t, t-step, ... (oldest first).
 *  Linear between samples — deliberately NOT Catmull-Rom: across an OpenF1
 *  feed gap CR rings off-track, while linear stays on the chord (which
 *  splitTrailOnGaps then drops). Used for motion trails — DERIVED. */
export function trailAt(
  xs: readonly number[] | undefined,
  ys: readonly number[] | undefined,
  ts: readonly number[],
  t: number,
  seconds = 12,
  samples = 12
): { x: number; y: number }[] {
  if (!xs || !ys || xs.length === 0) return [];
  const out: { x: number; y: number }[] = [];
  const step = seconds / Math.max(1, samples - 1);
  for (let k = samples - 1; k >= 0; k--) {
    const p = xyAtLinear(xs, ys, ts, t - k * step);
    if (p) out.push(p);
  }
  return out;
}

/** Split a trail into drawable segments, breaking wherever consecutive
 *  points jump further than a car can physically travel between samples.
 *  Feed gaps stay gaps on screen instead of streaks across the map.
 *  Points are MEASURED; only the connecting lines are presentation. */
export function splitTrailOnGaps(
  pts: readonly { x: number; y: number }[],
  maxJump = MAP_TRAIL_MAX_JUMP_U
): { x: number; y: number }[][] {
  const segs: { x: number; y: number }[][] = [];
  let cur: { x: number; y: number }[] = [];
  for (const p of pts) {
    const prev = cur[cur.length - 1];
    if (prev && Math.hypot(p.x - prev.x, p.y - prev.y) > maxJump) {
      if (cur.length >= 2) segs.push(cur);
      cur = [];
    }
    cur.push({ x: p.x, y: p.y });
  }
  if (cur.length >= 2) segs.push(cur);
  return segs;
}

/** Heading (radians, SVG space with y negated) from central differences.
 *  Returns null when the car is stationary or off the samples. */
export function headingAt(
  xs: readonly number[] | undefined,
  ys: readonly number[] | undefined,
  ts: readonly number[],
  t: number
): number | null {
  const a = xyAt(xs, ys, ts, t - 1);
  const b = xyAt(xs, ys, ts, t + 1);
  if (!a || !b) return null;
  const dx = b.x - a.x;
  const dy = -(b.y - a.y); // SVG space: y already negated on render
  if (Math.hypot(dx, dy) < 1e-9) return null;
  return Math.atan2(dy, dx);
}

/** All cars that have map coordinates, interpolated at t.
 *  colour from drivers list; battle codes get highlighted by caller. */
export function dotsAtT(
  positions: Positions,
  drivers: { code: string; teamColour: string }[],
  t: number
): MapDot[] {
  const colourOf = new Map(drivers.map((d) => [d.code, d.teamColour]));
  const out: MapDot[] = [];
  for (const [code, s] of Object.entries(positions.drivers)) {
    const p = xyAt(s.x, s.y, positions.t, t);
    if (!p) continue;
    out.push({ code, x: p.x, y: p.y, colour: colourOf.get(code) ?? "#fff" });
  }
  return out;
}

/** Motion trails for a subset of cars (battle / selected / leader).
 *  Keeps polyline counts small: only requested codes get trails. */
export function trailsAtT(
  positions: Positions,
  codes: readonly string[],
  t: number,
  seconds = 12,
  samples = 12
): Record<string, { x: number; y: number }[]> {
  const out: Record<string, { x: number; y: number }[]> = {};
  for (const code of codes) {
    const s = positions.drivers[code];
    if (!s) continue;
    const pts = trailAt(s.x, s.y, positions.t, t, seconds, samples);
    if (pts.length >= 2) out[code] = pts;
  }
  return out;
}

/** Resample a closed track outline through a Catmull-Rom spline.
 *  Telemetry outlines are coarse polygons (70–110 pts, chords up to 12% of
 *  the track span) — rendering them raw looks faceted and cheap. The spline
 *  passes through every MEASURED vertex; only the path *between* vertices is
 *  smoothed (DERIVED presentation), same contract as xyAt. Handles the
 *  pipeline's duplicated closing point. Returns ~target total points. */
export function smoothOutline(
  outline: readonly (readonly [number, number] | readonly number[])[],
  target = 400
): [number, number][] {
  const pts: [number, number][] = outline.map((p) => [p[0], p[1]]);
  if (pts.length < 4) return pts;
  // strip duplicated closing vertex
  const f = pts[0];
  const l = pts[pts.length - 1];
  const span = Math.max(
    ...pts.map((p) => Math.abs(p[0] - f[0]) + Math.abs(p[1] - f[1])),
    1
  );
  const closed = pts.length > 1 && Math.hypot(l[0] - f[0], l[1] - f[1]) < span * 1e-6;
  const ring = closed ? pts.slice(0, -1) : pts;
  const n = ring.length;
  if (n < 4) return pts;
  const per = Math.max(2, Math.min(10, Math.round(target / n)));
  const cr = (p0: number, p1: number, p2: number, p3: number, u: number) => {
    const u2 = u * u;
    const u3 = u2 * u;
    return (
      0.5 * (2 * p1 + (-p0 + p2) * u + (2 * p0 - 5 * p1 + 4 * p2 - p3) * u2 + (-p0 + 3 * p1 - 3 * p2 + p3) * u3)
    );
  };
  const out: [number, number][] = [];
  for (let i = 0; i < n; i++) {
    const p0 = ring[(i - 1 + n) % n];
    const p1 = ring[i];
    const p2 = ring[(i + 1) % n];
    const p3 = ring[(i + 2) % n];
    for (let j = 0; j < per; j++) {
      const u = j / per;
      out.push([cr(p0[0], p1[0], p2[0], p3[0], u), cr(p0[1], p1[1], p2[1], p3[1], u)]);
    }
  }
  return out;
}

function posAt(pos: readonly (number | null)[], ts: readonly number[], t: number): number | null {
  const i = indexAtT(ts, t);
  if (i < 0) return null;
  return pos[Math.min(i, pos.length - 1)] ?? null;
}

/** Cars that gained ("up") or lost ("down") a position within the last
 *  `windowS` seconds — drives the map pulse rings, synced with the tower
 *  flash which compares the same window. DERIVED presentation. */
export function moversAt(
  positions: Positions,
  t: number,
  windowS = 3
): Record<string, "up" | "down"> {
  const out: Record<string, "up" | "down"> = {};
  for (const [code, s] of Object.entries(positions.drivers)) {
    const now = posAt(s.pos, positions.t, t);
    const then = posAt(s.pos, positions.t, t - windowS);
    if (now == null || then == null || now === then) continue;
    out[code] = now < then ? "up" : "down";
  }
  return out;
}
