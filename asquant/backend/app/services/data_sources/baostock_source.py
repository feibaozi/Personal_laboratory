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

    def _to_bs_code(self, code: str) -> str:
        if code.startswith(("6", "9")):
            return f"sh.{code}"
        if code.startswith(("4", "8")):
            return f"bj.{code}"
        return f"sz.{code}"

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
            df["exchange"] = df["code"].apply(
                lambda x: "SH" if x.startswith(("6", "9")) else "SZ" if x.startswith(("0", "3")) else "BJ"
            )
            df["list_date"] = pd.to_datetime(df["ipodate"], errors="coerce").dt.date
            df["out_date"] = pd.to_datetime(df["outdate"], errors="coerce").dt.date
            return df[["code", "code_name", "exchange", "list_date", "out_date"]].rename(columns={"code_name": "name"})
        except Exception as e:
            logger.error(f"BaoStock stock_list error: {e}")
            return pd.DataFrame()

    async def fetch_daily_quotes(self, code: str, start: date, end: date) -> pd.DataFrame | None:
        try:
            self._login()
            import baostock as bs
            bs_code = self._to_bs_code(code)
            fields = "date,open,high,low,close,preclose,volume,amount,turn,pctChg,peTTM,pbMRQ"
            rs = bs.query_history_k_data_plus(
                bs_code, fields,
                start_date=start.strftime("%Y-%m-%d"),
                end_date=end.strftime("%Y-%m-%d"),
                frequency="d", adjustflag="2",
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

    async def fetch_weekly_quotes(self, code: str, start: date, end: date) -> pd.DataFrame | None:
        try:
            self._login()
            import baostock as bs
            bs_code = self._to_bs_code(code)
            fields = "date,open,high,low,close,volume,amount"
            rs = bs.query_history_k_data_plus(
                bs_code, fields,
                start_date=start.strftime("%Y-%m-%d"),
                end_date=end.strftime("%Y-%m-%d"),
                frequency="w", adjustflag="2",
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
            for col in ["open", "high", "low", "close", "volume", "amount"]:
                df[col] = pd.to_numeric(df[col], errors="coerce")
            return df
        except Exception as e:
            logger.error(f"BaoStock weekly {code}: {e}")
            return None

    async def fetch_monthly_quotes(self, code: str, start: date, end: date) -> pd.DataFrame | None:
        try:
            self._login()
            import baostock as bs
            bs_code = self._to_bs_code(code)
            fields = "date,open,high,low,close,volume,amount"
            rs = bs.query_history_k_data_plus(
                bs_code, fields,
                start_date=start.strftime("%Y-%m-%d"),
                end_date=end.strftime("%Y-%m-%d"),
                frequency="m", adjustflag="2",
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
            for col in ["open", "high", "low", "close", "volume", "amount"]:
                df[col] = pd.to_numeric(df[col], errors="coerce")
            return df
        except Exception as e:
            logger.error(f"BaoStock monthly {code}: {e}")
            return None

    async def fetch_minute_quotes(self, code: str, start: date, end: date, freq: str = "5") -> pd.DataFrame | None:
        try:
            self._login()
            import baostock as bs
            bs_code = self._to_bs_code(code)
            freq_map = {"1": "1", "5": "5", "15": "15", "30": "30", "60": "60"}
            bs_freq = freq_map.get(freq, "5")
            fields = "date,time,open,high,low,close,volume,amount"
            rs = bs.query_history_k_data_plus(
                bs_code, fields,
                start_date=start.strftime("%Y-%m-%d"),
                end_date=end.strftime("%Y-%m-%d"),
                frequency=bs_freq, adjustflag="2",
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
            df["trade_date"] = pd.to_datetime(df["date"]).dt.date
            df["trade_time"] = pd.to_datetime(df["date"] + " " + df["time"])
            for col in ["open", "high", "low", "close", "volume", "amount"]:
                df[col] = pd.to_numeric(df[col], errors="coerce")
            df["volume"] = df["volume"].fillna(0).astype(int)
            result = pd.DataFrame({
                "trade_time": df["trade_time"],
                "trade_date": df["trade_date"],
                "open": df["open"], "high": df["high"],
                "low": df["low"], "close": df["close"],
                "volume": df["volume"], "amount": df["amount"],
                "freq": freq,
            })
            return result
        except Exception as e:
            logger.error(f"BaoStock minute {code} freq={freq}: {e}")
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
                frequency="d", adjustflag="2",
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

    async def fetch_index_weekly(self, code: str, start: date, end: date) -> pd.DataFrame | None:
        try:
            self._login()
            import baostock as bs
            bs_code = f"sh.{code}" if code.startswith(("0", "6", "9")) else f"sz.{code}"
            fields = "date,open,high,low,close,volume,amount"
            rs = bs.query_history_k_data_plus(
                bs_code, fields,
                start_date=start.strftime("%Y-%m-%d"),
                end_date=end.strftime("%Y-%m-%d"),
                frequency="w", adjustflag="2",
            )
            rows = []
            while rs.next():
                rows.append(rs.get_row_data())
            if not rows:
                return None
            df = pd.DataFrame(rows, columns=rs.fields)
            df = df.replace("", np.nan)
            df["date"] = pd.to_datetime(df["date"]).dt.date
            for col in ["open", "high", "low", "close", "volume", "amount"]:
                df[col] = pd.to_numeric(df[col], errors="coerce")
            return df
        except Exception as e:
            logger.error(f"BaoStock index weekly {code}: {e}")
            return None

    async def fetch_index_monthly(self, code: str, start: date, end: date) -> pd.DataFrame | None:
        try:
            self._login()
            import baostock as bs
            bs_code = f"sh.{code}" if code.startswith(("0", "6", "9")) else f"sz.{code}"
            fields = "date,open,high,low,close,volume,amount"
            rs = bs.query_history_k_data_plus(
                bs_code, fields,
                start_date=start.strftime("%Y-%m-%d"),
                end_date=end.strftime("%Y-%m-%d"),
                frequency="m", adjustflag="2",
            )
            rows = []
            while rs.next():
                rows.append(rs.get_row_data())
            if not rows:
                return None
            df = pd.DataFrame(rows, columns=rs.fields)
            df = df.replace("", np.nan)
            df["date"] = pd.to_datetime(df["date"]).dt.date
            for col in ["open", "high", "low", "close", "volume", "amount"]:
                df[col] = pd.to_numeric(df[col], errors="coerce")
            return df
        except Exception as e:
            logger.error(f"BaoStock index monthly {code}: {e}")
            return None

    async def fetch_income_statement(self, code: str, year: int = 0, quarter: int = 0) -> pd.DataFrame | None:
        try:
            self._login()
            import baostock as bs
            bs_code = self._to_bs_code(code)
            if year > 0 and quarter > 0:
                rs = bs.query_profit_data(code=bs_code, year=year, quarter=quarter)
            else:
                all_rows = []
                cur_year = date.today().year
                for y in range(cur_year, cur_year - 5, -1):
                    for q in range(4, 0, -1):
                        try:
                            rs = bs.query_profit_data(code=bs_code, year=y, quarter=q)
                            while rs.next():
                                all_rows.append(rs.get_row_data())
                        except Exception:
                            pass
                if not all_rows:
                    return None
                df = pd.DataFrame(all_rows, columns=rs.fields)
                df = df.replace("", np.nan)
                df["report_date"] = pd.to_datetime(
                    df["statDate"].astype(str), errors="coerce"
                ).dt.date
                df["public_date"] = pd.to_datetime(
                    df["pubDate"].astype(str), errors="coerce"
                ).dt.date
                df["report_type"] = "quarterly"
                for col in ["roeAvg", "npMargin", "gpMargin", "netProfit", "epsTTM",
                            "MBRevenue", "totalShare", "liqaShare"]:
                    if col in df.columns:
                        df[col] = pd.to_numeric(df[col], errors="coerce")
                result = pd.DataFrame()
                result["report_date"] = df["report_date"]
                result["public_date"] = df["public_date"]
                result["report_type"] = df["report_type"]
                result["revenue"] = df.get("MBRevenue")
                result["net_profit_parent"] = df.get("netProfit")
                result["roe"] = df.get("roeAvg")
                result["net_margin"] = df.get("npMargin")
                result["gross_margin"] = df.get("gpMargin")
                result["eps_ttm"] = df.get("epsTTM")
                result["total_shares"] = df.get("totalShare")
                result["float_shares"] = df.get("liqaShare")
                return result.dropna(subset=["report_date"])
            rows = []
            while rs.next():
                rows.append(rs.get_row_data())
            if not rows:
                return None
            df = pd.DataFrame(rows, columns=rs.fields)
            df = df.replace("", np.nan)
            df["report_date"] = pd.to_datetime(df["statDate"].astype(str), errors="coerce").dt.date
            df["public_date"] = pd.to_datetime(
                df["pubDate"].astype(str), errors="coerce"
            ).dt.date
            df["report_type"] = "quarterly"
            for col in ["roeAvg", "npMargin", "gpMargin", "netProfit", "epsTTM", "MBRevenue", "totalShare", "liqaShare"]:
                if col in df.columns:
                    df[col] = pd.to_numeric(df[col], errors="coerce")
            result = pd.DataFrame()
            result["report_date"] = df["report_date"]
            result["public_date"] = df["public_date"]
            result["report_type"] = df["report_type"]
            result["revenue"] = df.get("MBRevenue")
            result["net_profit_parent"] = df.get("netProfit")
            result["roe"] = df.get("roeAvg")
            result["net_margin"] = df.get("npMargin")
            result["gross_margin"] = df.get("gpMargin")
            result["eps_ttm"] = df.get("epsTTM")
            result["total_shares"] = df.get("totalShare")
            result["float_shares"] = df.get("liqaShare")
            return result.dropna(subset=["report_date"])
        except Exception as e:
            logger.error(f"BaoStock income {code}: {e}")
            return None

    async def fetch_balance_sheet(self, code: str, year: int = 0, quarter: int = 0) -> pd.DataFrame | None:
        try:
            self._login()
            import baostock as bs
            bs_code = self._to_bs_code(code)
            all_rows = []
            if year > 0 and quarter > 0:
                rs = bs.query_balance_data(code=bs_code, year=year, quarter=quarter)
                while rs.next():
                    all_rows.append(rs.get_row_data())
            else:
                cur_year = date.today().year
                for y in range(cur_year, cur_year - 5, -1):
                    for q in range(4, 0, -1):
                        try:
                            rs = bs.query_balance_data(code=bs_code, year=y, quarter=q)
                            while rs.next():
                                all_rows.append(rs.get_row_data())
                        except Exception:
                            pass
            if not all_rows:
                return None
            df = pd.DataFrame(all_rows, columns=rs.fields)
            df = df.replace("", np.nan)
            df["report_date"] = pd.to_datetime(df["statDate"].astype(str), errors="coerce").dt.date
            df["public_date"] = pd.to_datetime(df["pubDate"].astype(str), errors="coerce").dt.date
            df["report_type"] = "quarterly"
            for col in ["currentRatio", "quickRatio", "cashRatio",
                        "YOYLiability", "liabilityToAsset", "assetToEquity"]:
                if col in df.columns:
                    df[col] = pd.to_numeric(df[col], errors="coerce")
            result = pd.DataFrame()
            result["report_date"] = df["report_date"]
            result["public_date"] = df["public_date"]
            result["report_type"] = df["report_type"]
            result["current_ratio"] = df.get("currentRatio")
            result["quick_ratio"] = df.get("quickRatio")
            result["yoy_liability_growth"] = df.get("YOYLiability")
            result["liability_to_asset"] = df.get("liabilityToAsset")
            result["asset_to_equity"] = df.get("assetToEquity")
            return result.dropna(subset=["report_date"])
        except Exception as e:
            logger.error(f"BaoStock balance {code}: {e}")
            return None

    async def fetch_cash_flow(self, code: str, year: int = 0, quarter: int = 0) -> pd.DataFrame | None:
        try:
            self._login()
            import baostock as bs
            bs_code = self._to_bs_code(code)
            all_rows = []
            if year > 0 and quarter > 0:
                rs = bs.query_cash_flow_data(code=bs_code, year=year, quarter=quarter)
                while rs.next():
                    all_rows.append(rs.get_row_data())
            else:
                cur_year = date.today().year
                for y in range(cur_year, cur_year - 5, -1):
                    for q in range(4, 0, -1):
                        try:
                            rs = bs.query_cash_flow_data(code=bs_code, year=y, quarter=q)
                            while rs.next():
                                all_rows.append(rs.get_row_data())
                        except Exception:
                            pass
            if not all_rows:
                return None
            df = pd.DataFrame(all_rows, columns=rs.fields)
            df = df.replace("", np.nan)
            df["report_date"] = pd.to_datetime(df["statDate"].astype(str), errors="coerce").dt.date
            df["public_date"] = pd.to_datetime(df["pubDate"].astype(str), errors="coerce").dt.date
            df["report_type"] = "quarterly"
            for col in ["CAToAsset", "NCAToAsset", "tangibleAssetToAsset",
                        "ebitToInterest", "CFOToOR", "CFOToNP", "CFOToGr"]:
                if col in df.columns:
                    df[col] = pd.to_numeric(df[col], errors="coerce")
            result = pd.DataFrame()
            result["report_date"] = df["report_date"]
            result["public_date"] = df["public_date"]
            result["report_type"] = df["report_type"]
            result["operating_cash_to_revenue"] = df.get("CFOToOR")
            result["operating_cash_to_profit"] = df.get("CFOToNP")
            result["operating_cash_to_growth"] = df.get("CFOToGr")
            return result.dropna(subset=["report_date"])
        except Exception as e:
            logger.error(f"BaoStock cashflow {code}: {e}")
            return None

    async def fetch_growth_data(self, code: str, year: int = 0, quarter: int = 0) -> pd.DataFrame | None:
        try:
            self._login()
            import baostock as bs
            bs_code = self._to_bs_code(code)
            all_rows = []
            if year > 0 and quarter > 0:
                rs = bs.query_growth_data(code=bs_code, year=year, quarter=quarter)
                while rs.next():
                    all_rows.append(rs.get_row_data())
            else:
                cur_year = date.today().year
                for y in range(cur_year, cur_year - 5, -1):
                    for q in range(4, 0, -1):
                        try:
                            rs = bs.query_growth_data(code=bs_code, year=y, quarter=q)
                            while rs.next():
                                all_rows.append(rs.get_row_data())
                        except Exception:
                            pass
            if not all_rows:
                return None
            df = pd.DataFrame(all_rows, columns=rs.fields)
            df = df.replace("", np.nan)
            df["report_date"] = pd.to_datetime(df["statDate"].astype(str), errors="coerce").dt.date
            df["public_date"] = pd.to_datetime(df["pubDate"].astype(str), errors="coerce").dt.date
            df["report_type"] = "quarterly"
            for col in ["YOYEquity", "YOYAsset", "YOYNI", "YOYEPSBasic", "YOYPNI"]:
                if col in df.columns:
                    df[col] = pd.to_numeric(df[col], errors="coerce")
            result = pd.DataFrame()
            result["report_date"] = df["report_date"]
            result["public_date"] = df["public_date"]
            result["report_type"] = df["report_type"]
            result["yoy_equity_growth"] = df.get("YOYEquity")
            result["yoy_asset_growth"] = df.get("YOYAsset")
            result["yoy_net_profit_growth"] = df.get("YOYNI")
            result["yoy_eps_growth"] = df.get("YOYEPSBasic")
            result["yoy_parent_net_profit_growth"] = df.get("YOYPNI")
            return result.dropna(subset=["report_date"])
        except Exception as e:
            logger.error(f"BaoStock growth {code}: {e}")
            return None

    async def fetch_stock_basic_info(self) -> pd.DataFrame | None:
        try:
            self._login()
            import baostock as bs
            rs = bs.query_stock_basic()
            rows = []
            while rs.next():
                rows.append(rs.get_row_data())
            if not rows:
                return None
            df = pd.DataFrame(rows, columns=rs.fields)
            df.columns = [c.lower() for c in df.columns]
            df["code"] = df["code"].str.replace("sh.", "").str.replace("sz.", "").str.replace("bj.", "")
            result = pd.DataFrame()
            result["code"] = df["code"]
            result["name"] = df.get("code_name", "")
            result["exchange"] = df["code"].apply(
                lambda x: "SH" if x.startswith(("6", "9")) else "SZ" if x.startswith(("0", "3")) else "BJ"
            )
            result["list_date"] = pd.to_datetime(df.get("ipodate"), errors="coerce").dt.date
            result["out_date"] = pd.to_datetime(df.get("outdate"), errors="coerce").dt.date
            result["type"] = df.get("type", "")
            result["status"] = df.get("status", "")
            return result
        except Exception as e:
            logger.error(f"BaoStock stock_info: {e}")
            return None

    async def fetch_dividend_history(self, code: str, year: str = "", year_type: str = "report") -> pd.DataFrame | None:
        try:
            self._login()
            import baostock as bs
            bs_code = self._to_bs_code(code)
            rs = bs.query_dividend_data(code=bs_code, year=year, yearType=year_type)
            rows = []
            while rs.next():
                rows.append(rs.get_row_data())
            if not rows:
                return None
            df = pd.DataFrame(rows, columns=rs.fields)
            df = df.replace("", np.nan)
            for col in ["cashPay", "eps", "perCashDiv", "perShareDiv", "perShareTrans"]:
                if col in df.columns:
                    df[col] = pd.to_numeric(df[col], errors="coerce")
            result = pd.DataFrame()
            result["report_year"] = df.get("year", "")
            result["dividend_type"] = df.get("divType", "")
            result["per_cash_div"] = df.get("perCashDiv")
            result["per_share_div"] = df.get("perShareDiv")
            result["per_share_trans"] = df.get("perShareTrans")
            result["cash_pay"] = df.get("cashPay")
            result["eps"] = df.get("eps")
            return result
        except Exception as e:
            logger.error(f"BaoStock dividend {code}: {e}")
            return None

    async def fetch_trading_calendar(self, start: date, end: date) -> pd.DataFrame | None:
        try:
            self._login()
            import baostock as bs
            rs = bs.query_trade_dates(
                start_date=start.strftime("%Y-%m-%d"),
                end_date=end.strftime("%Y-%m-%d"),
            )
            rows = []
            while rs.next():
                rows.append(rs.get_row_data())
            if not rows:
                return None
            df = pd.DataFrame(rows, columns=rs.fields)
            df["trade_date"] = pd.to_datetime(df["calendar_date"]).dt.date
            df["is_trading_day"] = df["is_trading_day"].astype(int)
            return df[["trade_date", "is_trading_day"]]
        except Exception as e:
            logger.error(f"BaoStock calendar: {e}")
            return None

    async def fetch_industry_classification(self) -> pd.DataFrame | None:
        try:
            self._login()
            import baostock as bs
            rs = bs.query_stock_industry()
            rows = []
            while rs.next():
                rows.append(rs.get_row_data())
            if not rows:
                return None
            df = pd.DataFrame(rows, columns=rs.fields)
            df["code"] = df["code"].str.replace("sh.", "").str.replace("sz.", "").str.replace("bj.", "")
            return df
        except Exception as e:
            logger.error(f"BaoStock industry: {e}")
            return None