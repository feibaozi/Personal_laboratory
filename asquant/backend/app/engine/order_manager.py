from datetime import date, datetime
from enum import Enum
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from ..models.backtest import PaperOrder, PaperPosition
from ..models.market import DailyQuote


class OrderStatus(str, Enum):
    PENDING = "pending"
    SUBMITTED = "submitted"
    PARTIAL = "partial_filled"
    FILLED = "filled"
    CANCELLED = "cancelled"
    REJECTED = "rejected"


class OrderManager:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def generate_orders(
        self,
        run_id: str,
        trade_date: date,
        signals: list[dict],
        capital: float,
    ) -> list[PaperOrder]:
        current_positions = await self._get_positions(run_id)
        pos_map = {p.stock_code: p for p in current_positions}

        orders = []
        target_stocks = {s["stock_code"] for s in signals}

        for code in set(list(pos_map.keys()) + list(target_stocks)):
            pos = pos_map.get(code)
            current_shares = pos.shares if pos else 0

            if code in target_stocks:
                s = next(x for x in signals if x["stock_code"] == code)
                target_value = capital * s["target_weight"]
                price = s["close"]
                target_shares = int(target_value / price / 100) * 100 if price > 0 else 0

                diff = target_shares - current_shares
                if diff == 0:
                    continue

                order = PaperOrder(
                    run_id=run_id, trade_date=trade_date, stock_code=code,
                    direction="buy" if diff > 0 else "sell",
                    signal_price=price,
                    order_shares=abs(diff),
                    status=OrderStatus.PENDING.value,
                    created_at=datetime.now(),
                )
                orders.append(order)
            else:
                if current_shares > 0:
                    order = PaperOrder(
                        run_id=run_id, trade_date=trade_date, stock_code=code,
                        direction="sell", signal_price=0,
                        order_shares=current_shares,
                        status=OrderStatus.PENDING.value,
                        created_at=datetime.now(),
                    )
                    orders.append(order)

        return orders

    async def simulate_fill(self, order: PaperOrder) -> PaperOrder:
        """Simulate order fill using actual market data."""
        # Query actual market data for the trade date
        result = await self.db.execute(
            select(DailyQuote).where(
                DailyQuote.stock_code == order.stock_code,
                DailyQuote.trade_date == order.trade_date,
            )
        )
        dq = result.scalar_one_or_none()

        if dq is None:
            order.status = OrderStatus.REJECTED.value
            order.reject_reason = "No market data"
            return order

        close = dq.close or 0
        pre_close = dq.pre_close or close
        volume = dq.volume or 0

        # Check limit up / limit down
        if pre_close > 0:
            limit_up = close >= pre_close * 1.095
            limit_down = close <= pre_close * 0.905
        else:
            limit_up = False
            limit_down = False

        if order.direction == "buy" and limit_up:
            order.status = OrderStatus.REJECTED.value
            order.reject_reason = "Limit up, cannot buy"
            return order

        if order.direction == "sell" and limit_down:
            order.status = OrderStatus.REJECTED.value
            order.reject_reason = "Limit down, cannot sell"
            return order

        # Fill price = closing price (simulate end-of-day execution)
        order.fill_price = close

        # Fill shares = min(order_shares, daily_volume * 1%), rounded down to 100-share lots
        if volume > 0:
            max_fill = int(volume * 0.01 / 100) * 100
            fill_shares = min(order.order_shares, max_fill)
        else:
            max_fill = 0
            fill_shares = 0
        fill_shares = (fill_shares // 100) * 100

        if fill_shares <= 0:
            order.status = OrderStatus.CANCELLED.value
            order.reject_reason = "Insufficient liquidity"
            return order

        order.fill_shares = fill_shares
        order.status = OrderStatus.FILLED.value
        order.filled_at = datetime.now()
        return order

    async def apply_fills(self, run_id: str, orders: list[PaperOrder]) -> list[PaperPosition]:
        for order in orders:
            self.db.add(order)

        current_positions = await self._get_positions(run_id)
        pos_map = {p.stock_code: p for p in current_positions}

        for order in orders:
            if order.status != OrderStatus.FILLED.value:
                continue

            code = order.stock_code
            if code in pos_map:
                pos = pos_map[code]
                if order.direction == "buy":
                    total_cost = pos.shares * pos.avg_cost + order.fill_shares * order.fill_price
                    pos.shares += order.fill_shares
                    pos.avg_cost = total_cost / pos.shares if pos.shares > 0 else 0
                else:
                    new_shares = pos.shares - order.fill_shares
                    if new_shares <= 0:
                        await self.db.delete(pos)
                        del pos_map[code]
                        continue
                    pos.shares = new_shares
                pos.updated_at = datetime.now()
            elif order.direction == "buy":
                pos = PaperPosition(
                    run_id=run_id, stock_code=code,
                    shares=order.fill_shares, avg_cost=order.fill_price,
                    market_value=order.fill_shares * order.fill_price,
                    weight=0, unrealized_pnl=0,
                    updated_at=datetime.now(),
                )
                self.db.add(pos)
                pos_map[code] = pos

        return list(pos_map.values())

    async def _get_positions(self, run_id: str) -> list[PaperPosition]:
        result = await self.db.execute(
            select(PaperPosition).where(PaperPosition.run_id == run_id)
        )
        return result.scalars().all()
