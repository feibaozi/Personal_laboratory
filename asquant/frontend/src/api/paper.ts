import { api } from "./client";
import type { PaperTradeRun, PaperSignal, PaperOrderRecord, PaperPositionsResponse } from "@/types/backtest";

export async function createPaperRun(config: Record<string, unknown>) {
  return api.post<{ run_id: string; status: string }>("/paper/runs", config);
}

export async function fetchPaperRuns() {
  return api.get<{ runs: PaperTradeRun[] }>("/paper/runs");
}

export async function fetchPaperRun(runId: string) {
  return api.get<PaperTradeRun & { config: Record<string, unknown>; current_cash: number }>(`/paper/runs/${runId}`);
}

export async function generatePaperSignal(runId: string, targetDate?: string): Promise<PaperSignal> {
  const params = targetDate ? `?target_date=${targetDate}` : "";
  return api.post(`/paper/runs/${runId}/generate-signal${params}`);
}

export async function executeRebalance(runId: string, targetDate?: string) {
  const params = targetDate ? `?target_date=${targetDate}` : "";
  return api.post(`/paper/runs/${runId}/execute${params}`);
}

export async function fetchPaperPositions(runId: string): Promise<PaperPositionsResponse> {
  return api.get(`/paper/runs/${runId}/positions`);
}

export async function fetchPaperOrders(runId: string, page = 1) {
  return api.get<{ orders: PaperOrderRecord[] }>(`/paper/runs/${runId}/orders?page=${page}`);
}

export async function fetchPaperEquity(runId: string) {
  return api.get<{ equity: { date: string; total_value: number; cash: number; daily_return: number }[] }>(`/paper/runs/${runId}/equity`);
}

export async function updatePaperRun(runId: string, body: { status?: string }) {
  return api.put(`/paper/runs/${runId}`, body);
}

export async function deletePaperRun(runId: string) {
  return api.delete<{ ok: boolean }>(`/paper/runs/${runId}`);
}
