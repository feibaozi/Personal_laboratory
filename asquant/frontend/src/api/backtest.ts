import { api } from "./client";
import type { BacktestRun, BacktestDetail, BacktestDaily, BacktestConfig, AttributionResult, BacktestTrade, BacktestPosition, TurnoverAnalysis, BarraAttribution } from "@/types/backtest";

export async function runBacktest(config: BacktestConfig) {
  return api.post<{ run_id: string; status: string; error?: string }>("/backtest/run", config);
}

export async function fetchBacktestRuns(page = 1) {
  return api.get<{ runs: BacktestRun[]; total: number }>(`/backtest/runs?page=${page}&page_size=20`);
}

export async function fetchBacktestDetail(runId: string): Promise<BacktestDetail> {
  return api.get(`/backtest/runs/${runId}`);
}

export async function fetchBacktestDaily(runId: string) {
  const res = await api.get<{ daily: BacktestDaily[] }>(`/backtest/runs/${runId}/daily`);
  return res.daily;
}

export async function fetchBacktestAttribution(runId: string): Promise<AttributionResult> {
  return api.get(`/backtest/runs/${runId}/attribution`);
}

export async function fetchBacktestTrades(runId: string): Promise<BacktestTrade[]> {
  const res = await api.get<{ trades: BacktestTrade[] }>(`/backtest/runs/${runId}/trades`);
  return res.trades;
}

export async function fetchBacktestPositions(runId: string): Promise<BacktestPosition[]> {
  const res = await api.get<{ positions: BacktestPosition[] }>(`/backtest/runs/${runId}/positions`);
  return res.positions;
}

export async function fetchBacktestTurnover(runId: string): Promise<TurnoverAnalysis> {
  return api.get(`/backtest/runs/${runId}/turnover`);
}

export async function fetchBacktestBarra(runId: string): Promise<BarraAttribution> {
  return api.get(`/backtest/runs/${runId}/barra`);
}

export function createProgressSSE(runId: string): EventSource {
  return new EventSource(`/api/v1/backtest/progress/${runId}`);
}

export async function cancelBacktest(runId: string) {
  return api.post<{ run_id: string; status: string }>(`/backtest/runs/${runId}/cancel`);
}

export async function deleteBacktest(runId: string) {
  return api.delete<{ ok: boolean }>(`/backtest/runs/${runId}`);
}

export async function compareBacktests(runIds: string[]) {
  return api.get(`/backtest/compare?run_ids=${runIds.join(",")}`);
}

export async function optimizeBacktest(config: Record<string, unknown>) {
  return api.post("/backtest/optimize", config);
}

export async function walkForward(config: Record<string, unknown>) {
  return api.post("/backtest/walk-forward", config);
}
