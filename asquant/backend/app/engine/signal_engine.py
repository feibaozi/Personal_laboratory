import numpy as np
import pandas as pd
from datetime import date, timedelta
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from ..models.market import DailyQuote, Stock
from .factor_computer import FactorComputer
from .constraints import get_limit_constraints, apply_liquidity_filter
from .portfolio_constructor import risk_parity_weights


class SignalEngine:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def generate(self, config: dict, target_date: date) -> dict:
        factor_names = config.get("factor_names", ["return_1m"])
        factor_weights = config.get("factor_weights")
        top_n = config.get("top_n", 20)
        weighting = config.get("weighting", "equal")
        min_daily_amount = config.get("min_daily_amount", 5_000_000)

        if not factor_weights:
            factor_weights = [1.0 / len(factor_names)] * len(factor_names)

        active_codes = await self._get_active_codes(target_date)
        if not active_codes:
            return {"date": target_date.isoformat(), "signals": [], "error": "No active stocks"}

        computer = FactorComputer(self.db)
        quote_df = await self._load_quotes(list(active_codes), target_date)

        composite = {}
        for fn, fw in zip(factor_names, factor_weights):
            vals = await computer.compute_one(fn, list(active_codes), target_date)
            if not vals:
                continue
            vals_list = [v for v in vals.values()]
            mean_v = sum(vals_list) / len(vals_list) if vals_list else 0
            std_v = (sum((v - mean_v) ** 2 for v in vals_list) / len(vals_list)) ** 0.5 or 1
            for code, v in vals.items():
                z = (v - mean_v) / std_v
                composite[code] = composite.get(code, 0) + z * fw

        sorted_codes = sorted(composite.keys(), key=lambda c: composite[c], reverse=True)
        selected = sorted_codes[:top_n]

        limit_map = get_limit_constraints(quote_df, selected) if not quote_df.empty else {}
        selected = apply_liquidity_filter(selected, quote_df, limit_map, min_daily_amount)

        if not selected:
            return {"date": target_date.isoformat(), "signals": [], "error": "No stocks pass filters"}

        n = len(selected)
        if weighting == "equal":
            weights = np.ones(n) / n
        elif weighting == "risk_parity":
            ret_df = await self._load_return_df(selected, target_date, 60)
            if ret_df is not None and len(ret_df) >= 20:
                weights = risk_parity_weights(ret_df)
            else:
                weights = np.ones(n) / n
        else:
            weights = np.ones(n) / n

        signals = []
        for code, w in zip(selected, weights):
            close_px = limit_map.get(code, {}).get("close", 0)
            signals.append({
                "stock_code": code,
                "target_weight": round(float(w), 6),
                "factor_score": round(composite.get(code, 0), 4),
                "close": close_px,
            })

        return {
            "date": target_date.isoformat(),
            "signals": signals,
            "n_selected": len(signals),
            "n_candidates": len(sorted_codes),
        }

    async def _get_active_codes(self, target_date: date) -> list[str]:
        result = await self.db.execute(
            select(Stock.code)
            .where(Stock.list_date <= target_date)
            .where((Stock.out_date.is_(None)) | (Stock.out_date > target_date))
        )
        codes = [r[0] for r in result.all()]
        if not codes:
            dq_result = await self.db.execute(select(DailyQuote.stock_code).distinct())
            codes = [r[0] for r in dq_result.all()]
        return codes

    async def _load_quotes(self, codes: list[str], target_date: date):
        # Process in batches of 500 to avoid SQLite parameter limit
        all_rows = []
        for i in range(0, len(codes), 500):
            batch = codes[i:i + 500]
            result = await self.db.execute(
                select(DailyQuote)
                .where(DailyQuote.stock_code.in_(batch))
                .where(DailyQuote.trade_date == target_date)
            )
            all_rows.extend(result.scalars().all())
        if not all_rows:
            return pd.DataFrame()
        return pd.DataFrame([{
            "code": r.stock_code, "close": r.close, "volume": r.volume,
            "pre_close": r.pre_close, "open": r.open, "high": r.high,
            "low": r.low, "amount": r.amount,
        } for r in all_rows])

    async def _load_return_df(self, codes: list[str], end_date: date, window: int) -> pd.DataFrame | None:
        """Load return DataFrame for risk parity weight calculation."""
        start = end_date - timedelta(days=window * 2)
        result = await self.db.execute(
            select(DailyQuote.stock_code, DailyQuote.trade_date, DailyQuote.close)
            .where(DailyQuote.stock_code.in_(codes))
            .where(DailyQuote.trade_date >= start)
            .where(DailyQuote.trade_date <= end_date)
            .order_by(DailyQuote.trade_date, DailyQuote.stock_code)
        )
        rows = result.all()
        if not rows:
            return None
        df = pd.DataFrame(rows, columns=["code", "date", "close"])
        pivot = df.pivot(index="date", columns="code", values="close").sort_index()
        pivot = pivot.iloc[-window:]
        returns = pivot.pct_change().dropna()
        if len(returns) < 10:
            return None
        return returns
