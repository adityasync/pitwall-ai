import { create } from "zustand";
import { persist } from "zustand/middleware";

export type UiState = {
  lang: "en" | "hi";
  palette: boolean;
  set: (p: Partial<UiState>) => void;
};

/** Language + palette state persist in localStorage (docs/02-PAGES.md).
 *  Mode is per-race-route, not global, so it is not stored here. */
export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      lang: "en",
      palette: false,
      set: (p) => set(p),
    }),
    { name: "pitwall-ui", partialize: (s) => ({ lang: s.lang, palette: false }) }
  )
);
