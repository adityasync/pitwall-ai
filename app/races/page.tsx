"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { loadJson, type LoadStatus } from "@/lib/data";
import type { RaceEntry } from "@/lib/types";

const MODES = [
  {
    tag: "New to F1",
    name: "Easy mode",
    text: "One clear story at a time. Big gaps, simple tyre health, and every term explained in a line.",
    cta: "Start watching",
    mode: "easy",
  },
  {
    tag: "For the devoted",
    name: "Pro mode",
    text: "The full workstation: telemetry traces, braking zones, strategy simulator, tyre pace and radio.",
    cta: "Open the pit wall",
    mode: "pro",
  },
] as const;

export default function RacesPage() {
  const [status, setStatus] = useState<LoadStatus>("loading");
  const [races, setRaces] = useState<RaceEntry[]>([]);

  useEffect(() => {
    let live = true;
    (async () => {
      const r = await loadJson<{ seasons: number[]; races: RaceEntry[] }>("index.json");
      if (!live) return;
      if (r.status !== "ready" || !r.data) {
        setStatus(r.status === "ready" ? "empty" : r.status);
        return;
      }
      setRaces(r.data.races);
      setStatus(r.data.races.length === 0 ? "empty" : "ready");
    })();
    return () => {
      live = false;
    };
  }, []);

  return (
    <main className="mx-auto flex w-full max-w-[1360px] flex-col gap-10 px-4 py-10">
      <section>
        <p className="panel-label">Your second screen for Formula 1</p>
        <h1 className="display mt-2 text-5xl font-bold tracking-tight sm:text-6xl">
          Watch the race. <span className="text-[var(--accent)]">Understand</span> the race.
        </h1>
        <p className="mt-3 max-w-2xl text-lg text-[var(--muted)]">
          Tap any overtake, pit stop or gap change and get a plain explanation
          backed by real lap data, in English or Hinglish.
        </p>
      </section>

      <section className="grid gap-3 md:grid-cols-2">
        {MODES.map((m) => (
          <div key={m.mode} className="rounded-md border border-[var(--border)] bg-[var(--panel)] p-6">
            <p className="panel-label">{m.tag}</p>
            <p className="display mt-2 text-3xl font-bold uppercase">{m.name}</p>
            <p className="mt-2 text-[var(--muted)]">{m.text}</p>
            {races.length > 0 && (
              <Link
                href={`/race/${races[0].id}/${m.mode}`}
                className="touch mt-4 inline-flex items-center font-semibold text-[var(--accent)]"
              >
                {m.cta} →
              </Link>
            )}
          </div>
        ))}
      </section>

      <section>
        <h2 className="display text-3xl font-bold">Pick a race to replay</h2>
        {status === "loading" && <p className="mt-3 text-[var(--muted)]">Loading races…</p>}
        {status === "empty" && (
          <div className="mt-3 rounded-md border border-[var(--border)] bg-[var(--panel)] p-6 text-[var(--muted)]">
            No race files yet — run <span className="tnum">pnpm data:build 2025 18</span>.
          </div>
        )}
        {status === "error" && (
          <div className="mt-3 rounded-md border border-[var(--bad)] p-6 text-[var(--bad)]">
            Could not load the race list.
          </div>
        )}
        {status === "ready" && (
          <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {races.map((r) => (
              <li key={r.id} className="flex flex-col rounded-md border border-[var(--border)] bg-[var(--panel)] p-5">
                <p className="tnum text-xs text-[var(--muted)]">
                  {r.year} · ROUND {r.round} · {r.date}
                </p>
                <p className="display mt-1 text-2xl font-bold">{r.name}</p>
                <p className="text-sm text-[var(--muted)]">{r.circuit}</p>
                <p className="mt-2 flex-1 text-sm">{r.story}</p>
                <p className="tnum mt-3 flex flex-wrap gap-2 text-[11px] text-[var(--muted)]">
                  <span className="rounded border border-[var(--border-strong)] px-1.5 py-0.5">REPLAY</span>
                  {r.coverage.radio && <span className="rounded border border-[var(--border-strong)] px-1.5 py-0.5">RADIO</span>}
                  {r.coverage.telemetry && <span className="rounded border border-[var(--border-strong)] px-1.5 py-0.5">TEL</span>}
                  {r.coverage.weather && <span className="rounded border border-[var(--border-strong)] px-1.5 py-0.5">WX</span>}
                </p>
                <div className="mt-4 grid grid-cols-2 gap-2">
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
        )}
        <p className="mt-4 text-sm text-[var(--muted)]">
          Sample list. Replays use free historical data; live needs a paid feed.
        </p>
      </section>
    </main>
  );
}
