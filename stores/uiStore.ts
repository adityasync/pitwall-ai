import { create } from "zustand";
import { persist } from "zustand/middleware";

export type UiState = {
  mode: "easy" | "pro";
  lang: "en" | "hi";
  palette: boolean;
  set: (p: Partial<UiState>) => void;
};

/** Mode + language persist in localStorage (docs/02-PAGES.md). */
export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      mode: "easy",
      lang: "en",
      palette: false,
      set: (p) => set(p),
    }),
    { name: "pitwall-ui", partialize: (s) => ({ mode: s.mode, lang: s.lang, palette: false }) }
  )
);
