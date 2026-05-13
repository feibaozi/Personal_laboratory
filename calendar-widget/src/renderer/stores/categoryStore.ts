import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import type { Category } from '../../shared/types';

interface CategoryState {
  categories: Category[];
  loaded: boolean;

  loadCategories: () => Promise<void>;
  addCategory: (name: string, color: string) => Promise<Category>;
  updateCategory: (id: string, patch: Partial<Pick<Category, 'name' | 'color' | 'recurrenceType' | 'recurrenceDays'>>) => Promise<void>;
  deleteCategory: (id: string) => Promise<void>;
}

export const useCategoryStore = create<CategoryState>((set, get) => ({
  categories: [],
  loaded: false,

  loadCategories: async () => {
    try {
      const raw = await window.electronAPI.getCategoriesAll();
      const categories = raw.map((c: any) => ({
        id: c.id,
        name: c.name,
        color: c.color,
        recurrenceType: c.recurrenceType || c.recurrence_type || 'none',
        recurrenceDays: c.recurrenceDays || c.recurrence_days || 7,
        createdAt: c.created_at || c.createdAt || '',
      }));
      set({ categories, loaded: true });
    } catch {
      set({ loaded: true });
    }
  },

  addCategory: async (name, color) => {
    const category: Category = {
      id: uuidv4(),
      name,
      color,
      recurrenceType: 'none',
      recurrenceDays: 7,
      createdAt: new Date().toISOString(),
    };
    await window.electronAPI.createCategory(category);
    set((s) => ({ categories: [...s.categories, category] }));
    return category;
  },

  updateCategory: async (id, patch) => {
    await window.electronAPI.updateCategory(id, patch);
    set((s) => ({
      categories: s.categories.map((c) =>
        c.id === id ? { ...c, ...patch } : c
      ),
    }));
  },

  deleteCategory: async (id) => {
    await window.electronAPI.deleteCategory(id);
    set((s) => ({ categories: s.categories.filter((c) => c.id !== id) }));
  },
}));
