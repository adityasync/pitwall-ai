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
  const [colours, setColours] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<"loading" | "ready" | "empty" | "error">("loading");

  useEffect(() => {
    let live = true;
    (async () => {
      const [m, q, dr] = await Promise.all([
        loadJson<{ name: string }>(`${raceId}/meta.json`),
        loadJson<Record<string, QRow>>(`${raceId}/quali.json`),
        loadJson<{ code: string; teamColour: string }[]>(`${raceId}/drivers.json`),
      ]);
      if (!live) return;
      if (m.status !== "ready") {
        setStatus("error");
        return;
      }
      setName(m.data?.name ?? raceId);
      if (dr.status === "ready" && dr.data) {
        setColours(Object.fromEntries(dr.data.map((d) => [d.code, d.teamColour])));
      }
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
  const sessionBest = useMemo(() => {
    const s = { s1: Infinity, s2: Infinity, s3: Infinity };
    for (const r of rows) {
      if (r.bestSectors.s1 != null) s.s1 = Math.min(s.s1, r.bestSectors.s1);
      if (r.bestSectors.s2 != null) s.s2 = Math.min(s.s2, r.bestSectors.s2);
      if (r.bestSectors.s3 != null) s.s3 = Math.min(s.s3, r.bestSectors.s3);
    }
    return s;
  }, [rows]);

  if (status === "loading") {
    return (
      <main className="mx-auto w-full max-w-5xl px-4 sm:px-6 py-10">
        <StateCard kind="loading" title="Loading qualifying" text="Reading Saturday…" progress={60} />
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
  if (status === "empty" || rows.length === 0) {
    return (
      <main className="mx-auto w-full max-w-5xl px-4 sm:px-6 py-10">
        <StateCard
          kind="empty"
          title="No qualifying data yet"
          text="Run python pipeline/build_quali.py YEAR ROUND to fetch Saturday laps."
        />
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-5xl px-4 sm:px-6 pb-12 pt-5">
      <Link href={`/race/${raceId}/easy`} className="touch inline-flex items-center text-sm text-[var(--accent)]">
        ← Back to race
      </Link>
      <h1 className="display mt-2 text-4xl font-bold tracking-tight sm:text-5xl">Qualifying — {name}</h1>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[var(--muted)]">
        Every sector MEASURED. Ideal lap = a driver&apos;s three personal bests
        stitched together (DERIVED) — nobody actually drove it. The gap between
        ideal and best is what they left on the table.
      </p>
      <div className="mt-5 overflow-x-auto rounded-xl border border-[var(--border)]">
        <table className="tnum w-full min-w-[680px] text-sm">
          <thead>
            <tr className="panel-label border-b border-[var(--border)] text-left">
              <th className="p-2.5">Pos</th><th className="p-2.5">Driver</th><th className="p-2.5">Best</th>
              <th className="p-2.5">Gap</th><th className="p-2.5">S1</th><th className="p-2.5">S2</th>
              <th className="p-2.5">S3</th><th className="p-2.5">Ideal</th><th className="p-2.5">Left out there</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.code} className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--raised)]/50">
                <td className="p-2.5 text-[var(--muted)]">P{i + 1}</td>
                <td className="p-2.5 font-bold">
                  <span aria-hidden className="mr-2 inline-block h-4 w-1 rounded-sm align-middle" style={{ background: colours[r.code] ?? "#fff" }} />
                  {r.code}
                </td>
                <td className="p-2.5 font-bold" style={i === 0 ? { color: "var(--fastest)" } : undefined}>
                  {fmtLapTime(r.best)}
                </td>
                <td className="p-2.5 text-[var(--muted)]">{pole != null && i > 0 ? `+${(r.best - pole).toFixed(3)}` : "—"}</td>
                {(["s1", "s2", "s3"] as const).map((k) => {
                  const v = r.bestSectors[k];
                  const purple = v != null && v <= sessionBest[k] + 1e-9;
                  return (
                    <td key={k} className="p-2.5" style={purple ? { color: "var(--fastest)", fontWeight: 700 } : undefined}>
                      {v?.toFixed(3) ?? "—"}
                    </td>
                  );
                })}
                <td className="p-2.5 text-[var(--muted)]">{r.ideal ? fmtLapTime(r.ideal) : "—"}</td>
                <td className="p-2.5 text-[var(--muted)]">
                  {r.ideal ? `+${(r.best - r.ideal).toFixed(3)}` : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="tnum mt-2 text-[11px] text-[var(--faint)]">
        <span style={{ color: "var(--fastest)" }}>PURPLE</span> fastest sector of the session
      </p>
    </main>
  );
}
