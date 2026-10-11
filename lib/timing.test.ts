import { describe, expect, it } from "vitest";
import {
  drsAtT,
  lastCompletedLap,
  sectorBests,
  sectorTone,
  trackStatusAtT,
  type RaceControlMsg,
} from "./timing";

const msg = (t: number, category: string, flag: string | null, message: string): RaceControlMsg => ({
  t, lap: 1, category, flag, message,
});

describe("trackStatusAtT", () => {
  it("starts green after session start", () => {
    const rc = [msg(0, "SessionStatus", null, "SESSION STARTED")];
    expect(trackStatusAtT(rc, 10).key).toBe("GREEN");
  });
  it("yellow on double yellow, back to green on clear", () => {
    const rc = [
      msg(0, "SessionStatus", null, "SESSION STARTED"),
      msg(100, "Flag", "DOUBLE YELLOW", "DOUBLE YELLOW IN TRACK SECTOR 2"),
      msg(200, "Flag", "CLEAR", "TRACK CLEAR"),
    ];
    expect(trackStatusAtT(rc, 150).key).toBe("YELLOW");
    expect(trackStatusAtT(rc, 250).key).toBe("GREEN");
  });
  it("ignores blue and black-and-white flags", () => {
    const rc = [
      msg(0, "SessionStatus", null, "SESSION STARTED"),
      msg(100, "Flag", "BLUE", "BLUE FLAG FOR TSU"),
      msg(110, "Flag", "BLACK AND WHITE", "WARNING FOR VER"),
    ];
    expect(trackStatusAtT(rc, 120).key).toBe("GREEN");
  });
  it("chequered ends the session", () => {
    const rc = [
      msg(0, "SessionStatus", null, "SESSION STARTED"),
      msg(6000, "Flag", "CHEQUERED", "CHEQUERED FLAG"),
    ];
    expect(trackStatusAtT(rc, 6100).key).toBe("FINISH");
  });
});

describe("drsAtT", () => {
  it("follows enable/disable messages", () => {
    const rc = [
      msg(-100, "Drs", null, "DRS DISABLED"),
      msg(100, "Drs", null, "DRS ENABLED"),
    ];
    expect(drsAtT(rc, 0)).toBe(false);
    expect(drsAtT(rc, 200)).toBe(true);
  });
});

describe("sectorBests", () => {
  const laps = {
    NOR: [
      { lap: 1, t: 0, time: 95, s1: 29, s2: 40, s3: 26, compound: "MEDIUM", tyreAge: 1 },
      { lap: 2, t: 95, time: 94, s1: 28.5, s2: 39.5, s3: 26, compound: "MEDIUM", tyreAge: 2 },
    ],
    VER: [
      { lap: 1, t: 0, time: 96, s1: 29.5, s2: 40.5, s3: 26.5, compound: "MEDIUM", tyreAge: 1 },
      { lap: 2, t: 96, time: null, s1: null, s2: null, s3: null, compound: "MEDIUM", tyreAge: 2, pitLane: true },
    ],
  };
  it("computes session and personal bests, skipping pit-lane laps", () => {
    const sb = sectorBests(laps);
    expect(sb.session.s1).toBeCloseTo(28.5);
    expect(sb.personal.VER.s1).toBeCloseTo(29.5);
  });
  it("purple beats green", () => {
    expect(sectorTone(28.5, 28.5, 28.5)).toBe("purple");
    expect(sectorTone(29, 29, 28.5)).toBe("green");
    expect(sectorTone(30, 29, 28.5)).toBe(null);
  });
});

describe("lastCompletedLap", () => {
  const rows = [
    { lap: 1, t: 0, time: 100, s1: 1, s2: 1, s3: 1, compound: "MEDIUM", tyreAge: 0 },
    { lap: 2, t: 100, time: 95, s1: 1, s2: 1, s3: 1, compound: "MEDIUM", tyreAge: 1 },
  ];
  it("returns the last lap fully behind t", () => {
    expect(lastCompletedLap(rows, 150)?.lap).toBe(1);
    expect(lastCompletedLap(rows, 200)?.lap).toBe(2);
  });
});
