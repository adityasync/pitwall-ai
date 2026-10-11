"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { loadJson } from "@/lib/data";
import { StateCard } from "@/components/StateCard";

type DriverLite = { code: string; name: string; team: string; teamColour: string };

const ALERTS = [
  { id: "moments", title: "Something happens", note: "Overtakes, pits and flags involving them." },
  { id: "drs", title: "DRS battle", note: "They get within a second of the car ahead." },
  { id: "pit", title: "They pit", note: "The moment they stop for tyres." },
];

/** Follow my driver (canvas, P2). Picks saved on this device — no account. */
export default function FollowPage() {
  const [races, setRaces] = useState<{ id: string; name: string }[]>([]);
  const [drivers, setDrivers] = useState<DriverLite[]>([]);
  const [raceId, setRaceId] = useState<string | null>(null);
  const [fav, setFav] = useState<string>("");
  const [alerts, setAlerts] = useState<string[]>(["moments"]);

  useEffect(() => {
    let live = true;
    (async () => {
      const idx = await loadJson<{ races: { id: string; name: string }[] }>("index.json");
      if (!live || idx.status !== "ready" || !idx.data) return;
      setRaces(idx.data.races);
      if (idx.data.races.length > 0) setRaceId(idx.data.races[0].id);
      try {
        setFav(localStorage.getItem("pitwall-fav") ?? "");
        setAlerts(JSON.parse(localStorage.getItem("pitwall-alerts") ?? '["moments"]') as string[]);
      } catch {
        /* private mode */
      }
    })();
    return () => {
      live = false;
    };
  }, []);

  useEffect(() => {
    if (!raceId) return;
    let live = true;
    (async () => {
      const dr = await loadJson<DriverLite[]>(`${raceId}/drivers.json`);
      if (!live || dr.status !== "ready" || !dr.data) return;
      setDrivers(dr.data);
      if (!dr.data.some((d) => d.code === fav)) setFav("");
    })();
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [raceId]);

  const save = (code: string, al: string[]) => {
    setFav(code);
    setAlerts(al);
    try {
      localStorage.setItem("pitwall-fav", code);
      localStorage.setItem("pitwall-alerts", JSON.stringify(al));
    } catch {
      /* private mode */
    }
  };

  const favDriver = drivers.find((d) => d.code === fav);

  return (
    <main className="mx-auto w-full max-w-3xl px-4 sm:px-6 pb-12 pt-5">
      <p className="panel-label">Make it yours</p>
      <h1 className="display mt-1 text-4xl font-bold">Who are you rooting for?</h1>
      <p className="mt-2 text-[var(--muted)]">
        Pick a driver and the app puts them first: their gap, their tyres, and a ping when
        something happens.
      </p>

      <p className="panel-label mb-2 mt-6">Replay</p>
      <div className="flex flex-wrap gap-1.5">
        {races.map((r) => (
          <button key={r.id} onClick={() => setRaceId(r.id)} aria-pressed={raceId === r.id}
            className={`touch rounded border px-3 text-xs font-bold ${raceId === r.id ? "border-[var(--accent)] text-[var(--accent)]" : "border-[var(--border-strong)] text-[var(--muted)]"}`}>
            {r.name}
          </button>
        ))}
      </div>

      <p className="panel-label mb-2 mt-6">Favourite driver</p>
      {drivers.length === 0 ? (
        <StateCard kind="loading" title="Loading drivers" text="…" progress={60} />
      ) : (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {drivers.map((d) => (
            <button key={d.code} onClick={() => save(d.code, alerts)} aria-pressed={fav === d.code}
              className={`touch rounded-md border p-3 text-left ${fav === d.code ? "border-[var(--accent)]" : "border-[var(--border)] bg-[var(--panel)]"}`}>
              <span className="tnum font-bold">{d.code}</span>
              <span className="block text-xs text-[var(--muted)]">{d.team}</span>
            </button>
          ))}
        </div>
      )}

      <p className="panel-label mb-2 mt-6">Alert me when</p>
      <ul className="grid gap-2">
        {ALERTS.map((a) => (
          <li key={a.id}>
            <button
              onClick={() => save(fav, alerts.includes(a.id) ? alerts.filter((x) => x !== a.id) : [...alerts, a.id])}
              aria-pressed={alerts.includes(a.id)}
              className={`touch flex w-full items-center gap-3 rounded-md border p-3 text-left ${alerts.includes(a.id) ? "border-[var(--accent)]" : "border-[var(--border)] bg-[var(--panel)]"}`}>
              <span aria-hidden>{alerts.includes(a.id) ? "☑" : "☐"}</span>
              <span>
                <span className="block font-semibold">{a.title}</span>
                <span className="block text-sm text-[var(--muted)]">{a.note}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>

      {favDriver ? (
        <section aria-label="Preview" className="mt-6 rounded-md border border-[var(--border-strong)] bg-[var(--panel)] p-4">
          <p className="panel-label mb-1">Preview: your feed</p>
          <p className="text-lg font-bold">{favDriver.name.split(" ").slice(-1)}</p>
          <p className="tnum text-sm text-[var(--muted)]">
            {favDriver.team} · alerts: {alerts.length ? alerts.join(", ") : "off"}
          </p>
          <Link href={`/race/${raceId}/driver/${fav}`} className="touch mt-3 inline-flex items-center rounded-md bg-[var(--accent-deep)] px-5 text-sm font-bold text-white">
            Continue →
          </Link>
        </section>
      ) : (
        <p className="mt-6 text-sm text-[var(--muted)]">Pick a driver to continue. Your picks are saved on this device. No account needed.</p>
      )}
    </main>
  );
}
