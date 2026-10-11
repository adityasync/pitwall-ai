"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { fmtLapTime } from "@/lib/format";
import { loadJson } from "@/lib/data";
import { StateCard } from "@/components/StateCard";

type QLap = { lap: number; time: number; s1: number | null; s2: number | null; s3: number | null };
type QRow = { laps: QLap[]; best: number; bestSectors: { s1: number | null; s2: number | null; s3: number | null }; ideal: number | null };

export function QualiClient({ raceId }: { raceId: string }) {
  const [quali, setQuali] = useState<Record<string, QRow> | null>(null);
  const [name, setName] = useState(raceId);
  const [status, setStatus] = useState<"loading" | "ready" | "empty" | "error">("loading");

  useEffect(() => {
    let live = true;
    (async () => {
      const [m, q] = await Promise.all([
        loadJson<{ name: string }>(`${raceId}/meta.json`),
        loadJson<Record<string, QRow>>(`${raceId}/quali.json`),
      ]);
      if (!live) return;
      if (m.status !== "ready") {
        setStatus("error");
        return;
      }
      setName(m.data?.name ?? raceId);
      if (q.status !== "ready" || !q.data || Object.keys(q.data).length === 0) {
        setStatus("empty");
        return;
      }
      setQuali(q.data);
      setStatus("ready");
    })();
    return () => {
      live = false;
    };
  }, [raceId]);

  const rows = useMemo(() => {
    if (!quali) return [];
    return Object.entries(quali)
      .map(([code, r]) => ({ code, ...r }))
      .sort((a, b) => a.best - b.best);
  }, [quali]);
  const pole = rows[0]?.best;

  if (status === "loading") {
    return (
      <main className="mx-auto w-full max-w-5xl px-4 py-10">
        <StateCard kind="loading" title="Loading qualifying" text="Reading Saturday…" progress={60} />
      </main>
    );
  }
  if (status === "error") {
    return (
      <main className="mx-auto w-full max-w-5xl px-4 py-10">
        <StateCard kind="error" title="Could not load this race" text="Build the race files first." />
      </main>
    );
  }
  if (status === "empty" || rows.length === 0) {
    return (
      <main className="mx-auto w-full max-w-5xl px-4 py-10">
        <StateCard
          kind="empty"
          title="No qualifying data yet"
          text="Run python pipeline/build_quali.py YEAR ROUND to fetch Saturday laps."
        />
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-5xl px-4 pb-10 pt-6">
      <Link href={`/race/${raceId}/easy`} className="touch inline-flex items-center text-sm text-[var(--accent)]">
        ← Back to race
      </Link>
      <h1 className="display mt-2 text-4xl font-bold">Qualifying — {name}</h1>
      <p className="mt-1 text-sm text-[var(--muted)]">
        Sector times are MEASURED. Ideal lap = sum of personal best sectors (DERIVED) — nobody
        actually drove it.
      </p>
      <div className="mt-4 overflow-x-auto rounded-md border border-[var(--border)]">
        <table className="tnum w-full min-w-[620px] text-sm">
          <thead>
            <tr className="panel-label border-b border-[var(--border)] text-left">
              <th className="p-2">Pos</th><th className="p-2">Driver</th><th className="p-2">Best</th>
              <th className="p-2">Gap</th><th className="p-2">S1</th><th className="p-2">S2</th>
              <th className="p-2">S3</th><th className="p-2">Ideal</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.code} className="border-b border-[var(--border)] last:border-0">
                <td className="p-2 text-[var(--muted)]">P{i + 1}</td>
                <td className="p-2 font-bold">{r.code}</td>
                <td className="p-2 font-bold" style={i === 0 ? { color: "var(--fastest)" } : undefined}>
                  {fmtLapTime(r.best)}
                </td>
                <td className="p-2 text-[var(--muted)]">{pole != null ? `+${(r.best - pole).toFixed(3)}` : "—"}</td>
                <td className="p-2">{r.bestSectors.s1?.toFixed(3) ?? "—"}</td>
                <td className="p-2">{r.bestSectors.s2?.toFixed(3) ?? "—"}</td>
                <td className="p-2">{r.bestSectors.s3?.toFixed(3) ?? "—"}</td>
                <td className="p-2 text-[var(--muted)]">{r.ideal ? fmtLapTime(r.ideal) : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
