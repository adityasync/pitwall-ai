/** Real timing-screen derivations (all MEASURED inputs, DERIVED outputs).
 *  Inputs come straight from race_control.json / laps.json — no models here. */

export type RaceControlMsg = {
  t: number;
  lap: number;
  category: string;
  flag: string | null;
  message: string;
};

export type TrackStatus = { key: "PRE" | "GREEN" | "YELLOW" | "SC" | "VSC" | "RED" | "FINISH"; label: string };

const STATUS_STYLE: Record<TrackStatus["key"], string> = {
  PRE: "text-[var(--muted)] border-[var(--border-strong)]",
  GREEN: "text-[var(--good)] border-[var(--good)]/60 bg-[var(--good)]/10",
  YELLOW: "text-[var(--flag)] border-[var(--flag)]/60 bg-[var(--flag)]/10",
  SC: "text-[var(--flag)] border-[var(--flag)]/60 bg-[var(--flag)]/10",
  VSC: "text-[var(--flag)] border-[var(--flag)]/60 bg-[var(--flag)]/10",
  RED: "text-[var(--bad)] border-[var(--bad)]/60 bg-[var(--bad)]/10",
  FINISH: "text-black bg-[var(--flag)] border-[var(--flag)]",
};

export function statusStyle(key: TrackStatus["key"]): string {
  return STATUS_STYLE[key];
}

/** Track status at time t: latest flag-category message wins. BLUE (backmarker)
 *  and BLACK AND WHITE (driver warning) never change track status. */
export function trackStatusAtT(msgs: RaceControlMsg[], t: number): TrackStatus {
  let s: TrackStatus = { key: "PRE", label: "SESSION NOT STARTED" };
  let started = false;
  for (const m of msgs) {
    if (m.t > t) break;
    if (m.category === "SessionStatus") {
      if (m.message.includes("STARTED")) {
        started = true;
        s = { key: "GREEN", label: "GREEN" };
      } else if (m.message.includes("FINISHED")) {
        s = { key: "FINISH", label: "CHEQUERED" };
      }
      continue;
    }
    if (m.category !== "Flag") continue;
    const msg = m.message.toUpperCase();
    if (msg.includes("SAFETY CAR DEPLOYED") || msg === "SAFETY CAR DEPLOYED") {
      s = { key: "SC", label: "SAFETY CAR" };
    } else if (msg.includes("VIRTUAL SAFETY CAR")) {
      s = { key: "VSC", label: "VIRTUAL SC" };
    } else if (m.flag === "CHEQUERED" || msg.includes("CHEQUERED")) {
      // checked before RED: "CHEQUERED FLAG" contains the substring "RED FLAG"
      s = { key: "FINISH", label: "CHEQUERED" };
    } else if (msg.includes("RED FLAG")) {
      s = { key: "RED", label: "RED FLAG" };
    } else if (m.flag === "YELLOW" || m.flag === "DOUBLE YELLOW") {
      s = { key: "YELLOW", label: m.flag === "DOUBLE YELLOW" ? "DOUBLE YELLOW" : "YELLOW" };
    } else if (m.flag === "GREEN" || m.flag === "CLEAR") {
      if (started) s = { key: "GREEN", label: "GREEN" };
    }
  }
  return s;
}

/** DRS at time t: last Drs-category message wins, default disabled. */
export function drsAtT(msgs: RaceControlMsg[], t: number): boolean {
  let on = false;
  for (const m of msgs) {
    if (m.t > t) break;
    if (m.category !== "Drs") continue;
    on = m.message.toUpperCase().includes("ENABLED");
  }
  return on;
}

export type LapLike = {
  lap: number;
  t: number;
  time: number | null;
  s1: number | null;
  s2: number | null;
  s3: number | null;
  compound: string | null;
  tyreAge: number | null;
  pitLane?: boolean;
  flagged?: boolean;
};

/** Laps clean enough for bests: timed, not in the pit lane. */
export function cleanLaps(rows: LapLike[]): LapLike[] {
  return rows.filter((r) => r.time != null && !r.pitLane);
}

export type SectorBests = {
  session: { s1: number | null; s2: number | null; s3: number | null };
  personal: Record<string, { s1: number | null; s2: number | null; s3: number | null }>;
};

/** Session-best and personal-best sectors across clean laps (DERIVED). */
export function sectorBests(laps: Record<string, LapLike[]>): SectorBests {
  const session = { s1: null as number | null, s2: null as number | null, s3: null as number | null };
  const personal: SectorBests["personal"] = {};
  for (const [code, rows] of Object.entries(laps)) {
    const p = { s1: null as number | null, s2: null as number | null, s3: null as number | null };
    for (const r of cleanLaps(rows)) {
      for (const k of ["s1", "s2", "s3"] as const) {
        const v = r[k];
        if (v == null) continue;
        if (p[k] == null || v < (p[k] as number)) p[k] = v;
        if (session[k] == null || v < (session[k] as number)) session[k] = v;
      }
    }
    personal[code] = p;
  }
  return { session, personal };
}

/** Best clean lap per driver (DERIVED). */
export function bestLaps(laps: Record<string, LapLike[]>): Record<string, LapLike | null> {
  const out: Record<string, LapLike | null> = {};
  for (const [code, rows] of Object.entries(laps)) {
    let best: LapLike | null = null;
    for (const r of cleanLaps(rows)) {
      if (r.time == null) continue;
      if (!best || (best.time as number) > r.time) best = r;
    }
    out[code] = best;
  }
  return out;
}

/** Last fully completed lap at time t (lap start + lap time both behind us). */
export function lastCompletedLap(rows: LapLike[], t: number): LapLike | null {
  let out: LapLike | null = null;
  for (const r of rows) {
    if (r.time == null) continue;
    if (r.t + r.time <= t) out = r;
    else break;
  }
  return out;
}

/** Row covering time t (the lap the car is on), or null. */
export function lapAtTime(rows: LapLike[], t: number): LapLike | null {
  let out: LapLike | null = null;
  for (const r of rows) {
    if (r.t <= t) out = r;
    else break;
  }
  return out;
}
export function sectorTone(
  v: number | null,
  driverBest: number | null,
  sessionBest: number | null
): "purple" | "green" | null {
  if (v == null) return null;
  if (sessionBest != null && v <= sessionBest + 1e-9) return "purple";
  if (driverBest != null && v <= driverBest + 1e-9) return "green";
  return null;
}
