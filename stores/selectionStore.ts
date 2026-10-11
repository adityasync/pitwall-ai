import { create } from "zustand";

export type SelectionState = {
  drivers: string[];
  momentId: string | null;
  set: (p: Partial<SelectionState>) => void;
};

/** Selected driver(s) + moment sync across pages and URL (docs/02-PAGES.md). */
export const useSelectionStore = create<SelectionState>((set) => ({
  drivers: [],
  momentId: null,
  set: (p) => set(p),
}));
