"use client";

import { useEffect, useMemo, useState } from "react";
import { loadReliability, loadTeams, type Reliability, type TeamHistory } from "@/lib/history";
import { StateCard } from "@/components/StateCard";

/** Teams — every constructor that ever started a race: titles, wins, pits, DNFs. */
export default function TeamsPage() {
  const [rows, setRows] = useState<TeamHistory[] | null>(null);
  const [rel, setRel] = useState<Reliability | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [q, setQ] = useState("");

  useEffect(() => {
    let live = true;
    (async () => {
      const [t, r] = await Promise.all([loadTeams(), loadReliability()]);
      if (!live) return;
      if (t.status !== "ready" || !t.data) {
        setStatus("error");
        return;
      }
      setRows(t.data);
      if (r.status === "ready" && r.data) setRel(r.data);
      setStatus("ready");
    })();
    return () => {
      live = false;
    };
  }, []);

  const list = useMemo(() => {
    if (!rows) return [];
    const needle = q.trim().toLowerCase();
    const filt = needle ? rows.filter((t) => t.name.toLowerCase().includes(needle)) : rows;
    return filt.slice(0, 60);
  }, [rows, q]);

  if (status === "loading") {
    return (
      <main className="mx-auto w-full max-w-5xl px-4 sm:px-6 py-10">
        <StateCard kind="loading" title="Loading teams" text="Reading history…" progress={60} />
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
      <p className="panel-label">Teams · {rows.length} constructors · 1950–2026</p>
      <h1 className="display mt-1 text-4xl font-bold">Who built the winners</h1>
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search — try Ferrari, McLaren, Williams…"
        aria-label="Search teams"
        className="touch mt-4 w-full max-w-sm rounded-lg border border-[var(--border-strong)] bg-[var(--panel)] px-3 text-sm"
      />
      <div className="mt-4 overflow-x-auto rounded-md border border-[var(--border)]">
        <table className="tnum w-full min-w-[720px] text-sm">
          <thead>
            <tr className="panel-label border-b border-[var(--border)] text-left">
              <th className="p-2">#</th><th className="p-2">Team</th><th className="p-2">Titles</th>
              <th className="p-2">Wins</th><th className="p-2">Pts</th>
              <th className="p-2">Avg pit</th><th className="p-2">DNF</th>
            </tr>
          </thead>
          <tbody>
            {list.map((t, i) => (
              <tr key={t.id} className="border-b border-[var(--border)] last:border-0">
                <td className="p-2 text-[var(--muted)]">{i + 1}</td>
                <td className="p-2 font-bold">{t.name}</td>
                <td className="p-2 font-bold">{t.titles || "—"}</td>
                <td className="p-2">{t.wins}</td>
                <td className="p-2">{t.points}</td>
                <td className="p-2 text-[var(--muted)]">{t.avgPit != null ? `${t.avgPit}s` : "—"}</td>
                <td className="p-2 text-[var(--muted)]">{t.dnfs}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rel && (
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <div className="card p-5">
            <p className="panel-label">Why cars retire · all time · {rel.totalDnfs} DNFs</p>
            <ul className="tnum mt-2 space-y-1 text-sm">
              {rel.causes.slice(0, 6).map((c) => (
                <li key={c.cause} className="flex justify-between gap-2">
                  <span>{c.cause}</span><span className="text-[var(--muted)]">{c.count}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="card p-5">
            <p className="panel-label">Pit kings · fastest average stop</p>
            <ul className="tnum mt-2 space-y-1 text-sm">
              {rel.pitLeaders.slice(0, 6).map((p) => (
                <li key={p.team} className="flex justify-between gap-2">
                  <span className="font-semibold">{p.team}</span>
                  <span className="text-[var(--muted)]">{p.avg}s avg · {p.best}s best</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
      <p className="mt-4 text-xs text-[var(--muted)]">
        Showing {list.length} of {rows.length}. Pit times are Ergast durations (outliers over 60s excluded). Source: Ergast mirror.
      </p>
    </main>
  );
}
