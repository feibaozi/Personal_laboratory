import { create } from "zustand";
import type { FactorDef } from "@/types/factor";

interface FactorState {
  selectedFactors: FactorDef[];
  toggleFactor: (f: FactorDef) => void;
  clearSelection: () => void;
}

export const useFactorStore = create<FactorState>((set) => ({
  selectedFactors: [],
  toggleFactor: (f) =>
    set((s) => {
      const exists = s.selectedFactors.find((x) => x.id === f.id);
      if (exists) return { selectedFactors: s.selectedFactors.filter((x) => x.id !== f.id) };
      return { selectedFactors: [...s.selectedFactors, f] };
    }),
  clearSelection: () => set({ selectedFactors: [] }),
}));
