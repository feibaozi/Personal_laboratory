import { create } from 'zustand';
import type { Garment, FilterState } from '../lib/types';

interface WardrobeState {
  garments: Garment[];
  filters: FilterState;
  selectedGarment: Garment | null;
  loading: boolean;

  loadGarments: () => Promise<void>;
  addGarment: (data: any) => Promise<void>;
  updateGarment: (id: string, patch: any) => Promise<void>;
  deleteGarment: (id: string) => Promise<void>;
  setFilters: (filters: Partial<FilterState>) => void;
  setSelectedGarment: (g: Garment | null) => void;

  // Derived
  filteredGarments: () => Garment[];
}

export const useWardrobeStore = create<WardrobeState>((set, get) => ({
  garments: [],
  filters: { category: null, colors: [], seasons: [], search: '' },
  selectedGarment: null,
  loading: false,

  loadGarments: async () => {
    set({ loading: true });
    try {
      const garments = await window.electronAPI.getGarments();
      set({ garments, loading: false });
    } catch (e) {
      console.error('Failed to load garments:', e);
      set({ loading: false });
    }
  },

  addGarment: async (data) => {
    const record = await window.electronAPI.createGarment(data);
    set((s) => ({ garments: [...s.garments, record] }));
  },

  updateGarment: async (id, patch) => {
    const updated = await window.electronAPI.updateGarment(id, patch);
    if (updated) {
      set((s) => ({
        garments: s.garments.map((g) => (g.id === id ? updated : g)),
        selectedGarment: s.selectedGarment?.id === id ? updated : s.selectedGarment,
      }));
    }
  },

  deleteGarment: async (id) => {
    await window.electronAPI.deleteGarment(id);
    set((s) => ({
      garments: s.garments.filter((g) => g.id !== id),
      selectedGarment: s.selectedGarment?.id === id ? null : s.selectedGarment,
    }));
  },

  setFilters: (partial) => {
    set((s) => ({ filters: { ...s.filters, ...partial } }));
  },

  setSelectedGarment: (g) => set({ selectedGarment: g }),

  filteredGarments: () => {
    const { garments, filters } = get();
    return garments.filter((g) => {
      if (filters.category && g.category !== filters.category) return false;
      if (filters.colors.length > 0) {
        const gColors = JSON.parse(g.colors) as string[];
        if (!filters.colors.some((c) => gColors.includes(c))) return false;
      }
      if (filters.seasons.length > 0) {
        const gSeasons = JSON.parse(g.seasons) as string[];
        if (!filters.seasons.some((s) => gSeasons.includes(s))) return false;
      }
      if (filters.search) {
        const q = filters.search.toLowerCase();
        if (!g.name.toLowerCase().includes(q) && !(g.brand || '').toLowerCase().includes(q)) return false;
      }
      return true;
    });
  },
}));
