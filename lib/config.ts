/**
 * Central tunables — no magic numbers anywhere else.
 * Provenance: SPEC (docs/ prescribe it) · DOMAIN (F1 regulation or physics)
 * · MODEL (our assumption — always surfaced as ESTIMATE with an explanation).
 */

// SPEC docs/03 — replay speeds.
export const SPEEDS = [1, 2, 5, 10, 30] as const;

// SPEC docs/07 — Ask limits.
export const ASK_RATE_PER_HOUR = 20;
export const ASK_MAX_CHARS = 300;
export const ASK_MAX_TOKENS = 400;
// MODEL — context size: newest N non-low moments + first M drivers in the pack.
export const ASK_CONTEXT_MOMENTS = 10;
export const ASK_CONTEXT_DRIVERS = 6;

// MODEL — ops choice: cached answers older than this are regenerated.
export const ASK_CACHE_TTL_DAYS = 30;

// DOMAIN — DRS eligibility needs <1 s to the car ahead.
export const DRS_GAP_S = 1.0;

// MODEL — what counts as an on-track battle in Battles/Pro.
export const BATTLE_GAP_S = 2.0;

// MODEL — tyre health bars until degradation-based health lands:
// health = 1 − age/TYRE_HEALTH_LAPS, labelled ESTIMATE with the footnote.
export const TYRE_HEALTH_LAPS = 45;

// MODEL — map trail gap cutoff (track units ≈7/m): an F1 car covers at most
// ~700u in the ~1 s between trail samples. Jumps beyond this are OpenF1 feed
// sample gaps (both endpoints verified on-track) — drawing a line across one
// paints a fake streak across the map, so trail segments split there.
export const MAP_TRAIL_MAX_JUMP_U = 1000;

// SPEC docs/05 — telemetry resampled every 5–10 m of lap distance.
export const LAP_RESAMPLE_M = 10;

// MODEL — battle-call closing assumption shown as an estimate.
export const BATTLE_CLOSE_S_PER_LAP = 0.3;

// MODEL — strategy simulator defaults (user-adjustable in the UI).
export const STRATEGY = {
  freshTyreEdgeSPerLap: 0.02,
  defaultWearSPerLap: 0.05,
  horizonLaps: 10,
  threatGapS: 6,
} as const;

// DOMAIN — FIA standard race points scale.
export const RACE_POINTS_SCALE = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1];

// MODEL — undercut threat score weights (0–100, labelled ESTIMATE).
export const THREAT = {
  basePerGap: 60,
  gapScaleS: 8,
  oldTyreBonus: 20,
  oldTyreAgeLaps: 15,
  min: 5,
  max: 90,
} as const;
