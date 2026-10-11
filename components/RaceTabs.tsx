"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { loadJson } from "@/lib/data";
import { useReplayStore } from "@/stores/replayStore";
import {
  drsAtT,
  statusStyle,
  trackStatusAtT,
  type RaceControlMsg,
} from "@/lib/timing";

const TABS = [
  "easy",
  "pro",
  "onboard",
  "recap",
  "compare",
  "corners",
  "strategy",
  "pace",
  "battles",
  "quali",
  "radio",
] as const;

/** One slim race bar: race name + live lap + section tabs. Replaces the old
 *  tab strip plus the Easy/Pro title rows so race pages open with one band,
 *  not three. */
export function RaceBar({ raceId }: { raceId: string }) {
  const pathname = usePathname();
  const active =
    pathname?.split(`/race/${raceId}/`)[1]?.split("/")[0]?.split("?")[0] ?? "";
  const lap = useReplayStore((s) => s.lap);
  const t = useReplayStore((s) => s.t);
  const loadedId = useReplayStore((s) => s.raceId);
  const [meta, setMeta] = useState<{ name: string; laps: number } | null>(null);
  const [rc, setRc] = useState<RaceControlMsg[] | null>(null);

  useEffect(() => {
    let live = true;
    (async () => {
      const r = await loadJson<{ name: string; laps: number }>(
        `${raceId}/meta.json`
      );
      if (!live || r.status !== "ready" || !r.data) return;
      setMeta({ name: r.data.name, laps: r.data.laps });
    })();
    return () => {
      live = false;
    };
  }, [raceId]);

  useEffect(() => {
    let live = true;
    (async () => {
      const r = await loadJson<RaceControlMsg[]>(`${raceId}/race_control.json`);
      if (!live || r.status !== "ready" || !r.data) return;
      setRc(r.data);
    })();
    return () => {
      live = false;
    };
  }, [raceId]);

  const status = rc ? trackStatusAtT(rc, t) : null;
  const drs = rc ? drsAtT(rc, t) : false;

  return (
    <div className="border-b border-[var(--border)] bg-[#090e16]">
      <div className="mx-auto flex w-full max-w-[1280px] items-center gap-4 px-4 sm:px-6">
        <p className="flex min-w-0 shrink-0 items-center gap-2 py-2.5">
          <span className="display max-w-[30vw] truncate text-base font-bold tracking-tight">
            {meta?.name ?? "…"}
          </span>
          {status && (
            <span
              className={`tnum shrink-0 rounded-md border px-1.5 py-0.5 text-[11px] font-bold tracking-widest ${statusStyle(status.key)}`}
              title="Track status from race control (MEASURED)"
            >
              {status.label}
            </span>
          )}
          {drs && status?.key === "GREEN" && (
            <span
              className="tnum shrink-0 rounded-md border border-[var(--accent)]/50 bg-[var(--accent-dim)] px-1.5 py-0.5 text-[11px] font-bold tracking-widest text-[var(--accent)]"
              title="DRS enabled by race control (MEASURED)"
            >
              DRS
            </span>
          )}
          <span className="tnum shrink-0 rounded bg-[var(--raised)] px-1.5 py-0.5 text-[11px] font-semibold text-[var(--muted)]">
            {loadedId === raceId && meta
              ? `LAP ${lap}/${meta.laps}`
              : meta
                ? `${meta.laps} LAPS`
                : "…"}
          </span>
        </p>
        <nav
          aria-label="Race sections"
          className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto whitespace-nowrap py-1 [scrollbar-width:thin] [&::-webkit-scrollbar]:h-1 [&::-webkit-scrollbar-thumb]:rounded [&::-webkit-scrollbar-thumb]:bg-[var(--border-strong)]"
        >
          {TABS.map((slug) => {
            const isActive = active === slug;
            return (
              <Link
                key={slug}
                href={`/race/${raceId}/${slug}`}
                aria-current={isActive ? "page" : undefined}
                className={`touch inline-flex shrink-0 items-center rounded-lg px-3 text-sm font-semibold capitalize ${
                  isActive
                    ? "bg-[var(--accent-deep)] text-white"
                    : "text-[var(--text)] hover:bg-[var(--raised)] hover:text-[var(--accent)]"
                }`}
              >
                {slug}
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
