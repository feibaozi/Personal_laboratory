import type { BacktestConfig } from "./backtest";

export interface Strategy {
  id: number;
  name: string;
  description: string | null;
  config: Partial<BacktestConfig>;
  category: "custom" | "preset";
  created_at: string;
  updated_at: string;
}
