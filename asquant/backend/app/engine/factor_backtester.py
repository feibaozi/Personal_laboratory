"""Factor backtester: IC analysis, quantile returns, turnover."""
import numpy as np
import pandas as pd
from scipy import stats
from datetime import date, timedelta
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from ..models.market import DailyQuote
from ..models.factor import FactorValue, FactorDefinition
from .factor_computer import FactorComputer


class FactorBacktester:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def run_ic_analysis(
        self,
        factor_name: str,
        stock_codes: list[str],
        start_date: date,
        end_date: date,
        period: str = "monthly",
        n_quantiles: int = 5,
    ) -> dict:
        computer = FactorComputer(self.db)

        step = {"daily": 1, "weekly": 5, "monthly": 21}[period]
        dates = await self._trading_days(start_date, end_date, step)

        ic_pearson_list = []
        ic_spearman_list = []
        quantile_returns: dict[int, list[float]] = {i: [] for i in range(n_quantiles)}
        turnover_list = []
        prev_top = set()

        prices_cache = {}
        for i, d in enumerate(dates):
            fwd_date = await self._next_trading_day(d, step)
            if fwd_date is None:
                continue

            factor_vals = await computer.compute_one(factor_name, stock_codes, d)
            if len(factor_vals) < 5:
                continue

            fwd_returns = await self._forward_returns(stock_codes, d, fwd_date)
            aligned = self._align(factor_vals, fwd_returns)
            if len(aligned) < 5:
                continue

            fv = np.array([x[0] for x in aligned])
            fr = np.array([x[1] for x in aligned])

            invalid = np.isnan(fv) | np.isinf(fv) | np.isnan(fr) | np.isinf(fr)
            fv = fv[~invalid]
            fr = fr[~invalid]
            if len(fv) < 5:
                continue

            # IC
            if np.std(fv) > 0 and np.std(fr) > 0:
                ic_p, _ = stats.pearsonr(fv, fr)
                ic_s, _ = stats.spearmanr(fv, fr)
                ic_pearson_list.append((d, float(ic_p)))
                ic_spearman_list.append((d, float(ic_s)))

            # Quantile returns
            try:
                labels = pd.qcut(fv, n_quantiles, labels=False, duplicates="drop")
                for q in range(n_quantiles):
                    mask = labels == q
                    if mask.sum() > 0:
                        quantile_returns[q].append(float(fr[mask].mean()))
            except (ValueError, IndexError):
                pass

            # Turnover (top 20% stocks)
            threshold = np.percentile(fv, 80)
            curr_top = {c for c, v in factor_vals.items() if v >= threshold and not np.isnan(v)}
            if prev_top:
                intersection = prev_top & curr_top
                turnover = 1 - len(intersection) / max(len(prev_top), 1)
                turnover_list.append((d, float(turnover)))
            prev_top = curr_top

        ic_series = [{"date": d.isoformat(), "ic_pearson": ic_p, "ic_spearman": ic_s} for d, ic_p, ic_s in
                     [(d, ic_pearson_list[i][1], ic_spearman_list[i][1]) for i, d in enumerate([x[0] for x in ic_pearson_list])]]
        # Fix: rebuild ic_series properly
        ic_series = []
        for i in range(min(len(ic_pearson_list), len(ic_spearman_list))):
            ic_series.append({
                "date": ic_pearson_list[i][0].isoformat(),
                "ic_pearson": ic_pearson_list[i][1],
                "ic_spearman": ic_spearman_list[i][1],
            })

        ic_vals = [x[1] for x in ic_pearson_list]
        ic_summary = {}
        if ic_vals:
            ic_mean = float(np.mean(ic_vals))
            ic_std = float(np.std(ic_vals, ddof=1))
            ic_summary = {
                "ic_mean": ic_mean,
                "ic_std": ic_std,
                "icir": ic_mean / ic_std if ic_std > 0 else 0,
                "ic_win_rate": float(np.mean([1 if v > 0 else 0 for v in ic_vals])),
                "ic_t_stat": float(ic_mean / (ic_std / np.sqrt(len(ic_vals))) if ic_std > 0 else 0),
            }

        quantile_summary = []
        for q in range(n_quantiles):
            if quantile_returns[q]:
                avg = float(np.mean(quantile_returns[q]))
                cum = float(np.prod([1 + r for r in quantile_returns[q]]) - 1)
                quantile_summary.append({"quantile": q + 1, "avg_return": avg, "cumulative_return": cum})

        turnover_series = [{"date": d.isoformat(), "turnover_rate": t} for d, t in turnover_list]

        return {
            "ic_summary": ic_summary,
            "ic_series": ic_series,
            "quantile_returns": quantile_summary,
            "turnover": turnover_series,
        }

    def _align(self, factor_vals: dict[str, float], fwd_returns: dict[str, float]) -> list[tuple[float, float]]:
        common = set(factor_vals.keys()) & set(fwd_returns.keys())
        return [(factor_vals[c], fwd_returns[c]) for c in common]

    async def _forward_returns(self, stock_codes: list[str], from_date: date, to_date: date) -> dict[str, float]:
        q = select(DailyQuote.stock_code, DailyQuote.trade_date, DailyQuote.close).where(
            DailyQuote.stock_code.in_(stock_codes),
            DailyQuote.trade_date.in_([from_date, to_date]),
        )
        result = await self.db.execute(q)
        rows = result.all()
        df = pd.DataFrame(rows, columns=["code", "date", "close"])

        ret = {}
        for code in set(r[0] for r in rows):
            sub = df[df["code"] == code].set_index("date")["close"]
            if from_date in sub.index and to_date in sub.index:
                r = sub[to_date] / sub[from_date] - 1
                if not np.isnan(r):
                    ret[code] = float(r)
        return ret

    async def _trading_days(self, start: date, end: date, step: int) -> list[date]:
        all_dates = []
        result = await self.db.execute(
            select(DailyQuote.trade_date).distinct()
            .where(DailyQuote.trade_date >= start - timedelta(days=365))
            .where(DailyQuote.trade_date <= end + timedelta(days=30))
            .order_by(DailyQuote.trade_date)
        )
        all_dates = [r[0] for r in result.all()]
        if not all_dates:
            return []
        filtered = [d for d in all_dates if start <= d <= end]
        return filtered[::step]

    async def _next_trading_day(self, d: date, step: int) -> date | None:
        result = await self.db.execute(
            select(DailyQuote.trade_date).distinct()
            .where(DailyQuote.trade_date > d)
            .order_by(DailyQuote.trade_date)
            .limit(step)
        )
        dates = [r[0] for r in result.all()]
        return dates[-1] if dates else None
