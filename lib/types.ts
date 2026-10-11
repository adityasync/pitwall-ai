/** Shared race-data types — mirrors docs/05-DATA-SCHEMA.md exactly. */

export type Trust = "MEASURED" | "DERIVED" | "ESTIMATE";

export type Coverage = {
  telemetry: boolean;
  telemetryDrivers?: string[];
  radio: boolean;
  weather: boolean;
  intervals: boolean;
};

export type RaceEntry = {
  id: string;
  year: number;
  round: number;
  name: string;
  circuit: string;
  date: string;
  coverage: Coverage;
  featured: boolean;
  story: string;
};

export type Meta = {
  id: string;
  name: string;
  circuit: string;
  date: string;
  laps: number;
  sessionKey: number;
  startOffset: number;
  lapStarts: number[];
  coverage: Coverage;
};

export type Driver = {
  code: string;
  number: number;
  name: string;
  team: string;
  teamColour: string;
  grid: number | null;
  finish: number | null;
  status: string;
};

export type LapRow = {
  lap: number;
  t: number;
  time: number | null;
  s1: number | null;
  s2: number | null;
  s3: number | null;
  compound: string | null;
  tyreAge: number | null;
  inLap: boolean;
  outLap: boolean;
  flagged: boolean;
  pitLane: boolean;
};
export type Stint = {
  stint: number;
  compound: string | null;
  lapStart: number;
  lapEnd: number;
  ageAtStart: number | null;
};

export type Laps = Record<string, LapRow[]>;

export type Pit = {
  driver: string;
  lap: number;
  t: number;
  duration: number | null;
  stationary: number | null;
};

export type Evidence = { label: string; value: string; trust: Trust };

export type Moment = {
  id: string;
  t: number;
  lap: number;
  type: "overtake" | "pit" | "gap" | "flag" | "fastest" | "tyre" | "incident";
  drivers: string[];
  headline: string;
  evidence: Evidence[];
  explain: {
    easy: { en: string; hi: string };
    pro: { en: string; hi: string };
  };
  confidence: "high" | "medium" | "low";
  links: { page: string; params: Record<string, string | number> };
};

export type DriverPos = { pos: (number | null)[]; x?: number[]; y?: number[] };

export type Positions = {
  hz: number;
  t: number[];
  drivers: Record<string, DriverPos>;
};

export type IntervalSeries = {
  gapLeader: (number | null)[];
  gapAhead: (number | null)[];
  ahead: (string | null)[];
  t: number[];
};

export type Intervals = { t: number[]; drivers: Record<string, IntervalSeries> };

export type Track = {
  outline: [number, number][];
  bounds: [number, number, number, number];
  corners: { n: number; x: number; y: number; dist: number; name: string }[];
  brakingZones: { corner: number | null; startDist: number; endDist: number; trust: Trust }[];
  sectors: number[];
};

export type PaceRow = { median: number; bestLap: number; trust: Trust };

export type Stats = {
  pace: Record<string, PaceRow>;
  degradation: Record<string, Record<string, { slopeSPerLap: number; laps: number; trust: Trust }>>;
  undercut: unknown[];
  overtakes: { t: number; lap: number; drivers: string[] }[];
  fastestLap: { driver: string; lap: number; time: number } | Record<string, never>;
  sectorBest: Record<string, Record<string, number>>;
  cornerLoss: unknown[];
};

export type Weather = {
  t: number[];
  air: (number | null)[];
  track: (number | null)[];
  rain: (number | null)[];
  wind: (number | null)[];
};
