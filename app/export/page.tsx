"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { loadJson } from "@/lib/data";
import { StateCard } from "@/components/StateCard";

/** Export (P2): CSV, PNG and share links in one place. Files are generated
 *  on demand from the same static JSON the pages read. */
export default function ExportPage() {
  const [races, setRaces] = useState<{ id: string; name: string }[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "empty" | "error">("loading");
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    (async () => {
      const idx = await loadJson<{ races: { id: string; name: string }[] }>("index.json");
      if (!live || idx.status !== "ready" || !idx.data) {
        setStatus(idx.status === "ready" ? "empty" : "error");
        return;
      }
      setRaces(idx.data.races);
      setStatus(idx.data.races.length ? "ready" : "empty");
    })();
    return () => {
      live = false;
    };
  }, []);

  const copy = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      /* clipboard unavailable */
    }
  };

  const downloadJson = async (raceId: string, file: string) => {
    const r = await fetch(`/data/${raceId}/${file}`);
    if (!r.ok) return;
    const a = document.createElement("a");
    a.href = URL.createObjectURL(await r.blob());
    a.download = `${raceId}-${file}`;
    a.click();
  };

  return (
    <main className="mx-auto w-full max-w-5xl px-4 sm:px-6 pb-12 pt-5">
      <p className="panel-label">Chart builder and export</p>
      <h1 className="display mt-1 text-4xl font-bold">Take the data with you</h1>
      {status === "loading" && <p className="mt-4 text-[var(--muted)]">Loading…</p>}
      {status === "empty" && (
        <div className="mt-4">
          <StateCard kind="empty" title="Nothing to export" text="Build a race first." />
        </div>
      )}
      {status === "error" && (
        <div className="mt-4">
          <StateCard kind="error" title="Could not load races" text="Check index.json." />
        </div>
      )}
      {status === "ready" && (
        <ul className="mt-4 grid gap-3">
          {races.map((r) => (
            <li key={r.id} className="card p-4">
              <p className="display text-xl font-bold">{r.name}</p>
              <p className="tnum text-xs text-[var(--muted)]">{r.id}</p>
              <div className="mt-3 flex flex-wrap gap-2 text-sm">
                <button onClick={() => void downloadJson(r.id, "laps.json")}
                  className="touch rounded-md border border-[var(--border-strong)] px-4 font-semibold">
                  Lap times CSV-source (JSON)
                </button>
                <button onClick={() => void downloadJson(r.id, "moments.json")}
                  className="touch rounded-md border border-[var(--border-strong)] px-4 font-semibold">
                  Moments (JSON)
                </button>
                <Link href={`/telemetry?race=${r.id}`}
                  className="touch inline-flex items-center rounded-md border border-[var(--border-strong)] px-4 font-semibold">
                  Traces CSV/PNG →
                </Link>
                <a href={`/api/og?race=${r.id}`} download={`${r.id}-recap.png`}
                  className="touch inline-flex items-center rounded-md border border-[var(--border-strong)] px-4 font-semibold">
                  Share card PNG
                </a>
                <button
                  onClick={() => void copy(`${window.location.origin}/race/${r.id}/easy`, r.id)}
                  className="touch rounded-md border border-[var(--accent)] px-4 font-bold text-[var(--accent)]">
                  {copied === r.id ? "Copied!" : "Copy share link"}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-3 text-xs text-[var(--muted)]">
        Race data: OpenF1 + FastF1 under their terms. Unofficial fan project.
      </p>
    </main>
  );
}
