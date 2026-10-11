import { create } from "zustand";

export type ReplayState = {
  raceId: string | null;
  /** seconds since race start */
  t: number;
  playing: boolean;
  speed: 1 | 2 | 5 | 10 | 30;
  /** derived from t via lap-start table */
  lap: number;
  /** lap-start table of the loaded race (for lap stepping) */
  lapStarts: number[];
  set: (p: Partial<ReplayState>) => void;
  play: () => void;
  pause: () => void;
  seek: (t: number) => void;
};

/** One source of truth for the replay clock (docs/03-ARCHITECTURE.md). */
export const useReplayStore = create<ReplayState>((set) => ({
  raceId: null,
  t: 0,
  playing: false,
  speed: 1,
  lap: 1,
  lapStarts: [],
  set: (p) => set(p),
  play: () => set({ playing: true }),
  pause: () => set({ playing: false }),
  seek: (t) => set({ t: Math.max(0, t) }),
}));
