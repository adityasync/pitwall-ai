/**
 * Z.ai wrapper (docs/07-AI-RULES.md). Provider swappable; key never in browser.
 * Day 1 stub — real route handler lands Day 3 with /api/ask.
 */

export type Evidence = { label: string; value: string; trust: "MEASURED" | "DERIVED" | "ESTIMATE" };

export function buildContextPack(input: {
  race: string;
  t: number;
  lap: number;
  drivers: string[];
  stats: unknown;
  evidence: Evidence[];
  coverage: Record<string, boolean>;
}): Record<string, unknown> {
  return { ...input };
}
