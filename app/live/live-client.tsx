"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { TrackMap } from "@/components/TrackMap";
import { StateCard } from "@/components/StateCard";
import { TimingRow } from "@/components/TimingRow";
import { useLiveTiming } from "@/lib/live";

/** Seconds since the last poll, ticking once a second. */
function LiveAge({ fetchedAt }: { fetchedAt: number }) {
  const [age, setAge] = useState(0);
  useEffect(() => {
    const update = () => setAge(Math.max(0, Math.round((Date.now() - fetchedAt) / 1000)));
    update();
    const id = window.setInterval(update, 1000);
    return () => window.clearInterval(id);
  }, [fetchedAt]);
  return <>Updated {age} s ago</>;
}

export function LiveClient() {
  const { enabled, snap, error, paused, setPaused, refresh } = useLiveTiming();
  const [selected, setSelected] = useState<string | null>(null);
  const [follow, setFollow] = useState<string | null>(null);

  const track = useMemo(() => {
    if (!snap?.outline) return null;
    return { outline: snap.outline.outline, bounds: snap.outline.bounds, corners: [], brakingZones: [], sectors: [] };
  }, [snap]);

  const dots = useMemo(
    () => (snap ? snap.points.map((p) => ({ code: p.code, x: p.x, y: p.y, colour: p.colour })) : []),
    [snap]
  );
  const leader = snap?.tower[0]?.code ?? null;
  const drs = useMemo(
    () => (snap ? snap.tower.filter((r) => r.gapAhead != null && r.gapAhead > 0 && r.gapAhead <= 1).map((r) => r.code) : []),
    [snap]
  );
  const gaps = useMemo(() => {
    const out: Record<string, string> = {};
    for (const r of snap?.tower ?? []) {
      if (r.pos === 1) continue;
      if (r.gapAhead != null) out[r.code] = `+${r.gapAhead.toFixed(1)}`;
    }
    return out;
  }, [snap]);

  if (!enabled) {
    return (
      <main className="mx-auto w-full max-w-3xl px-4 sm:px-6 py-10">
        <StateCard
          kind="empty"
          title="Live timing is off"
          text="Live positions need the paid OpenF1 feed. Set NEXT_PUBLIC_LIVE=1 to try it — replay stays the default and always works."
        />
        <div className="mt-4 flex gap-2">
          <Link href="/races" className="btn btn-primary px-5 text-sm">Watch a replay →</Link>
          <Link href="/methods" className="btn btn-secondary px-5 text-sm">Why replay-first?</Link>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-[1280px] px-4 sm:px-6 pb-12 pt-5">
      <div className="flex flex-wrap items-end gap-x-5 gap-y-2 border-b-2 border-[var(--accent-deep)] pb-4">
        <div className="flex items-center gap-3">
          <span className="slash" aria-hidden />
          <div>
            <p className="tnum flex items-center gap-2 text-[11px] font-bold tracking-widest text-[var(--muted)]">
              <span className="inline-flex items-center gap-1.5 rounded border border-[var(--accent)]/60 bg-[var(--accent-dim)] px-1.5 py-0.5 text-[var(--accent)]">
                <span aria-hidden className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--accent)]" />
                LIVE · BETA
              </span>
              {snap ? `${snap.session.session_name.toUpperCase()} · ${snap.session.location.toUpperCase()}` : "CONNECTING…"}
            </p>
            <h1 className="display mt-1 text-4xl font-bold tracking-tight sm:text-5xl">
              Live positions
            </h1>
          </div>
        </div>
        <div className="ml-auto flex items-center gap-2 pb-1">
          <button onClick={() => (paused ? (setPaused(false), refresh()) : setPaused(true))} className="btn btn-secondary px-5 text-sm" aria-pressed={paused}>
            {paused ? "Resume" : "Pause"}
          </button>
          <button onClick={refresh} className="btn btn-secondary px-5 text-sm">Refresh now</button>
        </div>
      </div>

      {error === "paid" ? (
        <div className="mt-6">
          <StateCard kind="empty" title="Live feed needs a paid plan" text="OpenF1 returned 401/403 for the live session. Replays use the same map and tower — pick one below." />
          <div className="mt-4">
            <Link href="/races" className="btn btn-primary px-5 text-sm">Watch a replay →</Link>
          </div>
        </div>
      ) : error ? (
        <div className="mt-6">
          <StateCard kind="error" title="Live fetch hiccup" text={`${error}. Retrying every 3 s — replays are unaffected.`} />
        </div>
      ) : !snap ? (
        <div className="mt-6">
          <StateCard kind="loading" title="Connecting to live timing" text="Polling OpenF1 for the current session…" progress={50} />
        </div>
      ) : (
        <>
          <p className="tnum mt-3 text-xs text-[var(--muted)]">
            <LiveAge fetchedAt={snap.fetchedAt} /> · polls every 3 s · {dots.length} cars · outline DERIVED from live dots
          </p>
          <div className="mt-4 grid gap-5 lg:grid-cols-[290px_minmax(0,1fr)]">
            <section aria-label="Live timing tower">
              <p className="panel-label mb-2">Tower · LIVE from OpenF1</p>
              <ol className="overflow-hidden rounded-md border border-[var(--border)] bg-[var(--panel)]">
                {snap.tower.map((r) => (
                  <TimingRow key={r.code} pos={r.pos ?? 0} teamColour={r.colour} code={r.code}
                    gap={r.pos === 1 ? "LEADER" : r.gapAhead == null ? null : `+${r.gapAhead.toFixed(1)}`}
                    tyre={null} age={null} trend={null}
                    status={r.gapAhead != null && r.gapAhead > 0 && r.gapAhead <= 1 ? "DRS" : null}
                    dense selected={selected === r.code} onSelect={() => setSelected((s) => (s === r.code ? null : r.code))} />
                ))}
              </ol>
            </section>
            <section aria-label="Live track map">
              <p className="panel-label mb-2">Map · tap a car to select, FOLLOW to track</p>
              <TrackMap track={track} dots={dots} height={420} battle={selected ? [selected] : []}
                leader={leader} onSelect={(c) => setSelected((s) => (s === c ? null : c))} selected={selected}
                drsCodes={drs} gapLabels={gaps} follow={follow} onFollow={setFollow}
                label={`${dots.length} cars live · dashed ring = within DRS (≤1.0 s) · gaps MEASURED from the intervals feed.`} />
              {!track && (
                <p className="mt-2 text-sm text-[var(--muted)]">Building the outline from live dots — the map appears after a few polls.</p>
              )}
            </section>
          </div>
        </>
      )}
    </main>
  );
}
