import numpy as np
import pandas as pd
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_
from datetime import date, timedelta

from ..models.market import DailyQuote, StockInfo, FinancialReport
from ..models.factor import FactorValue, FactorDefinition
from .technical_factor_computer import TechnicalFactorComputer
from .factor_factory import FactorRegistry, Factor, get_registry

TECH_FACTOR_PREFIXES = {
    "k_", "roc_", "ma_", "std_", "max_", "min_",
    "corr_", "cord_", "sump_", "sumn_", "sumd_",
    "rsv_", "cntp_", "cntd_", "vma_", "vstd_", "wvma_",
    "beta_", "rsqr_", "resi_", "imax_", "imin_", "imxd_",
}


def _build_registry() -> FactorRegistry:
    registry = FactorRegistry()

    registry.register(Factor(
        name="pe_ratio", category="value",
        description="市盈率（倒数）：1/PE，值越大越便宜",
        compute_fn=_compute_pe_ratio,
        required_data=["quote"],
    ))
    registry.register(Factor(
        name="pb_ratio", category="value",
        description="市净率（倒数）：1/PB，值越大越便宜",
        compute_fn=_compute_pb_ratio,
        required_data=["quote"],
    ))
    registry.register(Factor(
        name="ps_ratio", category="value",
        description="市销率（倒数）：1/PS",
        compute_fn=_compute_ps_ratio,
        required_data=["prices", "financials"],
    ))
    registry.register(Factor(
        name="dividend_yield", category="value",
        description="股息率：每股分红/股价",
        compute_fn=_compute_dividend_yield,
        required_data=["prices", "financials"],
    ))
    registry.register(Factor(
        name="ep_ratio", category="value",
        description="盈利收益率：归母净利润/总市值",
        compute_fn=_compute_ep_ratio,
        required_data=["prices", "financials"],
    ))
    registry.register(Factor(
        name="bp_ratio", category="value",
        description="账面市值比：净资产/总市值",
        compute_fn=_compute_bp_ratio,
        required_data=["prices", "financials"],
    ))

    registry.register(Factor(
        name="revenue_growth_yoy", category="growth",
        description="营业收入同比增长率",
        compute_fn=_compute_revenue_growth_yoy,
        required_data=["financials"],
        default_params={"period": "yoy"},
    ))
    registry.register(Factor(
        name="profit_growth_yoy", category="growth",
        description="归母净利润同比增长率",
        compute_fn=_compute_profit_growth_yoy,
        required_data=["financials"],
        default_params={"period": "yoy"},
    ))
    registry.register(Factor(
        name="roe", category="growth",
        description="净资产收益率 ROE",
        compute_fn=_compute_roe,
        required_data=["financials"],
    ))

    registry.register(Factor(
        name="return_1m", category="momentum",
        description="1个月动量（过去21个交易日累计收益）",
        compute_fn=_make_momentum_fn(21),
        required_data=["prices"],
        default_params={"window": 21},
    ))
    registry.register(Factor(
        name="return_3m", category="momentum",
        description="3个月动量（过去63个交易日累计收益）",
        compute_fn=_make_momentum_fn(63),
        required_data=["prices"],
        default_params={"window": 63},
    ))
    registry.register(Factor(
        name="return_6m", category="momentum",
        description="6个月动量（过去126个交易日累计收益）",
        compute_fn=_make_momentum_fn(126),
        required_data=["prices"],
        default_params={"window": 126},
    ))
    registry.register(Factor(
        name="return_12m_1m", category="momentum",
        description="12-1月动量（过去12个月剔除最近1个月收益）",
        compute_fn=_compute_return_12m_1m,
        required_data=["prices"],
    ))

    registry.register(Factor(
        name="gross_margin", category="quality",
        description="毛利率：(营收-成本)/营收",
        compute_fn=_compute_gross_margin,
        required_data=["financials"],
    ))
    registry.register(Factor(
        name="net_margin", category="quality",
        description="净利率：净利润/营收",
        compute_fn=_compute_net_margin,
        required_data=["financials"],
    ))
    registry.register(Factor(
        name="asset_turnover", category="quality",
        description="资产周转率：营收/总资产",
        compute_fn=_compute_asset_turnover,
        required_data=["financials"],
    ))
    registry.register(Factor(
        name="debt_to_equity", category="quality",
        description="资产负债率：总负债/总资产",
        compute_fn=_compute_debt_to_equity,
        required_data=["financials"],
    ))

    registry.register(Factor(
        name="volatility_1m", category="volatility",
        description="1个月波动率（21日日收益率标准差年化）",
        compute_fn=_make_volatility_fn(21),
        required_data=["prices"],
        default_params={"window": 21},
    ))
    registry.register(Factor(
        name="volatility_3m", category="volatility",
        description="3个月波动率（63日日收益率标准差年化）",
        compute_fn=_make_volatility_fn(63),
        required_data=["prices"],
        default_params={"window": 63},
    ))
    registry.register(Factor(
        name="max_drawdown_1y", category="volatility",
        description="1年最大回撤",
        compute_fn=_compute_max_drawdown_1y,
        required_data=["prices"],
        default_params={"window": 252},
    ))

    registry.register(Factor(
        name="log_market_cap", category="size",
        description="对数市值：ln(总市值)，衡量规模效应",
        compute_fn=_compute_log_market_cap,
        required_data=["prices", "financials"],
    ))

    registry.register(Factor(
        name="intraday_momentum", category="microstructure",
        description="日内动能：(close - open) / open",
        compute_fn=_compute_intraday_momentum,
        required_data=["quote"],
    ))
    registry.register(Factor(
        name="intraday_volatility", category="microstructure",
        description="日内振幅：(high - low) / open",
        compute_fn=_compute_intraday_volatility,
        required_data=["quote"],
    ))
    registry.register(Factor(
        name="gap_return", category="microstructure",
        description="跳空收益：(open - prev_close) / prev_close",
        compute_fn=_compute_gap_return,
        required_data=["quote"],
    ))
    registry.register(Factor(
        name="volume_intensity", category="microstructure",
        description="量比：当日成交量/5日平均量",
        compute_fn=_compute_volume_intensity,
        required_data=["prices", "quote"],
    ))
    registry.register(Factor(
        name="am_pm_ratio", category="microstructure",
        description="上下午收益比：下午收益/上午收益",
        compute_fn=_compute_am_pm_ratio,
        required_data=["quote"],
    ))
    registry.register(Factor(
        name="twap_deviation", category="microstructure",
        description="TWAP偏离：(close - TWAP) / TWAP",
        compute_fn=_compute_twap_deviation,
        required_data=["quote"],
    ))

    return registry


_BUILTIN_REGISTRY = None


def _get_builtin_registry() -> FactorRegistry:
    global _BUILTIN_REGISTRY
    if _BUILTIN_REGISTRY is None:
        _BUILTIN_REGISTRY = _build_registry()
        from .extended_factors import register_extended_factors
        register_extended_factors(_BUILTIN_REGISTRY)
    return _BUILTIN_REGISTRY


class FactorComputer:
    def __init__(self, db: AsyncSession):
        self.db = db
        self._price_cache: dict[str, pd.DataFrame] = {}
        self._tech_computer = TechnicalFactorComputer(db)
        self._factor_params_cache: dict[str, dict] = {}
        self._registry = _get_builtin_registry()
        self._compute_cache: dict[str, dict[str, float]] = {}
        self._context_cache: dict[str, dict] = {}

    @property
    def registry(self) -> FactorRegistry:
        return self._registry

    async def compute_all_factors(
        self, stock_codes: list[str], target_date: date
    ) -> dict[str, dict[str, float]]:
        ctx = await self._build_context(stock_codes, target_date, None)
        factors: dict[str, dict[str, float]] = {}

        for name, factor in self._registry.all().items():
            try:
                vals = await factor.compute_fn(ctx, stock_codes, target_date)
                if vals is not None and len(vals) > 0:
                    factors[name] = {k: float(v) for k, v in vals.items() if not np.isnan(v) and not np.isinf(v)}
            except Exception:
                pass

        return factors

    async def compute_one(self, factor_name: str, stock_codes: list[str], target_date: date) -> dict[str, float]:
        cache_key = f"{factor_name}_{target_date.isoformat()}"
        if cache_key in self._compute_cache:
            return self._compute_cache[cache_key]

        try:
            if self._is_tech_factor(factor_name):
                params = await self._get_factor_params(factor_name)
                vals = await self._tech_computer.compute(factor_name, stock_codes, target_date, params)
                result = {k: float(v) for k, v in vals.items() if not np.isnan(v) and not np.isinf(v)}
                self._compute_cache[cache_key] = result
                return result

            factor = self._registry.get(factor_name)
            if not factor:
                self._compute_cache[cache_key] = {}
                return {}

            ctx = await self._build_context(stock_codes, target_date, factor.required_data)
            vals = await factor.compute_fn(ctx, stock_codes, target_date)
            if vals is None:
                self._compute_cache[cache_key] = {}
                return {}
            result = {k: float(v) for k, v in vals.items() if not np.isnan(v) and not np.isinf(v)}
            self._compute_cache[cache_key] = result
            return result
        except Exception:
            self._compute_cache[cache_key] = {}
            return {}

    async def _build_context(
        self, stock_codes: list[str], target_date: date, required: list[str] | None
    ) -> dict:
        req = set(required) if required else {"prices", "financials", "quote", "stock_info"}
        req_key = ",".join(sorted(req))
        context_key = f"{req_key}_{target_date.isoformat()}"
        if context_key in self._context_cache:
            return self._context_cache[context_key]

        ctx: dict = {"db": self.db, "price_cache": self._price_cache}

        if "prices" in req or "quote" in req:
            prices, qdf = await self._load_prices_and_quotes(stock_codes, target_date)
            ctx["prices"] = prices
            ctx["quote_df"] = qdf
            ctx["latest_quotes"] = self._get_latest_quotes_from(qdf)

        if "financials" in req:
            ctx["financials"] = await self._load_financials(stock_codes, target_date)

        if "stock_info" in req:
            ctx["stock_info"] = await self._load_stock_info()

        self._context_cache[context_key] = ctx
        return ctx

    async def _load_prices_and_quotes(
        self, stock_codes: list[str], target_date: date
    ) -> tuple[pd.DataFrame, pd.DataFrame]:
        cache_key = f"prices_{target_date}"
        if cache_key in self._price_cache:
            prices = self._price_cache[cache_key]
            qdf = self._price_cache.get(f"quote_{target_date}", pd.DataFrame())
            return prices, qdf

        lookback = target_date - timedelta(days=400)
        result = await self.db.execute(
            select(DailyQuote.stock_code, DailyQuote.trade_date, DailyQuote.close, DailyQuote.volume,
                   DailyQuote.pe_ratio, DailyQuote.pb_ratio, DailyQuote.pre_close,
                   DailyQuote.open, DailyQuote.high, DailyQuote.low)
            .where(DailyQuote.stock_code.in_(stock_codes))
            .where(DailyQuote.trade_date >= lookback)
            .where(DailyQuote.trade_date <= target_date)
            .order_by(DailyQuote.trade_date)
        )
        rows = result.all()
        if not rows:
            return pd.DataFrame(), pd.DataFrame()
        df = pd.DataFrame(rows, columns=["code", "date", "close", "volume", "pe", "pb", "pre_close",
                                          "open", "high", "low"])
        prices = df.pivot(index="date", columns="code", values="close")
        prices.sort_index(inplace=True)
        self._price_cache[cache_key] = prices
        self._price_cache[f"quote_{target_date}"] = df
        return prices, df

    def _get_latest_quotes_from(self, qdf: pd.DataFrame) -> pd.DataFrame:
        if qdf is None or qdf.empty:
            return pd.DataFrame()
        return qdf.sort_values("date").groupby("code").last().reset_index()

    async def _load_financials(self, stock_codes: list[str], target_date: date) -> pd.DataFrame:
        result = await self.db.execute(
            select(FinancialReport)
            .where(FinancialReport.stock_code.in_(stock_codes))
            .where(FinancialReport.report_date <= target_date)
            .where(
                or_(
                    FinancialReport.public_date <= target_date,
                    FinancialReport.public_date.is_(None),
                )
            )
            .order_by(FinancialReport.stock_code, FinancialReport.report_date.desc())
        )
        rows = result.scalars().all()
        if not rows:
            return pd.DataFrame()

        data = [{
            "code": r.stock_code, "report_date": r.report_date,
            "revenue": r.revenue, "operating_cost": r.operating_cost,
            "net_profit_parent": r.net_profit_parent,
            "total_assets": r.total_assets, "total_liabilities": r.total_liabilities,
            "total_equity": r.total_equity, "current_assets": r.current_assets,
            "current_liabilities": r.current_liabilities,
            "dividend_per_share": r.dividend_per_share,
            "operating_cash_flow": r.operating_cash_flow,
            "investing_cash_flow": r.investing_cash_flow,
            "free_cash_flow": r.free_cash_flow,
            "roe_val": r.roe_val, "net_margin_val": r.net_margin_val,
            "gross_margin_val": r.gross_margin_val,
            "total_shares_val": r.total_shares_val, "float_shares_val": r.float_shares_val,
            "yoy_revenue_growth": r.yoy_revenue_growth,
            "yoy_profit_growth": r.yoy_profit_growth,
            "yoy_parent_profit_growth": r.yoy_parent_profit_growth,
        } for r in rows]
        df = pd.DataFrame(data)
        if not df.empty:
            # P7.2.6: Use drop_duplicates instead of groupby.last() for reliable latest-per-stock
            df = df.sort_values(["code", "report_date"], ascending=[True, False])
            df = df.drop_duplicates(subset=["code"], keep="first").reset_index(drop=True)
        return df

    async def _load_stock_info(self) -> dict[str, dict]:
        result = await self.db.execute(select(StockInfo))
        rows = result.scalars().all()
        info = {
            r.stock_code: {"total_shares": r.total_shares, "float_shares": r.float_shares,
                           "industry": r.industry_sw}
            for r in rows
        }
        return info if info else {}

    def _is_tech_factor(self, factor_name: str) -> bool:
        for prefix in TECH_FACTOR_PREFIXES:
            if factor_name.startswith(prefix):
                return True
        return False

    async def _get_factor_params(self, factor_name: str) -> dict:
        if factor_name in self._factor_params_cache:
            return self._factor_params_cache[factor_name]
        result = await self.db.execute(
            select(FactorDefinition.default_params)
            .where(FactorDefinition.name == factor_name)
        )
        params = result.scalar_one_or_none()
        if params is None:
            params = {}
        self._factor_params_cache[factor_name] = params or {}
        return self._factor_params_cache[factor_name]


# ================== Helper Functions ==================

def _get_close(prices: pd.DataFrame, code: str) -> float | None:
    if prices.empty or code not in prices.columns:
        return None
    col = prices[code].dropna()
    if col.empty:
        return None
    return float(col.iloc[-1])


def _get_market_cap(code: str, close_px: float, stock_info: dict, fin: pd.DataFrame) -> float:
    si = stock_info.get(code, {})
    shares = si.get("total_shares")
    if shares and shares > 0:
        return shares * close_px
    if fin is not None and not fin.empty:
        fin_row = fin[fin["code"] == code]
        if not fin_row.empty:
            ts = fin_row.iloc[0].get("total_shares_val")
            if ts and ts > 0:
                return ts * close_px
    return 0


def _compute_momentum(prices: pd.DataFrame, window: int) -> dict[str, float]:
    if prices.empty or len(prices) < window:
        return {}
    result = {}
    for col in prices.columns:
        s = prices[col].dropna()
        if len(s) < window + 1:
            continue
        val = float(s.iloc[-1]) / float(s.iloc[-(window + 1)]) - 1
        if not np.isnan(val) and not np.isinf(val):
            result[col] = val
    return result


def _compute_volatility(prices: pd.DataFrame, window: int) -> dict[str, float]:
    if prices.empty:
        return {}
    result = {}
    for col in prices.columns:
        s = prices[col].dropna()
        if len(s) < window + 1:
            continue
        recent = s.iloc[-(window + 1):]
        rets = recent.pct_change().dropna()
        if len(rets) < 2:
            continue
        vol = float(rets.std() * np.sqrt(252))
        if not np.isnan(vol) and not np.isinf(vol):
            result[col] = vol
    return result


async def _get_prev_fin(db, code: str, before_date: date, field: str) -> float | None:
    result = await db.execute(
        select(getattr(FinancialReport, field))
        .where(FinancialReport.stock_code == code)
        .where(FinancialReport.report_date <= before_date)
        .where(getattr(FinancialReport, field).isnot(None))
        .order_by(FinancialReport.report_date.desc())
        .limit(1)
    )
    val = result.scalar_one_or_none()
    return float(val) if val else None


# ================== Value Factor Compute Functions =================#

async def _compute_pe_ratio(ctx: dict, codes: list[str], d: date) -> dict[str, float]:
    qdf = ctx.get("latest_quotes", pd.DataFrame())
    if qdf.empty:
        return {}
    result = {}
    for _, row in qdf.iterrows():
        pe = row.get("pe")
        if pe and pe > 0:
            result[row["code"]] = 1.0 / pe
    return result


async def _compute_pb_ratio(ctx: dict, codes: list[str], d: date) -> dict[str, float]:
    qdf = ctx.get("latest_quotes", pd.DataFrame())
    if qdf.empty:
        return {}
    result = {}
    for _, row in qdf.iterrows():
        pb = row.get("pb")
        if pb and pb > 0:
            result[row["code"]] = 1.0 / pb
    return result


async def _compute_ps_ratio(ctx: dict, codes: list[str], d: date) -> dict[str, float]:
    prices = ctx.get("prices", pd.DataFrame())
    fin = ctx.get("financials", pd.DataFrame())
    si = ctx.get("stock_info", {})
    if fin.empty:
        return {}
    result = {}
    for _, row in fin.iterrows():
        code = row["code"]
        revenue = row.get("revenue")
        if not revenue or revenue <= 0:
            continue
        close_px = _get_close(prices, code)
        if close_px is None or close_px <= 0:
            continue
        mcap = _get_market_cap(code, close_px, si, fin)
        if mcap <= 0:
            continue
        ps = mcap / revenue
        if ps > 0:
            result[code] = 1.0 / ps
    return result


async def _compute_dividend_yield(ctx: dict, codes: list[str], d: date) -> dict[str, float]:
    prices = ctx.get("prices", pd.DataFrame())
    fin = ctx.get("financials", pd.DataFrame())
    result = {}
    for code in codes:
        close_px = _get_close(prices, code)
        if close_px is None or close_px <= 0:
            continue
        fin_row = fin[fin["code"] == code] if not fin.empty else pd.DataFrame()
        dps = None
        if not fin_row.empty:
            dps = fin_row.iloc[0].get("dividend_per_share")
        if dps and dps > 0:
            result[code] = dps / close_px
    return result


async def _compute_ep_ratio(ctx: dict, codes: list[str], d: date) -> dict[str, float]:
    prices = ctx.get("prices", pd.DataFrame())
    fin = ctx.get("financials", pd.DataFrame())
    si = ctx.get("stock_info", {})
    result = {}
    for code in codes:
        close_px = _get_close(prices, code)
        if close_px is None or close_px <= 0:
            continue
        mcap = _get_market_cap(code, close_px, si, fin)
        if mcap <= 0:
            continue
        fin_row = fin[fin["code"] == code] if not fin.empty else pd.DataFrame()
        net_profit = fin_row.iloc[0].get("net_profit_parent") if not fin_row.empty else None
        if net_profit and net_profit > 0:
            result[code] = net_profit / mcap
    return result


async def _compute_bp_ratio(ctx: dict, codes: list[str], d: date) -> dict[str, float]:
    prices = ctx.get("prices", pd.DataFrame())
    fin = ctx.get("financials", pd.DataFrame())
    si = ctx.get("stock_info", {})
    result = {}
    for code in codes:
        close_px = _get_close(prices, code)
        if close_px is None or close_px <= 0:
            continue
        mcap = _get_market_cap(code, close_px, si, fin)
        if mcap <= 0:
            continue
        fin_row = fin[fin["code"] == code] if not fin.empty else pd.DataFrame()
        equity = fin_row.iloc[0].get("total_equity") if not fin_row.empty else None
        if equity and equity > 0:
            result[code] = equity / mcap
    return result


# ================== Growth Factor Compute Functions =================#

async def _compute_revenue_growth_yoy(ctx: dict, codes: list[str], d: date) -> dict[str, float]:
    fin = ctx.get("financials", pd.DataFrame())
    db = ctx["db"]
    if fin.empty:
        return {}
    result = {}
    for code in codes:
        fin_row = fin[fin["code"] == code]
        if fin_row.empty:
            continue
        row = fin_row.iloc[0]
        yoy = row.get("yoy_revenue_growth")
        if yoy is not None and not pd.isna(yoy):
            result[code] = float(yoy) / 100 if abs(float(yoy)) > 1 else float(yoy)
            continue
        revenue = row.get("revenue")
        if not revenue or revenue <= 0:
            continue
        prev_date = row["report_date"] - timedelta(days=365)
        prev = await _get_prev_fin(db, code, prev_date, "revenue")
        if prev and prev > 0:
            result[code] = (revenue / prev) - 1
    return result


async def _compute_profit_growth_yoy(ctx: dict, codes: list[str], d: date) -> dict[str, float]:
    fin = ctx.get("financials", pd.DataFrame())
    db = ctx["db"]
    if fin.empty:
        return {}
    result = {}
    for code in codes:
        fin_row = fin[fin["code"] == code]
        if fin_row.empty:
            continue
        row = fin_row.iloc[0]
        yoy = row.get("yoy_parent_profit_growth") or row.get("yoy_profit_growth")
        if yoy is not None and not pd.isna(yoy):
            result[code] = float(yoy) / 100 if abs(float(yoy)) > 1 else float(yoy)
            continue
        np_val = row.get("net_profit_parent")
        if not np_val:
            continue
        prev_date = row["report_date"] - timedelta(days=365)
        prev = await _get_prev_fin(db, code, prev_date, "net_profit_parent")
        if prev and abs(prev) > 0:
            result[code] = (np_val / prev) - 1 if prev > 0 else 0
    return result


async def _compute_roe(ctx: dict, codes: list[str], d: date) -> dict[str, float]:
    fin = ctx.get("financials", pd.DataFrame())
    if fin.empty:
        return {}
    result = {}
    for _, row in fin.iterrows():
        code = row["code"]
        roe = row.get("roe_val")
        if roe is not None and not pd.isna(roe):
            result[code] = float(roe) / 100 if abs(float(roe)) > 1 else float(roe)
            continue
        np_val = row.get("net_profit_parent")
        equity = row.get("total_equity")
        if np_val and equity and equity > 0:
            result[code] = np_val / equity
    return result


# ================== Momentum Factor Compute Functions =================#

def _make_momentum_fn(window: int):
    async def _fn(ctx: dict, codes: list[str], d: date) -> dict[str, float]:
        prices = ctx.get("prices", pd.DataFrame())
        return _compute_momentum(prices, window)
    return _fn


async def _compute_return_12m_1m(ctx: dict, codes: list[str], d: date) -> dict[str, float]:
    prices = ctx.get("prices", pd.DataFrame())
    if prices.empty:
        return {}
    result = {}
    for col in prices.columns:
        s = prices[col].dropna()
        if len(s) < 252:
            continue
        m12 = float(s.iloc[-1]) / float(s.iloc[-252]) - 1
        m1 = float(s.iloc[-1]) / float(s.iloc[-21]) - 1
        val = m12 - m1
        if not np.isnan(val) and not np.isinf(val):
            result[col] = val
    return result


# ================== Quality Factor Compute Functions =================#

async def _compute_gross_margin(ctx: dict, codes: list[str], d: date) -> dict[str, float]:
    fin = ctx.get("financials", pd.DataFrame())
    if fin.empty:
        return {}
    result = {}
    for _, row in fin.iterrows():
        code = row["code"]
        gm = row.get("gross_margin_val")
        if gm is not None and not pd.isna(gm):
            result[code] = float(gm) / 100 if abs(float(gm)) > 1 else float(gm)
            continue
        revenue = row.get("revenue")
        cost = row.get("operating_cost")
        if revenue and cost and revenue > 0:
            result[code] = (revenue - cost) / revenue
    return result


async def _compute_net_margin(ctx: dict, codes: list[str], d: date) -> dict[str, float]:
    fin = ctx.get("financials", pd.DataFrame())
    if fin.empty:
        return {}
    result = {}
    for _, row in fin.iterrows():
        code = row["code"]
        nm = row.get("net_margin_val")
        if nm is not None and not pd.isna(nm):
            result[code] = float(nm) / 100 if abs(float(nm)) > 1 else float(nm)
            continue
        revenue = row.get("revenue")
        np_val = row.get("net_profit_parent")
        if revenue and np_val and revenue > 0:
            result[code] = np_val / revenue
    return result


async def _compute_asset_turnover(ctx: dict, codes: list[str], d: date) -> dict[str, float]:
    fin = ctx.get("financials", pd.DataFrame())
    if fin.empty:
        return {}
    result = {}
    for _, row in fin.iterrows():
        code = row["code"]
        revenue = row.get("revenue")
        assets = row.get("total_assets")
        if revenue and assets and assets > 0:
            result[code] = revenue / assets
    return result


async def _compute_debt_to_equity(ctx: dict, codes: list[str], d: date) -> dict[str, float]:
    fin = ctx.get("financials", pd.DataFrame())
    if fin.empty:
        return {}
    result = {}
    for _, row in fin.iterrows():
        code = row["code"]
        liabilities = row.get("total_liabilities")
        assets = row.get("total_assets")
        if liabilities is not None and assets and assets > 0:
            result[code] = liabilities / assets
    return result


# ================== Volatility Factor Compute Functions =================#

def _make_volatility_fn(window: int):
    async def _fn(ctx: dict, codes: list[str], d: date) -> dict[str, float]:
        prices = ctx.get("prices", pd.DataFrame())
        return _compute_volatility(prices, window)
    return _fn


async def _compute_max_drawdown_1y(ctx: dict, codes: list[str], d: date) -> dict[str, float]:
    prices = ctx.get("prices", pd.DataFrame())
    if prices.empty:
        return {}
    result = {}
    for col in prices.columns:
        s = prices[col].dropna()
        if len(s) < 63:
            continue
        window = min(252, len(s))
        recent = s.iloc[-window:]
        peak = recent.expanding().max()
        dd = (recent / peak - 1).min()
        val = float(dd)
        if not np.isnan(val) and not np.isinf(val):
            result[col] = val
    return result


# ================== Size Factor Compute Functions =================#

async def _compute_log_market_cap(ctx: dict, codes: list[str], d: date) -> dict[str, float]:
    prices = ctx.get("prices", pd.DataFrame())
    fin = ctx.get("financials", pd.DataFrame())
    si = ctx.get("stock_info", {})
    result = {}
    for code in codes:
        close_px = _get_close(prices, code)
        if close_px is None or close_px <= 0:
            continue
        mcap = _get_market_cap(code, close_px, si, fin)
        if mcap <= 0 and not fin.empty:
            fin_row = fin[fin["code"] == code]
            if not fin_row.empty:
                ts = fin_row.iloc[0].get("total_shares_val")
                if ts and ts > 0:
                    mcap = ts * close_px
        if mcap > 0:
            result[code] = float(np.log(mcap))
    return result


# ================== Microstructure Factor Compute Functions =================#

async def _compute_intraday_momentum(ctx: dict, codes: list[str], d: date) -> dict[str, float]:
    qdf = ctx.get("latest_quotes", pd.DataFrame())
    if qdf.empty:
        return {}
    result = {}
    for _, row in qdf.iterrows():
        o = row.get("open")
        c = row.get("close")
        if o and c and o > 0:
            result[row["code"]] = (c - o) / o
    return result


async def _compute_intraday_volatility(ctx: dict, codes: list[str], d: date) -> dict[str, float]:
    qdf = ctx.get("latest_quotes", pd.DataFrame())
    if qdf.empty:
        return {}
    result = {}
    for _, row in qdf.iterrows():
        o = row.get("open")
        h = row.get("high")
        l = row.get("low")
        if o and h and l and o > 0:
            result[row["code"]] = (h - l) / o
    return result


async def _compute_gap_return(ctx: dict, codes: list[str], d: date) -> dict[str, float]:
    qdf = ctx.get("latest_quotes", pd.DataFrame())
    if qdf.empty:
        return {}
    result = {}
    for _, row in qdf.iterrows():
        o = row.get("open")
        pc = row.get("pre_close")
        if o and pc and pc > 0:
            result[row["code"]] = (o - pc) / pc
    return result


async def _compute_volume_intensity(ctx: dict, codes: list[str], d: date) -> dict[str, float]:
    qdf = ctx.get("latest_quotes", pd.DataFrame())
    prices = ctx.get("prices", pd.DataFrame())
    if qdf.empty:
        return {}
    result = {}
    for _, row in qdf.iterrows():
        code = row["code"]
        vol = row.get("volume")
        if not vol or vol <= 0:
            continue
        if code in prices.columns:
            code_prices = prices[code].dropna()
            if len(code_prices) >= 6:
                # Use volume from quote data, not price
                code_quotes = ctx.get("quote_df", pd.DataFrame())
                if not code_quotes.empty:
                    code_q = code_quotes[code_quotes["code"] == code].sort_values("date")
                    if len(code_q) >= 6:
                        avg_vol_5d = code_q.iloc[-6:-1]["volume"].mean()
                        if avg_vol_5d and avg_vol_5d > 0:
                            result[code] = float(vol) / avg_vol_5d
    return result


async def _compute_am_pm_ratio(ctx: dict, codes: list[str], d: date) -> dict[str, float]:
    """AM/PM return ratio. Requires intraday data which is not currently available.

    Returns empty dict until minute-level data is supported.
    """
    # TODO: Implement when intraday (minute-level) data is available
    # Formula: AM return = (mid_close - open) / open, PM return = (close - mid_close) / mid_close
    # ratio = AM_return / PM_return
    return {}


async def _compute_twap_deviation(ctx: dict, codes: list[str], d: date) -> dict[str, float]:
    qdf = ctx.get("latest_quotes", pd.DataFrame())
    if qdf.empty:
        return {}
    result = {}
    for _, row in qdf.iterrows():
        o = row.get("open")
        c = row.get("close")
        h = row.get("high")
        l = row.get("low")
        if o and c and h and l:
            twap_est = (o + c + h + l) / 4
            if twap_est > 0:
                result[row["code"]] = (c - twap_est) / twap_est
    return result


# ================== Persistence ==================

async def save_factor_values(db: AsyncSession, factor_name: str, date_: date, values: dict[str, float]):
    fid_result = await db.execute(
        select(FactorDefinition.id).where(FactorDefinition.name == factor_name)
    )
    fid = fid_result.scalar_one_or_none()
    if not fid:
        return
    for code, val in values.items():
        fv = FactorValue(factor_id=fid, stock_code=code, trade_date=date_, value=val)
        await db.merge(fv)
