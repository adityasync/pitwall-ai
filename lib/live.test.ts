import { describe, expect, it } from "vitest";
import { latestByDriver, normaliseDrivers, outlineFromPoints } from "./live";

describe("latestByDriver", () => {
  it("keeps the newest row per driver", () => {
    const rows = [
      { driver_number: 1, date: "2026-01-01T00:00:01", position: 2 },
      { driver_number: 1, date: "2026-01-01T00:00:05", position: 1 },
      { driver_number: 2, date: "2026-01-01T00:00:03", position: 3 },
    ];
    const out = latestByDriver(rows);
    expect(out.get(1)?.position).toBe(1);
    expect(out.get(2)?.position).toBe(3);
  });
});

describe("normaliseDrivers", () => {
  it("prefixes team colours and falls back to the number", () => {
    const out = normaliseDrivers([{ driver_number: 4, name_acronym: "NOR", team_colour: "FF8000" }]);
    expect(out[0]).toMatchObject({ code: "NOR", teamColour: "#FF8000" });
  });
});

describe("outlineFromPoints", () => {
  it("returns null when too few points, bounds otherwise", () => {
    expect(outlineFromPoints([{ x: 0, y: 0 }])).toBeNull();
    const pts = Array.from({ length: 200 }, (_, i) => ({
      x: Math.cos((i / 200) * Math.PI * 2) * 1000,
      y: Math.sin((i / 200) * Math.PI * 2) * 500,
    }));
    const o = outlineFromPoints(pts);
    expect(o).not.toBeNull();
    expect(o!.outline.length).toBeGreaterThan(10);
    const [minx, miny, maxx, maxy] = o!.bounds;
    expect(maxx - minx).toBeGreaterThan(1000);
    expect(maxy - miny).toBeGreaterThan(500);
  });
});
