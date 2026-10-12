/**
 * Replay clock helpers (docs/03-ARCHITECTURE.md).
 * A rAF loop advances t by dt*speed when playing; panels derive views
 * from t with binary search on pre-sorted arrays. Never re-fetch on tick.
 */

/** Binary search: index of last element <= t in a sorted array. */
export function indexAtT(times: readonly number[], t: number): number {
  let lo = 0;
  let hi = times.length - 1;
  let ans = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (times[mid] <= t) {
      ans = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return ans;
}

/** Derive lap (1-based) from t using the lap-start table in laps/meta. */
export function lapAtT(lapStarts: readonly number[], t: number): number {
  return indexAtT(lapStarts, t) + 1;
}

/** Minimum ms between replay-clock commits at a given playback speed.
 *  Tower text, gaps and dots all resolve to ≥1 s data, so committing every
 *  animation frame only burns renders. 1x commits every 120 ms (0.12 s of
 *  race time — visually smooth); 10x+ commits every frame. */
export function commitIntervalMs(speed: number): number {
  if (!Number.isFinite(speed) || speed <= 0) return 120;
  return Math.max(16, Math.round(120 / speed));
}
