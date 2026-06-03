import numpy as np
import pandas as pd

from .portfolio_constructor import risk_parity_weights


class PositionSizer:
    def size(
        self,
        method: str,
        base_weights: np.ndarray,
        ret_mat: pd.DataFrame | None = None,
        market_caps: np.ndarray | None = None,
    ) -> np.ndarray:
        if method == "equal":
            return self._equal(base_weights)
        elif method == "risk_parity":
            return self._risk_parity(base_weights, ret_mat)
        elif method == "mean_variance":
            return base_weights
        elif method == "kelly":
            return self._kelly(base_weights, ret_mat)
        elif method == "volatility_parity":
            return self._volatility_parity(base_weights, ret_mat)
        elif method == "market_cap":
            return self._market_cap(base_weights, market_caps)
        return base_weights

    def _equal(self, base_weights: np.ndarray) -> np.ndarray:
        n = len(base_weights)
        return np.ones(n) / n

    def _risk_parity(self, base_weights: np.ndarray, ret_mat: pd.DataFrame | None) -> np.ndarray:
        # P7.3.1: Delegate to portfolio_constructor.risk_parity_weights
        if ret_mat is None or ret_mat.empty or ret_mat.shape[1] < 2:
            return base_weights
        return risk_parity_weights(ret_mat)

    def _kelly(self, base_weights: np.ndarray, ret_mat: pd.DataFrame | None) -> np.ndarray:
        if ret_mat is None or ret_mat.empty or ret_mat.shape[1] < 2:
            return base_weights
        mu = ret_mat.mean().values * 252
        var = ret_mat.var().values * 252
        kelly = np.where(var > 0, mu / var, 0)
        kelly = np.clip(kelly, 0, 0.25)
        total = kelly.sum()
        if total > 0:
            kelly = kelly / total
        else:
            kelly = np.ones(len(base_weights)) / len(base_weights)
        return kelly

    def _volatility_parity(self, base_weights: np.ndarray, ret_mat: pd.DataFrame | None) -> np.ndarray:
        if ret_mat is None or ret_mat.empty or ret_mat.shape[1] < 2:
            return base_weights
        vols = ret_mat.std().values
        if np.sum(vols) == 0:
            return base_weights
        inv_vols = np.where(vols > 0, 1.0 / vols, 0)
        total = inv_vols.sum()
        if total > 0:
            return inv_vols / total
        return base_weights

    def _market_cap(self, base_weights: np.ndarray, market_caps: np.ndarray | None) -> np.ndarray:
        if market_caps is None or len(market_caps) != len(base_weights):
            return base_weights
        total = market_caps.sum()
        if total <= 0:
            return base_weights
        return market_caps / total
