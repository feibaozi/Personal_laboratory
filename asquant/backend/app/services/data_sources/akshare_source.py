"""AkShare data source implementation."""
import logging
from datetime import date
import pandas as pd
from . import DataSource

logger = logging.getLogger(__name__)


class AkShareSource(DataSource):
    name = "akshare"

    def _to_sina_code(self, code: str) -> str:
        if code.startswith(("6", "9")):
            return f"sh{code}"
        if code.startswith(("4", "8")):
            return f"bj{code}"
        return f"sz{code}"

    async def fetch_stock_list(self) -> pd.DataFrame:
        import akshare as ak
        df = ak.stock_info_a_code_name()
        df["exchange"] = df["code"].apply(
            lambda x: "SH" if str(x).startswith(("6", "9")) else "SZ" if str(x).startswith(("0", "3")) else "BJ"
        )
        df["code"] = df["code"].apply(lambda x: str(x).zfill(6))
        df["list_date"] = None
        return df[["code", "name", "exchange", "list_date"]]

    async def fetch_daily_quotes(self, code: str, start: date, end: date) -> pd.DataFrame | None:
        import akshare as ak
        try:
            df = ak.stock_zh_a_hist(
                symbol=code, period="daily",
                start_date=start.strftime("%Y%m%d"),
                end_date=end.strftime("%Y%m%d"),
                adjust="qfq",
            )
            if df is None or df.empty:
                return None
            df["trade_date"] = pd.to_datetime(df["日期"]).dt.date
            return pd.DataFrame({
                "date": df["trade_date"],
                "open": pd.to_numeric(df["开盘"], errors="coerce"),
                "high": pd.to_numeric(df["最高"], errors="coerce"),
                "low": pd.to_numeric(df["最低"], errors="coerce"),
                "close": pd.to_numeric(df["收盘"], errors="coerce"),
                "pre_close": pd.to_numeric(df.get("昨收", 0), errors="coerce"),
                "volume": pd.to_numeric(df["成交量"], errors="coerce"),
                "amount": pd.to_numeric(df["成交额"], errors="coerce"),
                "turnover_rate": pd.to_numeric(df.get("换手率", 0), errors="coerce"),
                "change_pct": pd.to_numeric(df.get("涨跌幅", 0), errors="coerce"),
                "pe_ratio": pd.to_numeric(df.get("市盈率-动态", pd.NA), errors="coerce"),
                "pb_ratio": pd.to_numeric(df.get("市净率", pd.NA), errors="coerce"),
            })
        except Exception as e:
            logger.warning(f"AkShare fetch {code}: {e}")
            return None

    async def fetch_index_daily(self, code: str, start: date, end: date) -> pd.DataFrame | None:
        import akshare as ak
        try:
            sym = f"sh{code}" if code.startswith(("0", "6")) else f"sz{code}"
            df = ak.stock_zh_index_daily(symbol=sym)
            if df is None or df.empty:
                return None
            df["date"] = pd.to_datetime(df["date"]).dt.date
            sd, ed = date.fromisoformat(str(start)), date.fromisoformat(str(end))
            df = df[(df["date"] >= sd) & (df["date"] <= ed)]
            return df[["date", "open", "high", "low", "close", "volume", "amount"]]
        except Exception as e:
            logger.warning(f"AkShare index {code}: {e}")
            return None

    async def fetch_sector_data(self) -> pd.DataFrame | None:
        import akshare as ak
        try:
            return ak.stock_board_industry_summary_ths()
        except Exception:
            return None

    async def fetch_minute_quotes(self, code: str, start: date, end: date, freq: str = "5") -> pd.DataFrame | None:
        df = await self._fetch_minute_sina(code, start, end, freq)
        if df is not None and not df.empty:
            return df
        return await self._fetch_minute_eastmoney(code, start, end, freq)

    async def _fetch_minute_sina(self, code: str, start: date, end: date, freq: str = "5") -> pd.DataFrame | None:
        import akshare as ak
        import time as t
        sym = f"sh{code}" if code.startswith(("6", "9")) else f"sz{code}"
        for attempt in range(2):
            try:
                df = ak.stock_zh_a_minute(symbol=sym, period=freq, adjust="qfq")
                if df is None or df.empty:
                    return None
                df["trade_time"] = pd.to_datetime(df["day"])
                df["trade_date"] = df["trade_time"].dt.date
                sd_date = start if isinstance(start, date) else start
                ed_date = end if isinstance(end, date) else end
                df = df[(df["trade_date"] >= sd_date) & (df["trade_date"] <= ed_date)]
                if df.empty:
                    return None
                result = pd.DataFrame({
                    "trade_time": df["trade_time"],
                    "trade_date": df["trade_date"],
                    "open": pd.to_numeric(df["open"], errors="coerce"),
                    "high": pd.to_numeric(df["high"], errors="coerce"),
                    "low": pd.to_numeric(df["low"], errors="coerce"),
                    "close": pd.to_numeric(df["close"], errors="coerce"),
                    "volume": pd.to_numeric(df["volume"], errors="coerce").fillna(0).astype(int),
                    "amount": None,
                    "freq": freq,
                })
                return result
            except Exception as e:
                if attempt < 1:
                    t.sleep(2)
                else:
                    logger.warning(f"Sina minute {code} freq={freq}: {e}")
        return None

    async def _fetch_minute_eastmoney(self, code: str, start: date, end: date, freq: str = "5") -> pd.DataFrame | None:
        import akshare as ak
        import time as t
        sd_str = f"{start.strftime('%Y-%m-%d')} 09:30:00" if isinstance(start, date) else str(start)
        ed_str = f"{end.strftime('%Y-%m-%d')} 15:00:00" if isinstance(end, date) else str(end)
        for attempt in range(3):
            try:
                df = ak.stock_zh_a_hist_min_em(
                    symbol=code, period=freq, start_date=sd_str, end_date=ed_str, adjust="qfq",
                )
                if df is None or df.empty:
                    return None
                result = pd.DataFrame({
                    "trade_time": pd.to_datetime(df["时间"]),
                    "trade_date": pd.to_datetime(df["时间"]).dt.date,
                    "open": pd.to_numeric(df["开盘"], errors="coerce"),
                    "high": pd.to_numeric(df["最高"], errors="coerce"),
                    "low": pd.to_numeric(df["最低"], errors="coerce"),
                    "close": pd.to_numeric(df["收盘"], errors="coerce"),
                    "volume": pd.to_numeric(df["成交量"], errors="coerce").fillna(0).astype(int),
                    "amount": pd.to_numeric(df["成交额"], errors="coerce"),
                    "freq": freq,
                })
                return result
            except Exception as e:
                if attempt < 2:
                    t.sleep(3 * (attempt + 1))
                else:
                    logger.warning(f"EastMoney minute {code} freq={freq}: {e}")
        return None

    async def fetch_north_bound(self, start: date, end: date) -> pd.DataFrame | None:
        import akshare as ak
        try:
            return ak.stock_hsgt_north_net_flow_in_em(symbol="北上")
        except Exception:
            return None

    async def fetch_stock_basic_info(self) -> pd.DataFrame | None:
        import akshare as ak
        try:
            df = ak.stock_info_a_code_name()
            if df is None or df.empty:
                return None
            result = []
            for _, row in df.iterrows():
                code = str(row["code"]).zfill(6)
                try:
                    info = ak.stock_individual_info_em(symbol=code)
                    if info is not None and not info.empty:
                        info_dict = dict(zip(info["item"], info["value"]))
                        result.append({
                            "code": code,
                            "total_shares": info_dict.get("总股本"),
                            "float_shares": info_dict.get("流通股"),
                        })
                except Exception:
                    pass
                if len(result) >= 500:
                    break
            return pd.DataFrame(result) if result else None
        except Exception as e:
            logger.warning(f"AkShare stock info: {e}")
            return None

    async def fetch_income_statement(self, code: str) -> pd.DataFrame | None:
        df = await self._fetch_income_sina(code)
        if df is not None and not df.empty:
            return df
        return await self._fetch_income_em(code)

    async def _fetch_income_sina(self, code: str) -> pd.DataFrame | None:
        import akshare as ak
        try:
            sina_code = self._to_sina_code(code)
            df = ak.stock_financial_report_sina(stock=sina_code, symbol="利润表")
            if df is None or df.empty:
                return None
            result = pd.DataFrame()
            result["report_date"] = pd.to_datetime(df["报告日"], format="%Y%m%d", errors="coerce").dt.date
            result["report_type"] = "quarterly"
            result["revenue"] = pd.to_numeric(df.get("营业收入", 0), errors="coerce")
            result["operating_cost"] = pd.to_numeric(df.get("营业支出", 0), errors="coerce")
            result["operating_profit"] = pd.to_numeric(df.get("营业利润", 0), errors="coerce")
            result["net_profit"] = pd.to_numeric(df.get("净利润", 0), errors="coerce")
            result["net_profit_parent"] = pd.to_numeric(df.get("归属于母公司的净利润", 0), errors="coerce")
            result = result.dropna(subset=["report_date"])
            return result
        except Exception as e:
            logger.warning(f"AkShare income sina {code}: {e}")
            return None

    async def _fetch_income_em(self, code: str) -> pd.DataFrame | None:
        import akshare as ak
        try:
            df = ak.stock_profit_sheet_by_report_em(symbol=code)
            if df is None or df.empty:
                return None
            result = pd.DataFrame()
            result["report_date"] = pd.to_datetime(df["报告期"]).dt.date
            result["report_type"] = "quarterly"
            result["revenue"] = pd.to_numeric(df.get("营业总收入", 0), errors="coerce")
            result["operating_cost"] = pd.to_numeric(df.get("营业总成本", 0), errors="coerce")
            result["operating_profit"] = pd.to_numeric(df.get("营业利润", 0), errors="coerce")
            result["net_profit"] = pd.to_numeric(df.get("净利润", 0), errors="coerce")
            result["net_profit_parent"] = pd.to_numeric(df.get("归属于母公司所有者的净利润", 0), errors="coerce")
            return result
        except Exception as e:
            logger.warning(f"AkShare income em {code}: {e}")
            return None

    async def fetch_balance_sheet(self, code: str) -> pd.DataFrame | None:
        df = await self._fetch_balance_sina(code)
        if df is not None and not df.empty:
            return df
        return await self._fetch_balance_em(code)

    async def _fetch_balance_sina(self, code: str) -> pd.DataFrame | None:
        import akshare as ak
        try:
            sina_code = self._to_sina_code(code)
            df = ak.stock_financial_report_sina(stock=sina_code, symbol="资产负债表")
            if df is None or df.empty:
                return None
            result = pd.DataFrame()
            result["report_date"] = pd.to_datetime(df["报告日"], format="%Y%m%d", errors="coerce").dt.date
            result["report_type"] = "quarterly"
            result["total_assets"] = pd.to_numeric(df.get("资产总计", 0), errors="coerce")
            result["total_liabilities"] = pd.to_numeric(df.get("负债合计", 0), errors="coerce")
            result["total_equity"] = pd.to_numeric(df.get("归属于母公司股东的权益", 0), errors="coerce")
            result["current_assets"] = pd.to_numeric(df.get("流动资产合计", 0), errors="coerce")
            result["current_liabilities"] = pd.to_numeric(df.get("流动负债合计", 0), errors="coerce")
            result = result.dropna(subset=["report_date"])
            return result
        except Exception as e:
            logger.warning(f"AkShare balance sina {code}: {e}")
            return None

    async def _fetch_balance_em(self, code: str) -> pd.DataFrame | None:
        import akshare as ak
        try:
            df = ak.stock_balance_sheet_by_report_em(symbol=code)
            if df is None or df.empty:
                return None
            result = pd.DataFrame()
            result["report_date"] = pd.to_datetime(df["报告期"]).dt.date
            result["report_type"] = "quarterly"
            result["total_assets"] = pd.to_numeric(df.get("资产总计", 0), errors="coerce")
            result["total_liabilities"] = pd.to_numeric(df.get("负债合计", 0), errors="coerce")
            result["total_equity"] = pd.to_numeric(df.get("归属于母公司股东权益合计", 0), errors="coerce")
            result["current_assets"] = pd.to_numeric(df.get("流动资产合计", 0), errors="coerce")
            result["current_liabilities"] = pd.to_numeric(df.get("流动负债合计", 0), errors="coerce")
            return result
        except Exception as e:
            logger.warning(f"AkShare balance em {code}: {e}")
            return None

    async def fetch_cash_flow(self, code: str) -> pd.DataFrame | None:
        df = await self._fetch_cashflow_sina(code)
        if df is not None and not df.empty:
            return df
        return await self._fetch_cashflow_em(code)

    async def _fetch_cashflow_sina(self, code: str) -> pd.DataFrame | None:
        import akshare as ak
        try:
            sina_code = self._to_sina_code(code)
            df = ak.stock_financial_report_sina(stock=sina_code, symbol="现金流量表")
            if df is None or df.empty:
                return None
            result = pd.DataFrame()
            result["report_date"] = pd.to_datetime(df["报告日"], format="%Y%m%d", errors="coerce").dt.date
            result["report_type"] = "quarterly"
            result["operating_cash_flow"] = pd.to_numeric(df.get("经营活动产生的现金流量净额", 0), errors="coerce")
            result["investing_cash_flow"] = pd.to_numeric(df.get("投资活动产生的现金流量净额", 0), errors="coerce")
            result["financing_cash_flow"] = pd.to_numeric(df.get("筹资活动产生的现金流量净额", 0), errors="coerce")
            result = result.dropna(subset=["report_date"])
            return result
        except Exception as e:
            logger.warning(f"AkShare cashflow sina {code}: {e}")
            return None

    async def _fetch_cashflow_em(self, code: str) -> pd.DataFrame | None:
        import akshare as ak
        try:
            df = ak.stock_cash_flow_sheet_by_report_em(symbol=code)
            if df is None or df.empty:
                return None
            result = pd.DataFrame()
            result["report_date"] = pd.to_datetime(df["报告期"]).dt.date
            result["report_type"] = "quarterly"
            result["operating_cash_flow"] = pd.to_numeric(df.get("经营活动产生的现金流量净额", 0), errors="coerce")
            result["investing_cash_flow"] = pd.to_numeric(df.get("投资活动产生的现金流量净额", 0), errors="coerce")
            result["financing_cash_flow"] = pd.to_numeric(df.get("筹资活动产生的现金流量净额", 0), errors="coerce")
            return result
        except Exception as e:
            logger.warning(f"AkShare cashflow em {code}: {e}")
            return None

    async def fetch_dividend_history(self, code: str) -> pd.DataFrame | None:
        import akshare as ak
        try:
            df = ak.stock_history_dividend_detail(symbol=code, indicator="分红")
            if df is None or df.empty:
                return None
            result = pd.DataFrame()
            result["ex_date"] = pd.to_datetime(df.iloc[:, 0]).dt.date
            result["dividend_per_share"] = pd.to_numeric(df.iloc[:, 2], errors="coerce")
            return result.dropna(subset=["dividend_per_share"])
        except Exception as e:
            logger.warning(f"AkShare dividend {code}: {e}")
            return None
