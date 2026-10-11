import { loadJson } from "./data";

export type SeasonYear = {
  year: number;
  races: {
    year: number;
    round: number;
    name: string;
    date: string;
    circuitId: string;
    winner: string | null;
    winnerCode: string | null;
    team: string | null;
    pole: string | null;
    poleCode: string | null;
    fastest: string | null;
    fastestCode: string | null;
    fastestTime: string | null;
    dnfs: number;
    pits: number;
    sprintWinner: string | null;
    sprintWinnerCode: string | null;
  }[];
  champDriver: { driver: string; points: string; wins: string } | null;
  champTeam: { team: string; points: string; wins: string } | null;
};

export type DriverCareer = {
  id: string;
  code: string;
  name: string;
  nationality: string;
  starts: number;
  wins: number;
  podiums: number;
  poles: number;
  fastest: number;
  titles: number;
  points: number;
  dnfs: number;
  sprintWins: number;
};

export type CircuitHistory = {
  id: string;
  ref: string;
  name: string;
  location: string;
  country: string;
  lat: number | null;
  lng: number | null;
  races: number;
  first: number;
  last: number;
  topWinners: { driver: string; wins: number }[];
  lastWinner: { year: number; driver: string; team: string } | null;
  lapRecord: { time: string; driver: string; code: string; year: number } | null;
};

export type TeamHistory = {
  id: string;
  name: string;
  nationality: string;
  titles: number;
  wins: number;
  points: number;
  races: number;
  dnfs: number;
  avgPit: number | null;
  bestPit: number | null;
  pitStops: number;
};

export type TitleYear = {
  year: number;
  codes: string[];
  names: string[];
  rounds: number[];
  points: number[][];
};

export type H2HRow = {
  year: number;
  team: string;
  aCode: string;
  bCode: string;
  qualiA: number;
  qualiB: number;
  raceA: number;
  raceB: number;
};

export type Reliability = {
  causes: { cause: string; count: number }[];
  pitLeaders: { team: string; avg: number; best: number; count: number }[];
  totalPits: number;
  totalDnfs: number;
};

/** Ergast mirror (data/*.csv) prebuilt by pipeline/build_history.py.
 *  Static history only — replays stay on OpenF1. */
export async function loadSeasons() {
  return loadJson<SeasonYear[]>("history/seasons.json");
}
export async function loadDriverCareers() {
  return loadJson<DriverCareer[]>("history/drivers.json");
}
export async function loadCircuitHistory() {
  return loadJson<CircuitHistory[]>("history/circuits.json");
}
export async function loadTeams() {
  return loadJson<TeamHistory[]>("history/teams.json");
}
export async function loadTitle() {
  return loadJson<TitleYear[]>("history/title.json");
}
export async function loadH2H() {
  return loadJson<H2HRow[]>("history/h2h.json");
}
export async function loadReliability() {
  return loadJson<Reliability>("history/reliability.json");
}
