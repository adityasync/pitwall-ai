"use client";

import { loadJson } from "./data";
import type { RaceEntry } from "./types";

let cached: string | null | undefined;
/** First featured race from index.json — the data-driven default wherever a
 *  race is needed and none is selected. Resolves once, then memoizes. */
export async function firstRaceId(): Promise<string | null> {
  if (cached !== undefined) return cached;
  const r = await loadJson<{ races: RaceEntry[] }>("index.json");
  cached = r.status === "ready" && r.data && r.data.races.length > 0 ? r.data.races[0].id : null;
  return cached;
}
