"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { fmtLapTime } from "@/lib/format";
import { loadJson } from "@/lib/data";
import type { RaceEntry } from "@/lib/types";

type RaceStats = {
  overtakes: number;
  stops: number;
  fastest: { driver: string; time: number; lap: number } | null;
};

/** Featured replays — editorial index rows with glow hover. */
export function FeaturedRaces() {
  const [races, setRaces] = useState<RaceEntry[]>([]);
  const [stats, setStats] = useState<Record<string, RaceStats>>({});

  useEffect(() => {
    let live = true;
    (async () => {
      const r = await loadJson<{ races: RaceEntry[] }>("index.json");
      if (!live || r.status !== "ready" || !r.data) return;
      setRaces(r.data.races);
      const out: Record<string, RaceStats> = {};
      await Promise.all(
        r.data.races.map(async (race) => {
          const [s, p] = await Promise.all([
            loadJson<{ overtakes: unknown[]; fastestLap: RaceStats["fastest"] }>(`${race.id}/stats.json`),
            loadJson<unknown[]>(`${race.id}/pits.json`),
          ]);
          if (!live) return;
          out[race.id] = {
            overtakes: s.data?.overtakes.length ?? 0,
            stops: Array.isArray(p.data) ? p.data.length : 0,
            fastest: s.data?.fastestLap ?? null,
          };
        })
      );
      if (live) setStats(out);
    })();
    return () => {
      live = false;
    };
  }, []);

  if (races.length === 0) return null;
  return (
    <section aria-label="Featured replays">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h2 className="display-italic text-4xl font-bold tracking-tight sm:text-6xl">
          WORTH <span className="bg-gradient-to-r from-[#ff2b2b] to-[#ff7a5c] bg-clip-text text-transparent">REWATCHING</span>
        </h2>
        <Link href="/races" className="tnum text-[12px] font-bold tracking-[0.2em] text-[var(--muted)] transition hover:text-white">
          ALL REPLAYS →
        </Link>
      </div>
      <ul className="mt-6 overflow-hidden rounded-2xl border border-white/[0.07] bg-white/[0.02] backdrop-blur-xl">
        {races.map((r, i) => {
          const st = stats[r.id];
          return (
            <li key={r.id} className="race-row group grid gap-4 border-b border-white/[0.06] p-6 transition last:border-0 hover:bg-white/[0.03] sm:grid-cols-[72px_1fr_auto] sm:items-center sm:gap-8 sm:px-8">
              <span className="display-italic text-6xl font-bold leading-none text-white/[0.12] transition-colors duration-500 group-hover:text-[rgba(225,6,0,0.45)]">
                0{i + 1}
              </span>
              <div className="min-w-0">
                <p className="tnum text-[11px] tracking-[0.22em] text-[var(--muted)]">
                  {r.year} · ROUND {r.round} · {r.date}
                </p>
                <p className="display mt-1.5 text-3xl font-bold leading-none tracking-tight sm:text-4xl">
                  {r.name}
                  <span aria-hidden className="race-arrow ml-3 inline-block text-[var(--faint)]">↗</span>
                </p>
                <p className="mt-2 max-w-xl leading-relaxed text-[var(--muted)]">{r.story}</p>
                <p className="tnum mt-3 flex flex-wrap gap-x-5 gap-y-1 text-[11px] tracking-[0.14em] text-[var(--muted)]">
                  {st ? (
                    <>
                      <span><strong className="text-base text-white">{st.overtakes}</strong> OVERTAKES</span>
                      <span><strong className="text-base text-white">{st.stops}</strong> STOPS</span>
                      {st.fastest && (
                        <span>FASTEST <strong className="text-[var(--fastest)]">{st.fastest.driver} {fmtLapTime(st.fastest.time)}</strong></span>
                      )}
                    </>
                  ) : (
                    <span>READING RACE DATA…</span>
                  )}
                </p>
              </div>
              <div className="flex gap-2 sm:flex-col sm:items-stretch">
                <Link href={`/race/${r.id}/easy`} className="btn btn-secondary px-6">
                  Easy →
                </Link>
                <Link href={`/race/${r.id}/pro`} className="btn btn-primary px-6">
                  Timing →
                </Link>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
