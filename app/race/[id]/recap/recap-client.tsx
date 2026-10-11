"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { loadJson } from "@/lib/data";
import { StateCard } from "@/components/StateCard";
import type { Driver, Moment, Stats } from "@/lib/types";

export function RecapClient({ raceId }: { raceId: string }) {
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [moments, setMoments] = useState<Moment[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [name, setName] = useState(raceId);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    let live = true;
    (async () => {
      const [m, dr, mo, st] = await Promise.all([
        loadJson<{ name: string }>(`${raceId}/meta.json`),
        loadJson<Driver[]>(`${raceId}/drivers.json`),
        loadJson<Moment[]>(`${raceId}/moments.json`),
        loadJson<Stats>(`${raceId}/stats.json`),
      ]);
      if (!live) return;
      if (m.status !== "ready" || dr.status !== "ready") {
        setStatus("error");
        return;
      }
      setName(m.data?.name ?? raceId);
      setDrivers((dr.data ?? []).filter((d) => d.finish).sort((a, b) => (a.finish ?? 99) - (b.finish ?? 99)));
      setMoments(mo.data ?? []);
      setStats(st.data);
      setStatus("ready");
    })();
    return () => {
      live = false;
    };
  }, [raceId]);

  if (status === "loading") {
    return (
      <main className="mx-auto w-full max-w-5xl px-4 sm:px-6 py-10">
        <StateCard kind="loading" title="Loading recap" text="Reading results…" progress={70} />
      </main>
    );
  }
  if (status === "error") {
    return (
      <main className="mx-auto w-full max-w-5xl px-4 sm:px-6 py-10">
        <StateCard kind="error" title="Could not load this race" text="Build the race files first." />
      </main>
    );
  }

  const top3 = moments
    .filter((mm) => mm.confidence === "high")
    .sort((a, b) => a.t - b.t)
    .slice(0, 3);
  const shareText = `${name} recap: ${drivers.slice(0, 3).map((d) => `${d.finish}. ${d.name.split(" ").slice(-1)}`).join(", ")}. ${top3[0]?.headline ?? ""}`;
  const og = `/api/og?race=${raceId}`;

  return (
    <main className="mx-auto w-full max-w-5xl px-4 sm:px-6 pb-12 pt-5">
      <p className="panel-label">Race finished</p>
      <h1 className="display mt-1 text-4xl font-bold sm:text-5xl">{name} — recap</h1>

      <section aria-label="Results" className="mt-6">
        <ol className="overflow-hidden rounded-md border border-[var(--border)]">
          {drivers.map((d) => (
            <li key={d.code} className="tnum flex items-center gap-3 border-b border-[var(--border)] bg-[var(--panel)] px-4 py-2.5 last:border-0">
              <span className="w-8 text-[var(--muted)]">P{d.finish}</span>
              <span className="h-6 w-1 rounded" style={{ background: d.teamColour }} aria-hidden />
              <span className="font-bold">{d.name}</span>
              <span className="ml-auto text-sm text-[var(--muted)]">{d.team}</span>
            </li>
          ))}
        </ol>
      </section>

      <section aria-label="Three moments that mattered" className="mt-8">
        <h2 className="display text-3xl font-bold">Three moments that mattered</h2>
        <ol className="mt-3 grid gap-2">
          {top3.map((m, i) => (
            <li key={m.id} className="card p-4">
              <p className="tnum text-xs text-[var(--muted)]">{i + 1} · LAP {m.lap} · {m.type.toUpperCase()}</p>
              <p className="mt-1 font-semibold">{m.headline}</p>
              <Link href={`/race/${raceId}/easy?t=${Math.round(m.t)}&m=${m.id}`} className="touch mt-1 inline-flex text-sm font-semibold text-[var(--accent)]">
                Replay →
              </Link>
            </li>
          ))}
        </ol>
      </section>

      <section aria-label="By the numbers" className="tnum mt-8 grid grid-cols-3 gap-2 text-center">
        <div className="card p-4">
          <p className="text-[11px] tracking-widest text-[var(--muted)]">OVERTAKES</p>
          <p className="text-2xl font-bold">{stats?.overtakes.length ?? "—"}</p>
        </div>
        <div className="card p-4">
          <p className="text-[11px] tracking-widest text-[var(--muted)]">PIT STOPS</p>
          <p className="text-2xl font-bold">{moments.filter((m) => m.type === "pit").length}</p>
        </div>
        <div className="card p-4">
          <p className="text-[11px] tracking-widest text-[var(--muted)]">FASTEST LAP</p>
          <p className="text-2xl font-bold">{(stats?.fastestLap as { driver?: string })?.driver ?? "—"}</p>
        </div>
      </section>

      <section aria-label="Share card" className="mt-8">
        <h2 className="display text-3xl font-bold">Share card preview</h2>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={og} alt={`${name} recap card`} className="mt-3 w-full max-w-xl rounded-md border border-[var(--border)]" />
        <div className="mt-3 flex flex-wrap gap-2">
          <a href={`https://wa.me/?text=${encodeURIComponent(shareText)}`} target="_blank" rel="noreferrer"
            className="touch inline-flex items-center rounded-md bg-[var(--accent-deep)] px-5 text-sm font-bold text-white">
            Share on WhatsApp
          </a>
          <a href={og} download={`${raceId}-recap.png`}
            className="touch inline-flex items-center rounded-md border border-[var(--border-strong)] px-5 text-sm font-semibold">
            Save image
          </a>
        </div>
        <p className="mt-3 text-xs text-[var(--muted)]">
          Made from the race data. The AI writes the story, the numbers come from the timing and lap records.
        </p>
      </section>
    </main>
  );
}
