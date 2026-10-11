"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { fmtLapTime } from "@/lib/format";
import { loadJson } from "@/lib/data";
import { StateCard } from "@/components/StateCard";
import { TyreDot } from "@/components/TimingRow";
import type { Driver, Laps, Pit, Stats, Stint } from "@/lib/types";

type RadioClip = { t: number; lap: number; driver: string; url: string };

export function DriverClient({ raceId, code }: { raceId: string; code: string }) {
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [laps, setLaps] = useState<Laps>({});
  const [stints, setStints] = useState<Record<string, Stint[]>>({});
  const [pits, setPits] = useState<Pit[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [radio, setRadio] = useState<RadioClip[]>([]);
  const [meta, setMeta] = useState<{ name: string; laps: number } | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    let live = true;
    (async () => {
      const [m, dr, la, st, pi, se, ra] = await Promise.all([
        loadJson<{ name: string; laps: number }>(`${raceId}/meta.json`),
        loadJson<Driver[]>(`${raceId}/drivers.json`),
        loadJson<Laps>(`${raceId}/laps.json`),
        loadJson<Record<string, Stint[]>>(`${raceId}/stints.json`),
        loadJson<Pit[]>(`${raceId}/pits.json`),
        loadJson<Stats>(`${raceId}/stats.json`),
        loadJson<RadioClip[]>(`${raceId}/radio.json`),
      ]);
      if (!live) return;
      if (m.status !== "ready" || dr.status !== "ready") {
        setStatus("error");
        return;
      }
      setMeta(m.data);
      setDrivers(dr.data ?? []);
      setLaps(la.data ?? {});
      setStints(st.data ?? {});
      setPits((pi.data ?? []).filter((p) => p.driver === code));
      setStats(se.data);
      setRadio((ra.data ?? []).filter((c) => c.driver === code));
      setStatus("ready");
    })();
    return () => {
      live = false;
    };
  }, [raceId, code]);

  const driver = drivers.find((d) => d.code === code);
  const mate = driver ? drivers.find((d) => d.team === driver.team && d.code !== code) : null;

  const lapChart = useMemo(() => {
    const rows = (laps[code] ?? []).filter((r) => r.time && !r.pitLane);
    if (rows.length < 2) return null;
    const times = rows.map((r) => r.time as number);
    const lo = Math.min(...times);
    const hi = Math.max(...times);
    const W = 600;
    const H = 140;
    const pts = rows.map((r, i) => {
      const x = (i / (rows.length - 1)) * (W - 8) + 4;
      const y = H - 8 - ((r.time as number) - lo) / Math.max(0.001, hi - lo) * (H - 16);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    });
    return { pts: pts.join(" "), W, H, best: lo };
  }, [laps, code]);

  if (status === "loading") {
    return (
      <main className="mx-auto w-full max-w-5xl px-4 sm:px-6 py-10">
        <StateCard kind="loading" title={`Loading ${code}`} text="Reading driver data…" progress={70} />
      </main>
    );
  }
  if (status === "error" || !driver) {
    return (
      <main className="mx-auto w-full max-w-5xl px-4 sm:px-6 py-10">
        <StateCard kind="error" title="Driver not found" text={`${code} has no data in ${raceId}.`} />
      </main>
    );
  }

  const pace = stats?.pace[code];
  const report = [
    `${driver.name.split(" ").slice(-1)} finished P${driver.finish ?? "—"} from grid P${driver.grid ?? "—"}.`,
    pits.length > 0
      ? `${pits.length} stop${pits.length > 1 ? "s" : ""}${pits[0].duration ? `, quickest stationary ${Math.min(...pits.map((p) => p.stationary ?? 99)).toFixed(1)} s` : ""}.`
      : "No recorded stops.",
    pace ? `Median ${fmtLapTime(pace.median)}, best ${fmtLapTime(pace.bestLap)} (DERIVED, clean laps only).` : "",
  ].join(" ");

  return (
    <main className="mx-auto w-full max-w-5xl px-4 sm:px-6 pb-12 pt-5">
      <Link href={`/race/${raceId}/easy`} className="touch inline-flex items-center text-sm text-[var(--accent)]">
        ← Back to race
      </Link>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <span className="h-10 w-2 rounded" style={{ background: driver.teamColour }} aria-hidden />
        <h1 className="display text-4xl font-bold sm:text-5xl">{driver.name.split(" ").slice(-1)[0].toUpperCase()}</h1>
        <span className="tnum text-sm text-[var(--muted)]">{driver.team} · {code}</span>
        <span className="tnum ml-auto rounded border border-[var(--border-strong)] px-2 py-1 text-sm">
          P{driver.finish ?? "—"} · {driver.status}
        </span>
      </div>

      <section aria-label="Race story" className="mt-6">
        <p className="panel-label mb-2">Race story · stints and stops</p>
        <ol className="flex flex-wrap items-center gap-2">
          {(stints[code] ?? []).map((s) => (
            <li key={s.stint} className="tnum flex items-center gap-2 card px-3 py-2 text-sm">
              <TyreDot compound={s.compound} age={s.ageAtStart} />
              <span>Laps {s.lapStart}–{s.lapEnd}</span>
            </li>
          ))}
          {pits.map((p) => (
            <li key={p.lap} className="tnum rounded-md border border-[var(--accent)] px-3 py-2 text-sm text-[var(--accent)]">
              PIT LAP {p.lap}{p.duration ? ` · ${p.duration.toFixed(1)}s` : ""}
            </li>
          ))}
        </ol>
      </section>

      {lapChart && (
        <section aria-label="Lap times" className="mt-6 card p-4">
          <p className="panel-label mb-1">Lap times{MateName(mate)} · pit laps removed</p>
          <svg viewBox={`0 0 ${lapChart.W} ${lapChart.H}`} style={{ width: "100%", height: 140 }} role="img" aria-label={`${code} lap times`}>
            <polyline points={lapChart.pts} fill="none" stroke={driver.teamColour} strokeWidth={2} />
          </svg>
          <p className="tnum text-xs text-[var(--muted)]">Best clean lap {fmtLapTime(lapChart.best)} · {meta?.laps} lap race</p>
        </section>
      )}

      <section aria-label="AI driver report" className="mt-6 rounded-md border border-[var(--border-strong)] bg-[var(--panel)] p-4">
        <p className="panel-label mb-1">AI driver report · from lap times</p>
        <p>{report}</p>
      </section>

      <section aria-label="Team radio" className="mt-6">
        <p className="panel-label mb-2">Team radio · {radio.length} clips</p>
        {radio.length === 0 ? (
          <StateCard kind="no-radio" title="No radio for this driver" text="Radio availability varies by race." />
        ) : (
          <ul className="grid gap-2">
            {radio.map((c, i) => (
              <li key={i} className="card p-3">
                <p className="tnum text-xs text-[var(--muted)]">LAP {c.lap}</p>
                <audio controls preload="none" src={c.url} className="mt-1 w-full" />
              </li>
            ))}
          </ul>
        )}
      </section>

      {mate && stats?.pace[mate.code] && pace && (
        <section aria-label="Head to head" className="tnum mt-6 card p-4 text-sm">
          <p className="panel-label mb-2">Head to head vs {mate.code}</p>
          <p>Median: {code} {fmtLapTime(pace.median)} vs {mate.code} {fmtLapTime(stats.pace[mate.code].median)}</p>
          <p>Best: {code} {fmtLapTime(pace.bestLap)} vs {mate.code} {fmtLapTime(stats.pace[mate.code].bestLap)}</p>
        </section>
      )}
      <p className="mt-2 text-xs text-[var(--muted)]">Grid slot minus current position table lives on Battles.</p>
    </main>
  );
}

function MateName(mate: Driver | null | undefined): string {
  return mate ? ` vs ${mate.code}` : "";
}
