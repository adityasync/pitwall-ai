"use client";

import { useEffect, useState } from "react";
import { loadCircuitHistory, type CircuitHistory } from "@/lib/history";
import { StateCard } from "@/components/StateCard";

/** Circuit history — every track that hosted F1, top winners, last winner. */
export default function CircuitsPage() {
  const [rows, setRows] = useState<CircuitHistory[] | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "empty" | "error">("loading");

  useEffect(() => {
    let live = true;
    (async () => {
      const r = await loadCircuitHistory();
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

  if (status === "loading") {
    return (
      <main className="mx-auto w-full max-w-5xl px-4 sm:px-6 py-10">
        <StateCard kind="loading" title="Loading circuits" text="Reading history…" progress={60} />
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
      <p className="panel-label">Circuit history · {rows.length} tracks · 1950–2026</p>
      <h1 className="display mt-1 text-4xl font-bold">Where it was won</h1>
      <ul className="mt-6 grid gap-4 sm:grid-cols-2">
        {rows.map((c) => (
          <li key={c.id} className="card flex flex-col p-6">
            <p className="tnum text-xs text-[var(--muted)]">
              {c.country.toUpperCase()} · {c.races} RACES · {c.first}–{c.last}
            </p>
            <p className="display mt-2 text-2xl font-bold leading-tight">{c.name}</p>
            <p className="text-sm text-[var(--muted)]">{c.location}</p>
            {c.topWinners.length > 0 && (
              <p className="tnum mt-3 text-sm">
                Most wins: <strong>{c.topWinners[0].driver} ({c.topWinners[0].wins})</strong>
              </p>
            )}
            {c.lastWinner && (
              <p className="tnum mt-1 text-sm text-[var(--muted)]">
                Last: {c.lastWinner.year} · {c.lastWinner.driver} ({c.lastWinner.team})
              </p>
            )}
            {c.lapRecord && (
              <p className="tnum mt-1 text-sm text-[var(--muted)]">
                Record: {c.lapRecord.time} · {c.lapRecord.code} ({c.lapRecord.year})
              </p>
            )}
          </li>
        ))}
      </ul>
      <p className="mt-6 text-xs text-[var(--muted)]">Source: Ergast mirror (see Methods).</p>
    </main>
  );
}
