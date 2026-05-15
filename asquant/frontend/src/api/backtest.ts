import { api } from "./client";
import type { BacktestRun, BacktestDetail, BacktestDaily, BacktestConfig } from "@/types/backtest";

export async function runBacktest(config: BacktestConfig) {
  return api.post<{ run_id: string; status: string; error?: string }>("/backtest/run", config);
}

export async function fetchBacktestRuns(page = 1) {
  return api.get<{ runs: BacktestRun[] }>(`/backtest/runs?page=${page}&page_size=20`);
}

export async function fetchBacktestDetail(runId: string): Promise<BacktestDetail> {
  return api.get(`/backtest/runs/${runId}`);
}

export async function fetchBacktestDaily(runId: string) {
  const res = await api.get<{ daily: BacktestDaily[] }>(`/backtest/runs/${runId}/daily`);
  return res.daily;
}

export async function fetchBacktestAttribution(runId: string) {
  return api.get(`/backtest/runs/${runId}/attribution`);
}
