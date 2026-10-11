import { describe, expect, it } from "vitest";
import { median } from "./stats";
import { fmtGap, fmtLapTime } from "./format";

describe("median", () => {
  it("returns null for empty input", () => {
    expect(median([])).toBeNull();
  });

  it("handles odd and even counts", () => {
    expect(median([91.2])).toBe(91.2);
    expect(median([90, 92, 91])).toBe(91);
    expect(median([90, 92])).toBe(91);
  });
});

describe("format", () => {
  it("formats gaps and lap times, em-dash when missing", () => {
    expect(fmtGap(null)).toBe("—");
    expect(fmtGap(1.24)).toBe("+1.2s");
    expect(fmtLapTime(89.456)).toBe("1:29.456");
    expect(fmtLapTime(null)).toBe("—");
  });
});
