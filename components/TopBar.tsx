"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
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
      className="flex shrink-0 items-center rounded-full border border-white/10 bg-white/[0.04] p-1 backdrop-blur-md"
    >
      {(["easy", "pro"] as const).map((m) => (
        <button
          key={m}
          onClick={() => set({ mode: m })}
          aria-pressed={mode === m}
          className={`touch rounded-full px-4 text-[12px] font-bold tracking-[0.14em] uppercase transition-all duration-300 ${
            mode === m
              ? "bg-white text-black shadow-[0_2px_14px_rgba(255,255,255,0.3)]"
              : "text-[var(--muted)] hover:text-[var(--text)]"
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
      className="flex shrink-0 items-center rounded-full border border-white/10 bg-white/[0.04] p-1 backdrop-blur-md"
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
          className={`touch rounded-full px-3 text-[12px] font-bold tracking-wide transition-all duration-300 ${
            lang === v
              ? "bg-[var(--accent-deep)] text-white shadow-[0_2px_16px_rgba(225,6,0,0.6)]"
              : "text-[var(--muted)] hover:text-[var(--text)]"
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
      <span className="tnum inline-flex min-h-[44px] shrink-0 items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 text-[11px] font-bold tracking-[0.18em] text-[var(--muted)] backdrop-blur-md">
        <span aria-hidden className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--faint)]" />
        REPLAY DATA
      </span>
    );
  }
  return (
    <span className="tnum inline-flex min-h-[44px] shrink-0 items-center gap-2 rounded-full border border-[rgba(225,6,0,0.45)] bg-[rgba(225,6,0,0.12)] px-4 text-[11px] font-bold tracking-[0.18em] text-white backdrop-blur-md shadow-[0_0_24px_-4px_rgba(225,6,0,0.6)]">
      <span aria-hidden className="live-dot inline-block h-1.5 w-1.5 rounded-full bg-[#ff2b2b]" />
      REPLAY · LAP {lap}
    </span>
  );
}

const PRIMARY: { href: string; label: string }[] = [
  { href: "/races", label: "Races" },
  { href: "/ask", label: "Ask" },
  { href: "/telemetry", label: "Telemetry" },
  { href: "/standings", label: "Standings" },
];

const OVERFLOW: { href: string; label: string; desc: string }[] = [
  { href: "/follow", label: "Follow", desc: "Your drivers" },
  { href: "/season", label: "Season", desc: "Title fight + calendar" },
  { href: "/drivers", label: "Drivers", desc: "865 careers" },
  { href: "/teams", label: "Teams", desc: "Constructors" },
  { href: "/circuits", label: "Circuits", desc: "78 tracks" },
  { href: "/explorer", label: "Explorer", desc: "Search everything" },
  { href: "/export", label: "Export", desc: "CSV + PNG" },
  { href: "/methods", label: "Methods", desc: "How we stay honest" },
];

const SHEET_GROUPS: { title: string; links: { href: string; label: string }[] }[] = [
  { title: "Watch", links: [{ href: "/races", label: "Races" }, { href: "/follow", label: "Follow" }] },
  { title: "Analyse", links: [{ href: "/ask", label: "Ask" }, { href: "/telemetry", label: "Telemetry" }, { href: "/explorer", label: "Explorer" }, { href: "/export", label: "Export" }] },
  { title: "Sport", links: [{ href: "/standings", label: "Standings" }, { href: "/season", label: "Season" }, { href: "/drivers", label: "Drivers" }, { href: "/teams", label: "Teams" }, { href: "/circuits", label: "Circuits" }] },
  { title: "Project", links: [{ href: "/methods", label: "Methods" }] },
];

export function TopBar() {
  const openPalette = useUiStore((s) => s.set);
  const pathname = usePathname() ?? "";
  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(`${href}/`);
  const overflowActive = OVERFLOW.some((l) => isActive(l.href));

  return (
    <header className="sticky top-0 z-50 border-b border-white/[0.07] bg-[#07070a]/78 backdrop-blur-2xl backdrop-saturate-150">
      <div className="mx-auto flex h-16 w-full max-w-[1440px] items-center gap-2 px-4 sm:gap-3 sm:px-6">
        <Link href="/" className="display group flex shrink-0 items-center gap-2.5 text-xl font-bold tracking-tight" aria-label="Pitwall.ai home">
          <Image src="/logo-mark.svg" alt="" aria-hidden width={32} height={32} className="h-8 w-8" />
          <span className="hidden italic sm:inline">pitwall<span className="text-[var(--accent)]">.ai</span></span>
        </Link>

        {/* desktop primary nav — 4 items, no shouting group labels */}
        <nav aria-label="Primary" className="ml-2 hidden items-center gap-0.5 lg:flex">
          {PRIMARY.map((l) => {
            const active = isActive(l.href);
            return (
              <Link
                key={l.href}
                href={l.href}
                aria-current={active ? "page" : undefined}
                className={`touch relative inline-flex items-center gap-1.5 rounded-full px-3.5 text-[13.5px] font-semibold tracking-wide transition-all duration-200 ${
                  active ? "text-white" : "text-[var(--muted)] hover:text-white"
                }`}
              >
                {l.label}
                <span
                  aria-hidden
                  className={`absolute inset-x-3.5 -bottom-[13px] h-[2px] rounded-full bg-gradient-to-r from-[#ff2b2b] to-[#ff7a5c] transition-all duration-300 ${
                    active ? "opacity-100 scale-x-100" : "opacity-0 scale-x-50"
                  }`}
                />
              </Link>
            );
          })}
          <OverflowMenu active={overflowActive} isActive={isActive} />
        </nav>

        <div className="ml-auto flex min-w-0 items-center gap-1.5 sm:gap-2">
          <button
            onClick={() => openPalette({ palette: true })}
            className="touch inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-[var(--muted)] backdrop-blur-md transition hover:border-white/20 hover:text-white"
            aria-label="Search or run a command (Ctrl K)"
            title="Search (Ctrl K)"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
              <circle cx="7" cy="7" r="4.5" stroke="currentColor" strokeWidth="1.6" />
              <line x1="10.8" y1="10.8" x2="14" y2="14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </button>
          <span className="hidden md:inline-flex"><ReplayBadge /></span>
          <ModeToggle />
          <span className="hidden sm:inline-flex"><LangToggle /></span>
          <MobileMenu isActive={isActive} />
        </div>
      </div>
      <div aria-hidden className="h-px bg-gradient-to-r from-transparent via-[var(--accent-deep)]/70 to-transparent" />
    </header>
  );
}

function OverflowMenu({ active, isActive }: { active: boolean; isActive: (h: string) => boolean }) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open ]);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="menu"
        className={`touch inline-flex items-center gap-1 rounded-full px-3.5 text-[13.5px] font-semibold tracking-wide transition ${
          active || open ? "text-white" : "text-[var(--muted)] hover:text-white"
        }`}
      >
        More
        <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden className={`transition-transform duration-300 ${open ? "rotate-180" : ""}`}>
          <path d="M2 3.5 5 6.5 8 3.5" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" />
        </svg>
        {active && <span aria-hidden className="h-1 w-1 rounded-full bg-[#ff2b2b]" />}
      </button>
      {open && (
        <div
          role="menu"
          className="glass absolute left-1/2 top-[calc(100%+14px)] z-50 w-[420px] -translate-x-1/2 overflow-hidden rounded-2xl p-2 shadow-[0_30px_80px_-20px_rgba(0,0,0,0.9)]"
        >
          <div aria-hidden className="h-px bg-gradient-to-r from-transparent via-[var(--accent-deep)]/60 to-transparent" />
          <div className="grid grid-cols-2 gap-1 p-1">
            {OVERFLOW.map((l) => {
              const on = isActive(l.href);
              return (
                <Link
                  key={l.href}
                  href={l.href}
                  role="menuitem"
                  onClick={() => setOpen(false)}
                  className={`group rounded-xl px-3.5 py-3 transition ${
                    on ? "bg-[rgba(225,6,0,0.14)]" : "hover:bg-white/[0.06]"
                  }`}
                >
                  <span className={`block text-[14px] font-bold ${on ? "text-white" : "text-white/90 group-hover:text-white"}`}>
                    {l.label}
                  </span>
                  <span className="tnum mt-0.5 block text-[10px] tracking-[0.16em] text-[var(--muted)]">{l.desc.toUpperCase()}</span>
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function MobileMenu({ isActive }: { isActive: (h: string) => boolean }) {
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      document.removeEventListener("keydown", onKey);
    };
  }, [open ]);

  return (
    <span className="lg:hidden">
      <button
        onClick={() => setOpen(true)}
        aria-label="Open menu"
        aria-expanded={open}
        className="touch inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-white"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden>
          <line x1="2" y1="4.5" x2="14" y2="4.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          <line x1="2" y1="8" x2="14" y2="8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          <line x1="6" y1="11.5" x2="14" y2="11.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      </button>
      {open && (
        <div className="fixed inset-0 z-[70] flex flex-col bg-[#07070a]/92 backdrop-blur-2xl" role="dialog" aria-modal="true" aria-label="Menu">
          <div className="flex h-16 items-center gap-2 px-4">
            <span className="display text-xl font-bold italic">pitwall<span className="text-[var(--accent)]">.ai</span></span>
            <button
              onClick={() => setOpen(false)}
              aria-label="Close menu"
              className="touch ml-auto inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/[0.05] text-white"
            >
              ✕
            </button>
          </div>
          <div aria-hidden className="h-px bg-gradient-to-r from-transparent via-[var(--accent-deep)]/60 to-transparent" />
          <div className="flex-1 overflow-y-auto px-5 pb-10 pt-4">
            {SHEET_GROUPS.map((g) => (
              <div key={g.title} className="mt-6 first:mt-2">
                <p className="panel-label opacity-70">{g.title}</p>
                <ul className="mt-2 overflow-hidden rounded-2xl border border-white/[0.07] bg-white/[0.02]">
                  {g.links.map((l) => {
                    const on = isActive(l.href);
                    return (
                      <li key={l.href} className="border-b border-white/[0.06] last:border-0">
                        <Link
                          href={l.href}
                          onClick={() => setOpen(false)}
                          aria-current={on ? "page" : undefined}
                          className={`flex items-center gap-3 px-4 py-3.5 text-[17px] font-semibold ${on ? "text-white" : "text-white/85"}`}
                        >
                          {on && <span aria-hidden className="h-5 w-[3px] rounded-full bg-gradient-to-b from-[#ff2b2b] to-[#9d0400]" />}
                          {l.label}
                          <span aria-hidden className="ml-auto text-[var(--faint)]">→</span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
            <div className="mt-6 flex flex-wrap gap-2">
              <ModeToggle />
              <LangToggle />
            </div>
          </div>
        </div>
      )}
    </span>
  );
}
