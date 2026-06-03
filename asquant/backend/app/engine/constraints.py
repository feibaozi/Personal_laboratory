import pandas as pd
import numpy as np


LIMIT_UP_RATE = 0.10
LIMIT_DOWN_RATE = -0.10
GEM_LIMIT_RATE = 0.20
GEM_LIMIT_DOWN_RATE = -0.20
MIN_SHARES = 100

COMMISSION_RATE = 0.00025
STAMP_TAX_RATE = 0.0005
TRANSFER_FEE_RATE = 0.00001
MIN_COMMISSION = 5.0

BASE_SLIPPAGE = 0.001
MAX_POSITION_WEIGHT = 0.20
MAX_INDUSTRY_WEIGHT = 0.30


def is_limit_up(code: str, close_px: float, pre_close: float) -> bool:
    if not pre_close or pre_close <= 0:
        return False
    change = (close_px - pre_close) / pre_close
    if code.startswith("300") or code.startswith("688"):
        return change >= GEM_LIMIT_RATE - 0.001
    if code.startswith("4") or code.startswith("8"):
        return change >= 0.30 - 0.001
    return change >= LIMIT_UP_RATE - 0.001


def is_limit_down(code: str, close_px: float, pre_close: float) -> bool:
    if not pre_close or pre_close <= 0:
        return False
    change = (close_px - pre_close) / pre_close
    if code.startswith("300") or code.startswith("688"):
        return change <= GEM_LIMIT_DOWN_RATE + 0.001
    if code.startswith("4") or code.startswith("8"):
        return change <= -0.30 + 0.001
    return change <= LIMIT_DOWN_RATE + 0.001


def is_suspended(volume: float) -> bool:
    return volume is None or volume <= 0


def compute_buy_cost(trade_amount: float) -> float:
    commission = max(trade_amount * COMMISSION_RATE, MIN_COMMISSION)
    transfer = trade_amount * TRANSFER_FEE_RATE
    return commission + transfer


def compute_sell_cost(trade_amount: float) -> float:
    commission = max(trade_amount * COMMISSION_RATE, MIN_COMMISSION)
    stamp = trade_amount * STAMP_TAX_RATE
    transfer = trade_amount * TRANSFER_FEE_RATE
    return commission + stamp + transfer


def dynamic_slippage(
    trade_amount: float,
    daily_amount: float,
    base_slippage: float = BASE_SLIPPAGE,
) -> float:
    if daily_amount <= 0:
        return base_slippage
    impact_ratio = trade_amount / daily_amount
    if impact_ratio < 0.01:
        return base_slippage
    elif impact_ratio < 0.05:
        return base_slippage * 2
    elif impact_ratio < 0.10:
        return base_slippage * 5
    else:
        return base_slippage * 10


def apply_position_constraints(
    weights: np.ndarray,
    max_single: float = MAX_POSITION_WEIGHT,
) -> np.ndarray:
    w = np.clip(weights, 0, max_single)
    total = w.sum()
    if total > 0:
        w = w / total
    else:
        w = np.ones_like(weights) / len(weights)
    return w


def round_shares(target_shares: float) -> int:
    lots = target_shares / MIN_SHARES
    int_lots = int(lots)
    return int_lots * MIN_SHARES


def get_limit_constraints(quote_df: pd.DataFrame, codes: list[str]) -> dict[str, dict]:
    constraints = {}
    for code in codes:
        row = quote_df[quote_df["code"] == code]
        if row.empty:
            constraints[code] = {"can_buy": False, "can_sell": True, "suspended": True}
            continue
        r = row.iloc[0]
        pre_close = r.get("pre_close", 0)
        close_px = r.get("close", 0)
        vol = r.get("volume", 0)

        suspended = is_suspended(vol)

        constraints[code] = {
            "can_buy": not is_limit_up(code, close_px, pre_close) and not suspended,
            "can_sell": not is_limit_down(code, close_px, pre_close) and not suspended,
            "suspended": suspended,
            "close": close_px,
            "pre_close": pre_close,
            "daily_amount": r.get("amount", 0) or 0,
        }
    return constraints


MIN_DAILY_AMOUNT = 5_000_000
MIN_MARKET_CAP = 2_000_000_000
MAX_POSITION_RATIO = 0.05


def apply_liquidity_filter(
    codes: list[str],
    quote_df: pd.DataFrame,
    constraints_map: dict[str, dict],
    min_daily_amount: float = MIN_DAILY_AMOUNT,
    min_market_cap: float = 0,
) -> list[str]:
    filtered = []
    for code in codes:
        info = constraints_map.get(code, {})
        if info.get("suspended", False):
            continue
        daily_amount = info.get("daily_amount", 0)
        if daily_amount < min_daily_amount:
            continue
        filtered.append(code)
    return filtered