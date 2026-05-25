import { api, queryString } from "./client";
import type { IndexData, SectorData, BreadthData, NorthBoundData, StockInfo, WatchlistItem, QuoteData, StockProfile } from "@/types/market";

export async function fetchIndicesLatest(): Promise<IndexData[]> {
  const res = await api.get<{ indices: IndexData[] }>("/market/indices/latest");
  return res.indices;
}

export async function fetchIndexHistory(code: string, start: string, end: string) {
  return api.get<{ code: string; data: unknown[] }>(
    `/market/indices/${code}/history${queryString({ start_date: start, end_date: end })}`
  );
}

export async function fetchStocks(page: number, search?: string) {
  return api.get<{ items: StockInfo[]; total: number }>(
    `/market/stocks${queryString({ page, page_size: 50, search })}`
  );
}

export async function fetchStockQuotes(code: string, start: string, end: string, freq = "d", source = "all") {
  return api.get<{ code: string; data: QuoteData[]; freq: string }>(
    `/market/stocks/${code}/quotes${queryString({ start_date: start, end_date: end, freq, source })}`
  );
}

export async function fetchStockProfile(code: string): Promise<StockProfile> {
  return api.get(`/market/stocks/${code}/profile`);
}

export async function fetchSectorHeatmap() {
  const res = await api.get<{ sectors: SectorData[] }>("/market/sectors/heatmap");
  return res.sectors;
}

export async function fetchNorthBound(start: string, end: string) {
  const res = await api.get<{ data: NorthBoundData[] }>(
    `/market/north-bound${queryString({ start_date: start, end_date: end })}`
  );
  return res.data;
}

export async function fetchMarketBreadth(start: string, end: string) {
  const res = await api.get<{ data: BreadthData[] }>(
    `/market/breadth${queryString({ start_date: start, end_date: end })}`
  );
  return res.data;
}

export async function fetchWatchlist() {
  const res = await api.get<{ items: WatchlistItem[] }>("/market/watchlist");
  return res.items;
}

export async function addWatchlist(code: string, notes?: string, alertUpper?: number, alertLower?: number) {
  return api.post<{ id: number }>(
    `/market/watchlist${queryString({ stock_code: code, notes, alert_price_upper: alertUpper, alert_price_lower: alertLower })}`
  );
}

export async function deleteWatchlist(id: number) {
  return api.delete("/market/watchlist/" + id);
}

export async function fetchPositions(code: string) {
  return api.get<{ positions: { id: number; stock_code: string; shares: number; avg_cost: number; open_date: string | null; close_date: string | null; close_price: number | null; notes: string }[] }>(`/market/positions/${code}`);
}

export async function addPosition(code: string, shares: number, avgCost: number, openDate: string, notes?: string) {
  return api.post("/market/positions", { stock_code: code, shares, avg_cost: avgCost, open_date: openDate, notes: notes || "" });
}

export async function closePosition(id: number, closeDate: string, closePrice: number) {
  return api.put(`/market/positions/${id}/close`, { close_date: closeDate, close_price: closePrice });
}

export async function deletePosition(id: number) {
  return api.delete("/market/positions/" + id);
}
