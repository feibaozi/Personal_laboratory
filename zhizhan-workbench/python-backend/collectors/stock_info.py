import akshare as ak
import pandas as pd
from database.connection import sync_session
from database.models import Stock
from collectors.base import BaseCollector


class StockInfoCollector(BaseCollector):
    def __init__(self):
        super().__init__("StockInfo")

    async def collect(self, symbol: str = None):
        if symbol:
            return await self._collect_single(symbol)
        return await self._collect_all()

    async def _collect_all(self):
        self.log_info("Collecting all A-share stock list...")
        try:
            df = ak.stock_zh_a_spot_em()
            count = 0

            with sync_session() as session:
                for _, row in df.iterrows():
                    code = str(row.get("代码", ""))
                    name = str(row.get("名称", ""))

                    if not code or not name:
                        continue

                    existing = session.query(Stock).filter(Stock.code == code).first()
                    if existing:
                        existing.name = name
                    else:
                        market = "SH" if code.startswith("6") else "SZ"
                        stock = Stock(
                            code=code,
                            name=name,
                            market=market,
                            watch_status="closed",
                        )
                        session.add(stock)
                        count += 1

                session.commit()

            self.log_info(f"Collected {count} new stocks")
            return {"collected": count}

        except Exception as e:
            self.log_error(f"Failed to collect stock list: {e}")
            return {"error": str(e)}

    async def _collect_single(self, symbol: str):
        self.log_info(f"Searching stock: {symbol}")
        try:
            df = ak.stock_zh_a_spot_em()
            mask = df["代码"].astype(str).str.contains(symbol) | df["名称"].astype(
                str
            ).str.contains(symbol)
            results = df[mask].head(20)

            stocks = []
            for _, row in results.iterrows():
                code = str(row.get("代码", ""))
                name = str(row.get("名称", ""))
                market = "SH" if code.startswith("6") else "SZ"
                price = row.get("最新价", 0)
                change_pct = row.get("涨跌幅", 0)

                stocks.append(
                    {
                        "code": code,
                        "name": name,
                        "market": market,
                        "price": float(price) if pd.notna(price) else 0,
                        "change_pct": float(change_pct) if pd.notna(change_pct) else 0,
                    }
                )

            return stocks

        except Exception as e:
            self.log_error(f"Failed to search stock {symbol}: {e}")
            return []

    async def get_stock_detail(self, code: str):
        self.log_info(f"Getting detail for {code}")
        try:
            df = ak.stock_individual_info_em(symbol=code)
            info = {}
            for _, row in df.iterrows():
                key = str(row.get("item", ""))
                value = str(row.get("value", ""))
                info[key] = value

            return {
                "code": code,
                "name": info.get("股票简称", ""),
                "industry": info.get("行业", ""),
                "market": info.get("市场", ""),
                "list_date": info.get("上市时间", ""),
                "total_share": info.get("总市值", ""),
                "circulating_share": info.get("流通市值", ""),
            }

        except Exception as e:
            self.log_error(f"Failed to get detail for {code}: {e}")
            return None
