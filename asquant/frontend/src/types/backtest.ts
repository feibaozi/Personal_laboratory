export interface BacktestConfig {
  name: string;
  start_date: string;
  end_date: string;
  factor_names: string[];
  factor_weights?: number[];
  top_n: number;
  rebalance_freq: "monthly" | "weekly";
  weighting: "equal" | "risk_parity" | "mean_variance";
  transaction_cost: number;
  slippage: number;
  benchmark: string;
  initial_capital: number;
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
