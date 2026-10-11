import { createHash } from "node:crypto";
import { neon } from "@neondatabase/serverless";
import { ASK_CACHE_TTL_DAYS } from "./config";

export type CachedAnswer = {
  headline: string;
  text: string;
  used: string[];
  evidence: { label: string; value: string; trust: string }[];
};

const TTL_DAYS = ASK_CACHE_TTL_DAYS;

function conn() {
  const url = process.env.DATABASE_URL ?? "";
  if (!url) return null;
  try {
    return neon(url);
  } catch {
    return null;
  }
}

let tableReady = false;

async function ensureTable(sql: NonNullable<ReturnType<typeof conn>>) {
  if (tableReady) return;
  await sql`
    CREATE TABLE IF NOT EXISTS ask_cache (
      key TEXT PRIMARY KEY,
      headline TEXT NOT NULL,
      text TEXT NOT NULL,
      used JSONB NOT NULL DEFAULT '[]',
      evidence JSONB NOT NULL DEFAULT '[]',
      hits INT NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;
  tableReady = true;
}

/** Cache key: normalized question + race + mode + lang. Normalization keeps
 *  "Why did NOR pit?" and "why did  nor   pit?" on the same entry. */
export function cacheKey(raceId: string, question: string, mode: string, lang: string): string {
  const norm = question.toLowerCase().trim().replace(/\s+/g, " ");
  return createHash("sha256").update(`${raceId}|${norm}|${mode}|${lang}`).digest("hex");
}

/** LLM answers take seconds; a cache hit takes milliseconds. Never throws —
 *  a dead cache must never break Ask (docs: works with AI down). */
export async function getCached(key: string): Promise<CachedAnswer | null> {
  const sql = conn();
  if (!sql) return null;
  try {
    await ensureTable(sql);
    const rows = (await sql`
      SELECT headline, text, used, evidence FROM ask_cache
      WHERE key = ${key} AND created_at > now() - (${TTL_DAYS} * INTERVAL '1 day')
      LIMIT 1
    `) as { headline: string; text: string; used: string[]; evidence: CachedAnswer["evidence"] }[];
    if (rows.length === 0) return null;
    await sql`UPDATE ask_cache SET hits = hits + 1 WHERE key = ${key}`;
    return rows[0];
  } catch {
    return null;
  }
}

export async function putCached(key: string, ans: CachedAnswer): Promise<void> {
  const sql = conn();
  if (!sql) return;
  try {
    await ensureTable(sql);
    await sql`
      INSERT INTO ask_cache (key, headline, text, used, evidence)
      VALUES (${key}, ${ans.headline}, ${ans.text}, ${JSON.stringify(ans.used)}, ${JSON.stringify(ans.evidence)})
      ON CONFLICT (key) DO UPDATE SET
        headline = EXCLUDED.headline, text = EXCLUDED.text,
        used = EXCLUDED.used, evidence = EXCLUDED.evidence,
        created_at = now(), hits = ask_cache.hits + 1
    `;
  } catch {
    /* cache is best-effort */
  }
}
