import { api, queryString } from "./client";
import type { FactorDef, ICResult } from "@/types/factor";

export async function fetchFactorLibrary(): Promise<FactorDef[]> {
  const res = await api.get<{ factors: FactorDef[] }>("/factor/library");
  return res.factors;
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
