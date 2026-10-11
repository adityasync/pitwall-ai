/** Server-side AI output validation (docs/07-AI-RULES.md) — TS port of the
 *  pipeline validators. Every number quoted must appear in the context pack;
 *  forbidden signals and unlisted driver names are rejected. */

const NUMBER = /\d+(?:\.\d+)?/g;

const FORBIDDEN =
  /\bbrake pressure\b|\bbraking pressure\b|\bsteering\b|\bERS\b|\btyre temperature\b|\btire temperature\b|\btyre wear\b|\btire wear\b|\bfuel load\b|\bengine mode\b|\bbrake bias\b|\bsetup\b/i;

export function numbersIn(text: string): number[] {
  return [...text.matchAll(NUMBER)].map((m) => parseFloat(m[0]));
}

export function numbersOk(text: string, ctx: string): boolean {
  const ctxNums = new Set(numbersIn(ctx));
  const ctxArr = [...ctxNums];
  for (const n of numbersIn(text)) {
    if (!ctxNums.has(n) && !ctxArr.some((c) => Math.abs(c - n) < 1e-9) && !ctx.includes(String(n))) {
      return false;
    }
  }
  return true;
}

export function forbiddenFound(text: string): boolean {
  return FORBIDDEN.test(text);
}

export function surnamesOk(text: string, allowed: Set<string>, roster: Set<string>): boolean {
  for (const m of text.matchAll(/[A-Z][a-z]{2,}/g)) {
    if (roster.has(m[0]) && !allowed.has(m[0])) return false;
  }
  return true;
}

export function comparisonsOk(text: string): boolean {
  // Split on sentence ends only (a dot followed by space); decimal points stay intact.
  for (const sent of text.split(/(?<=[.!?])\s+/)) {
    const faster = sent.match(/(\d+\.\d+)[^.]*?\bfaster than\b[^.]*?(\d+\.\d+)/);
    if (faster && !(parseFloat(faster[1]) < parseFloat(faster[2]))) return false;
    const slower = sent.match(/(\d+\.\d+)[^.]*?\bslower than\b[^.]*?(\d+\.\d+)/);
    if (slower && !(parseFloat(slower[1]) > parseFloat(slower[2]))) return false;
  }
  return true;
}

export function scrubModelTic(text: string, hasEstimate: boolean): string {
  if (hasEstimate) return text;
  return text
    .replace(/\s*\.?\s*this is a model,? not a measurement\.?/gi, (m) =>
      m.trimStart().startsWith(".") ? "." : ""
    )
    .replace(/\.\.+/g, ".")
    .trim();
}

export function validateAiText(
  text: string,
  ctx: string,
  allowedNames: Set<string>,
  rosterNames: Set<string>
): { ok: boolean; reason?: string } {
  if (forbiddenFound(text)) return { ok: false, reason: "forbidden-signal" };
  if (!numbersOk(text, ctx)) return { ok: false, reason: "number-check" };
  if (!surnamesOk(text, allowedNames, rosterNames)) return { ok: false, reason: "unlisted-driver" };
  if (!comparisonsOk(text)) return { ok: false, reason: "comparison" };
  return { ok: true };
}
