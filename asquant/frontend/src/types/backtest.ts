export interface BacktestConfig {
  name: string;
  start_date: string;
  end_date: string;
  factor_names: string[];
  factor_weights?: number[];
  top_n: number;
  rebalance_freq: "monthly" | "weekly";
  weighting: "equal" | "risk_parity" | "mean_variance";
  position_sizing?: "equal" | "risk_parity" | "kelly" | "volatility_parity" | "market_cap";
  transaction_cost: number;
  slippage: number;
  benchmark: string;
  initial_capital: number;
  max_drawdown_limit?: number;
  daily_loss_limit?: number;
  volatility_target?: number;
  min_daily_amount?: number;
  mode?: "daily" | "intraday";
  // Intraday strategy params (mode=intraday)
  strategy?: "intraday_momentum" | "mean_reversion" | "breakout";
  freq?: string;
  lookback?: number;
  hold_period?: number;
  stop_loss?: number;
  take_profit?: number;
  max_positions?: number;
  position_size?: number;
  force_close_eod?: boolean;
}

export interface BacktestRun {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  status: "pending" | "running" | "done" | "error";
  started_at: string;
}

export interface BacktestDetail {
  id: string;
  name: string;
  config: BacktestConfig;
  status: string;
  started_at: string;
  completed_at: string;
  error_message: string;
  summary: BacktestSummary | null;
}

export interface BacktestSummary {
  total_return: number;
  annual_return: number;
  volatility: number;
  max_drawdown: number;
  max_drawdown_duration: number;
  sharpe: number;
  calmar: number;
  sortino: number;
  alpha: number;
  beta: number;
  r_squared: number;
  information_ratio: number;
  var_95: number;
  cvar_95: number;
  treynor: number;
  win_rate: number;
  profit_factor: number;
  avg_win_loss: number;
  skewness: number;
  kurtosis: number;
  tracking_error: number;
  monthly_returns: { month: number; return: number }[];
}

export interface BacktestDaily {
  date: string;
  portfolio_value: number;
  benchmark_value: number;
  cash: number;
  daily_return: number;
  benchmark_return: number;
  turnover: number;
}

export interface BacktestTrade {
  trade_date: string;
  stock_code: string;
  direction: "buy" | "sell";
  shares: number;
  price: number;
  amount: number;
  cost: number;
  slippage: number;
}

export interface BacktestPosition {
  trade_date: string;
  positions: Record<string, number>;
  weights: Record<string, number>;
  sector_weights: Record<string, number>;
  cumulative_pnl: Record<string, number>;
}

export interface TurnoverAnalysis {
  avg_turnover: number;
  max_turnover: number;
  trade_count: number;
  turnover_series: { date: string; turnover: number }[];
}

export interface BarraAttribution {
  factor_contributions: { factor: string; contribution: number }[];
  specific_return: number;
  r_squared: number;
  total_explained: number;
  total_return: number;
  factor_names: string[];
}

export interface SectorAttribution {
  sector: string;
  portfolio_weight: number;
  benchmark_weight: number;
  portfolio_return: number;
  benchmark_return: number;
  allocation_effect: number;
  selection_effect: number;
  interaction_effect: number;
  total_effect: number;
}

export interface FactorAttribution {
  factor: string;
  beta: number;
  contribution: number;
}

export interface AttributionResult {
  sector_attribution: SectorAttribution[];
  factor_attribution: FactorAttribution[];
  daily_attribution?: { date: string; allocation: number; selection: number; interaction: number; excess: number }[];
  summary?: { total_allocation: number; total_selection: number; total_interaction: number; total_excess: number };
  alpha_annual: number;
  beta: number;
  r_squared: number;
  idiosyncratic_vol: number;
  annual_return?: number;
  annual_benchmark?: number;
}

export interface PaperTradeRun {
  id: string;
  name: string;
  status: "active" | "paused" | "closed";
  started_at: string | null;
  initial_capital: number;
  current_value: number;
  total_return: number;
}

export interface PaperSignal {
  date: string;
  signals: PaperStockSignal[];
  n_selected: number;
  n_candidates: number;
  error?: string;
}

export interface PaperStockSignal {
  stock_code: string;
  target_weight: number;
  factor_score: number;
  close: number;
}

export interface PaperOrderRecord {
  id: number;
  trade_date: string;
  stock_code: string;
  direction: "buy" | "sell";
  signal_price: number;
  order_shares: number;
  fill_price: number;
  fill_shares: number;
  status: string;
  created_at: string;
}

export interface PaperPosition {
  stock_code: string;
  shares: number;
  avg_cost: number;
  market_value: number;
  weight: number;
  unrealized_pnl: number;
}

export interface PaperPositionsResponse {
  positions: PaperPosition[];
  total_value: number;
  cash: number;
}
