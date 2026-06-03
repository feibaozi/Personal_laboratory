import logging
from datetime import date
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from ..models.backtest import PaperTradeRun, PaperDailyValue
from ..models.market import DailyQuote
from .signal_engine import SignalEngine
from .order_manager import OrderManager, OrderStatus

logger = logging.getLogger(__name__)


class PaperTradeEngine:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.signal = SignalEngine(db)
        self.order_mgr = OrderManager(db)

    async def run_once(self, run_id: str, target_date: date | None = None) -> dict:
        run_result = await self.db.execute(
            select(PaperTradeRun).where(PaperTradeRun.id == run_id)
        )
        run = run_result.scalar_one_or_none()
        if not run:
            return {"error": "Run not found"}

        if not target_date:
            target_date = await self._latest_trade_date()

        config = run.config_json or {}

        signal_result = await self.signal.generate(config, target_date)
        signals = signal_result.get("signals", [])
        if not signals:
            return {"run_id": run_id, "date": target_date.isoformat(), "signals": 0, "orders": 0, "message": "No signals"}

        # Record value before rebalancing
        prev_value = run.current_value or run.initial_capital

        capital = run.current_cash or run.initial_capital
        positions = await self.order_mgr._get_positions(run_id)
        pos_value = sum((p.market_value or 0) for p in positions)
        total_capital = capital + pos_value

        orders = await self.order_mgr.generate_orders(run_id, target_date, signals, total_capital)

        filled_orders = []
        total_buy = 0.0
        total_sell = 0.0
        for order in orders:
            order = await self.order_mgr.simulate_fill(order)
            filled_orders.append(order)
            if order.status == OrderStatus.FILLED.value:
                if order.direction == "buy":
                    total_buy += order.fill_shares * order.fill_price
                else:
                    total_sell += order.fill_shares * order.fill_price

        new_positions = await self.order_mgr.apply_fills(run_id, filled_orders)

        # Deduct transaction costs
        total_cost = total_buy * 0.0003 + abs(total_sell) * 0.0013  # buy commission + sell commission + stamp tax
        run.current_cash = capital + total_sell - total_buy - total_cost

        # Update position market values and unrealized PnL
        await self._update_position_values(run_id, target_date)

        # Recalculate total value after position updates
        updated_positions = await self.order_mgr._get_positions(run_id)
        run.current_value = sum((p.market_value or 0) for p in updated_positions) + run.current_cash
        run.total_return = (run.current_value / run.initial_capital - 1) if run.initial_capital > 0 else 0

        # Record daily value for equity curve
        daily_ret = (run.current_value / prev_value - 1) if prev_value > 0 else 0
        self.db.add(PaperDailyValue(
            run_id=run_id,
            trade_date=target_date,
            total_value=round(run.current_value, 2),
            cash=round(run.current_cash, 2),
            daily_return=round(daily_ret, 6),
        ))

        await self.db.commit()

        n_filled = sum(1 for o in filled_orders if o.status == OrderStatus.FILLED.value)
        return {
            "run_id": run_id,
            "date": target_date.isoformat(),
            "signals": len(signals),
            "orders": len(orders),
            "filled": n_filled,
            "total_value": round(run.current_value, 2),
            "total_return": round(run.total_return, 6),
        }

    async def _update_position_values(self, run_id: str, target_date: date):
        """Query closing prices and update all positions' market_value and unrealized_pnl."""
        positions = await self.order_mgr._get_positions(run_id)
        if not positions:
            return
        codes = [p.stock_code for p in positions]

        result = await self.db.execute(
            select(DailyQuote.stock_code, DailyQuote.close)
            .where(DailyQuote.stock_code.in_(codes))
            .where(DailyQuote.trade_date == target_date)
        )
        price_map = {r[0]: r[1] for r in result.all() if r[1] is not None}

        for pos in positions:
            close = price_map.get(pos.stock_code)
            if close and close > 0:
                pos.market_value = pos.shares * close
                pos.unrealized_pnl = pos.shares * (close - pos.avg_cost)

    async def _latest_trade_date(self) -> date:
        result = await self.db.execute(
            select(DailyQuote.trade_date).order_by(DailyQuote.trade_date.desc()).limit(1)
        )
        row = result.first()
        return row[0] if row else date.today()
