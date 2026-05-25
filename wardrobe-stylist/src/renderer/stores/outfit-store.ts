import { create } from 'zustand';
import type { Outfit } from '../lib/types';

interface OutfitState {
  outfits: Outfit[];
  loading: boolean;

  loadOutfits: () => Promise<void>;
  saveOutfit: (data: any) => Promise<void>;
  updateOutfit: (id: string, patch: any) => Promise<void>;
  deleteOutfit: (id: string) => Promise<void>;
}

export const useOutfitStore = create<OutfitState>((set) => ({
  outfits: [],
  loading: false,

  loadOutfits: async () => {
    set({ loading: true });
    try {
      const outfits = await window.electronAPI.getOutfits();
      set({ outfits, loading: false });
    } catch (e) {
      console.error('Failed to load outfits:', e);
      set({ loading: false });
    }
  },

  saveOutfit: async (data) => {
    const record = await window.electronAPI.createOutfit(data);
    set((s) => ({ outfits: [...s.outfits, record] }));
  },

  updateOutfit: async (id, patch) => {
    const updated = await window.electronAPI.updateOutfit(id, patch);
    if (updated) {
      set((s) => ({
        outfits: s.outfits.map((o) => (o.id === id ? updated : o)),
      }));
    }
  },

  deleteOutfit: async (id) => {
    await window.electronAPI.deleteOutfit(id);
    set((s) => ({ outfits: s.outfits.filter((o) => o.id !== id) }));
  },
}));
