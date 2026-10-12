"use client";

import { loadJson } from "./data";
import type { RaceEntry } from "./types";

let cachedFirst: string | null | undefined;
let cachedLatest: string | null | undefined;

/** Latest race by date (ISO YYYY-MM-DD compares lexicographically).
 *  Falls back to the last index entry when dates are missing. Pure — tested. */
export function pickLatest(races: RaceEntry[]): string | null {
  if (races.length === 0) return null;
  let best = races[0];
  for (const r of races) {
    if ((r.date ?? "") > (best.date ?? "")) best = r;
  }
  return best.id;
}

/** First featured race from index.json — the data-driven default wherever a
 *  race is needed and none is selected. Resolves once, then memoizes. */
export async function firstRaceId(): Promise<string | null> {
  if (cachedFirst !== undefined) return cachedFirst;
  const r = await loadJson<{ races: RaceEntry[] }>("index.json");
  cachedFirst = r.status === "ready" && r.data && r.data.races.length > 0 ? r.data.races[0].id : null;
  return cachedFirst;
}

/** Latest race from index.json — the default for landing/hero surfaces so
 *  the site always opens on the most recent Grand Prix. Resolves once. */
export async function latestRaceId(): Promise<string | null> {
  if (cachedLatest !== undefined) return cachedLatest;
  const r = await loadJson<{ races: RaceEntry[] }>("index.json");
  cachedLatest = r.status === "ready" && r.data ? pickLatest(r.data.races) : null;
  return cachedLatest;
}
