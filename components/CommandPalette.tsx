"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useReplayStore } from "@/stores/replayStore";
import { useUiStore } from "@/stores/uiStore";

type Entry = { label: string; hint: string; race: boolean; run: () => void };

/** Ctrl-K command palette (Shell canvas). ↑↓ move, Enter open, Tab ask, Esc close. */
export function CommandPalette() {
  const open = useUiStore((s) => s.palette);
  if (!open) return null;
  return <PaletteInner key="open" />;
}

function PaletteInner() {
  const router = useRouter();
  const setUi = useUiStore((s) => s.set);
  const stored = useReplayStore((s) => s.raceId);
  const [resolved, setResolved] = useState<string | null>(stored);
  const [q, setQ] = useState("");
  const [idx, setIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const raceId = stored ?? resolved ?? "";

  useEffect(() => {
    if (stored) return;
    let live = true;
    (async () => {
      const { firstRaceId } = await import("@/lib/first-race");
      const id = await firstRaceId();
      if (live && id) setResolved(id);
    })();
    return () => {
      live = false;
    };
  }, [stored]);

  const entries: Entry[] = useMemo(
    () => [
      { label: `Easy race view — ${raceId}`, hint: "watch", race: true, run: () => router.push(`/race/${raceId}/easy`) },
      { label: `Pro workstation — ${raceId}`, hint: "watch", race: true, run: () => router.push(`/race/${raceId}/pro`) },
      { label: `Onboard telemetry — ${raceId}`, hint: "watch", race: true, run: () => router.push(`/race/${raceId}/onboard`) },
      { label: `Qualifying — ${raceId}`, hint: "watch", race: true, run: () => router.push(`/race/${raceId}/quali`) },
      { label: "Compare drivers", hint: "analyse", race: true, run: () => router.push(`/race/${raceId}/compare`) },
      { label: "Corner analysis", hint: "analyse", race: true, run: () => router.push(`/race/${raceId}/corners`) },
      { label: "Strategy simulator", hint: "analyse", race: true, run: () => router.push(`/race/${raceId}/strategy`) },
      { label: "Tyre and pace", hint: "analyse", race: true, run: () => router.push(`/race/${raceId}/pace`) },
      { label: "Battles and overtakes", hint: "analyse", race: true, run: () => router.push(`/race/${raceId}/battles`) },
      { label: "Recap and share", hint: "watch", race: true, run: () => router.push(`/race/${raceId}/recap`) },
      { label: "Ask the AI", hint: "more", race: true, run: () => router.push(`/ask?race=${raceId}`) },
      { label: "Session explorer", hint: "more", race: false, run: () => router.push("/explorer") },
      { label: "Live positions (beta)", hint: "watch", race: false, run: () => router.push("/live") },
      { label: "Telemetry lab", hint: "analyse", race: false, run: () => router.push("/telemetry") },
      { label: "Standings", hint: "people", race: false, run: () => router.push("/standings") },
      { label: "Methods and data limits", hint: "more", race: false, run: () => router.push("/methods") },
      { label: "Pick a race", hint: "watch", race: false, run: () => router.push("/races") },
      { label: "Toggle Easy/Pro mode", hint: "command", race: false, run: () => {
        const s = useUiStore.getState();
        s.set({ mode: s.mode === "easy" ? "pro" : "easy" });
      } },
      { label: "Toggle EN/Hinglish", hint: "command", race: false, run: () => {
        const s = useUiStore.getState();
        s.set({ lang: s.lang === "en" ? "hi" : "en" });
      } },
    ],
    [router, raceId]
  );

  const filtered = useMemo(() => {
    const needle = q.toLowerCase();
    // without a resolved race, only global commands are valid
    const pool = raceId ? entries : entries.filter((e) => !e.race);
    return pool.filter(
      (e) => e.label.toLowerCase().includes(needle) || e.hint.includes(needle)
    );
  }, [entries, q, raceId]);
  useEffect(() => {
    const id = setTimeout(() => inputRef.current?.focus(), 0);
    return () => clearTimeout(id);
  }, []);

  const close = () => setUi({ palette: false });

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center bg-black/60 p-4 pt-[15vh]"
      onClick={close} role="presentation">
      <div className="w-full max-w-lg overflow-hidden rounded-md border border-[var(--border-strong)] bg-[var(--panel)]"
        onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Command palette">
        <input
          ref={inputRef}
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setIdx(0);
          }}
          placeholder="Search or run a command..."
          aria-label="Search or run a command"
          className="touch w-full border-b border-[var(--border)] bg-transparent px-4 text-base outline-none"
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setIdx((i) => Math.min(filtered.length - 1, i + 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setIdx((i) => Math.max(0, i - 1));
            } else if (e.key === "Enter") {
              e.preventDefault();
              filtered[idx]?.run();
              close();
            } else if (e.key === "Escape") {
              close();
            } else if (e.key === "Tab") {
              e.preventDefault();
              router.push(`/ask?race=${raceId}`);
              close();
            }
          }}
        />
        <ul className="max-h-72 overflow-auto py-1">
          {filtered.map((e, i) => (
            <li key={e.label}>
              <button
                onClick={() => {
                  e.run();
                  close();
                }}
                onMouseEnter={() => setIdx(i)}
                className={`flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm ${i === idx ? "bg-[var(--raised)] text-[var(--accent)]" : "text-[var(--text)]"}`}
              >
                <span className="tnum text-[11px] uppercase text-[var(--muted)]">{e.hint}</span>
                {e.label}
              </button>
            </li>
          ))}
          {filtered.length === 0 && (
            <li className="px-4 py-3 text-sm text-[var(--muted)]">No matches.</li>
          )}
        </ul>
        <p className="tnum border-t border-[var(--border)] px-4 py-2 text-[11px] text-[var(--muted)]">
          ↑↓ MOVE · ENTER OPEN · TAB ASK THE AI · ESC CLOSE
        </p>
      </div>
    </div>
  );
}
