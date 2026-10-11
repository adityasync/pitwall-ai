"use client";

import { useEffect } from "react";
import { useReplayStore } from "@/stores/replayStore";
import { useUiStore } from "@/stores/uiStore";
import { lapAtT } from "@/lib/clock";

/**
 * Global keyboard shortcuts (docs/03): Space play/pause,
 * arrows step lap, Ctrl-K palette (palette lands Day 4 — stub).
 */
export function PlaybackKeys() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) return;
      if (useUiStore.getState().palette && e.key !== "Escape") return;
      if (e.code === "Space") {
        e.preventDefault();
        const s = useReplayStore.getState();
        s.set({ playing: !s.playing });
      } else if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
        const s = useReplayStore.getState();
        const dir = e.key === "ArrowRight" ? 1 : -1;
        if (s.lapStarts.length > 0) {
          const lap = Math.min(
            s.lapStarts.length,
            Math.max(1, lapAtT(s.lapStarts, s.t) + dir)
          );
          const nt = s.lapStarts[lap - 1];
          s.set({ t: nt, lap });
        } else {
          s.seek(s.t + dir * 95);
        }
      } else if (e.key.toLowerCase() === "k" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        const u = useUiStore.getState();
        u.set({ palette: !u.palette });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  return null;
}
