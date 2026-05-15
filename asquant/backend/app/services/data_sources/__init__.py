"""Abstract base for data sources."""
from abc import ABC, abstractmethod
from datetime import date
import pandas as pd


class DataSource(ABC):
    name: str = "base"

    @abstractmethod
    async def fetch_stock_list(self) -> pd.DataFrame:
        """Return DataFrame with columns: code, name, exchange, list_date"""

    @abstractmethod
    async def fetch_daily_quotes(self, code: str, start: date, end: date) -> pd.DataFrame | None:
        """Return DataFrame with columns: date, open, high, low, close, pre_close,
        volume, amount, turnover, change_pct, pe_ratio, pb_ratio"""

    @abstractmethod
    async def fetch_index_daily(self, code: str, start: date, end: date) -> pd.DataFrame | None:
        """Return DataFrame with index OHLC data"""

    async def fetch_minute_quotes(self, code: str, start: date, end: date, freq: str = "5") -> pd.DataFrame | None:
        """Return DataFrame with minute bar data. Override in subclasses that support it."""
        return None
