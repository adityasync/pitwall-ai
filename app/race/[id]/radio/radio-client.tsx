"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { loadJson } from "@/lib/data";
import { StateCard } from "@/components/StateCard";

type Clip = { t: number; lap: number; driver: string; url: string };
type RC = { t: number; lap: number | null; category: string | null; flag: string | null; message: string | null };

const PLAIN: [RegExp, string][] = [
  [/double yellow/i, "Double yellow: slow down, no overtaking in that zone."],
  [/^yellow$/i, "Yellow flag: hazard ahead, slow down."],
  [/safety car/i, "Safety car: field bunches up, gaps wiped out."],
  [/red flag/i, "Red flag: session stopped, cars return to pits."],
  [/chequered/i, "Chequered flag: race finished."],
  [/track limits/i, "Track limits: lap deleted for running wide."],
  [/penalty|drive.?through|time penalty/i, "Penalty from race control."],
  [/pit (lane|entry|exit)/i, "Pit lane incident or infringement."],
];

function plainEnglish(m: RC): string {
  const raw = `${m.flag ?? ""} ${m.category ?? ""} ${m.message ?? ""}`;
  for (const [re, text] of PLAIN) {
    if (re.test(raw)) return text;
  }
  return m.message ?? m.category ?? m.flag ?? "Race control note.";
}

export function RadioClient({ raceId }: { raceId: string }) {
  const [clips, setClips] = useState<Clip[]>([]);
  const [rc, setRc] = useState<RC[]>([]);
  const [name, setName] = useState(raceId);
  const [hasRadio, setHasRadio] = useState(true);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [playing, setPlaying] = useState<number | null>(null);
  const [plain, setPlain] = useState(true);
  const [filter, setFilter] = useState("");

  useEffect(() => {
    let live = true;
    (async () => {
      const [m, ra, rcm] = await Promise.all([
        loadJson<{ name: string; coverage: { radio: boolean } }>(`${raceId}/meta.json`),
        loadJson<Clip[]>(`${raceId}/radio.json`),
        loadJson<RC[]>(`${raceId}/race_control.json`),
      ]);
      if (!live) return;
      if (m.status !== "ready") {
        setStatus("error");
        return;
      }
      setName(m.data?.name ?? raceId);
      setHasRadio(!!m.data?.coverage.radio && ra.status === "ready");
      setClips(ra.status === "ready" && ra.data ? [...ra.data].sort((a, b) => a.t - b.t) : []);
      setRc(rcm.status === "ready" && rcm.data ? [...rcm.data].sort((a, b) => a.t - b.t) : []);
      setStatus("ready");
    })();
    return () => {
      live = false;
    };
  }, [raceId]);

  if (status === "loading") {
    return (
      <main className="mx-auto w-full max-w-5xl px-4 py-10">
        <StateCard kind="loading" title="Loading radio" text="Tuning in…" progress={60} />
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

  const shown = clips.filter((c) => !filter || c.driver === filter);
  const drivers = [...new Set(clips.map((c) => c.driver))].sort();

  return (
    <main className="mx-auto w-full max-w-5xl px-4 pb-10 pt-6">
      <Link href={`/race/${raceId}/easy`} className="touch inline-flex items-center text-sm text-[var(--accent)]">
        ← Back to race
      </Link>
      <h1 className="display mt-2 text-4xl font-bold">Radio and race control</h1>
      <p className="mt-1 text-sm text-[var(--muted)]">
        {name} · Radio coverage is limited and varies by race.
      </p>

      <section aria-label="Team radio" className="mt-6">
        <p className="panel-label mb-2">Team radio · {clips.length} clips</p>
        {!hasRadio || clips.length === 0 ? (
          <StateCard
            kind="no-radio"
            title="No radio for this race"
            text="The feed released no team radio for this replay. Try São Paulo 2024 — it has 60+ clips."
            action={
              <Link href="/races" className="touch inline-flex items-center rounded-md bg-[var(--accent)] px-5 font-semibold text-black">
                Pick another race
              </Link>
            }
          />
        ) : (
          <>
            <div className="mb-2 flex flex-wrap gap-1.5">
              <button onClick={() => setFilter("")} aria-pressed={filter === ""}
                className={`touch rounded-full border px-3 text-xs font-bold ${filter === "" ? "border-[var(--accent)] text-[var(--accent)]" : "border-[var(--border-strong)] text-[var(--muted)]"}`}>
                ALL
              </button>
              {drivers.map((d) => (
                <button key={d} onClick={() => setFilter(d)} aria-pressed={filter === d}
                  className={`touch rounded-full border px-3 text-xs font-bold ${filter === d ? "border-[var(--accent)] text-[var(--accent)]" : "border-[var(--border-strong)] text-[var(--muted)]"}`}>
                  {d}
                </button>
              ))}
            </div>
            <ul className="grid gap-2">
              {shown.map((c, i) => (
                <li key={`${c.t}-${i}`} className="rounded-md border border-[var(--border)] bg-[var(--panel)] p-3">
                  <p className="tnum text-xs text-[var(--muted)]">
                    {c.driver} · LAP {c.lap}
                    {playing === i ? " · NOW PLAYING" : ""}
                  </p>
                  <audio
                    controls
                    preload="none"
                    src={c.url}
                    className="mt-1 w-full"
                    onPlay={() => setPlaying(i)}
                    onPause={() => setPlaying((p) => (p === i ? null : p))}
                  />
                  <Link href={`/race/${raceId}/easy?t=${Math.round(c.t)}`} className="touch mt-1 inline-flex text-sm text-[var(--accent)]">
                    Jump to replay →
                  </Link>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-xs text-[var(--muted)]">
              Clips stream from the official source rather than being copied, and only the radio F1
              releases is available.
            </p>
          </>
        )}
      </section>

      <section aria-label="Race control" className="mt-8">
        <div className="flex items-center gap-3">
          <p className="panel-label">Race control · {rc.length} messages</p>
          <button onClick={() => setPlain(!plain)} aria-pressed={plain}
            className={`touch ml-auto rounded-full border px-3 text-xs font-bold ${plain ? "border-[var(--accent)] text-[var(--accent)]" : "border-[var(--border-strong)] text-[var(--muted)]"}`}>
            PLAIN ENGLISH {plain ? "ON" : "OFF"}
          </button>
        </div>
        <ul className="mt-2 grid gap-1.5">
          {rc.filter((m) => (m.message ?? m.flag ?? m.category) && !/chequered/i.test(`${m.flag} ${m.message}`)).slice(0, 60).map((m, i) => (
            <li key={i} className="tnum rounded-md border border-[var(--border)] bg-[var(--panel)] px-3 py-2 text-sm">
              <span className="text-[var(--muted)]">LAP {m.lap ?? "—"} · </span>
              <strong>{m.flag || m.category || "NOTE"}</strong>
              <span className="block text-[var(--muted)]">{plain ? plainEnglish(m) : (m.message ?? "")}</span>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
