/** Race bundle loader — one place that fetches the small files Easy needs
 *  first (docs/03 loading strategy), with per-file status for States. */

import { loadJson, type LoadStatus } from "./data";
import type { Driver, Intervals, Laps, Meta, Moment, Positions, Stats, Stint, Track, Weather } from "./types";

export type RaceBundle = {
  status: LoadStatus;
  meta: Meta | null;
  drivers: Driver[];
  laps: Laps;
  stints: Record<string, Stint[]>;
  moments: Moment[];
  positions: Positions | null;
  intervals: Intervals | null;
  track: Track | null;
  stats: Stats | null;
  weather: Weather | null;
};

export async function loadRaceBundle(raceId: string): Promise<RaceBundle> {
  const [meta, drivers, laps, stints, moments, positions, intervals, track, stats, weather] =
    await Promise.all([
      loadJson<Meta>(`${raceId}/meta.json`),
      loadJson<Driver[]>(`${raceId}/drivers.json`),
      loadJson<Laps>(`${raceId}/laps.json`),
      loadJson<Record<string, Stint[]>>(`${raceId}/stints.json`),
      loadJson<Moment[]>(`${raceId}/moments.json`),
      loadJson<Positions>(`${raceId}/positions.json`),
      loadJson<Intervals>(`${raceId}/intervals.json`),
      loadJson<Track>(`${raceId}/track.json`),
      loadJson<Stats>(`${raceId}/stats.json`),
      loadJson<Weather>(`${raceId}/weather.json`),
    ]);
  if (meta.status !== "ready" || !meta.data || positions.status !== "ready" || !positions.data) {
    return {
      status: "error",
      meta: meta.data,
      drivers: drivers.data ?? [],
      laps: laps.data ?? {},
      stints: stints.data ?? {},
      moments: moments.data ?? [],
      positions: positions.data,
      intervals: intervals.data,
      track: track.data,
      stats: stats.data,
      weather: weather.data,
    };
  }
  return {
    status: "ready",
    meta: meta.data,
    drivers: drivers.data ?? [],
    laps: laps.data ?? {},
    stints: stints.data ?? {},
    moments: moments.data ?? [],
    positions: positions.data,
    intervals: intervals.data,
    track: track.data,
    stats: stats.data,
    weather: weather.data,
  };
}
