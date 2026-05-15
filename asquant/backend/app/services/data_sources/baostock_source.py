"""BaoStock data source implementation."""
import logging
from datetime import date
import pandas as pd
import numpy as np
from . import DataSource

logger = logging.getLogger(__name__)


class BaoStockSource(DataSource):
    name = "baostock"

    def __init__(self):
        self._logged_in = False

    def _login(self):
        if self._logged_in:
            return
        import baostock as bs
        lg = bs.login()
        if lg.error_code != "0":
            logger.warning(f"BaoStock login failed: {lg.error_msg}")
        else:
            self._logged_in = True

    def _logout(self):
        if not self._logged_in:
            return
        import baostock as bs
        bs.logout()
        self._logged_in = False

    async def fetch_stock_list(self) -> pd.DataFrame:
        try:
            self._login()
            import baostock as bs
            rs = bs.query_stock_basic()
            rows = []
            while rs.next():
                rows.append(rs.get_row_data())
            df = pd.DataFrame(rows, columns=rs.fields)
            if df.empty:
                return pd.DataFrame()
            df.columns = [c.lower() for c in df.columns]
            df["exchange"] = df["code"].apply(lambda x: "SH" if x.startswith(("6", "9")) else "SZ" if x.startswith(("0", "3")) else "BJ")
            df["list_date"] = pd.to_datetime(df["ipodate"], errors="coerce").dt.date
            return df[["code", "code_name", "exchange", "list_date"]].rename(columns={"code_name": "name"})
        except Exception as e:
            logger.error(f"BaoStock stock_list error: {e}")
            return pd.DataFrame()

    async def fetch_daily_quotes(self, code: str, start: date, end: date) -> pd.DataFrame | None:
        try:
            self._login()
            import baostock as bs
            # Ensure code format: sh.000001 or sz.000001
            if code.startswith(("6", "9")):
                bs_code = f"sh.{code}"
            else:
                bs_code = f"sz.{code}"

            fields = "date,open,high,low,close,preclose,volume,amount,turn,pctChg,peTTM,pbMRQ"
            rs = bs.query_history_k_data_plus(
                bs_code, fields,
                start_date=start.strftime("%Y-%m-%d"),
                end_date=end.strftime("%Y-%m-%d"),
                frequency="d", adjustflag="2"
            )
            rows = []
            while rs.next():
                rows.append(rs.get_row_data())
            if not rows:
                return None
            df = pd.DataFrame(rows, columns=rs.fields)
            if df.empty:
                return None
            df = df.replace("", np.nan)
            df["date"] = pd.to_datetime(df["date"]).dt.date
            for col in ["open", "high", "low", "close", "preclose", "volume", "amount", "turn", "pctChg", "peTTM", "pbMRQ"]:
                df[col] = pd.to_numeric(df[col], errors="coerce")
            df = df.rename(columns={
                "preclose": "pre_close", "turn": "turnover_rate",
                "pctChg": "change_pct", "peTTM": "pe_ratio", "pbMRQ": "pb_ratio",
            })
            return df
        except Exception as e:
            logger.error(f"BaoStock fetch {code}: {e}")
            return None

    async def fetch_index_daily(self, code: str, start: date, end: date) -> pd.DataFrame | None:
        try:
            self._login()
            import baostock as bs
            bs_code = f"sh.{code}" if code.startswith(("0", "6", "9")) else f"sz.{code}"
            fields = "date,open,high,low,close,preclose,volume,amount,pctChg"
            rs = bs.query_history_k_data_plus(
                bs_code, fields,
                start_date=start.strftime("%Y-%m-%d"),
                end_date=end.strftime("%Y-%m-%d"),
                frequency="d", adjustflag="2"
            )
            rows = []
            while rs.next():
                rows.append(rs.get_row_data())
            if not rows:
                return None
            df = pd.DataFrame(rows, columns=rs.fields)
            df = df.replace("", np.nan)
            df["date"] = pd.to_datetime(df["date"]).dt.date
            for col in ["open", "high", "low", "close", "preclose", "volume", "amount", "pctChg"]:
                df[col] = pd.to_numeric(df[col], errors="coerce")
            return df
        except Exception as e:
            logger.error(f"BaoStock index {code}: {e}")
            return None
