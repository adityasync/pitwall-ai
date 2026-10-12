import { describe, expect, it } from "vitest";
import { pickLatest } from "./first-race";
import type { RaceEntry } from "./types";

const entry = (id: string, date: string): RaceEntry =>
  ({ id, date, year: Number(date.slice(0, 4)), round: 1 } as RaceEntry);

describe("pickLatest", () => {
  it("returns null for an empty index", () => {
    expect(pickLatest([])).toBeNull();
  });
  it("picks the max date regardless of index order", () => {
    const races = [entry("2026-19-singapore", "2026-10-11"), entry("2023-16-singapore", "2023-09-17"), entry("2025-24-abu-dhabi", "2025-12-07")];
    expect(pickLatest(races)).toBe("2026-19-singapore");
    expect(pickLatest([...races].reverse())).toBe("2026-19-singapore");
  });
});
