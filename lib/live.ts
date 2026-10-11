/** Live timing scaffold (docs/03 + AGENTS.md).
 *  Replay-first stays the default: this module only runs when the user opens
 *  /live AND NEXT_PUBLIC_LIVE=1. It polls the OpenF1 feed directly from the
 *  browser (CORS-enabled) and degrades to a clear empty state when the paid
 *  live feed is unavailable — never a silent failure, never invented numbers.
 *
 *  OpenF1 shapes (free historical, paid live):
 *    GET /v1/sessions?session_key=latest -> [{session_key, session_name, location, ...}]
 *    GET /v1/drivers?session_key=X       -> [{driver_number, name_acronym, team_colour, ...}]
 *    GET /v1/location?session_key=X&date>ISO -> [{driver_number, x, y, date}]
 *    GET /v1/position?session_key=X&date>ISO -> [{driver_number, position, date}]
 *    GET /v1/intervals?session_key=X&date>ISO -> [{driver_number, gap_to_leader, interval, date}]
 */

"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export const OPENF1 = "https://api.openf1.org/v1";
export const LIVE_POLL_MS = 3000;
export const LIVE_WINDOW_S = 20;

export function liveEnabled(): boolean {
  return (process.env.NEXT_PUBLIC_LIVE ?? "0") === "1";
}

export type LiveSession = {
  session_key: number;
  session_name: string;
  location: string;
  date_start: string;
};

export type LiveDriver = {
  driver_number: number;
  code: string;
  name: string;
  teamColour: string;
};

export type LivePoint = { code: string; x: number; y: number; colour: string };
export type LiveTowerRow = {
  code: string;
  colour: string;
  pos: number | null;
  gapLeader: number | null;
  gapAhead: number | null;
};

async function get<T>(url: string): Promise<T> {
  const res = await fetch(url, { cache: "no-store" });
  if (res.status === 401 || res.status === 403) {
    throw new Error("paid");
  }
  if (res.status === 429) throw new Error("throttled — retrying");
  if (!res.ok) throw new Error(`openf1 ${res.status}`);
  return (await res.json()) as T;
}

function sinceIso(secondsBack: number): string {
  return new Date(Date.now() - secondsBack * 1000).toISOString().slice(0, 19);
}

/** Latest row per driver_number by date (OpenF1 returns history unless filtered). */
export function latestByDriver<T extends { driver_number: number; date: string }>(rows: T[]): Map<number, T> {
  const out = new Map<number, T>();
  for (const r of rows) {
    const cur = out.get(r.driver_number);
    if (!cur || r.date > cur.date) out.set(r.driver_number, r);
  }
  return out;
}

export function normaliseDrivers(rows: Record<string, unknown>[]): LiveDriver[] {
  return rows.map((r) => {
    const num = Number(r["driver_number"]);
    const code = String(r["name_acronym"] ?? num);
    const raw = String(r["team_colour"] ?? "ffffff").replace("#", "");
    return {
      driver_number: num,
      code,
      name: String(r["full_name"] ?? code),
      teamColour: `#${raw}`,
    };
  });
}

/** Derive a track outline from scattered location points (live sessions have
 *  no stored outline). Moving-average + stride, mirroring pipeline
 *  _smooth_outline so live and replay render with the same primitive. */
export function outlineFromPoints(
  pts: { x: number; y: number }[],
  target = 600,
  window = 9
): { outline: [number, number][]; bounds: [number, number, number, number] } | null {
  if (pts.length < 10) return null;
  // order points by nearest-neighbour walk so the polyline reads as one lap
  const order: { x: number; y: number }[] = [pts[0]];
  const used = new Set([0]);
  let cur = pts[0];
  for (let n = 1; n < pts.length; n++) {
    let bi = -1;
    let bd = Infinity;
    for (let i = 0; i < pts.length; i++) {
      if (used.has(i)) continue;
      const d = (pts[i].x - cur.x) ** 2 + (pts[i].y - cur.y) ** 2;
      if (d < bd) {
        bd = d;
        bi = i;
      }
    }
    // teleport guard: location (0,0) warps or session jumps start a new lap
    if (bi < 0 || bd > 1e9) break;
    used.add(bi);
    cur = pts[bi];
    order.push(cur);
    if (order.length >= 4000) break;
  }
  const w = Math.max(1, Math.min(window, Math.floor(order.length / 10)));
  const sx: number[] = [];
  const sy: number[] = [];
  for (let i = 0; i < order.length; i++) {
    let ax = 0;
    let ay = 0;
    let c = 0;
    for (let k = -Math.floor(w / 2); k <= Math.floor(w / 2); k++) {
      const j = i + k;
      if (j < 0 || j >= order.length) continue;
      ax += order[j].x;
      ay += order[j].y;
      c++;
    }
    sx.push(ax / c);
    sy.push(ay / c);
  }
  const step = Math.max(1, Math.floor(sx.length / target));
  const outline: [number, number][] = [];
  for (let i = 0; i < sx.length; i += step) outline.push([sx[i], sy[i]]);
  const xs = outline.map((p) => p[0]);
  const ys = outline.map((p) => p[1]);
  return {
    outline,
    bounds: [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)],
  };
}

export type LiveSnapshot = {
  session: LiveSession;
  drivers: LiveDriver[];
  points: LivePoint[];
  tower: LiveTowerRow[];
  outline: { outline: [number, number][]; bounds: [number, number, number, number] } | null;
  fetchedAt: number;
};

export async function fetchLiveSnapshot(accum: { x: number; y: number }[]): Promise<LiveSnapshot> {
  const [sessRows, driverRows] = await Promise.all([
    get<Record<string, unknown>[]>(`${OPENF1}/sessions?session_key=latest`),
    get<Record<string, unknown>[]>(`${OPENF1}/drivers?session_key=latest`),
  ]);
  const s = sessRows[0];
  if (!s) throw new Error("no live session right now");
  const session: LiveSession = {
    session_key: Number(s["session_key"]),
    session_name: String(s["session_name"] ?? "Session"),
    location: String(s["location"] ?? ""),
    date_start: String(s["date_start"] ?? ""),
  };
  const drivers = normaliseDrivers(driverRows);
  const colourOf = new Map(drivers.map((d) => [d.driver_number, d.teamColour]));
  const codeOf = new Map(drivers.map((d) => [d.driver_number, d.code]));
  const since = sinceIso(LIVE_WINDOW_S);
  const key = `session_key=${session.session_key}`;
  const [locRows, posRows, ivRows] = await Promise.all([
    get<{ driver_number: number; x: number | null; y: number | null; date: string }[]>(
      `${OPENF1}/location?${key}&date>${since}`
    ),
    get<{ driver_number: number; position: number | null; date: string }[]>(
      `${OPENF1}/position?${key}&date>${since}`
    ),
    get<{ driver_number: number; gap_to_leader: number | string | null; interval: number | string | null; date: string }[]>(
      `${OPENF1}/intervals?${key}&date>${since}`
    ),
  ]);
  const loc = latestByDriver(
    locRows.filter((r) => r.x != null && r.y != null && !(r.x === 0 && r.y === 0))
  );
  const pos = latestByDriver(posRows);
  const iv = latestByDriver(ivRows);
  const num = (v: unknown): number | null => {
    if (v == null) return null;
    const n = typeof v === "number" ? v : Number(v);
    return Number.isFinite(n) ? n : null;
  };
  const points: LivePoint[] = [];
  for (const [n, r] of loc) {
    const code = codeOf.get(n) ?? String(n);
    points.push({ code, x: r.x as number, y: r.y as number, colour: colourOf.get(n) ?? "#fff" });
    accum.push({ x: r.x as number, y: r.y as number });
  }
  const tower: LiveTowerRow[] = drivers.map((d) => {
    const p = pos.get(d.driver_number)?.position ?? null;
    const g = iv.get(d.driver_number);
    return {
      code: d.code,
      colour: d.teamColour,
      pos: typeof p === "number" ? p : null,
      gapLeader: num(g?.gap_to_leader),
      gapAhead: num(g?.interval),
    };
  }).sort((a, b) => (a.pos ?? 99) - (b.pos ?? 99));
  const outline = outlineFromPoints(accum.slice(-4000));
  return { session, drivers, points, tower, outline, fetchedAt: Date.now() };
}

export function useLiveTiming(pollMs = LIVE_POLL_MS) {
  const [snap, setSnap] = useState<LiveSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [paused, setPaused] = useState(false);
  const accum = useRef<{ x: number; y: number }[]>([]);
  const enabled = liveEnabled();

  const tick = useCallback(async () => {
    try {
      const s = await fetchLiveSnapshot(accum.current);
      setSnap(s);
      setError(null);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "live fetch failed";
      setError(msg === "paid" ? "paid" : msg);
    }
  }, []);

  useEffect(() => {
    if (!enabled || paused) return;
    let live = true;
    let id = 0;
    (async () => {
      await tick();
      if (!live) return;
      id = window.setInterval(tick, pollMs);
    })();
    return () => {
      live = false;
      window.clearInterval(id);
    };
  }, [enabled, paused, pollMs, tick]);

  return { enabled, snap, error, paused, setPaused, refresh: tick };
}
