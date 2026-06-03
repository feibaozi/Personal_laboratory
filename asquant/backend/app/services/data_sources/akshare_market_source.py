import logging
from datetime import date, timedelta
import pandas as pd

logger = logging.getLogger(__name__)


class AkShareMarketSource:
    name = "akshare_market"

    @staticmethod
    def _find_col(df, keyword, exclude=None):
        for col in df.columns:
            col_str = str(col)
            if keyword in col_str:
                if exclude and exclude in col_str:
                    continue
                return col
        return None

    async def fetch_margin_details(self, stock_code: str, start_date: date, end_date: date) -> pd.DataFrame:
        try:
            import akshare as ak
            all_dfs = []
            current = start_date
            while current <= end_date:
                if current.weekday() >= 5:
                    current += timedelta(days=1)
                    continue
                try:
                    if stock_code.startswith(("6", "9")):
                        df = ak.stock_margin_detail_sse(date=current.strftime("%Y%m%d"))
                    else:
                        df = ak.stock_margin_detail_szse(date=current.strftime("%Y%m%d"))
                    if df is None or df.empty:
                        current += timedelta(days=1)
                        continue
                    code_col = self._find_col(df, "证券代码")
                    if code_col:
                        df = df[df[code_col].astype(str).str.zfill(6) == stock_code]
                    if not df.empty:
                        df = df.copy()
                        df["_trade_date"] = current
                        all_dfs.append(df)
                except Exception:
                    pass
                current += timedelta(days=1)
            if not all_dfs:
                return pd.DataFrame()
            combined = pd.concat(all_dfs, ignore_index=True)
            result = pd.DataFrame()
            result["trade_date"] = combined["_trade_date"]
            result["stock_code"] = stock_code
            col_mappings = [
                ("margin_buy", "融资买入额", None),
                ("margin_sell", "融资偿还额", None),
                ("margin_balance", "融资余额", "融资融券"),
                ("short_sell_volume", "融券卖出量", None),
                ("short_buy_volume", "融券偿还量", None),
                ("short_balance", "融券余额", "融资融券"),
                ("total_balance", "融资融券余额", None),
            ]
            for field, keyword, exclude in col_mappings:
                col = self._find_col(combined, keyword, exclude)
                if col:
                    result[field] = pd.to_numeric(combined[col], errors="coerce")
                else:
                    result[field] = None
            return result
        except Exception as e:
            logger.error(f"AkShare margin detail {stock_code}: {e}")
            return pd.DataFrame()

    async def fetch_north_bound_flow(self, start_date: date, end_date: date) -> pd.DataFrame:
        try:
            import akshare as ak
            dfs = {}
            for symbol, key in [("沪股通", "sh"), ("深股通", "sz"), ("北上", "total")]:
                try:
                    df = ak.stock_hsgt_north_net_flow_in_em(symbol=symbol)
                    if df is None or df.empty:
                        continue
                    date_col = self._find_col(df, "日期") or self._find_col(df, "date")
                    value_col = self._find_col(df, "净流入") or self._find_col(df, "value")
                    if date_col is None or value_col is None:
                        continue
                    df = df.copy()
                    df["_date"] = pd.to_datetime(df[date_col])
                    df = df[(df["_date"].dt.date >= start_date) & (df["_date"].dt.date <= end_date)]
                    dfs[key] = df[["_date", value_col]].rename(columns={value_col: f"net_flow_{key}"})
                except Exception:
                    continue
            if not dfs:
                return pd.DataFrame()
            result = None
            for key in ["sh", "sz", "total"]:
                if key in dfs:
                    if result is None:
                        result = dfs[key]
                    else:
                        result = result.merge(dfs[key], on="_date", how="outer")
            if result is None or result.empty:
                return pd.DataFrame()
            result = result.sort_values("_date").reset_index(drop=True)
            final = pd.DataFrame()
            final["trade_date"] = result["_date"].dt.date
            for col in ["net_flow_sh", "net_flow_sz", "net_flow_total"]:
                if col in result.columns:
                    final[col] = pd.to_numeric(result[col], errors="coerce")
                else:
                    final[col] = None
            final["balance_sh"] = None
            final["balance_sz"] = None
            final["balance_total"] = None
            return final
        except Exception as e:
            logger.error(f"AkShare north bound flow: {e}")
            return pd.DataFrame()

    async def fetch_sector_flow(self, start_date: date, end_date: date) -> pd.DataFrame:
        try:
            import akshare as ak
            df = ak.stock_sector_fund_flow_rank(indicator="今日", sector_type="行业资金流")
            if df is None or df.empty:
                return pd.DataFrame()
            df.columns = [c.replace("今日", "").replace("5日", "").replace("10日", "") for c in df.columns]
            result = pd.DataFrame()
            result["trade_date"] = date.today()
            name_col = self._find_col(df, "名称")
            result["sector_name"] = df[name_col] if name_col else None
            result["sector_code"] = None
            flow_col = self._find_col(df, "主力净流入-净额")
            result["net_flow"] = pd.to_numeric(df[flow_col], errors="coerce") if flow_col else None
            big_col = self._find_col(df, "超大单净流入-净额")
            large_col = self._find_col(df, "大单净流入-净额")
            if big_col and large_col:
                big_flow = pd.to_numeric(df[big_col], errors="coerce").fillna(0) + pd.to_numeric(df[large_col], errors="coerce").fillna(0)
                result["buy_amount"] = big_flow.where(big_flow > 0, 0)
                result["sell_amount"] = (-big_flow).where(big_flow < 0, 0)
            else:
                result["buy_amount"] = None
                result["sell_amount"] = None
            return result
        except Exception as e:
            logger.error(f"AkShare sector flow: {e}")
            return pd.DataFrame()
