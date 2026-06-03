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
    {"name": "fcf_yield", "category": "value", "description": "自由现金流收益率：FCF/总市值", "default_params": {}},
    {"name": "pcf_ratio", "category": "value", "description": "市现率：总市值/经营现金流", "default_params": {}},
    # Growth
    {"name": "revenue_growth_yoy", "category": "growth", "description": "营业收入同比增长率", "default_params": {"period": "yoy"}},
    {"name": "profit_growth_yoy", "category": "growth", "description": "归母净利润同比增长率", "default_params": {"period": "yoy"}},
    {"name": "roe", "category": "growth", "description": "净资产收益率 ROE", "default_params": {}},
    # Momentum
    {"name": "return_1m", "category": "momentum", "description": "1个月动量（过去21个交易日累计收益）", "default_params": {"window": 21}},
    {"name": "return_3m", "category": "momentum", "description": "3个月动量（过去63个交易日累计收益）", "default_params": {"window": 63}},
    {"name": "return_6m", "category": "momentum", "description": "6个月动量（过去126个交易日累计收益）", "default_params": {"window": 126}},
    {"name": "return_12m_1m", "category": "momentum", "description": "12-1月动量（过去12个月剔除最近1个月收益）", "default_params": {}},
    {"name": "return_5d", "category": "momentum", "description": "近5日收益", "default_params": {}},
    # Quality
    {"name": "gross_margin", "category": "quality", "description": "毛利率：(营收-成本)/营收", "default_params": {}},
    {"name": "net_margin", "category": "quality", "description": "净利率：净利润/营收", "default_params": {}},
    {"name": "asset_turnover", "category": "quality", "description": "资产周转率：营收/总资产", "default_params": {}},
    {"name": "debt_to_equity", "category": "quality", "description": "资产负债率：总负债/总资产", "default_params": {}},
    {"name": "ocf_to_debt", "category": "quality", "description": "经营现金流/总负债", "default_params": {}},
    {"name": "cash_conversion", "category": "quality", "description": "盈利现金含量：OCF/净利润", "default_params": {}},
    {"name": "reinvestment_rate", "category": "quality", "description": "再投资率：(OCF-股息)/净利润", "default_params": {}},
    {"name": "current_ratio", "category": "quality", "description": "流动比率：流动资产/流动负债", "default_params": {}},
    {"name": "quick_ratio", "category": "quality", "description": "速动比率：(流动资产-存货)/流动负债", "default_params": {}},
    {"name": "accrual", "category": "quality", "description": "应计项目：(净利润-OCF)/总资产", "default_params": {}},
    {"name": "asset_growth", "category": "quality", "description": "总资产增长率", "default_params": {}},
    {"name": "equity_growth", "category": "quality", "description": "净资产增长率", "default_params": {}},
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
    # Short-term Reversal
    {"name": "return_reversal_1w", "category": "short_term", "description": "1周反转因子", "default_params": {}},
    {"name": "return_reversal_2w", "category": "short_term", "description": "2周反转因子", "default_params": {}},
    {"name": "close_position_20d", "category": "short_term", "description": "收盘价在近20日位置", "default_params": {}},
    {"name": "amplitude_5d", "category": "short_term", "description": "5日振幅", "default_params": {}},
    {"name": "volume_weighted_return", "category": "short_term", "description": "成交量加权收益偏离", "default_params": {}},
    # Trend / Breakout
    {"name": "macd_signal", "category": "trend", "description": "MACD信号（标准化）", "default_params": {}},
    {"name": "bollinger_position", "category": "trend", "description": "布林带位置：(收盘-下轨)/(上轨-下轨)", "default_params": {}},
    {"name": "adx_trend_strength", "category": "trend", "description": "ADX趋势强度", "default_params": {}},
    {"name": "price_channel_breakout", "category": "trend", "description": "20日价格通道突破信号", "default_params": {}},
    {"name": "momentum_reversal_3m", "category": "trend", "description": "3月动量反转", "default_params": {}},
    {"name": "resistance_strength", "category": "trend", "description": "阻力位强度", "default_params": {}},
    {"name": "support_strength", "category": "trend", "description": "支撑位强度", "default_params": {}},
    {"name": "volume_price_trend", "category": "trend", "description": "量价趋势一致性", "default_params": {}},
    # Risk / Tail
    {"name": "tail_risk_1m", "category": "risk", "description": "月度尾部风险(VaR5%)", "default_params": {}},
    {"name": "downside_volatility", "category": "risk", "description": "下行波动率", "default_params": {}},
    {"name": "cvar_ratio", "category": "risk", "description": "CVaR/波动率", "default_params": {}},
    {"name": "skewness_3m", "category": "risk", "description": "3月收益偏度", "default_params": {}},
    {"name": "kurtosis_3m", "category": "risk", "description": "3月收益峰度", "default_params": {}},
    {"name": "beta_60d", "category": "risk", "description": "60日市场Beta", "default_params": {}},
    # Sentiment / Flow
    {"name": "north_bound_flow", "category": "sentiment", "description": "北向资金净流入率", "default_params": {}},
    {"name": "margin_balance_ratio", "category": "sentiment", "description": "融资余额/总市值", "default_params": {}},
    {"name": "margin_balance_change", "category": "sentiment", "description": "融资余额变化率", "default_params": {}},
    {"name": "short_selling_ratio", "category": "sentiment", "description": "融券余额/总市值", "default_params": {}},
    {"name": "turnover_rate_short", "category": "sentiment", "description": "短期换手率变化", "default_params": {}},
    {"name": "price_volume_divergence", "category": "sentiment", "description": "量价背离度", "default_params": {}},
    {"name": "limit_up_count_5d", "category": "sentiment", "description": "5日涨停次数", "default_params": {}},
]

# ================== Technical Factors (from Qlib Alpha158) ==================
WINDOWS = [5, 10, 20, 30, 60]

TECH_FACTORS = [
    # K-line shape factors (9, no window)
    {"name": "k_mid", "category": "technical", "description": "K线实体中位值：(close-open)/open", "default_params": {}},
    {"name": "k_len", "category": "technical", "description": "K线振幅：(high-low)/open", "default_params": {}},
    {"name": "k_mid2", "category": "technical", "description": "实体占振幅比：(close-open)/(high-low)", "default_params": {}},
    {"name": "k_up", "category": "technical", "description": "上影线比例：(high-max(open,close))/open", "default_params": {}},
    {"name": "k_up2", "category": "technical", "description": "上影线占振幅比", "default_params": {}},
    {"name": "k_low", "category": "technical", "description": "下影线比例：(min(open,close)-low)/open", "default_params": {}},
    {"name": "k_low2", "category": "technical", "description": "下影线占振幅比", "default_params": {}},
    {"name": "k_sft", "category": "technical", "description": "价格在K线中位置：(2*close-high-low)/open", "default_params": {}},
    {"name": "k_sft2", "category": "technical", "description": "标准化K线位置", "default_params": {}},
]

for w in WINDOWS:
    TECH_FACTORS.extend([
        # Price rolling
        {"name": f"roc_{w}", "category": "technical", "description": f"{w}日价格变化率", "default_params": {"window": w}},
        {"name": f"ma_{w}", "category": "technical", "description": f"{w}日移动均线偏离", "default_params": {"window": w}},
        {"name": f"std_{w}", "category": "technical", "description": f"{w}日价格波动率", "default_params": {"window": w}},
        {"name": f"max_{w}", "category": "technical", "description": f"{w}日最高价偏离", "default_params": {"window": w}},
        {"name": f"min_{w}", "category": "technical", "description": f"{w}日最低价偏离", "default_params": {"window": w}},
        # Correlation
        {"name": f"corr_{w}", "category": "technical", "description": f"{w}日量价相关性", "default_params": {"window": w}},
        {"name": f"cord_{w}", "category": "technical", "description": f"{w}日量价变化相关性", "default_params": {"window": w}},
        # RSI-like
        {"name": f"sump_{w}", "category": "technical", "description": f"{w}日上涨力量(RSI类)", "default_params": {"window": w}},
        {"name": f"sumn_{w}", "category": "technical", "description": f"{w}日下跌力量(RSI类)", "default_params": {"window": w}},
        {"name": f"sumd_{w}", "category": "technical", "description": f"{w}日涨跌力量差(RSI类)", "default_params": {"window": w}},
        # Price position
        {"name": f"rsv_{w}", "category": "technical", "description": f"{w}日价格位置(KDJ-RSV)", "default_params": {"window": w}},
        {"name": f"cntp_{w}", "category": "technical", "description": f"{w}日上涨天数占比", "default_params": {"window": w}},
        {"name": f"cntd_{w}", "category": "technical", "description": f"{w}日涨跌天数差", "default_params": {"window": w}},
        # Volume
        {"name": f"vma_{w}", "category": "technical", "description": f"{w}日成交量均线偏离", "default_params": {"window": w}},
        {"name": f"vstd_{w}", "category": "technical", "description": f"{w}日成交量波动", "default_params": {"window": w}},
        {"name": f"wvma_{w}", "category": "technical", "description": f"{w}日量价加权波动", "default_params": {"window": w}},
        # Trend
        {"name": f"beta_{w}", "category": "technical", "description": f"{w}日线性趋势斜率", "default_params": {"window": w}},
        {"name": f"rsqr_{w}", "category": "technical", "description": f"{w}日趋势拟合度R²", "default_params": {"window": w}},
        {"name": f"resi_{w}", "category": "technical", "description": f"{w}日回归残差", "default_params": {"window": w}},
        # Aroon
        {"name": f"imax_{w}", "category": "technical", "description": f"{w}日Aroon上行指标", "default_params": {"window": w}},
        {"name": f"imin_{w}", "category": "technical", "description": f"{w}日Aroon下行指标", "default_params": {"window": w}},
        {"name": f"imxd_{w}", "category": "technical", "description": f"{w}日Aroon差值", "default_params": {"window": w}},
    ])

BUILTIN_FACTORS = BUILTIN_FACTORS + TECH_FACTORS


async def seed_factors(db: AsyncSession):
    result = await db.execute(select(FactorDefinition.name))
    existing_names = {r[0] for r in result.all()}

    new_count = 0
    for f in BUILTIN_FACTORS:
        if f["name"] not in existing_names:
            db.add(FactorDefinition(
                name=f["name"],
                category=f["category"],
                description=f["description"],
                default_params=f["default_params"],
                is_builtin=True,
            ))
            new_count += 1

    if new_count > 0:
        await db.commit()
        print(f"Seeded {new_count} new factors")
    else:
        print("All factors already seeded")
