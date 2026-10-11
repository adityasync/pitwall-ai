import { describe, expect, it } from "vitest";
import { headingAt, trailAt, trailsAtT, xyAt, xyAtLinear } from "./map";

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
