import { create } from "zustand";

interface UIState {
  sidebarCollapsed: boolean;
  marketOpen: boolean;
  toggleSidebar: () => void;
  setMarketOpen: (open: boolean) => void;
}

export const useUIStore = create<UIState>((set) => ({
  sidebarCollapsed: false,
  marketOpen: false,
  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
  setMarketOpen: (open) => set({ marketOpen: open }),
}));
