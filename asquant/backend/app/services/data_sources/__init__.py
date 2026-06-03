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

    async def fetch_weekly_quotes(self, code: str, start: date, end: date) -> pd.DataFrame | None:
        return None

    async def fetch_monthly_quotes(self, code: str, start: date, end: date) -> pd.DataFrame | None:
        return None

    async def fetch_minute_quotes(self, code: str, start: date, end: date, freq: str = "5") -> pd.DataFrame | None:
        return None

    async def fetch_index_weekly(self, code: str, start: date, end: date) -> pd.DataFrame | None:
        return None

    async def fetch_index_monthly(self, code: str, start: date, end: date) -> pd.DataFrame | None:
        return None

    async def fetch_sector_data(self) -> pd.DataFrame | None:
        return None

    async def fetch_north_bound(self, start: date, end: date) -> pd.DataFrame | None:
        return None

    async def fetch_income_statement(self, code: str, **kwargs) -> pd.DataFrame | None:
        return None

    async def fetch_balance_sheet(self, code: str, **kwargs) -> pd.DataFrame | None:
        return None

    async def fetch_cash_flow(self, code: str, **kwargs) -> pd.DataFrame | None:
        return None

    async def fetch_growth_data(self, code: str, **kwargs) -> pd.DataFrame | None:
        return None

    async def fetch_stock_basic_info(self) -> pd.DataFrame | None:
        return None

    async def fetch_dividend_history(self, code: str, **kwargs) -> pd.DataFrame | None:
        return None

    async def fetch_trading_calendar(self, start: date, end: date) -> pd.DataFrame | None:
        return None

    async def fetch_industry_classification(self) -> pd.DataFrame | None:
        return None