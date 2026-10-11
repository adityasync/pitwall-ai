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
  const accent =
    kind === "error"
      ? "text-[var(--bad)] border-[var(--bad)]"
      : kind === "loading" || kind === "thinking"
        ? "text-[var(--accent)] border-[var(--border-strong)]"
        : "text-[var(--text)] border-[var(--border)]";
  return (
    <div
      role="status"
      className={`rounded-md border bg-[var(--panel)] p-6 ${accent}`}
    >
      <p className="panel-label mb-2">{kind}</p>
      <p className="display text-2xl font-bold text-[var(--text)]">{title}</p>
      <p className="mt-2 text-[var(--muted)]">{text}</p>
      {(kind === "loading" || kind === "thinking") && (
        <div
          className="mt-4 h-1.5 overflow-hidden rounded bg-[var(--raised)]"
          aria-hidden={progress == null}
        >
          <div
            className="h-full rounded bg-[var(--accent)] transition-all"
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
        <div className="mt-4 flex flex-wrap gap-2">
          {action}
          {second}
        </div>
      )}
    </div>
  );
}
