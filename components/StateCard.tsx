"use client";

import type { ReactNode } from "react";

/**
 * StateCard — the six canvas states (States.dc.html):
 * loading (with progress), empty, error, no-radio, live-off, thinking.
 * Never a blank panel (docs/03).
 */
export function StateCard({
  kind,
  title,
  text,
  action,
  second,
  progress,
}: {
  kind: "loading" | "empty" | "error" | "no-radio" | "live-off" | "thinking";
  title: string;
  text: string;
  action?: ReactNode;
  second?: ReactNode;
  /** 0..100 for loading */
  progress?: number;
}) {
  const dot =
    kind === "error"
      ? "bg-[var(--bad)]"
      : kind === "loading" || kind === "thinking"
        ? "bg-[var(--accent)] animate-pulse"
        : "bg-[var(--faint)]";
  return (
    <div role="status" className="card p-6 sm:p-8">
      <p className="panel-label flex items-center gap-2">
        <span aria-hidden className={`inline-block h-1.5 w-1.5 rounded-full ${dot}`} />
        {kind}
      </p>
      <p className="display mt-2 text-2xl font-bold sm:text-3xl">{title}</p>
      <p className="mt-2 max-w-xl leading-relaxed text-[var(--muted)]">{text}</p>
      {(kind === "loading" || kind === "thinking") && (
        <div
          className="mt-5 h-1.5 max-w-xl overflow-hidden rounded-full bg-[var(--raised)]"
          aria-hidden={progress == null}
        >
          <div
            className="h-full rounded-full bg-[var(--accent)] transition-all"
            style={{ width: `${progress ?? 64}%` }}
          />
        </div>
      )}
      {kind === "thinking" && (
        <p className="mt-3 flex items-center gap-1 text-sm text-[var(--accent)]" aria-hidden>
          <span className="animate-pulse">●</span>
          <span className="animate-pulse [animation-delay:150ms]">●</span>
          <span className="animate-pulse [animation-delay:300ms]">●</span>
        </p>
      )}
      {(action || second) && (
        <div className="mt-5 flex flex-wrap gap-2">
          {action}
          {second}
        </div>
      )}
    </div>
  );
}
