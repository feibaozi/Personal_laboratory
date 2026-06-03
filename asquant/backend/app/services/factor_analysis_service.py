import numpy as np
import pandas as pd
from datetime import date, timedelta
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from ..models.market import DailyQuote
from ..models.factor import FactorDefinition, FactorBacktestResult
from ..engine.factor_computer import FactorComputer


class FactorAnalyzer:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.computer = FactorComputer(db)

    async def compute_ic_analysis(
        self,
        factor_name: str,
        stock_codes: list[str],
        start_date: date,
        end_date: date,
        period: str = "monthly",
        ic_type: str = "rank",
    ) -> dict:
        step = 21 if period == "monthly" else 5

        date_result = await self.db.execute(
            select(DailyQuote.trade_date).distinct()
            .where(DailyQuote.trade_date >= start_date)
            .where(DailyQuote.trade_date <= end_date)
            .order_by(DailyQuote.trade_date)
        )
        all_dates = [r[0] for r in date_result.all()]
        dates = all_dates[::step]
        if not dates:
            return {"error": "No trading dates in range", "ic_series": []}

        ic_list = []
        forward_returns_cache = {}

        for i, d in enumerate(dates):
            factor_vals = await self.computer.compute_one(factor_name, stock_codes, d)
            if not factor_vals:
                continue

            codes = list(factor_vals.keys())
            if len(codes) < 3:
                continue

            next_date = dates[i + 1] if i + 1 < len(dates) else self._next_trading_date(d, all_dates)
            if next_date is None:
                continue

            cache_key = (d, next_date)
            if cache_key not in forward_returns_cache:
                fwd = await self._forward_returns(codes, d, next_date)
                forward_returns_cache[cache_key] = fwd
            else:
                fwd = forward_returns_cache[cache_key]

            if not fwd:
                continue

            f_vals = np.array([factor_vals.get(c, np.nan) for c in fwd.keys()])
            f_ret = np.array(list(fwd.values()))

            mask = ~np.isnan(f_vals) & ~np.isnan(f_ret)
            if mask.sum() < 3:
                continue

            f_vals_clean = f_vals[mask]
            f_ret_clean = f_ret[mask]

            if ic_type == "rank":
                r1 = pd.Series(f_vals_clean).rank()
                r2 = pd.Series(f_ret_clean).rank()
                ic_val = float(r1.corr(r2))
            else:
                ic_val = float(np.corrcoef(f_vals_clean, f_ret_clean)[0, 1]) if len(f_vals_clean) >= 3 else 0

            if np.isnan(ic_val) or np.isinf(ic_val):
                ic_val = 0.0
            ic_list.append({"date": d.isoformat(), "ic": round(ic_val, 6)})

        if not ic_list:
            return {"ic_mean": 0, "ic_std": 0, "icir": 0, "ic_win_rate": 0, "ic_t_stat": 0, "ic_series": []}

        ic_arr = np.array([x["ic"] for x in ic_list])
        ic_mean = float(np.mean(ic_arr))
        ic_std = float(np.std(ic_arr, ddof=1))
        icir = ic_mean / ic_std if ic_std > 0 else 0
        ic_win_rate = float(np.mean(ic_arr > 0))
        ic_t_stat = float(ic_mean / (ic_std / np.sqrt(len(ic_arr)))) if ic_std > 0 and len(ic_arr) > 1 else 0

        return {
            "factor_name": factor_name,
            "period": period,
            "ic_type": ic_type,
            "ic_mean": round(ic_mean, 6),
            "ic_std": round(ic_std, 6),
            "icir": round(icir, 4),
            "ic_win_rate": round(ic_win_rate, 4),
            "ic_t_stat": round(ic_t_stat, 4),
            "n_periods": len(ic_list),
            "ic_series": ic_list,
        }

    async def compute_decile_backtest(
        self,
        factor_name: str,
        stock_codes: list[str],
        start_date: date,
        end_date: date,
        period: str = "monthly",
        n_groups: int = 10,
    ) -> dict:
        step = 21 if period == "monthly" else 5

        date_result = await self.db.execute(
            select(DailyQuote.trade_date).distinct()
            .where(DailyQuote.trade_date >= start_date)
            .where(DailyQuote.trade_date <= end_date)
            .order_by(DailyQuote.trade_date)
        )
        all_dates = [r[0] for r in date_result.all()]
        dates = all_dates[::step]
        if not dates:
            return {"error": "No trading dates", "groups": []}

        group_cum_returns = {i: 0.0 for i in range(n_groups)}
        group_daily_returns: dict[int, list[float]] = {i: [] for i in range(n_groups)}
        long_short_returns: list[float] = []

        for i, d in enumerate(dates):
            factor_vals = await self.computer.compute_one(factor_name, stock_codes, d)
            if not factor_vals:
                continue
            codes = list(factor_vals.keys())
            if len(codes) < n_groups:
                continue

            next_date = dates[i + 1] if i + 1 < len(dates) else self._next_trading_date(d, all_dates)
            if next_date is None:
                continue

            fwd = await self._forward_returns(codes, d, next_date)
            if not fwd:
                continue

            sorted_items = sorted(
                [(c, factor_vals.get(c, 0)) for c in codes if c in fwd],
                key=lambda x: x[1],
            )
            if len(sorted_items) < n_groups:
                continue

            groups = np.array_split(sorted_items, n_groups)

            for gi, group in enumerate(groups):
                group_codes = [item[0] for item in group]
                rets = [fwd.get(c, 0) for c in group_codes]
                avg_ret = float(np.mean(rets)) if rets else 0
                group_daily_returns[gi].append(avg_ret)

            if len(groups[0]) > 0 and len(groups[-1]) > 0:
                top_codes = [item[0] for item in groups[-1]]
                bot_codes = [item[0] for item in groups[0]]
                top_ret = np.mean([fwd.get(c, 0) for c in top_codes]) if top_codes else 0
                bot_ret = np.mean([fwd.get(c, 0) for c in bot_codes]) if bot_codes else 0
                long_short_returns.append(float(top_ret - bot_ret))

        group_stats = []
        for gi in range(n_groups):
            rets = group_daily_returns.get(gi, [])
            if not rets:
                group_stats.append({
                    "group": gi + 1,
                    "avg_return": 0,
                    "cum_return": 0,
                    "volatility": 0,
                    "sharpe": 0,
                    "n_signals": 0,
                })
                continue

            rets_arr = np.array(rets)
            avg_ret = float(np.mean(rets_arr))
            cum_ret = float(np.prod(1 + rets_arr) - 1) if len(rets_arr) > 0 else 0
            vol = float(np.std(rets_arr, ddof=1)) if len(rets_arr) > 1 else 0
            ann_ret = (1 + cum_ret) ** (21 / max(len(rets_arr), 1)) - 1
            ann_vol = vol * np.sqrt(21) if len(rets_arr) > 1 else 0
            sharpe = (ann_ret - 0.02) / ann_vol if ann_vol > 0 else 0

            group_stats.append({
                "group": gi + 1,
                "avg_return": round(avg_ret, 6),
                "cum_return": round(cum_ret, 6),
                "volatility": round(vol, 6),
                "sharpe": round(sharpe, 4),
                "n_signals": len(rets),
            })

        ls_arr = np.array(long_short_returns)
        ls_cum = float(np.prod(1 + ls_arr) - 1) if len(ls_arr) > 0 else 0
        ls_vol = float(np.std(ls_arr, ddof=1)) * np.sqrt(21) if len(ls_arr) > 1 else 0

        return {
            "factor_name": factor_name,
            "n_groups": n_groups,
            "period": period,
            "groups": group_stats,
            "long_short": {
                "cum_return": round(ls_cum, 6),
                "volatility": round(ls_vol, 6),
                "sharpe": round((((1 + ls_cum) ** (21 / max(len(ls_arr), 1)) - 1) - 0.02) / ls_vol, 4) if ls_vol > 0 else 0,
                "n_signals": len(ls_arr),
            },
        }

    async def compute_factor_stats(
        self, factor_name: str, stock_codes: list[str], target_date: date
    ) -> dict:
        vals = await self.computer.compute_one(factor_name, stock_codes, target_date)
        if not vals:
            return {"coverage": 0, "n_stocks": 0}

        valid = {k: v for k, v in vals.items() if not np.isnan(v) and not np.isinf(v)}
        if not valid:
            return {"coverage": 0, "n_stocks": 0}

        v_list = list(valid.values())
        mean_val = float(np.mean(v_list))
        std_val = float(np.std(v_list, ddof=1)) if len(v_list) > 1 else 0.0
        min_val = float(np.min(v_list))
        max_val = float(np.max(v_list))

        def safe_round(v, d):
            if np.isnan(v) or np.isinf(v):
                return 0
            return round(v, d)

        return {
            "coverage": round(len(valid) / max(len(stock_codes), 1), 4),
            "n_stocks": len(valid),
            "mean": safe_round(mean_val, 6),
            "std": safe_round(std_val, 6),
            "min": safe_round(min_val, 6),
            "max": safe_round(max_val, 6),
        }

    async def compute_correlation_matrix(
        self, factor_names: list[str], stock_codes: list[str], target_date: date
    ) -> dict:
        factor_data: dict[str, dict[str, float]] = {}
        for fname in factor_names:
            vals = await self.computer.compute_one(fname, stock_codes, target_date)
            if vals:
                factor_data[fname] = vals

        if len(factor_data) < 2:
            return {"factor_names": list(factor_data.keys()), "matrix": []}

        common_codes = None
        for vals in factor_data.values():
            if common_codes is None:
                common_codes = set(vals.keys())
            else:
                common_codes &= set(vals.keys())

        if not common_codes or len(common_codes) < 2:
            return {"factor_names": list(factor_data.keys()), "matrix": []}

        n = len(factor_data)
        names = list(factor_data.keys())
        matrix = [[0.0] * n for _ in range(n)]
        for i in range(n):
            for j in range(n):
                if i == j:
                    matrix[i][j] = 1.0
                    continue
                a = np.array([factor_data[names[i]].get(c, np.nan) for c in common_codes])
                b = np.array([factor_data[names[j]].get(c, np.nan) for c in common_codes])
                mask = ~np.isnan(a) & ~np.isnan(b)
                if mask.sum() >= 2:
                    c = float(np.corrcoef(a[mask], b[mask])[0, 1])
                    matrix[i][j] = round(c, 4) if not np.isnan(c) and not np.isinf(c) else 0.0
                else:
                    matrix[i][j] = 0.0

        return {"factor_names": names, "matrix": matrix}

    def _next_trading_date(self, current: date, all_dates: list[date]) -> date | None:
        for d in all_dates:
            if d > current:
                return d
        return None

    async def batch_ic_analysis(
        self,
        stock_codes: list[str],
        start_date: date,
        end_date: date,
        period: str = "monthly",
        ic_type: str = "rank",
        categories: list[str] | None = None,
    ) -> list[dict]:
        from ..engine.factor_computer import _get_builtin_registry
        registry = _get_builtin_registry()
        factor_names = registry.names()
        if categories:
            factor_names = [n for n in factor_names if registry.get(n) and registry.get(n).category in categories]

        results = []
        for fname in factor_names:
            try:
                ic_result = await self.compute_ic_analysis(fname, stock_codes, start_date, end_date, period, ic_type)
                if ic_result.get("ic_series"):
                    results.append({
                        "factor_name": fname,
                        "category": registry.get(fname).category if registry.get(fname) else "unknown",
                        "description": registry.get(fname).description if registry.get(fname) else "",
                        "ic_mean": ic_result.get("ic_mean", 0),
                        "ic_std": ic_result.get("ic_std", 0),
                        "icir": ic_result.get("icir", 0),
                        "ic_win_rate": ic_result.get("ic_win_rate", 0),
                        "ic_t_stat": ic_result.get("ic_t_stat", 0),
                        "n_periods": ic_result.get("n_periods", 0),
                    })
            except Exception:
                continue

        results.sort(key=lambda x: abs(x.get("icir", 0)), reverse=True)
        return results

    async def batch_decile_backtest(
        self,
        stock_codes: list[str],
        start_date: date,
        end_date: date,
        period: str = "monthly",
        categories: list[str] | None = None,
    ) -> list[dict]:
        from ..engine.factor_computer import _get_builtin_registry
        registry = _get_builtin_registry()
        factor_names = registry.names()
        if categories:
            factor_names = [n for n in factor_names if registry.get(n) and registry.get(n).category in categories]

        results = []
        for fname in factor_names:
            try:
                dec_result = await self.compute_decile_backtest(fname, stock_codes, start_date, end_date, period)
                ls = dec_result.get("long_short", {})
                groups = dec_result.get("groups", [])
                monotonic = True
                if len(groups) >= 3:
                    mid = len(groups) // 2
                    top_avg = groups[-1].get("avg_return", 0)
                    bot_avg = groups[0].get("avg_return", 0)
                    mid_avg = groups[mid].get("avg_return", 0)
                    if not (top_avg >= mid_avg >= bot_avg or top_avg <= mid_avg <= bot_avg):
                        monotonic = False

                results.append({
                    "factor_name": fname,
                    "category": registry.get(fname).category if registry.get(fname) else "unknown",
                    "long_short_cum_return": ls.get("cum_return", 0),
                    "long_short_sharpe": ls.get("sharpe", 0),
                    "long_short_volatility": ls.get("volatility", 0),
                    "monotonic": monotonic,
                    "top_group_avg": groups[-1].get("avg_return", 0) if groups else 0,
                    "bottom_group_avg": groups[0].get("avg_return", 0) if groups else 0,
                })
            except Exception:
                continue

        results.sort(key=lambda x: abs(x.get("long_short_sharpe", 0)), reverse=True)
        return results

    async def find_redundant_factors(
        self,
        stock_codes: list[str],
        target_date: date,
        threshold: float = 0.8,
        categories: list[str] | None = None,
    ) -> list[dict]:
        from ..engine.factor_computer import _get_builtin_registry
        registry = _get_builtin_registry()
        factor_names = registry.names()
        if categories:
            factor_names = [n for n in factor_names if registry.get(n) and registry.get(n).category in categories]

        corr_result = await self.compute_correlation_matrix(factor_names, stock_codes, target_date)
        names = corr_result.get("factor_names", [])
        matrix = corr_result.get("matrix", [])

        redundant = []
        for i in range(len(names)):
            for j in range(i + 1, len(names)):
                if i < len(matrix) and j < len(matrix[i]):
                    corr_val = abs(matrix[i][j])
                    if corr_val >= threshold:
                        redundant.append({
                            "factor_a": names[i],
                            "factor_b": names[j],
                            "correlation": round(matrix[i][j], 4),
                            "abs_correlation": round(corr_val, 4),
                        })

        redundant.sort(key=lambda x: x["abs_correlation"], reverse=True)
        return redundant

    async def _forward_returns(self, codes: list[str], d: date, next_d: date) -> dict[str, float]:
        result = await self.db.execute(
            select(DailyQuote.stock_code, DailyQuote.trade_date, DailyQuote.close)
            .where(DailyQuote.stock_code.in_(codes[:500]))
            .where(DailyQuote.trade_date.in_([d, next_d]))
        )
        rows = result.all()
        prices_at_d = {}
        prices_at_next = {}
        for row in rows:
            code = row[0]
            trade_date = row[1]
            close = row[2]
            if trade_date == d:
                prices_at_d[code] = close
            elif trade_date == next_d:
                prices_at_next[code] = close

        rets = {}
        for code in codes:
            p0 = prices_at_d.get(code)
            p1 = prices_at_next.get(code)
            if p0 and p1 and p0 > 0:
                rets[code] = (p1 / p0) - 1
        return rets