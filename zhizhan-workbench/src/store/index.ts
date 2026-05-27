import { create } from "zustand";
import type { Stock, Alert, AppSettings } from "@/lib/types";
import { fetchApi } from "@/lib/api";

interface AppStore {
  watchlist: Stock[];
  currentStock: Stock | null;
  alerts: Alert[];
  unreadAlertCount: number;
  isGenerating: boolean;
  generationProgress: string;
  pythonOnline: boolean;
  settings: AppSettings;

  fetchWatchlist: () => Promise<void>;
  addToWatchlist: (stock: Omit<Stock, "id" | "createdAt" | "updatedAt">) => Promise<void>;
  removeFromWatchlist: (code: string) => Promise<void>;
  setCurrentStock: (stock: Stock | null) => void;
  fetchAlerts: () => Promise<void>;
  markAlertRead: (id: number) => Promise<void>;
  setGenerating: (val: boolean) => void;
  setGenerationProgress: (msg: string) => void;
  setPythonOnline: (val: boolean) => void;
  updateSettings: (settings: Partial<AppSettings>) => void;
}

const defaultSettings: AppSettings = {
  llmProvider: "deepseek",
  llmApiKey: "",
  llmModel: "deepseek-chat",
  dataRefreshInterval: 30,
  pythonPort: 8765,
};

export const useAppStore = create<AppStore>((set, get) => ({
  watchlist: [],
  currentStock: null,
  alerts: [],
  unreadAlertCount: 0,
  isGenerating: false,
  generationProgress: "",
  pythonOnline: false,
  settings: defaultSettings,

  fetchWatchlist: async () => {
    try {
      const stocks = await fetchApi<Stock[]>("/api/stocks/");
      set({ watchlist: stocks });
    } catch (err) {
      console.error("Failed to fetch watchlist:", err);
    }
  },

  addToWatchlist: async (stock) => {
    try {
      const created = await fetchApi<Stock>("/api/stocks/", {
        method: "POST",
        body: JSON.stringify(stock),
      });
      set((state) => ({ watchlist: [...state.watchlist, created] }));
    } catch (err) {
      console.error("Failed to add stock:", err);
    }
  },

  removeFromWatchlist: async (code) => {
    const stock = get().watchlist.find((s) => s.code === code);
    if (!stock) return;
    try {
      await fetchApi(`/api/stocks/${stock.id}`, { method: "DELETE" });
      set((state) => ({
        watchlist: state.watchlist.filter((s) => s.code !== code),
      }));
    } catch (err) {
      console.error("Failed to remove stock:", err);
    }
  },

  setCurrentStock: (stock) => set({ currentStock: stock }),

  fetchAlerts: async () => {
    try {
      const alerts = await fetchApi<Alert[]>("/api/alerts/");
      set({
        alerts,
        unreadAlertCount: alerts.filter((a) => !a.isRead).length,
      });
    } catch (err) {
      console.error("Failed to fetch alerts:", err);
    }
  },

  markAlertRead: async (id) => {
    try {
      await fetchApi(`/api/alerts/${id}/read`, { method: "PUT" });
      set((state) => ({
        alerts: state.alerts.map((a) => (a.id === id ? { ...a, isRead: true } : a)),
        unreadAlertCount: Math.max(0, state.unreadAlertCount - 1),
      }));
    } catch (err) {
      console.error("Failed to mark alert read:", err);
    }
  },

  setGenerating: (val) => set({ isGenerating: val }),
  setGenerationProgress: (msg) => set({ generationProgress: msg }),
  setPythonOnline: (val) => set({ pythonOnline: val }),
  updateSettings: (partial) =>
    set((state) => ({ settings: { ...state.settings, ...partial } })),
}));
