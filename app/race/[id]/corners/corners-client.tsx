"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { loadJson } from "@/lib/data";
import { loadRaceBundle, type RaceBundle } from "@/lib/race";
import { StateCard } from "@/components/StateCard";
import { TrackMap } from "@/components/TrackMap";

type TeleFile = { lap: Record<string, { dist: number[]; speed: number[]; brake: number[]; gear: number[] }> };

export function CornersClient({ raceId }: { raceId: string }) {
  const [bundle, setBundle] = useState<RaceBundle | null>(null);
  const [tele, setTele] = useState<Record<string, TeleFile>>({});
  const [pair, setPair] = useState<string[]>([]);
  const [corner, setCorner] = useState<number>(1);

  useEffect(() => {
    let live = true;
    (async () => {
      const b = await loadRaceBundle(raceId);
      if (!live) return;
      setBundle(b);
      if (b.status === "ready" && b.meta) {
        const covered: string[] = b.meta.coverage.telemetryDrivers ?? [];
        const got: Record<string, TeleFile> = {};
        for (const c of covered.slice(0, 4)) {
          const r = await loadJson<TeleFile>(`${raceId}/telemetry/${c}.json`);
          if (!live) return;
          if (r.status === "ready" && r.data) got[c] = r.data;
        }
        setTele(got);
        setPair(Object.keys(got).slice(0, 2));
        const first = b.track?.corners[0]?.n ?? 1;
        setCorner(first);
      }
    })();
    return () => {
      live = false;
    };
  }, [raceId]);

  const table = useMemo(() => {
    if (!bundle?.track || pair.length < 2) return null;
    const c = bundle.track.corners.find((x) => x.n === corner);
    if (!c) return null;
    const zone = bundle.track.brakingZones.find((z) => z.corner === c.n) ?? null;
    const rows = pair.map((code) => {
      const f = tele[code];
      if (!f) return { code, lap: "—", brake: null as number | null, apex: null as number | null, gear: null as number | null };
      const lk = Object.keys(f.lap).sort((a, b) => Number(a) - Number(b))[0];
      const L = f.lap[lk];
      let bi = 0;
      for (let i = 0; i < L.dist.length; i++) {
        if (Math.abs(L.dist[i] - c.dist) < Math.abs(L.dist[bi] - c.dist)) bi = i;
      }
      return { code, lap: lk, brake: zone ? zone.startDist : null, apex: L.speed[bi], gear: L.gear[bi] };
    });
    const withApex = rows.filter((r) => r.apex != null) as { code: string; apex: number }[];
    const win = withApex.length ? withApex.reduce((a, b) => (b.apex < a.apex ? b : a)).code : null;
    return { corner: c, rows, zone, win };
  }, [bundle, tele, pair, corner]);

  if (!bundle) {
    return (
      <main className="mx-auto w-full max-w-5xl px-4 py-10">
        <StateCard kind="loading" title="Loading corners" text="Reading track data…" progress={70} />
      </main>
    );
  }
  if (bundle.status !== "ready" || !bundle.track) {
    return (
      <main className="mx-auto w-full max-w-5xl px-4 py-10">
        <StateCard kind="error" title="Could not load this race" text="Build the race files first." />
      </main>
    );
  }

  const corners = bundle.track.corners;
  return (
    <main className="mx-auto w-full max-w-5xl px-4 pb-10 pt-6">
      <Link href={`/race/${raceId}/easy`} className="touch inline-flex items-center text-sm text-[var(--accent)]">
        ← Back to race
      </Link>
      <h1 className="display mt-2 text-4xl font-bold">Corner analysis</h1>
      <p className="panel-label mb-2 mt-4">Every corner, tap to inspect</p>
      <TrackMap track={bundle.track} dots={[]} height={300} showZones
        selectedCorner={corner} onCorner={setCorner}
        label="Corner numbers are DERIVED from speed minima. Tap a corner." />

      <div className="tnum mt-3 flex flex-wrap gap-1.5">
        {corners.map((c) => (
          <button key={c.n} onClick={() => setCorner(c.n)} aria-pressed={corner === c.n}
            className={`touch min-w-[44px] rounded border px-2 text-sm font-bold ${corner === c.n ? "border-[var(--accent)] text-[var(--accent)]" : "border-[var(--border-strong)] text-[var(--muted)]"}`}>
            T{c.n}
          </button>
        ))}
      </div>

      <div className="tnum mt-3 flex flex-wrap gap-1.5 text-xs">
        <span className="panel-label w-full">Drivers (telemetry covers {Object.keys(tele).join(", ") || "none"})</span>
        {Object.keys(tele).map((c) => (
          <button key={c} onClick={() => setPair((p) => (p.includes(c) ? p.filter((x) => x !== c) : [...p, c].slice(-2)))}
            aria-pressed={pair.includes(c)}
            className={`touch rounded-full border px-3 font-bold ${pair.includes(c) ? "border-[var(--accent)] text-[var(--accent)]" : "border-[var(--border-strong)] text-[var(--muted)]"}`}>
            {c}
          </button>
        ))}
      </div>

      {table && pair.length === 2 ? (
        <section aria-label={`Turn ${table.corner.n}`} className="mt-4 rounded-md border border-[var(--border)] bg-[var(--panel)] p-4">
          <p className="display text-2xl font-bold">TURN {table.corner.n} · {pair[0]} vs {pair[1]}</p>
          <table className="tnum mt-2 w-full text-sm">
            <thead>
              <tr className="text-left text-[var(--muted)]">
                <th className="py-1">Driver</th><th>Brake point</th><th>Lowest speed</th><th>Gear</th><th>Faster</th>
              </tr>
            </thead>
            <tbody>
              {table.rows.map((r) => (
                <tr key={r.code} className="border-t border-[var(--border)]">
                  <td className="py-1.5 font-bold">{r.code} <span className="font-normal text-[var(--muted)]">lap {r.lap}</span></td>
                  <td>{r.brake != null ? `${Math.round(r.brake).toLocaleString()} m` : "—"}</td>
                  <td>{r.apex != null ? `${Math.round(r.apex)} km/h` : "—"}</td>
                  <td>{r.gear ?? "—"}</td>
                  <td>{r.code === table.win ? <span className="font-bold text-[var(--good)]">apex ▲</span> : ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <CornerRead table={table} pair={pair} />
          <Link href={`/race/${raceId}/compare?d=${pair.join(",")}`}
            className="touch mt-3 inline-flex items-center rounded-md border border-[var(--accent)] px-4 text-sm font-bold text-[var(--accent)]">
            Full trace →
          </Link>
        </section>
      ) : (
        <div className="mt-4">
          <StateCard kind="empty" title="Pick two drivers with telemetry" text="Corner comparison needs stored laps for both drivers." />
        </div>
      )}
      <p className="mt-3 text-xs text-[var(--muted)]">
        Braking points come from the brake on/off signal and distance. Position data updates about
        3.7 times a second, so distances are approximate.
      </p>
    </main>
  );
}

function CornerRead({ table, pair }: {
  table: { rows: { code: string; apex: number | null; brake: number | null }[]; win: string | null };
  pair: string[];
}) {
  const [a, b] = table.rows;
  if (!a || !b || a.apex == null || b.apex == null) return null;
  const apexA: number = a.apex;
  const apexB: number = b.apex;
  const diff = Math.abs(apexA - apexB);
  const slower = apexA > apexB ? b : a;
  const slowerApex = Math.min(apexA, apexB);
  const fasterApex = Math.max(apexA, apexB);
  const brakeNote =
    a.brake != null && b.brake != null && Math.abs(a.brake - b.brake) >= 3
      ? ` ${a.brake < b.brake ? a.code : b.code} brakes about ${Math.abs(Math.round(a.brake - b.brake))} m later.`
      : " Both brake at roughly the same point.";
  return (
    <div className="mt-3 border-t border-[var(--border)] pt-3">
      <p className="panel-label mb-1">AI corner read</p>
      <p>
        {slower.code} is slower at the apex ({Math.round(slowerApex)} vs {Math.round(fasterApex)} km/h
        — {diff.toFixed(0)} km/h gap).{brakeNote} Apex speeds are DERIVED from telemetry traces.
      </p>
      <p className="mt-1 text-sm text-[var(--muted)]">
        {pair[0]} vs {pair[1]}: apex is only half the story — exits decide the straight.
      </p>
    </div>
  );
}
