"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { loadJson } from "@/lib/data";
import type { RaceEntry } from "@/lib/types";

/** Real featured races on the landing page — no mock list. */
export function FeaturedRaces() {
  const [races, setRaces] = useState<RaceEntry[]>([]);

  useEffect(() => {
    let live = true;
    (async () => {
      const r = await loadJson<{ races: RaceEntry[] }>("index.json");
      if (!live || r.status !== "ready" || !r.data) return;
      setRaces(r.data.races);
    })();
    return () => {
      live = false;
    };
  }, []);

  if (races.length === 0) return null;
  return (
    <section aria-label="Featured replays">
      <p className="panel-label">Featured replays · real data</p>
      <ul className="mt-4 grid gap-3 md:grid-cols-3">
        {races.map((r) => (
          <li key={r.id} className="group rounded-md border border-[var(--border)] bg-[var(--panel)] p-5 transition-colors hover:border-[var(--border-strong)]">
            <p className="tnum text-xs text-[var(--muted)]">
              {r.year} · ROUND {r.round} · {r.date}
            </p>
            <p className="display mt-1 text-2xl font-bold">{r.name}</p>
            <p className="mt-1 text-sm text-[var(--muted)]">{r.story}</p>
            <p className="tnum mt-2 flex gap-1.5 text-[11px] text-[var(--muted)]">
              <span className="rounded border border-[var(--border-strong)] px-1.5 py-0.5">REPLAY</span>
              {r.coverage.radio && <span className="rounded border border-[var(--border-strong)] px-1.5 py-0.5">RADIO</span>}
              {r.coverage.telemetry && <span className="rounded border border-[var(--border-strong)] px-1.5 py-0.5">TEL</span>}
              {r.coverage.weather && <span className="rounded border border-[var(--border-strong)] px-1.5 py-0.5">WX</span>}
            </p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Link
                href={`/race/${r.id}/easy`}
                className="touch inline-flex items-center justify-center rounded-md bg-[var(--accent)] text-sm font-bold text-black"
              >
                Easy →
              </Link>
              <Link
                href={`/race/${r.id}/pro`}
                className="touch inline-flex items-center justify-center rounded-md border border-[var(--border-strong)] text-sm font-semibold"
              >
                Pro →
              </Link>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
