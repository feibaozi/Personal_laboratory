import { create } from 'zustand';

interface UIState {
  tryOnMode: boolean;
  sidebarCollapsed: boolean;
  defaultOccasion: string;
  defaultSeason: string;

  setTryOnMode: (v: boolean) => void;
  toggleSidebar: () => void;
  setDefaultOccasion: (v: string) => void;
  setDefaultSeason: (v: string) => void;
}

export const useUIStore = create<UIState>((set) => ({
  tryOnMode: false,
  sidebarCollapsed: false,
  defaultOccasion: 'casual',
  defaultSeason: 'spring',

  setTryOnMode: (v) => set({ tryOnMode: v }),
  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
  setDefaultOccasion: (v) => set({ defaultOccasion: v }),
  setDefaultSeason: (v) => set({ defaultSeason: v }),
}));
