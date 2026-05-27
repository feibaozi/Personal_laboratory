import akshare as ak
import pandas as pd
from datetime import datetime, timedelta
from database.connection import sync_session
from database.models import Stock, SentimentEvent
from collectors.base import BaseCollector


class NewsCollector(BaseCollector):
    def __init__(self):
        super().__init__("News")

    async def collect(self, stock_code: str = None, limit: int = 50):
        if stock_code:
            return await self._collect_stock_news(stock_code, limit)
        return await self._collect_market_news(limit)

    async def _collect_market_news(self, limit: int = 50):
        self.log_info("Collecting market news...")
        try:
            df = ak.stock_news_em(symbol="全部")
            return self._save_news(df, limit=limit)
        except Exception as e:
            self.log_error(f"Failed to collect market news: {e}")
            return {"error": str(e)}

    async def _collect_stock_news(self, stock_code: str, limit: int = 50):
        self.log_info(f"Collecting news for {stock_code}")
        try:
            df = ak.stock_news_em(symbol=stock_code)
            return self._save_news(df, stock_code=stock_code, limit=limit)
        except Exception as e:
            self.log_error(f"Failed to collect news for {stock_code}: {e}")
            return {"error": str(e)}

    def _save_news(self, df: pd.DataFrame, stock_code: str = None, limit: int = 50):
        if df is None or df.empty:
            return {"collected": 0}

        with sync_session() as session:
            stock_id = None
            if stock_code:
                stock = session.query(Stock).filter(Stock.code == stock_code).first()
                if stock:
                    stock_id = stock.id

            count = 0
            for _, row in df.head(limit).iterrows():
                title = str(row.get("新闻标题", row.get("标题", "")))
                content = str(row.get("新闻内容", row.get("内容", "")))
                source = str(row.get("新闻来源", row.get("来源", "")))
                url = str(row.get("新闻链接", row.get("链接", "")))
                pub_time = row.get("发布时间", row.get("时间", ""))

                if not title or title == "nan":
                    continue

                existing = (
                    session.query(SentimentEvent)
                    .filter(SentimentEvent.title == title)
                    .first()
                )
                if existing:
                    continue

                event = SentimentEvent(
                    stock_id=stock_id,
                    source=source if source != "nan" else "东方财富",
                    source_url=url if url != "nan" else "",
                    title=title,
                    content=content if content != "nan" else "",
                    sentiment="neutral",
                    sentiment_score=0.5,
                    impact_score=0.0,
                    published_at=pub_time if pub_time and str(pub_time) != "nan" else None,
                )
                session.add(event)
                count += 1

            session.commit()

        self.log_info(f"Collected {count} new news items")
        return {"collected": count}

    async def collect_notices(self, stock_code: str, limit: int = 30):
        self.log_info(f"Collecting notices for {stock_code}")
        try:
            df = ak.stock_notice_report(symbol=stock_code)
            if df is None or df.empty:
                return {"collected": 0}

            with sync_session() as session:
                stock = session.query(Stock).filter(Stock.code == stock_code).first()
                if not stock:
                    return {"error": "Stock not in watchlist"}

                count = 0
                for _, row in df.head(limit).iterrows():
                    title = str(row.get("公告标题", row.get("标题", "")))
                    if not title or title == "nan":
                        continue

                    existing = (
                        session.query(SentimentEvent)
                        .filter(SentimentEvent.title == title)
                        .first()
                    )
                    if existing:
                        continue

                    event = SentimentEvent(
                        stock_id=stock.id,
                        source="巨潮公告",
                        title=title,
                        content="",
                        sentiment="neutral",
                        sentiment_score=0.5,
                        impact_score=0.0,
                        published_at=row.get("公告日期", None),
                    )
                    session.add(event)
                    count += 1

                session.commit()

            self.log_info(f"Collected {count} new notices for {stock_code}")
            return {"collected": count}

        except Exception as e:
            self.log_error(f"Failed to collect notices for {stock_code}: {e}")
            return {"error": str(e)}
