"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { loadJson } from "@/lib/data";
import { StateCard } from "@/components/StateCard";
import type { RaceEntry } from "@/lib/types";

export default function ExplorerPage() {
  const [races, setRaces] = useState<RaceEntry[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "empty" | "error">("loading");
  const [q, setQ] = useState("");
  const [sel, setSel] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    (async () => {
      const r = await loadJson<{ races: RaceEntry[] }>("index.json");
      if (!live) return;
      if (r.status !== "ready" || !r.data) {
        setStatus(r.status === "ready" ? "empty" : "error");
        return;
      }
      setRaces(r.data.races);
      setSel(r.data.races[0]?.id ?? null);
      setStatus(r.data.races.length ? "ready" : "empty");
    })();
    return () => {
      live = false;
    };
  }, []);

  const filtered = useMemo(
    () => races.filter((r) => (r.name + r.circuit + r.date + r.id).toLowerCase().includes(q.toLowerCase())),
    [races, q]
  );
  const selected = races.find((r) => r.id === sel);

  return (
    <main className="mx-auto w-full max-w-5xl px-4 sm:px-6 pb-12 pt-5">
      <p className="panel-label">Session explorer</p>
      <h1 className="display mt-1 text-4xl font-bold">Every replay, and what data it has</h1>
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search sessions"
        aria-label="Search sessions"
        className="touch mt-4 w-full rounded-md border border-[var(--border-strong)] bg-[var(--raised)] px-4 text-sm"
      />
      {status === "loading" && <p className="mt-4 text-[var(--muted)]">Loading…</p>}
      {status === "empty" && (
        <div className="mt-4">
          <StateCard kind="empty" title="No sessions built" text="Run pnpm data:build YEAR ROUND first." />
        </div>
      )}
      {status === "error" && (
        <div className="mt-4">
          <StateCard kind="error" title="Could not load sessions" text="Check index.json." />
        </div>
      )}
      {status === "ready" && (
        <>
          <p className="tnum mt-3 text-xs text-[var(--muted)]">{filtered.length} SESSIONS · SORT: NEWEST FIRST</p>
          <div className="mt-2 overflow-x-auto rounded-md border border-[var(--border)]">
            <table className="tnum w-full min-w-[720px] text-sm">
              <thead>
                <tr className="panel-label border-b border-[var(--border)] text-left">
                  <th className="p-3">Date</th><th className="p-3">Meeting</th><th className="p-3">Session</th><th className="p-3">Data</th>
                </tr>
              </thead>
              <tbody>
                {[...filtered].reverse().map((r) => (
                  <tr key={r.id} onClick={() => setSel(r.id)}
                    className={`cursor-pointer border-b border-[var(--border)] last:border-0 ${sel === r.id ? "bg-[var(--raised)]" : ""}`}>
                    <td className="p-3">{r.date}</td>
                    <td className="p-3 font-bold">{r.name}</td>
                    <td className="p-3 text-[var(--muted)]">Race · R{r.round}</td>
                    <td className="p-3 text-xs">
                      REPLAY{r.coverage.radio ? " +RADIO" : ""}{r.coverage.telemetry ? " TEL" : ""}{r.coverage.weather ? " WX" : ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-xs text-[var(--muted)]">Sessions come from 2023 onwards, where free historical data starts.</p>
          {selected && (
            <section aria-label="Selected session" className="mt-4 rounded-md border border-[var(--border-strong)] bg-[var(--panel)] p-5">
              <p className="panel-label">Selected</p>
              <p className="display text-2xl font-bold">{selected.name}, Race</p>
              <p className="text-sm text-[var(--muted)]">{selected.circuit} · {selected.story}</p>
              <p className="panel-label mb-1 mt-3">What data exists</p>
              <ul className="tnum grid gap-1 text-xs sm:grid-cols-2">
                {[["Replay", true], ["Radio", selected.coverage.radio], ["Telemetry", selected.coverage.telemetry], ["Weather", selected.coverage.weather], ["Intervals", selected.coverage.intervals]].map(([n, ok]) => (
                  <li key={n as string} className="flex gap-2">
                    <span style={{ color: ok ? "var(--good)" : "var(--bad)" }}>{ok ? "READY" : "NOT AVAILABLE"}</span>
                    <span className="text-[var(--muted)]">{n as string}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-4 flex flex-wrap gap-2">
                <Link href={`/race/${selected.id}/easy`} className="touch inline-flex items-center rounded-md bg-[var(--accent-deep)] px-4 text-sm font-bold text-white">Open in Easy mode</Link>
                <Link href={`/race/${selected.id}/pro`} className="touch inline-flex items-center rounded-md border border-[var(--border-strong)] px-4 text-sm font-semibold">Pro</Link>
                <Link href={`/race/${selected.id}/compare`} className="touch inline-flex items-center rounded-md border border-[var(--border-strong)] px-4 text-sm font-semibold">Telemetry lab</Link>
              </div>
            </section>
          )}
        </>
      )}
    </main>
  );
}
