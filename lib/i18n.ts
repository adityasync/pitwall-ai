/** EN/Hinglish copy helpers (docs/07-AI-RULES.md). Hinglish = Roman-script Hindi,
 *  F1 terms (pit stop, tyres, gap, DRS) stay in English. */

export type Lang = "en" | "hi";

export function pickLang<T>(lang: Lang, v: { en: T; hi: T }): T {
  return lang === "hi" ? v.hi : v.en;
}
