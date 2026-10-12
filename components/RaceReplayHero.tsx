"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { indexAtT } from "@/lib/clock";
import { fmtLapTime } from "@/lib/format";
import { trailAt } from "@/lib/map";
import { loadRaceBundle, type RaceBundle } from "@/lib/race";
import { TrackMap, type MapDot } from "@/components/TrackMap";
import { TyreDot } from "@/components/TimingRow";

/** Landing hero — glass pitwall console with motion-blurred lap counter,
 *  glowing track and live tower. Same data, cinematic presentation. */
export function RaceReplayHero() {
  const [bundle, setBundle] = useState<RaceBundle | null>(null);
  const [raceId, setRaceId] = useState<string | null>(null);
  const [atLap, setAtLap] = useState(28);

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

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const iv = setInterval(() => setAtLap((l) => (l >= 48 ? 18 : l + 1)), 1600);
    return () => clearInterval(iv);
  }, []);

  const view = useMemo(() => {
    if (!bundle || bundle.status !== "ready" || !bundle.meta || !bundle.positions) return null;
    const laps = bundle.meta.laps;
    const at = Math.min(atLap, laps - 1);
    const t = bundle.meta.lapStarts[at - 1] ?? 0;
    const i = indexAtT(bundle.positions.t, t);
    if (i < 0) return null;
    const dots: MapDot[] = [];
    const rows = bundle.drivers
      .map((d) => {
        const s = bundle.positions?.drivers[d.code];
        const pos = s ? s.pos[Math.min(i, s.pos.length - 1)] : null;
        const iv = bundle.intervals?.drivers[d.code];
        const ahead = iv ? iv.gapAhead[Math.min(indexAtT(iv.t, t), iv.gapAhead.length - 1)] : null;
        const lapRow = bundle.laps[d.code]?.find((r) => r.lap === at);
        if (s?.x && s?.y && pos != null) {
          const j = Math.min(i, s.x.length - 1);
          dots.push({ code: d.code, x: s.x[j], y: s.y[j], colour: d.teamColour });
        }
        return { d, pos, ahead, compound: lapRow?.compound ?? null, age: lapRow?.tyreAge ?? null };
      })
      .filter((r) => r.pos != null)
      .sort((a, b) => (a.pos as number) - (b.pos as number));
    const overtakes = bundle.moments.filter((m) => m.type === "overtake").length;
    const leader = rows.length > 0 ? rows[0].d.code : null;
    // Leader-only motion trail (DERIVED presentation) — one ribbon of motion,
    // never the whole-field spaghetti the map filter was built to prevent.
    let trails: Record<string, { x: number; y: number }[]> | null = null;
    if (leader) {
      const s = bundle.positions.drivers[leader];
      if (s?.x && s?.y) {
        const pts = trailAt(s.x, s.y, bundle.positions.t, t, 12, 12);
        if (pts.length >= 2) trails = { [leader]: pts };
      }
    }
    return { rows: rows.slice(0, 10), dots, trails, leader, at, laps, name: bundle.meta.name, overtakes, fastest: bundle.stats?.fastestLap };
  }, [bundle, atLap]);

  return (
    <div className="cut light-streak glass relative overflow-hidden shadow-[0_40px_120px_-30px_rgba(225,6,0,0.35)]" aria-label="Race replay preview">
      {/* ambient glow inside the console */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="orb left-[-80px] top-[-80px] h-64 w-64 bg-[rgba(225,6,0,0.22)]" />
        <div className="orb bottom-[-100px] right-[10%] h-72 w-72 bg-[rgba(99,102,255,0.12)]" style={{ animationDelay: "-4s" }} />
        <div className="absolute inset-0 bg-gradient-to-b from-white/[0.05] to-transparent" />
      </div>

      <div className="relative flex items-center gap-3 border-b border-white/[0.07] px-5 py-3">
        <span className="tnum flex items-center gap-2 text-[11px] font-bold tracking-[0.22em] text-white">
          <span aria-hidden className="live-dot inline-block h-2 w-2 rounded-full bg-[#ff2b2b]" />
          REPLAY
        </span>
        <span className="tnum truncate text-xs text-[var(--muted)]">
          {view ? `${view.name.toUpperCase()}` : "LOADING…"}
        </span>
        <span className="tnum ml-auto flex items-baseline gap-1.5 text-[11px] tracking-widest text-[var(--muted)]">
          LAP
          {view ? (
            <strong key={view.at} className="lap-blur display-italic inline-block text-3xl leading-none text-white">
              {String(view.at).padStart(2, "0")}
            </strong>
          ) : (
            <strong className="display text-2xl text-white">—</strong>
          )}
          <span className="opacity-60">/{view?.laps ?? "—"}</span>
        </span>
      </div>

      <div className="relative grid md:grid-cols-[1.15fr_248px]">
        <div className="relative min-w-0 border-b border-white/[0.07] p-3 md:border-b-0 md:border-r">
          {bundle?.track ? (
            <div className="relative">
              <TrackMap track={bundle.track} dots={view?.dots ?? []} height={308} controls={false} minimal leader={view?.leader ?? null} trails={view?.trails ?? null} />
            </div>
          ) : (
            <div className="flex h-[308px] items-center justify-center text-sm text-[var(--muted)]">Loading track…</div>
          )}
        </div>
        <ol className="relative">
          {view ? (
            view.rows.map((r) => (
              <li key={r.d.code} className="tower-row flex items-center gap-2 border-b border-white/[0.06] px-3.5 py-[6.5px] last:border-0">
                <span className="tnum w-6 text-[13px] font-bold text-[var(--faint)]">{String(r.pos).padStart(2, "0")}</span>
                <span
                  className="h-7 w-[3px] flex-none rounded-full"
                  style={{ background: r.d.teamColour, boxShadow: `0 0 10px ${r.d.teamColour}88` }}
                  aria-hidden
                />
                <span className="tnum w-11 text-[13px] font-bold tracking-wide">{r.d.code}</span>
                <span className="tnum flex-1 text-right text-xs text-[var(--muted)]">
                  {r.pos === 1 ? <span className="text-white">LEAD</span> : r.ahead == null ? "—" : `+${r.ahead.toFixed(1)}`}
                </span>
                <TyreDot compound={r.compound} age={r.age} />
              </li>
            ))
          ) : (
            Array.from({ length: 10 }, (_, k) => (
              <li key={k} className="border-b border-white/[0.06] px-3 py-[12px] last:border-0">
                <div className="h-2.5 animate-pulse rounded-full bg-white/10" style={{ width: `${90 - k * 5}%` }} />
              </li>
            ))
          )}
        </ol>
      </div>
      <div className="tnum relative flex flex-wrap items-center gap-x-5 gap-y-1 border-t border-white/[0.07] bg-black/30 px-5 py-3 text-[11px] tracking-[0.14em] text-[var(--muted)] backdrop-blur-md">
        {view ? (
          <>
            <span><strong className="text-xl text-white">{view.overtakes}</strong> <span className="opacity-70">OVERTAKES</span></span>
            <span>FASTEST <strong className="text-[var(--fastest)]">{view.fastest?.driver} {view.fastest ? fmtLapTime(view.fastest.time) : ""}</strong></span>
            <span className="ml-auto">
              {raceId && (
                <Link href={`/race/${raceId}/pro`} className="touch inline-flex items-center gap-1.5 font-bold text-white transition hover:text-[var(--accent)]">
                  WATCH IT ALL <span aria-hidden className="text-[var(--accent)]">→</span>
                </Link>
              )}
            </span>
          </>
        ) : (
          <span>READING RACE DATA…</span>
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
    <div className="mt-8 flex flex-wrap items-center gap-3">
      <Link href={pro} className="btn btn-primary px-8">
        Open the timing <span aria-hidden>→</span>
      </Link>
      <Link href={easy} className="btn btn-secondary px-8">
        Start simple
      </Link>
    </div>
  );
}
