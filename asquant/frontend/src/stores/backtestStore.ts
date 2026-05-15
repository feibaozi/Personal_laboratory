import { create } from "zustand";
import type { BacktestConfig } from "@/types/backtest";
import dayjs from "dayjs";

const defaultConfig: BacktestConfig = {
  name: "",
  start_date: dayjs().subtract(1, "year").format("YYYY-MM-DD"),
  end_date: dayjs().format("YYYY-MM-DD"),
  factor_names: ["return_1m"],
  top_n: 20,
  rebalance_freq: "monthly",
  weighting: "equal",
  transaction_cost: 0.0003,
  slippage: 0.001,
  benchmark: "000300",
  initial_capital: 1_000_000,
};

interface BacktestState {
  config: BacktestConfig;
  setConfig: (partial: Partial<BacktestConfig>) => void;
  toggleFactor: (name: string) => void;
  resetConfig: () => void;
}

export const useBacktestStore = create<BacktestState>((set) => ({
  config: { ...defaultConfig },
  setConfig: (partial) => set((s) => ({ config: { ...s.config, ...partial } })),
  toggleFactor: (name: string) =>
    set((s) => {
      const names = [...s.config.factor_names];
      const idx = names.indexOf(name);
      if (idx >= 0) names.splice(idx, 1);
      else names.push(name);
      return { config: { ...s.config, factor_names: names } };
    }),
  resetConfig: () => set({ config: { ...defaultConfig } }),
}));
