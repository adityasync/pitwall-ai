"use client";

import { useEffect, useMemo, useState } from "react";
import { loadDriverCareers, type DriverCareer } from "@/lib/history";
import { StateCard } from "@/components/StateCard";

/** Driver careers 1950–2026 — wins, podiums, poles, titles (Ergast mirror). */
export default function DriversPage() {
  const [rows, setRows] = useState<DriverCareer[] | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "empty" | "error">("loading");
  const [q, setQ] = useState("");

  useEffect(() => {
    let live = true;
    (async () => {
      const r = await loadDriverCareers();
      if (!live) return;
      if (r.status !== "ready" || !r.data || r.data.length === 0) {
        setStatus(r.status === "ready" ? "empty" : "error");
        return;
      }
      setRows(r.data);
      setStatus("ready");
    })();
    return () => {
      live = false;
    };
  }, []);

  const list = useMemo(() => {
    if (!rows) return [];
    const needle = q.trim().toLowerCase();
    const filt = needle ? rows.filter((d) => d.name.toLowerCase().includes(needle) || d.code.toLowerCase() === needle) : rows;
    return filt.slice(0, 100);
  }, [rows, q]);

  if (status === "loading") {
    return (
      <main className="mx-auto w-full max-w-5xl px-4 sm:px-6 py-10">
        <StateCard kind="loading" title="Loading careers" text="Reading history…" progress={60} />
      </main>
    );
  }
  if (status !== "ready" || !rows) {
    return (
      <main className="mx-auto w-full max-w-5xl px-4 sm:px-6 py-10">
        <StateCard kind="error" title="No history data" text="Run python pipeline/build_history.py first." />
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-5xl px-4 sm:px-6 pb-12 pt-5">
      <p className="panel-label">Driver careers · {rows.length} drivers · 1950–2026</p>
      <h1 className="display mt-1 text-4xl font-bold">Who won what</h1>
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search — try VER, HAM, NOR…"
        aria-label="Search drivers"
        className="touch mt-4 w-full max-w-sm rounded-lg border border-[var(--border-strong)] bg-[var(--panel)] px-3 text-sm"
      />
      <div className="mt-4 overflow-x-auto rounded-md border border-[var(--border)]">
        <table className="tnum w-full min-w-[760px] text-sm">
          <thead>
            <tr className="panel-label border-b border-[var(--border)] text-left">
              <th className="p-2">#</th><th className="p-2">Driver</th><th className="p-2">Starts</th>
              <th className="p-2">Wins</th><th className="p-2">Pts</th>
              <th className="p-2">Poles</th><th className="p-2">DNF</th><th className="p-2">Titles</th>
            </tr>
          </thead>
          <tbody>
            {list.map((d, i) => (
              <tr key={d.id} className="border-b border-[var(--border)] last:border-0">
                <td className="p-2 text-[var(--muted)]">{i + 1}</td>
                <td className="p-2 font-bold">{d.name} <span className="font-normal text-[var(--muted)]">{d.code}</span>{d.sprintWins > 0 ? <span className="ml-1 font-normal text-xs text-[var(--muted)]">SPR×{d.sprintWins}</span> : null}</td>
                <td className="p-2">{d.starts}</td>
                <td className="p-2">{d.wins}</td>
                <td className="p-2">{d.points}</td>
                <td className="p-2">{d.poles}</td>
                <td className="p-2 text-[var(--muted)]">{d.dnfs}</td>
                <td className="p-2 font-bold">{d.titles || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-4 text-xs text-[var(--muted)]">Showing {list.length} of {rows.length}. Source: Ergast mirror (see Methods).</p>
    </main>
  );
}
