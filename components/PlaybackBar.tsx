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
  return (
    <div className="rounded-md border border-[var(--border)] bg-[var(--panel)] p-3">
      <p className="tnum text-xs text-[var(--muted)]">
        REPLAY · LAP {lap}/{laps}
      </p>
      <input
        type="range"
        min={0}
        max={Math.max(1, endT)}
        step={1}
        value={Math.min(t, endT)}
        onChange={(e) => onScrub(Number(e.target.value))}
        aria-label="Scrub replay time"
        className="mt-1 w-full"
      />
      <div className="relative mt-1 h-2" aria-hidden={false}>
        {shown.map((m) => (
          <button
            key={m.id}
            title={`${m.type.toUpperCase()} · ${m.headline}`}
            aria-label={`Seek to ${m.headline}`}
            onClick={() => onMoment(m.id)}
            className="absolute top-0 h-2 w-1.5 rounded bg-[var(--accent)] transition-transform hover:scale-y-150"
            style={{ left: `${endT > 0 ? (m.t / endT) * 100 : 0}%` }}
          />
        ))}
      </div>
      {hidden > 0 && (
        <p className="tnum mt-1 text-[11px] text-[var(--muted)]">
          Markers show high-confidence moments · {hidden} more in the feed below
        </p>
      )}
    </div>
  );
}
