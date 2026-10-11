"use client";

import type { Moment } from "@/lib/types";

/** Playback bar: scrub across the race with moment markers (06-DESIGN-SYSTEM.md). */
export function PlaybackBar({
  t,
  endT,
  lap,
  laps,
  moments,
  onScrub,
  onMoment,
}: {
  t: number;
  endT: number;
  lap: number;
  laps: number;
  moments: Pick<Moment, "id" | "t" | "headline" | "confidence" | "type">[];
  onScrub: (t: number) => void;
  onMoment: (id: string) => void;
}) {
  // 400+ markers would be visual noise — show high-confidence ones, count the rest
  const shown = moments.filter((m) => m.confidence === "high");
  const hidden = moments.length - shown.length;
  const pct = endT > 0 ? Math.min(100, (t / endT) * 100) : 0;
  return (
    <div className="card p-4 sm:p-5">
      <div className="flex items-baseline justify-between gap-3">
        <p className="tnum text-xs font-semibold tracking-widest text-[var(--muted)]">
          REPLAY · LAP {lap}/{laps}
        </p>
        <p className="tnum text-xs text-[var(--faint)]">
          {shown.length} key moments
        </p>
      </div>
      <input
        type="range"
        min={0}
        max={Math.max(1, endT)}
        step={1}
        value={Math.min(t, endT)}
        onChange={(e) => onScrub(Number(e.target.value))}
        aria-label="Scrub replay time"
        className="mt-1 w-full"
        style={{ ["--fill" as string]: `${pct}%` }}
      />
      <div className="relative mt-1 h-3" aria-hidden={false}>
        <div aria-hidden className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-[var(--raised)]" />
        {shown.map((m) => (
          <button
            key={m.id}
            title={`${m.type.toUpperCase()} · ${m.headline}`}
            aria-label={`Seek to ${m.headline}`}
            onClick={() => onMoment(m.id)}
            className="absolute top-1/2 h-3 w-2 -translate-y-1/2 rounded-full bg-[var(--accent)] transition-transform hover:scale-x-150"
            style={{ left: `${endT > 0 ? (m.t / endT) * 100 : 0}%` }}
          />
        ))}
      </div>
      {hidden > 0 && (
        <p className="tnum mt-1.5 text-[11px] text-[var(--faint)]">
          Markers show high-confidence moments · {hidden} more in the feed below
        </p>
      )}
    </div>
  );
}
