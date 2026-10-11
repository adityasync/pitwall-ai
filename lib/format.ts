/** Formatting: gaps, times, laps. Numbers keep trust labels at the panel level. */

export function fmtGap(seconds: number | null): string {
  if (seconds == null || !Number.isFinite(seconds)) return "—";
  return `${seconds >= 0 ? "+" : "−"}${Math.abs(seconds).toFixed(1)}s`;
}

export function fmtLapTime(seconds: number | null): string {
  if (seconds == null || !Number.isFinite(seconds)) return "—";
  const m = Math.floor(seconds / 60);
  const s = (seconds - m * 60).toFixed(3);
  return `${m}:${s.padStart(6, "0")}`;
}
