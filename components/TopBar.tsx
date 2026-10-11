"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useUiStore } from "@/stores/uiStore";
import { useReplayStore } from "@/stores/replayStore";
/** EASY/PRO toggle — changes presentation, not data (AGENTS.md). */
export function ModeToggle() {
  const { mode, set } = useUiStore();
  return (
    <div
      role="group"
      aria-label="Mode"
      className="flex overflow-hidden rounded-md border border-[var(--border-strong)]"
    >
      {(["easy", "pro"] as const).map((m) => (
        <button
          key={m}
          onClick={() => set({ mode: m })}
          aria-pressed={mode === m}
          className={`touch px-4 text-sm font-semibold tracking-wide uppercase ${
            mode === m
              ? "bg-[var(--accent)] text-black"
              : "text-[var(--muted)]"
          }`}
        >
          {m}
        </button>
      ))}
    </div>
  );
}

/** EN/Hinglish toggle — same layout both languages (06-DESIGN-SYSTEM.md rule 6). */
export function LangToggle() {
  const { lang, set } = useUiStore();
  return (
    <div
      role="group"
      aria-label="Language"
      className="flex overflow-hidden rounded-md border border-[var(--border-strong)]"
    >
      {(
        [
          ["en", "EN"],
          ["hi", "HINGLISH"],
        ] as const
      ).map(([v, label]) => (
        <button
          key={v}
          onClick={() => set({ lang: v })}
          aria-pressed={lang === v}
          className={`touch px-3 text-sm font-semibold ${
            lang === v
              ? "bg-[var(--raised)] text-[var(--text)]"
              : "text-[var(--muted)]"
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

/** Replay badge — every page shows REPLAY · LAP n (02-PAGES.md shell). */
export function ReplayBadge() {
  const lap = useReplayStore((s) => s.lap);
  const raceId = useReplayStore((s) => s.raceId);
  if (!raceId) {
    return (
      <span className="tnum inline-flex min-h-[44px] items-center rounded-md border border-[var(--border)] px-3 text-xs font-semibold tracking-widest text-[var(--muted)]">
        REPLAY DATA
      </span>
    );
  }
  return (
    <span className="tnum inline-flex min-h-[44px] items-center rounded-md border border-[var(--border-strong)] px-3 text-xs font-semibold tracking-widest text-[var(--accent)]">
      REPLAY · LAP {lap}
    </span>
  );
}

const NAV: { group: string; links: { href: string; label: string }[] }[] = [
  {
    group: "WATCH",
    links: [
      { href: "/races", label: "Races" },
      { href: "/follow", label: "Follow" },
    ],
  },
  {
    group: "ANALYSE",
    links: [
      { href: "/ask", label: "Ask" },
      { href: "/telemetry", label: "Telemetry" },
    ],
  },
  {
    group: "PEOPLE",
    links: [
      { href: "/standings", label: "Standings" },
      { href: "/season", label: "Season" },
    ],
  },
  {
    group: "MORE",
    links: [
      { href: "/explorer", label: "Explorer" },
      { href: "/export", label: "Export" },
      { href: "/methods", label: "Methods" },
    ],
  },
];

export function TopBar() {
  const openPalette = useUiStore((s) => s.set);
  const pathname = usePathname() ?? "";
  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(`${href}/`);
  return (
    <header className="sticky top-0 z-50 border-b border-[var(--border)] bg-[var(--bar)]">
      <div className="mx-auto w-full max-w-[1360px] px-4 pt-2">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <Link href="/" className="flex min-h-[44px] items-center gap-2" aria-label="PITWALL.AI — home">
            <Image src="/logo.svg" alt="" width={176} height={32} className="h-8 w-auto" priority />
            <span className="sr-only">PITWALL.AI</span>
          </Link>
          <button
            onClick={() => openPalette({ palette: true })}
            className="touch hidden items-center gap-2 rounded-md border border-[var(--border-strong)] px-3 text-sm text-[var(--muted)] md:inline-flex"
            aria-label="Open command palette"
          >
            Search or run a command…
            <span className="tnum rounded bg-[var(--raised)] px-1.5 text-[11px]">Ctrl K</span>
          </button>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <ReplayBadge />
            <ModeToggle />
            <LangToggle />
          </div>
        </div>
        <nav
          aria-label="Primary"
          className="mt-1 flex items-center gap-x-5 gap-y-1 overflow-x-auto whitespace-nowrap py-1 [scrollbar-width:thin] [&::-webkit-scrollbar]:h-1 [&::-webkit-scrollbar-thumb]:rounded [&::-webkit-scrollbar-thumb]:bg-[var(--border-strong)]"
        >
          {NAV.map((g) => (
            <span key={g.group} className="flex shrink-0 items-center gap-1">
              <span aria-hidden="true" className="panel-label mr-1 shrink-0">
                {g.group}
              </span>
              {g.links.map((l) => {
                const active = isActive(l.href);
                return (
                  <Link
                    key={l.href}
                    href={l.href}
                    aria-current={active ? "page" : undefined}
                    className={`touch inline-flex shrink-0 items-center rounded-md px-3 text-sm font-semibold ${
                      active
                        ? "bg-[var(--raised)] text-[var(--accent)] shadow-[inset_0_-2px_0_0_var(--accent)]"
                        : "text-[var(--text)] hover:bg-[var(--raised)] hover:text-[var(--accent)]"
                    }`}
                  >
                    {l.label}
                  </Link>
                );
              })}
            </span>
          ))}
        </nav>
      </div>
    </header>
  );
}
