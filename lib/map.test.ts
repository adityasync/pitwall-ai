import { describe, expect, it } from "vitest";
import { headingAt, moversAt, smoothOutline, splitTrailOnGaps, trailAt, trailsAtT, xyAt, xyAtLinear } from "./map";

const ts = [0, 1, 2, 3, 4];
const xs = [0, 10, 20, 30, 40];
const ys = [0, 5, 15, 30, 50];

describe("xyAt", () => {
  it("passes exactly through MEASURED samples", () => {
    for (let i = 0; i < ts.length; i++) {
      const p = xyAt(xs, ys, ts, ts[i]);
      expect(p?.x).toBeCloseTo(xs[i], 9);
      expect(p?.y).toBeCloseTo(ys[i], 9);
    }
  });
  it("stays within the segment bounding box between samples", () => {
    const p = xyAt(xs, ys, ts, 1.5);
    expect(p!.x).toBeGreaterThanOrEqual(10);
    expect(p!.x).toBeLessThanOrEqual(20);
  });
  it("returns null for missing data or pre-race t", () => {
    expect(xyAt(undefined, ys, ts, 2)).toBeNull();
    expect(xyAt([], [], ts, 2)).toBeNull();
    expect(xyAt(xs, ys, ts, -1)).toBeNull();
  });
  it("linear fallback agrees with smooth at sample times", () => {
    for (const t of ts) {
      const a = xyAt(xs, ys, ts, t);
      const b = xyAtLinear(xs, ys, ts, t);
      expect(a?.x).toBeCloseTo(b!.x, 9);
    }
  });
});

describe("trails", () => {
  it("trailAt returns oldest-first points ending at t", () => {
    const pts = trailAt(xs, ys, ts, 4, 4, 5);
    expect(pts).toHaveLength(5);
    const last = pts[pts.length - 1];
    const here = xyAt(xs, ys, ts, 4);
    expect(last.x).toBeCloseTo(here!.x, 9);
    expect(pts[0].x).toBeLessThanOrEqual(last.x);
  });
  it("trailsAtT only builds requested codes", () => {
    const positions = { hz: 1, t: ts, drivers: { NOR: { pos: [1, 1, 1, 1, 1], x: xs, y: ys } } };
    const out = trailsAtT(positions, ["NOR", "VER"], 4);
    expect(Object.keys(out)).toEqual(["NOR"]);
  });
});

describe("headingAt", () => {
  it("points along travel direction, null when stationary", () => {
    const h = headingAt(xs, ys, ts, 2);
    expect(h).not.toBeNull();
    expect(h!).toBeGreaterThan(-Math.PI);
    const still = headingAt([5, 5, 5, 5, 5], [5, 5, 5, 5, 5], ts, 2);
    expect(still).toBeNull();
  });
});

describe("smoothOutline", () => {  const square: [number, number][] = [[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]];
  it("passes through every MEASURED vertex", () => {
    const out = smoothOutline(square, 40);
    expect(out.length).toBe(40);
    for (const v of square.slice(0, -1)) {
      const hit = out.some((p) => Math.hypot(p[0] - v[0], p[1] - v[1]) < 1e-9);
      expect(hit).toBe(true);
    }
  });
  it("returns short outlines untouched", () => {
    expect(smoothOutline([[0, 0], [1, 1]])).toHaveLength(2);
  });
});

describe("splitTrailOnGaps", () => {
  it("keeps a clean trail whole", () => {
    const pts = [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 200, y: 0 }];
    expect(splitTrailOnGaps(pts)).toHaveLength(1);
  });
  it("breaks at feed-gap jumps and drops singletons", () => {
    const pts = [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 5000, y: 0 }, { x: 5100, y: 0 }, { x: 9000, y: 0 }];
    const segs = splitTrailOnGaps(pts, 1000);
    expect(segs).toHaveLength(2);
    expect(segs[0]).toHaveLength(2);
    expect(segs[1]).toHaveLength(2);
  });
  it("returns nothing for empty or single-point trails", () => {
    expect(splitTrailOnGaps([])).toHaveLength(0);
    expect(splitTrailOnGaps([{ x: 1, y: 2 }])).toHaveLength(0);
  });
});

describe("moversAt", () => {
  // pos sampled each second: NOR P3 -> P2 between t=2 and t=3, VER steady P1.
  const positions = {
    hz: 1,
    t: [0, 1, 2, 3, 4],
    drivers: {
      NOR: { pos: [3, 3, 3, 2, 2] },
      VER: { pos: [1, 1, 1, 1, 1] },
      DNF: { pos: [5, 5, null, null, null] },
    },
  };
  it("flags gainers up and losers down inside the window", () => {
    const m = moversAt(positions, 4, 3);
    expect(m.NOR).toBe("up");
    expect(m.VER).toBeUndefined();
  });
  it("is quiet when nobody changed in the window", () => {
    expect(moversAt(positions, 2, 3)).toEqual({});
  });
  it("ignores drivers with null positions", () => {
    expect(moversAt(positions, 4, 3).DNF).toBeUndefined();
  });
});
