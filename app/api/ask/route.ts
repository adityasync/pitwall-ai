import { NextRequest, NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import {
  comparisonsOk,
  forbiddenFound,
  numbersOk,
  scrubModelTic,
  surnamesOk,
} from "@/lib/ai-validate";
import { ASK_CONTEXT_DRIVERS, ASK_CONTEXT_MOMENTS, ASK_MAX_CHARS, ASK_MAX_TOKENS, ASK_RATE_PER_HOUR } from "@/lib/config";
import { cacheKey, getCached, putCached } from "@/lib/ask-cache";

const SYSTEM = `You are the PITWALL.AI race explainer. You explain Formula 1 races using ONLY the facts in CONTEXT.
Rules:
1. Quote numbers exactly as given in CONTEXT. Never compute new numbers, never guess.
2. If CONTEXT does not contain what is needed, say what data is missing and stop. Do not speculate.
3. Only add the sentence "this is a model, not a measurement" when the fact you use is labelled ESTIMATE in CONTEXT. Never write it for MEASURED or DERIVED facts.
4. Brake data is on/off only; never claim brake pressure, steering, ERS or tyre temperature.
5. Refer to drivers ONLY by the codes and full names listed in CONTEXT. Never mention any other driver, past or present.
6. Mode EASY: one idea, plain words, explain any F1 term in one short clause. Max 3 sentences. Mode PRO: precise, max 5 sentences.
7. Language EN or HI. HI means Hinglish: Roman-script Hindi with English F1 terms kept in English.
8. When comparing lap times, a SMALLER number is FASTER. Never call a driver "the leader" unless the evidence says Position P1.
9. End with nothing extra: no greetings, no disclaimers beyond rule 3.
Return JSON: {"headline": string, "text": string, "used": [evidence labels you relied on]}`;

type MomentRow = {
  headline: string;
  t: number;
  confidence: string;
  drivers?: string[];
  evidence?: { label: string; value: string; trust: string }[];
};

type EvidenceRow = { label: string; value: string; trust: string };

// In-memory per-IP rate limit (docs/07, ASK_RATE_PER_HOUR).
const hits = new Map<string, number[]>();
function limited(ip: string): boolean {
  const now = Date.now();
  const arr = (hits.get(ip) ?? []).filter((t) => now - t < 3_600_000);
  if (arr.length >= ASK_RATE_PER_HOUR) return true;
  arr.push(now);
  hits.set(ip, arr);
  return false;
}

async function readJson(path: string) {
  try {
    return JSON.parse(await readFile(join(process.cwd(), "public", "data", path), "utf-8"));
  } catch {
    return null;
  }
}

let defaultRace: string | null | undefined;
/** First featured race from index.json — data-driven default, resolved once. */
async function defaultRaceId(): Promise<string | null> {
  if (defaultRace !== undefined) return defaultRace;
  const idx = await readJson("index.json");
  const id: string | null = idx?.races?.[0]?.id ?? null;
  defaultRace = id;
  return id;
}

function stripFences(s: string): string {
  const m = s.trim().match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  return m ? m[1] : s.trim();
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  if (limited(ip)) {
    return NextResponse.json(
      { error: `Rate limit reached (${ASK_RATE_PER_HOUR} per hour). Try again later.` },
      { status: 429 }
    );
  }
  let body: { question?: string; raceId?: string; mode?: string; lang?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }
  const question = (body.question ?? "").slice(0, ASK_MAX_CHARS).trim();
  if (!question) return NextResponse.json({ error: `Ask a question (max ${ASK_MAX_CHARS} chars).` }, { status: 400 });
  const raceId = body.raceId ?? (await defaultRaceId());
  if (!raceId) return NextResponse.json({ error: "No races built yet." }, { status: 404 });
  const mode = body.mode === "pro" ? "PRO" : "EASY";
  const lang = body.lang === "hi" ? "HI" : "EN";

  // Repeat questions answer from Postgres in ms instead of paying LLM seconds.
  const cachekey = cacheKey(raceId, question, mode, lang);
  const hit = await getCached(cachekey);
  if (hit) {
    return NextResponse.json({ ...hit, cached: true });
  }

  const [meta, drivers, moments, stats] = await Promise.all([
    readJson(`${raceId}/meta.json`),
    readJson(`${raceId}/drivers.json`),
    readJson(`${raceId}/moments.json`),
    readJson(`${raceId}/stats.json`),
  ]);
  if (!meta || !moments) {
    return NextResponse.json({ error: "Race data not found. Build it first." }, { status: 404 });
  }

  const roster: Record<string, string> = {};
  const rosterNames = new Set<string>();
  for (const d of drivers ?? []) {
    const full = `${String(d.name).toLowerCase().replace(/\b\w/g, (c: string) => c.toUpperCase())} (${d.team})`;
    roster[d.code] = full;
    rosterNames.add(String(d.name).split(" ").slice(-1)[0]);
  }
  const q = question.toLowerCase();
  const mentioned = Object.keys(roster).filter(
    (c) => q.includes(c.toLowerCase()) || q.includes(roster[c].split(" (")[0].toLowerCase())
  );
  const pool = mentioned.length > 0 ? mentioned : Object.keys(roster).slice(0, ASK_CONTEXT_DRIVERS);
  const relMoments = ((moments ?? []) as MomentRow[])
    .filter((m) => m.confidence !== "low" && (mentioned.length === 0 || m.drivers?.some((c) => mentioned.includes(c))))
    .sort((a, b) => b.t - a.t)
    .slice(0, ASK_CONTEXT_MOMENTS)
    .map((m) => ({ headline: m.headline, evidence: m.evidence, drivers: m.drivers }));
  const pack = {
    question,
    race: meta.name,
    drivers: Object.fromEntries(pool.map((c) => [c, roster[c]])),
    pace: Object.fromEntries(pool.map((c) => [c, stats?.pace?.[c]])),
    fastestLap: stats?.fastestLap ?? {},
    moments: relMoments,
    coverage: meta.coverage,
  };
  const ctxText = JSON.stringify(pack);
  const allowed = new Set<string>();
  for (const c of [...mentioned, ...pool]) {
    allowed.add(roster[c]?.split(" (")[0].split(" ").slice(-1)[0] ?? c);
  }
  const flDriver = stats?.fastestLap?.driver;
  if (flDriver && roster[flDriver]) allowed.add(roster[flDriver].split(" (")[0].split(" ").slice(-1)[0]);

  const key = process.env.ZAI_API_KEY ?? "";
  const base = process.env.ZAI_BASE_URL ?? "https://api.z.ai/api/paas/v4";
  const model = process.env.ZAI_MODEL ?? "";
  const evidencePool: EvidenceRow[] = relMoments.flatMap((m) => m.evidence ?? []);

  type AskAnswer = { headline?: unknown; text?: unknown; used?: unknown };
  async function ask(retryHint: string): Promise<AskAnswer | null> {
    if (!key || !model) return null;
    try {
      const r = await fetch(`${base.replace(/\/$/, "")}/chat/completions`, {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: SYSTEM },
            { role: "user", content: `MODE=${mode} LANG=${lang}\nCONTEXT=${ctxText}\n${retryHint}` },
          ],
          temperature: 0.2,
          max_tokens: ASK_MAX_TOKENS,
          thinking: { type: "disabled" },
        }),
      });
      if (!r.ok) return null;
      const d = await r.json();
      return JSON.parse(stripFences(d.choices?.[0]?.message?.content ?? ""));
    } catch {
      return null;
    }
  }

  for (const hint of ["", "STRICT: every number and driver name must come from CONTEXT."]) {
    const ans = await ask(hint);
    if (typeof ans?.text !== "string") continue;
    const text = ans.text;
    if (forbiddenFound(text)) continue;
    if (!numbersOk(text, ctxText)) continue;
    if (!surnamesOk(text, allowed, rosterNames)) continue;
    if (!comparisonsOk(text)) continue;
    const usedLabels: string[] = Array.isArray(ans.used) ? ans.used.filter((u): u is string => typeof u === "string") : [];
    let evidence = evidencePool.filter((e) => usedLabels.includes(e.label)).slice(0, 6);
    if (evidence.length === 0) evidence = evidencePool.slice(0, 4);
    const hasEst = evidence.some((e) => e.trust === "ESTIMATE");
    const out = {
      headline: String(ans.headline ?? "").slice(0, 120),
      text: scrubModelTic(text, hasEst),
      used: usedLabels,
      evidence,
    };
    void putCached(cachekey, out);
    return NextResponse.json(out);
  }

  // Honest fallback: template built from evidence, never invented.
  const top = relMoments[0];
  if (top) {
    return NextResponse.json({
      headline: top.headline,
      text:
        lang === "HI"
          ? `${top.headline}. AI abhi jawab nahi de paya, lekin evidence neeche hai.`
          : `${top.headline}. The AI could not answer right now — the evidence below is what the data shows.`,
      used: [],
      evidence: (top.evidence ?? []).slice(0, 6),
      fallback: true,
    });
  }
  return NextResponse.json({
    headline: "The data cannot show this",
    text:
      lang === "HI"
        ? "Is sawal ka jawab race data mein nahi hai. Kuch aur poochho."
        : "The race data does not contain what is needed to answer that. Try another question.",
    used: [],
    evidence: [],
    fallback: true,
  });
}
