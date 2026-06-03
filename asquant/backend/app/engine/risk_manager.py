import numpy as np


class RiskManager:
    def __init__(self, config: dict | None = None):
        cfg = config or {}
        self.max_drawdown_limit = float(cfg.get("max_drawdown_limit", 0.0))
        self.daily_loss_limit = float(cfg.get("daily_loss_limit", 0.0))
        self.volatility_target = float(cfg.get("volatility_target", 0.0))
        self.peak_value = 0.0
        self._circuit_breaker = False
        self._initialized = False

    def check(
        self,
        portfolio_value: float,
        daily_return: float,
        daily_returns: list[float],
        initial_capital: float,
    ) -> dict:
        # Initialize peak to initial capital on first call
        if not self._initialized:
            self.peak_value = max(portfolio_value, initial_capital)
            self._initialized = True

        if portfolio_value > self.peak_value:
            self.peak_value = portfolio_value

        action: dict = {"reduce": False, "reduce_ratio": 0, "vol_scale": 1.0}

        if self._circuit_breaker:
            action["reduce"] = True
            action["reduce_ratio"] = 100
            return action

        if self.max_drawdown_limit > 0 and self.peak_value > 0:
            drawdown = (self.peak_value - portfolio_value) / self.peak_value
            if drawdown >= self.max_drawdown_limit:
                self._circuit_breaker = True
                action["reduce"] = True
                action["reduce_ratio"] = 100
                action["reason"] = "max_drawdown_circuit_breaker"
                return action

        if self.daily_loss_limit > 0 and daily_return < -self.daily_loss_limit:
            action["reduce"] = True
            action["reduce_ratio"] = 50
            action["reason"] = "daily_loss_limit"

        if self.volatility_target > 0 and len(daily_returns) >= 20:
            recent = daily_returns[-20:]
            vol = float(np.std(recent)) * np.sqrt(252)
            if vol > self.volatility_target:
                action["vol_scale"] = self.volatility_target / vol

        return action

    def reset(self):
        self.peak_value = 0.0
        self._circuit_breaker = False
        self._initialized = False
