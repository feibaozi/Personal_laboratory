export interface IndexData {
  code: string;
  name: string;
  close: number;
  change_pct: number;
  volume: number;
  amount: number;
  trade_date: string;
}

export interface SectorData {
  code: string;
  name: string;
  change_pct: number;
  leading_stock_code: string;
  leading_stock_name: string;
}

export interface BreadthData {
  date: string;
  up_count: number;
  down_count: number;
  flat_count: number;
  limit_up: number;
  limit_down: number;
}

export interface NorthBoundData {
  date: string;
  net_flow_total: number;
}

export interface StockInfo {
  code: string;
  name: string;
  exchange: string;
  industry: string;
  area: string;
  list_date: string;
  is_st: boolean;
}

export interface WatchlistItem {
  id: number;
  stock_code: string;
  notes: string;
  alert_price_upper: number | null;
  alert_price_lower: number | null;
  added_at: string;
}

export interface QuoteData {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  pre_close?: number;
  volume: number;
  amount: number;
  change_pct: number;
  turnover_rate: number;
  pe_ratio?: number;
  pb_ratio?: number;
}

export interface StockProfile {
  code: string;
  name: string;
  industry: string;
  exchange: string;
  area: string;
  list_date: string;
  latest_price: number;
  change_pct: number;
  pe_ratio: number;
  pb_ratio: number;
  volume: number;
  amount: number;
  turnover_rate: number;
  trade_date: string;
}
