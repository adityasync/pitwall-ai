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
