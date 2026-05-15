from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from ..models.factor import FactorDefinition

BUILTIN_FACTORS = [
    # Value
    {"name": "pe_ratio", "category": "value", "description": "市盈率（倒数）：1/PE，值越大越便宜", "default_params": {}},
    {"name": "pb_ratio", "category": "value", "description": "市净率（倒数）：1/PB，值越大越便宜", "default_params": {}},
    {"name": "ps_ratio", "category": "value", "description": "市销率（倒数）：1/PS", "default_params": {}},
    {"name": "dividend_yield", "category": "value", "description": "股息率：每股分红/股价", "default_params": {}},
    {"name": "ep_ratio", "category": "value", "description": "盈利收益率：归母净利润/总市值", "default_params": {}},
    {"name": "bp_ratio", "category": "value", "description": "账面市值比：净资产/总市值", "default_params": {}},
    # Growth
    {"name": "revenue_growth_yoy", "category": "growth", "description": "营业收入同比增长率", "default_params": {"period": "yoy"}},
    {"name": "profit_growth_yoy", "category": "growth", "description": "归母净利润同比增长率", "default_params": {"period": "yoy"}},
    {"name": "roe", "category": "growth", "description": "净资产收益率 ROE", "default_params": {}},
    # Momentum
    {"name": "return_1m", "category": "momentum", "description": "1个月动量（过去21个交易日累计收益）", "default_params": {"window": 21}},
    {"name": "return_3m", "category": "momentum", "description": "3个月动量（过去63个交易日累计收益）", "default_params": {"window": 63}},
    {"name": "return_6m", "category": "momentum", "description": "6个月动量（过去126个交易日累计收益）", "default_params": {"window": 126}},
    {"name": "return_12m_1m", "category": "momentum", "description": "12-1月动量（过去12个月剔除最近1个月收益）", "default_params": {}},
    # Quality
    {"name": "gross_margin", "category": "quality", "description": "毛利率：(营收-成本)/营收", "default_params": {}},
    {"name": "net_margin", "category": "quality", "description": "净利率：净利润/营收", "default_params": {}},
    {"name": "asset_turnover", "category": "quality", "description": "资产周转率：营收/总资产", "default_params": {}},
    {"name": "debt_to_equity", "category": "quality", "description": "资产负债率：总负债/总资产", "default_params": {}},
    # Volatility
    {"name": "volatility_1m", "category": "volatility", "description": "1个月波动率（21日日收益率标准差年化）", "default_params": {"window": 21}},
    {"name": "volatility_3m", "category": "volatility", "description": "3个月波动率（63日日收益率标准差年化）", "default_params": {"window": 63}},
    {"name": "max_drawdown_1y", "category": "volatility", "description": "1年最大回撤", "default_params": {"window": 252}},
    # Size
    {"name": "log_market_cap", "category": "size", "description": "对数市值：ln(总市值)，衡量规模效应", "default_params": {}},
    # Microstructure (intraday)
    {"name": "intraday_momentum", "category": "microstructure", "description": "日内动能：(close - open) / open", "default_params": {}},
    {"name": "intraday_volatility", "category": "microstructure", "description": "日内振幅：(high - low) / open", "default_params": {}},
    {"name": "am_pm_ratio", "category": "microstructure", "description": "上下午收益比：下午收益/上午收益", "default_params": {}},
    {"name": "volume_intensity", "category": "microstructure", "description": "量比：当日成交量/5日平均量", "default_params": {}},
    {"name": "gap_return", "category": "microstructure", "description": "跳空收益：(open - prev_close) / prev_close", "default_params": {}},
    {"name": "twap_deviation", "category": "microstructure", "description": "TWAP偏离：(close - TWAP) / TWAP", "default_params": {}},
]


async def seed_factors(db: AsyncSession):
    result = await db.execute(select(FactorDefinition.id).limit(1))
    if result.scalar_one_or_none():
        return

    for f in BUILTIN_FACTORS:
        db.add(FactorDefinition(
            name=f["name"],
            category=f["category"],
            description=f["description"],
            default_params=f["default_params"],
            is_builtin=True,
        ))
    await db.commit()
