import { api, queryString } from "./client";
import type { FactorDef, ICResult, ICAnalysis, DecileAnalysis } from "@/types/factor";

export async function fetchLatestTradeDate(): Promise<string | null> {
  const res = await api.get<{ date: string | null }>("/factor/latest-date");
  return res.date;
}

export async function fetchFactorLibrary(): Promise<FactorDef[]> {
  const res = await api.get<{ factors: FactorDef[] }>("/factor/library");
  return res.factors;
}

export async function runICAnalysis(
  factorName: string, startDate: string, endDate: string, period = "monthly", icType = "rank"
): Promise<ICAnalysis> {
  return api.post("/factor/ic-analysis", {
    factor_name: factorName, start_date: startDate, end_date: endDate, period, ic_type: icType,
  });
}

export async function runDecileAnalysis(
  factorName: string, startDate: string, endDate: string, period = "monthly", nGroups = 10
): Promise<DecileAnalysis> {
  return api.post("/factor/decile-analysis", {
    factor_name: factorName, start_date: startDate, end_date: endDate, period, n_groups: nGroups,
  });
}

export async function computeFactor(factorName: string, startDate: string, endDate: string) {
  return api.post(`/factor/compute${queryString({ factor_name: factorName, start_date: startDate, end_date: endDate })}`);
}

export async function computeFactorIC(
  factorName: string, startDate: string, endDate: string, period = "monthly"
): Promise<ICResult> {
  return api.post(`/factor/backtest/ic${queryString({
    factor_name: factorName, start_date: startDate, end_date: endDate, period,
  })}`);
}

export async function screenStocks(conditions: unknown[], date: string, topN = 50) {
  return api.post<{ results: { code: string; name: string; composite_score: number }[]; total: number }>(
    "/factor/screen", { conditions, date, top_n: topN }
  );
}

export async function computeFactorCorrelation(factorNames: string[], dateStr: string) {
  return api.post<{ correlation_matrix: number[][]; factor_names: string[] }>(
    "/factor/correlation",
    { factor_names: factorNames, date_str: dateStr },
  );
}

export async function fetchFactorCorrelationMatrix(factorNames: string[], date: string) {
  return api.post<{ factor_names: string[]; matrix: number[][] }>(
    "/factor/correlation-matrix",
    { factor_names: factorNames, date },
  );
}

export async function fetchFactorCategories() {
  return api.get<{ categories: { category: string; count: number; factors: { name: string; description: string }[] }[] }>(
    "/factor/categories",
  );
}

export interface BatchICResult {
  factor_name: string;
  category: string;
  description: string;
  ic_mean: number;
  ic_std: number;
  icir: number;
  ic_win_rate: number;
  ic_t_stat: number;
  n_periods: number;
}

export async function runBatchICAnalysis(
  startDate: string, endDate: string, period = "monthly", icType = "rank", categories?: string[]
): Promise<BatchICResult[]> {
  const res = await api.post<{ results: BatchICResult[]; total: number }>(
    "/factor/batch-ic",
    { start_date: startDate, end_date: endDate, period, ic_type: icType, categories },
  );
  return res.results;
}

export async function findRedundantFactors(
  dateStr: string, threshold = 0.8, categories?: string[]
) {
  return api.post<{ redundant: { factor_a: string; factor_b: string; correlation: number; abs_correlation: number }[]; total: number }>(
    "/factor/redundant-factors",
    { date: dateStr, threshold, categories },
  );
}