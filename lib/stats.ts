/** Stat helpers with trust labels (docs/04 + 05). Tested with Vitest. */

export type Trust = "MEASURED" | "DERIVED" | "ESTIMATE";

export function median(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  const s = [...values].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 === 1 ? s[m] : (s[m - 1] + s[m]) / 2;
}
