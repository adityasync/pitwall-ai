"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { loadJson } from "@/lib/data";
import { useReplayStore } from "@/stores/replayStore";

const TABS = [
  "easy",
  "pro",
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
  const loadedId = useReplayStore((s) => s.raceId);
  const [meta, setMeta] = useState<{ name: string; laps: number } | null>(null);

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

  return (
    <div className="border-b border-[var(--border)] bg-[var(--bar)]">
      <div className="mx-auto flex w-full max-w-[1360px] items-center gap-3 px-4">
        <p className="flex min-w-0 shrink-0 items-baseline gap-2 py-2">
          <span className="display max-w-[36vw] truncate text-base font-bold tracking-wide">
            {meta?.name ?? "…"}
          </span>
          <span className="tnum shrink-0 text-xs text-[var(--muted)]">
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
                className={`touch inline-flex shrink-0 items-center rounded-md px-3 text-sm font-semibold capitalize ${
                  isActive
                    ? "bg-[var(--accent)] text-black"
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
