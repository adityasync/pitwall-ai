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
    <main className="mx-auto flex w-full max-w-[1280px] flex-col gap-12 px-4 py-10 sm:px-6 sm:py-14">
      <section className="section-head">
        <p className="panel-label">Pick a race and a mode</p>
        <h1 className="display mt-3 text-5xl font-bold tracking-tight sm:text-6xl">
          Watch the race. <span className="text-[var(--accent)]">Understand</span> the race.
        </h1>
        <p className="mt-4 max-w-2xl text-lg leading-relaxed text-[var(--muted)]">
          Tap any overtake, pit stop or gap change and get a plain explanation
          backed by real lap data, in English or Hinglish.
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        {MODES.map((m) => (
          <div key={m.mode} className="card card-hover flex flex-col p-6 sm:p-8">
            <p className="panel-label">{m.tag}</p>
            <p className="display mt-2 text-3xl font-bold uppercase tracking-tight">{m.name}</p>
            <p className="mt-3 max-w-md leading-relaxed text-[var(--muted)]">{m.text}</p>
            {races.length > 0 && (
              <Link
                href={`/race/${races[0].id}/${m.mode}`}
                className="touch mt-5 inline-flex items-center self-start font-semibold text-[var(--accent)] hover:underline"
              >
                {m.cta} →
              </Link>
            )}
          </div>
        ))}
      </section>

      <section>
        <div className="section-head">
          <h2 className="display text-3xl font-bold tracking-tight sm:text-4xl">Pick a race to replay</h2>
        </div>
        <div className="section-rule" aria-hidden />
        {status === "loading" && <p className="mt-6 text-[var(--muted)]">Loading races…</p>}
        {status === "empty" && (
          <div className="card mt-6 p-6 text-[var(--muted)]">
            No race files yet — run <span className="tnum">pnpm data:build 2025 18</span>.
          </div>
        )}
        {status === "error" && (
          <div className="card mt-6 border-[var(--bad)] p-6 text-[var(--bad)]">
            Could not load the race list.
          </div>
        )}
        {status === "ready" && (
          <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {races.map((r) => (
              <li key={r.id} className="card card-hover flex flex-col p-6">
                <p className="tnum text-xs text-[var(--muted)]">
                  {r.year} · ROUND {r.round} · {r.date}
                </p>
                <p className="display mt-2 text-2xl font-bold leading-tight">{r.name}</p>
                <p className="text-sm text-[var(--muted)]">{r.circuit}</p>
                <p className="mt-3 flex-1 text-sm leading-relaxed">{r.story}</p>
                <p className="tnum mt-4 flex flex-wrap gap-1.5 text-[11px] text-[var(--muted)]">
                  <span className="rounded-md border border-[var(--border-strong)] bg-[var(--raised)] px-1.5 py-0.5">REPLAY</span>
                  {r.coverage.radio && <span className="rounded-md border border-[var(--border-strong)] bg-[var(--raised)] px-1.5 py-0.5">RADIO</span>}
                  {r.coverage.telemetry && <span className="rounded-md border border-[var(--border-strong)] bg-[var(--raised)] px-1.5 py-0.5">TEL</span>}
                  {r.coverage.weather && <span className="rounded-md border border-[var(--border-strong)] bg-[var(--raised)] px-1.5 py-0.5">WX</span>}
                </p>
                <div className="mt-4 grid grid-cols-2 gap-2 pt-1">
                  <Link
                    href={`/race/${r.id}/easy`}
                    className="btn btn-primary px-3 text-sm"
                  >
                    Easy →
                  </Link>
                  <Link
                    href={`/race/${r.id}/pro`}
                    className="btn btn-secondary px-3 text-sm"
                  >
                    Pro →
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-6 text-sm text-[var(--faint)]">
          Sample list. Replays use free historical data; live needs a paid feed.
        </p>
      </section>
    </main>
  );
}
