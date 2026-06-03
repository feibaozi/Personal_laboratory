import json
from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, Text, func
from ..database import Base


class Strategy(Base):
    __tablename__ = "strategies"
    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(100), nullable=False)
    description = Column(String(500))
    config_json = Column(Text)  # JSON string of BacktestConfig
    category = Column(String(30), default="custom")  # "preset" or "custom"
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())

    def get_config(self) -> dict:
        if self.config_json:
            return json.loads(self.config_json)
        return {}

    def set_config(self, config: dict):
        self.config_json = json.dumps(config, ensure_ascii=False)


PRESET_STRATEGIES = [
    {
        "name": "低估值高成长",
        "description": "选取低PE、高营收增长的股票，等权配置，月度调仓",
        "category": "preset",
        "config": {
            "factor_names": ["pe_ratio", "revenue_growth_yoy"],
            "factor_weights": [-1.0, 1.0],
            "top_n": 30,
            "rebalance_freq": "monthly",
            "weighting": "equal",
            "position_sizing": "equal",
            "benchmark": "000300",
            "initial_capital": 1000000,
            "transaction_cost": 0.0003,
            "slippage": 0.001,
            "min_daily_amount": 5000000,
        },
    },
    {
        "name": "动量反转",
        "description": "1个月动量+3个月动量组合，周度调仓捕捉短期趋势",
        "category": "preset",
        "config": {
            "factor_names": ["return_1m", "return_3m"],
            "factor_weights": [0.6, 0.4],
            "top_n": 20,
            "rebalance_freq": "weekly",
            "weighting": "equal",
            "position_sizing": "equal",
            "benchmark": "000905",
            "initial_capital": 1000000,
            "transaction_cost": 0.0003,
            "slippage": 0.001,
            "min_daily_amount": 5000000,
        },
    },
    {
        "name": "高质量低波动",
        "description": "高毛利率+低波动率，风险平价配置，月度调仓",
        "category": "preset",
        "config": {
            "factor_names": ["gross_margin", "volatility_1m"],
            "factor_weights": [1.0, -1.0],
            "top_n": 30,
            "rebalance_freq": "monthly",
            "weighting": "risk_parity",
            "position_sizing": "risk_parity",
            "benchmark": "000300",
            "initial_capital": 1000000,
            "transaction_cost": 0.0003,
            "slippage": 0.001,
            "min_daily_amount": 5000000,
        },
    },
    {
        "name": "小盘成长",
        "description": "小市值+高利润增长，等权配置，月度调仓",
        "category": "preset",
        "config": {
            "factor_names": ["log_market_cap", "profit_growth_yoy"],
            "factor_weights": [-1.0, 1.0],
            "top_n": 40,
            "rebalance_freq": "monthly",
            "weighting": "equal",
            "position_sizing": "equal",
            "benchmark": "000905",
            "initial_capital": 1000000,
            "transaction_cost": 0.0003,
            "slippage": 0.001,
            "min_daily_amount": 5000000,
        },
    },
]


async def seed_strategies(db):
    """Seed preset strategies if they don't exist."""
    from sqlalchemy import select
    result = await db.execute(
        select(Strategy).where(Strategy.category == "preset")
    )
    existing = result.scalars().all()
    if existing:
        return
    for preset in PRESET_STRATEGIES:
        s = Strategy(
            name=preset["name"],
            description=preset["description"],
            category=preset["category"],
        )
        s.set_config(preset["config"])
        db.add(s)
    await db.commit()
