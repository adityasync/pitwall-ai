import { describe, expect, it } from "vitest";
import { indexAtT, lapAtT } from "./clock";

describe("indexAtT", () => {
  it("returns -1 before the first sample", () => {
    expect(indexAtT([10, 20, 30], 5)).toBe(-1);
  });

  it("returns the last index <= t", () => {
    expect(indexAtT([10, 20, 30], 20)).toBe(1);
    expect(indexAtT([10, 20, 30], 25)).toBe(1);
    expect(indexAtT([10, 20, 30], 31)).toBe(2);
  });
});

describe("lapAtT", () => {
  it("derives 1-based lap from lap starts", () => {
    expect(lapAtT([0, 95, 190], 0)).toBe(1);
    expect(lapAtT([0, 95, 190], 94.9)).toBe(1);
    expect(lapAtT([0, 95, 190], 95)).toBe(2);
  });
});
