export interface FactorDef {
  id: number;
  name: string;
  category: string;
  description: string;
  default_params: Record<string, unknown>;
  is_builtin: boolean;
}

export interface FactorValue {
  stock_code: string;
  date: string;
  value: number;
}

export interface ICIter {
  date: string;
  ic: number;
}

export interface ICAnalysis {
  factor_name: string;
  period: string;
  ic_type: string;
  ic_mean: number;
  ic_std: number;
  icir: number;
  ic_win_rate: number;
  ic_t_stat: number;
  n_periods: number;
  ic_series: ICIter[];
}

export interface DecileGroup {
  group: number;
  avg_return: number;
  cum_return: number;
  volatility: number;
  sharpe: number;
  n_signals: number;
}

export interface DecileAnalysis {
  factor_name: string;
  n_groups: number;
  period: string;
  groups: DecileGroup[];
  long_short: {
    cum_return: number;
    volatility: number;
    sharpe: number;
    n_signals: number;
  };
}

export interface ICResult {
  ic_summary: {
    ic_mean: number;
    ic_std: number;
    icir: number;
    ic_win_rate: number;
    ic_t_stat: number;
  };
  ic_series: { date: string; ic_pearson: number; ic_spearman: number }[];
  quantile_returns: { quantile: number; avg_return: number; cumulative_return: number }[];
  turnover: { date: string; turnover_rate: number }[];
}
