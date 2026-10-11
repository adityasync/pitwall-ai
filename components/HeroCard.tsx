"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { loadJson } from "@/lib/data";
import type { RaceEntry } from "@/lib/types";

/** Hero CTAs resolve the first featured race — no hardcoded race id. */
export function HeroCtas() {
  const [id, setId] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    (async () => {
      const { firstRaceId } = await import("@/lib/first-race");
      const rid = await firstRaceId();
      if (live) setId(rid);
    })();
    return () => {
      live = false;
    };
  }, []);
  const easy = id ? `/race/${id}/easy` : "/races";
  const pro = id ? `/race/${id}/pro` : "/races";
  return (
    <div className="mt-6 flex flex-wrap gap-3">
      <Link
        href={easy}
        className="btn btn-primary px-7"
      >
        Start in Easy mode
      </Link>
      <Link
        href={pro}
        className="btn btn-secondary px-7"
      >
        Open the pit wall
      </Link>
    </div>
  );
}

/** Hero replay card renders the first featured race's real story — the mock
 *  tower it replaces never showed real data. */
export function HeroCard() {
  const [race, setRace] = useState<RaceEntry | null>(null);
  useEffect(() => {
    let live = true;
    (async () => {
      const r = await loadJson<{ races: RaceEntry[] }>("index.json");
      if (!live || r.status !== "ready" || !r.data || r.data.races.length === 0) return;
      setRace(r.data.races[0]);
    })();
    return () => {
      live = false;
    };
  }, []);

  if (!race) {
    return (
      <div className="card p-8" aria-hidden>
        <p className="tnum animate-pulse text-sm text-[var(--muted)]">Loading featured replay…</p>
      </div>
    );
  }
  return (
    <div className="card overflow-hidden">
      <div className="h-0.5 bg-gradient-to-r from-[var(--accent-deep)] via-[var(--accent)] to-transparent" aria-hidden />
      <div className="flex items-center justify-between gap-3 px-5 py-3 sm:px-6">
        <span className="tnum flex items-center gap-2 text-xs font-bold tracking-widest text-[var(--accent)]">
          <span aria-hidden className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--accent)]" />
          REPLAY
        </span>
        <span className="tnum truncate text-xs text-[var(--muted)]">{race.name.toUpperCase()}</span>
        <span className="tnum shrink-0 rounded-md bg-[var(--accent-deep)] px-2 py-0.5 text-[11px] font-bold text-white">
          EASY
        </span>
      </div>
      <div className="border-t border-[var(--border)] p-5 sm:p-6">
        <p className="tnum text-xs text-[var(--muted)]">
          {race.year} · ROUND {race.round} · {race.date}
        </p>
        <p className="display mt-2 text-3xl font-bold leading-tight">{race.story}</p>
        <p className="tnum mt-3 flex flex-wrap gap-1.5 text-[11px] text-[var(--muted)]">
          <span className="rounded-md border border-[var(--border-strong)] bg-[var(--raised)] px-1.5 py-0.5">REPLAY</span>
          {race.coverage.radio && <span className="rounded-md border border-[var(--border-strong)] bg-[var(--raised)] px-1.5 py-0.5">RADIO</span>}
          {race.coverage.telemetry && <span className="rounded-md border border-[var(--border-strong)] bg-[var(--raised)] px-1.5 py-0.5">TEL</span>}
          {race.coverage.weather && <span className="rounded-md border border-[var(--border-strong)] bg-[var(--raised)] px-1.5 py-0.5">WX</span>}
        </p>
        <Link
          href={`/race/${race.id}/easy`}
          className="btn btn-secondary mt-4 border-[var(--accent)] text-[var(--accent)] hover:text-[var(--accent)]"
        >
          WHY? — tap a moment
        </Link>
      </div>
      <div className="border-t border-[var(--border)] bg-black/20 p-5 sm:px-6">
        <p className="panel-label mb-1">Grounded in lap data</p>
        <p className="text-sm leading-relaxed text-[var(--muted)]">
          Every number labelled measured, derived or estimate.{" "}
          <Link href="/methods" className="text-[var(--accent)] underline underline-offset-2">
            How we stay honest
          </Link>
        </p>
      </div>
    </div>
  );
}
