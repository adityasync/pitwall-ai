"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { RACE_POINTS_SCALE } from "@/lib/config";
import { loadJson } from "@/lib/data";
import { StateCard } from "@/components/StateCard";

const SCALE = RACE_POINTS_SCALE;

type DLite = { code: string; name: string; team: string; finish: number | null };
type PaceMap = Record<string, { median: number; bestLap: number }>;

type RaceAgg = { id: string; name: string; drivers: DLite[]; pace: PaceMap };

export default function SeasonPage() {
  const [races, setRaces] = useState<RaceAgg[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "empty" | "error">("loading");

  useEffect(() => {
    let live = true;
    (async () => {
      const idx = await loadJson<{ races: { id: string; name: string }[] }>("index.json");
      if (!live || idx.status !== "ready" || !idx.data) {
        setStatus(idx.status === "ready" ? "empty" : "error");
        return;
      }
      const out: RaceAgg[] = [];
      for (const r of idx.data.races) {
        const [dr, st] = await Promise.all([
          loadJson<DLite[]>(`${r.id}/drivers.json`),
          loadJson<{ pace: PaceMap }>(`${r.id}/stats.json`),
        ]);
        if (!live) return;
        if (dr.status === "ready" && dr.data) {
          out.push({ id: r.id, name: r.name, drivers: dr.data, pace: st.data?.pace ?? {} });
        }
      }
      setRaces(out);
      setStatus(out.length ? "ready" : "empty");
    })();
    return () => {
      live = false;
    };
  }, []);

  if (status === "loading") {
    return (
      <main className="mx-auto w-full max-w-5xl px-4 py-10">
        <StateCard kind="loading" title="Loading season" text="Aggregating replays…" progress={60} />
      </main>
    );
  }
  if (status !== "ready") {
    return (
      <main className="mx-auto w-full max-w-5xl px-4 py-10">
        <StateCard kind="error" title="No season data" text="Build at least one race first." />
      </main>
    );
  }

  const table: Record<string, { name: string; team: string; wins: number; podiums: number; pts: number }> = {};
  for (const r of races) {
    const order = [...r.drivers].filter((d) => d.finish).sort((a, b) => (a.finish as number) - (b.finish as number));
    order.forEach((d, i) => {
      const row = (table[d.code] ??= { name: d.name, team: d.team, wins: 0, podiums: 0, pts: 0 });
      if (d.finish === 1) row.wins++;
      if ((d.finish as number) <= 3) row.podiums++;
      if (i < SCALE.length) row.pts += SCALE[i];
    });
  }
  const standings = Object.entries(table).sort((a, b) => b[1].pts - a[1].pts);

  // teammate head-to-head: race finishes + median-pace wins, aggregated
  const h2h: Record<string, { a: string; b: string; team: string; aWins: number; bWins: number; aPace: number; bPace: number }> = {};
  for (const r of races) {
    const byTeam: Record<string, DLite[]> = {};
    for (const d of r.drivers) (byTeam[d.team] ??= []).push(d);
    for (const [team, pair] of Object.entries(byTeam)) {
      if (pair.length !== 2) continue;
      const [x, y] = [...pair].sort((p, q) => p.code.localeCompare(q.code));
      const key = `${team}`;
      const row = (h2h[key] ??= { a: x.code, b: y.code, team, aWins: 0, bWins: 0, aPace: 0, bPace: 0 });
      if (x.finish != null && y.finish != null) {
        if (x.finish < y.finish) row.aWins++;
        else if (y.finish < x.finish) row.bWins++;
      }
      const px = r.pace[x.code]?.median;
      const py = r.pace[y.code]?.median;
      if (px != null && py != null) {
        if (px < py) row.aPace++;
        else if (py < px) row.bPace++;
      }
    }
  }

  return (
    <main className="mx-auto w-full max-w-5xl px-4 pb-10 pt-6">
      <p className="panel-label">Season trends · {races.length} replays</p>
      <h1 className="display mt-1 text-4xl font-bold">Across the built races</h1>
      <p className="mt-2 max-w-2xl text-sm text-[var(--muted)]">
        Aggregates of every race file. Points use the standard 25-18-15 scale per replay —
        an ESTIMATE of form, not the official standings.
      </p>

      <section aria-label="Points across replays" className="mt-6">
        <div className="overflow-x-auto rounded-md border border-[var(--border)]">
          <table className="tnum w-full min-w-[560px] text-sm">
            <thead>
              <tr className="panel-label border-b border-[var(--border)] text-left">
                <th className="p-2">#</th><th className="p-2">Driver</th><th className="p-2">Team</th>
                <th className="p-2">Wins</th><th className="p-2">Podiums</th><th className="p-2">Pts</th>
              </tr>
            </thead>
            <tbody>
              {standings.map(([code, r], i) => (
                <tr key={code} className="border-b border-[var(--border)] last:border-0">
                  <td className="p-2 text-[var(--muted)]">{i + 1}</td>
                  <td className="p-2 font-bold">{code}</td>
                  <td className="p-2 text-[var(--muted)]">{r.team}</td>
                  <td className="p-2">{r.wins}</td>
                  <td className="p-2">{r.podiums}</td>
                  <td className="p-2 font-bold">{r.pts}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section aria-label="Teammate head to head" className="mt-8">
        <h2 className="display text-2xl font-bold">Teammate head to head</h2>
        <p className="text-sm text-[var(--muted)]">Race finishes and median-pace wins, race pace only (no quali data in replays).</p>
        <ul className="tnum mt-3 grid gap-2 text-sm sm:grid-cols-2">
          {Object.values(h2h).map((h) => (
            <li key={h.team} className="rounded-md border border-[var(--border)] bg-[var(--panel)] p-3">
              <p className="text-[var(--muted)]">{h.team}</p>
              <p className="mt-1 font-bold">
                {h.a} {h.aWins}–{h.bWins} {h.b} <span className="font-normal text-[var(--muted)]">races</span>
              </p>
              <p>
                {h.a} {h.aPace}–{h.bPace} {h.b} <span className="font-normal text-[var(--muted)]">pace</span>
              </p>
            </li>
          ))}
        </ul>
      </section>

      <section aria-label="Races" className="mt-8">
        <h2 className="display text-2xl font-bold">Races in this view</h2>
        <div className="mt-2 flex flex-wrap gap-2">
          {races.map((r) => (
            <Link key={r.id} href={`/race/${r.id}/recap`}
              className="touch inline-flex items-center rounded-md border border-[var(--border-strong)] px-4 text-sm font-semibold">
              {r.name} →
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
