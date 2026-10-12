"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { indexAtT } from "@/lib/clock";
import { fmtLapTime } from "@/lib/format";
import { loadRaceBundle, type RaceBundle } from "@/lib/race";
import { TyreDot } from "@/components/TimingRow";

/** Landing hero preview: a real timing tower (top 8, mid-race) from the
 *  featured race's own files — MEASURED positions, intervals and tyres. */
export function TowerPreview() {
  const [bundle, setBundle] = useState<RaceBundle | null>(null);
  const [raceId, setRaceId] = useState<string | null>(null);
  const [atLap, setAtLap] = useState(31);

  useEffect(() => {
    let live = true;
    (async () => {
      const { latestRaceId } = await import("@/lib/first-race");
      const id = await latestRaceId();
      if (!live || !id) return;
      setRaceId(id);
      const b = await loadRaceBundle(id);
      if (live) setBundle(b);
    })();
    return () => {
      live = false;
    };
  }, []);

  // the preview replays mid-race on a loop — stills when reduced motion is set
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const iv = setInterval(() => setAtLap((l) => (l >= 36 ? 26 : l + 1)), 2600);
    return () => clearInterval(iv);
  }, []);

  const view = useMemo(() => {
    if (!bundle || bundle.status !== "ready" || !bundle.meta || !bundle.positions) return null;
    const laps = bundle.meta.laps;
    const at = Math.min(atLap, laps - 1);
    const t = bundle.meta.lapStarts[at - 1] ?? 0;
    const i = indexAtT(bundle.positions.t, t);
    if (i < 0) return null;
    const rows = bundle.drivers
      .map((d) => {
        const s = bundle.positions?.drivers[d.code];
        const pos = s ? s.pos[Math.min(i, s.pos.length - 1)] : null;
        const iv = bundle.intervals?.drivers[d.code];
        const ahead = iv ? iv.gapAhead[Math.min(indexAtT(iv.t, t), iv.gapAhead.length - 1)] : null;
        const lapRow = bundle.laps[d.code]?.find((r) => r.lap === at);
        return { d, pos, ahead, compound: lapRow?.compound ?? null, age: lapRow?.tyreAge ?? null };
      })
      .filter((r) => r.pos != null)
      .sort((a, b) => (a.pos as number) - (b.pos as number))
      .slice(0, 8);
    return { rows, at, laps, name: bundle.meta.name, fastest: bundle.stats?.fastestLap };
  }, [bundle, atLap]);

  return (
    <div className="card overflow-hidden" aria-label="Live timing preview">
      <div className="h-0.5 bg-gradient-to-r from-[var(--accent-deep)] via-[var(--accent)] to-transparent" aria-hidden />
      <div className="flex items-center justify-between gap-3 px-5 py-3">
        <span className="tnum flex items-center gap-2 text-xs font-bold tracking-widest text-[var(--accent)]">
          <span aria-hidden className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--accent)]" />
          TIMING
        </span>
        <span className="tnum truncate text-xs text-[var(--muted)]">
          {view ? `${view.name.toUpperCase()} · LAP ${view.at}/${view.laps}` : "LOADING REPLAY…"}
        </span>
      </div>
      <ol className="border-t border-[var(--border)]">
        {view ? (
          view.rows.map((r) => (
            <li key={r.d.code} className="flex items-center gap-2.5 border-b border-[var(--border)] px-4 py-[7px] last:border-0">
              <span className="tnum w-5 text-sm font-bold text-[var(--muted)]">{r.pos}</span>
              <span className="h-7 w-1 flex-none rounded-full" style={{ background: r.d.teamColour }} aria-hidden />
              <span className="tnum w-11 text-sm font-bold tracking-wide">{r.d.code}</span>
              <span className="tnum flex-1 text-right text-[13px] text-[var(--muted)]">
                {r.pos === 1 ? "LEADER" : r.ahead == null ? "—" : `+${r.ahead.toFixed(1)}`}
              </span>
              <TyreDot compound={r.compound} age={r.age} />
            </li>
          ))
        ) : (
          Array.from({ length: 8 }, (_, k) => (
            <li key={k} className="border-b border-[var(--border)] px-4 py-[13px] last:border-0">
              <div className="h-3 animate-pulse rounded bg-[var(--raised)]" style={{ width: `${88 - k * 6}%` }} />
            </li>
          ))
        )}
      </ol>
      <div className="flex items-center justify-between gap-3 border-t border-[var(--border)] bg-black/20 px-5 py-3">
        <span className="tnum text-[11px] text-[var(--muted)]">
          {view?.fastest
            ? <>FASTEST <strong className="text-[var(--fastest)]">{view.fastest.driver} {fmtLapTime(view.fastest.time)}</strong> LAP {view.fastest.lap}</>
            : "FASTEST LAP…"}
        </span>
        {raceId && (
          <Link href={`/race/${raceId}/pro`} className="touch inline-flex items-center text-xs font-bold text-[var(--accent)]">
            OPEN TIMING →
          </Link>
        )}
      </div>
    </div>
  );
}

export function HeroCtasLanding() {
  const [id, setId] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    (async () => {
      const { latestRaceId } = await import("@/lib/first-race");
      const rid = await latestRaceId();
      if (live) setId(rid);
    })();
    return () => {
      live = false;
    };
  }, []);
  const easy = id ? `/race/${id}/easy` : "/races";
  const pro = id ? `/race/${id}/pro` : "/races";
  return (
    <div className="mt-7 flex flex-wrap gap-3">
      <Link href={pro} className="btn btn-primary px-7">
        Open the timing
      </Link>
      <Link href={easy} className="btn btn-secondary px-7">
        Start simple
      </Link>
    </div>
  );
}

