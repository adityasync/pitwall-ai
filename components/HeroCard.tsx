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
        className="touch inline-flex items-center justify-center rounded-md bg-[var(--accent)] px-6 font-semibold text-black"
      >
        Start in Easy mode
      </Link>
      <Link
        href={pro}
        className="touch inline-flex items-center justify-center rounded-md border border-[var(--border-strong)] px-6 font-semibold"
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
      <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--bar)] p-8" aria-hidden>
        <p className="tnum animate-pulse text-sm text-[var(--muted)]">Loading featured replay…</p>
      </div>
    );
  }
  return (
    <div className="overflow-hidden rounded-xl border border-[var(--border-strong)] bg-[var(--bar)]">
      <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-2.5">
        <span className="tnum text-xs font-bold tracking-widest text-[var(--accent)]">REPLAY</span>
        <span className="tnum text-xs text-[var(--muted)]">{race.name.toUpperCase()}</span>
        <span className="tnum rounded bg-[var(--accent)] px-2 py-0.5 text-[11px] font-bold text-black">
          EASY
        </span>
      </div>
      <div className="p-4">
        <p className="tnum text-xs text-[var(--muted)]">
          {race.year} · ROUND {race.round} · {race.date}
        </p>
        <p className="display mt-1 text-2xl font-bold">{race.story}</p>
        <p className="tnum mt-2 flex gap-1.5 text-[11px] text-[var(--muted)]">
          <span className="rounded border border-[var(--border-strong)] px-1.5 py-0.5">REPLAY</span>
          {race.coverage.radio && <span className="rounded border border-[var(--border-strong)] px-1.5 py-0.5">RADIO</span>}
          {race.coverage.telemetry && <span className="rounded border border-[var(--border-strong)] px-1.5 py-0.5">TEL</span>}
          {race.coverage.weather && <span className="rounded border border-[var(--border-strong)] px-1.5 py-0.5">WX</span>}
        </p>
        <Link
          href={`/race/${race.id}/easy`}
          className="touch mt-3 inline-flex items-center rounded-md border border-[var(--accent)] px-4 py-2 text-sm font-bold text-[var(--accent)]"
        >
          WHY? — tap a moment
        </Link>
      </div>
      <div className="border-t border-[var(--border)] p-4">
        <p className="panel-label mb-1">Grounded in lap data</p>
        <p className="text-sm text-[var(--muted)]">
          Every number labelled measured, derived or estimate.{" "}
          <Link href="/methods" className="text-[var(--accent)] underline">
            How we stay honest
          </Link>
        </p>
      </div>
    </div>
  );
}
