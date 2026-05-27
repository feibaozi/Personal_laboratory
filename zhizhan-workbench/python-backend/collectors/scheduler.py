import asyncio
import logging
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.interval import IntervalTrigger
from database.connection import sync_session
from database.models import Stock
from collectors.stock_info import StockInfoCollector
from collectors.news import NewsCollector
from nlp.sentiment import sentiment_classifier
from nlp.clustering import event_clusterer
from ai.alert_engine import alert_engine
from config import settings

logger = logging.getLogger(__name__)

scheduler = AsyncIOScheduler()

stock_info_collector = StockInfoCollector()
news_collector = NewsCollector()


async def refresh_watchlist_news():
    logger.info("[Scheduler] Starting watchlist news refresh...")
    try:
        with sync_session() as session:
            stocks = (
                session.query(Stock)
                .filter(Stock.watch_status.in_(["focused", "observing"]))
                .all()
            )
            stock_codes = [s.code for s in stocks]

        for code in stock_codes:
            try:
                await news_collector.collect(stock_code=code, limit=20)
                await asyncio.sleep(1)
            except Exception as e:
                logger.error(f"[Scheduler] Failed to refresh news for {code}: {e}")

        logger.info(f"[Scheduler] News refresh completed for {len(stock_codes)} stocks")
    except Exception as e:
        logger.error(f"[Scheduler] News refresh failed: {e}")


async def refresh_stock_list():
    logger.info("[Scheduler] Starting stock list refresh...")
    try:
        await stock_info_collector.collect()
        logger.info("[Scheduler] Stock list refresh completed")
    except Exception as e:
        logger.error(f"[Scheduler] Stock list refresh failed: {e}")


async def analyze_sentiment():
    logger.info("[Scheduler] Starting sentiment analysis...")
    try:
        from database.models import SentimentEvent

        with sync_session() as session:
            events = (
                session.query(SentimentEvent)
                .filter(SentimentEvent.sentiment == "neutral")
                .limit(100)
                .all()
            )

            updated = 0
            for event in events:
                text = (event.title or "") + " " + (event.content or "")
                if not text.strip():
                    continue

                result = sentiment_classifier.classify(text)
                event.sentiment = result["sentiment"]
                event.sentiment_score = result["score"]
                if result["is_alert"]:
                    event.impact_score = 0.8
                updated += 1

            session.commit()

        logger.info(f"[Scheduler] Sentiment analysis completed: {updated} events updated")
    except Exception as e:
        logger.error(f"[Scheduler] Sentiment analysis failed: {e}")


async def run_event_clustering():
    logger.info("[Scheduler] Starting event clustering...")
    try:
        result = event_clusterer.cluster_events()
        logger.info(f"[Scheduler] Event clustering completed: {result}")
    except Exception as e:
        logger.error(f"[Scheduler] Event clustering failed: {e}")


async def run_alert_checks():
    logger.info("[Scheduler] Running alert checks...")
    try:
        result = alert_engine.run_all_checks()
        logger.info(f"[Scheduler] Alert checks completed: {result}")
    except Exception as e:
        logger.error(f"[Scheduler] Alert checks failed: {e}")


def start_scheduler():
    interval_minutes = settings.data_refresh_interval

    scheduler.add_job(
        refresh_watchlist_news,
        trigger=IntervalTrigger(minutes=interval_minutes),
        id="refresh_watchlist_news",
        name="Refresh watchlist news",
        replace_existing=True,
    )

    scheduler.add_job(
        refresh_stock_list,
        trigger=IntervalTrigger(hours=24),
        id="refresh_stock_list",
        name="Refresh stock list",
        replace_existing=True,
    )

    scheduler.add_job(
        analyze_sentiment,
        trigger=IntervalTrigger(minutes=interval_minutes + 5),
        id="analyze_sentiment",
        name="Analyze sentiment",
        replace_existing=True,
    )

    scheduler.add_job(
        run_event_clustering,
        trigger=IntervalTrigger(hours=1),
        id="run_event_clustering",
        name="Run event clustering",
        replace_existing=True,
    )

    scheduler.add_job(
        run_alert_checks,
        trigger=IntervalTrigger(minutes=15),
        id="run_alert_checks",
        name="Run alert checks",
        replace_existing=True,
    )

    scheduler.start()
    logger.info(
        f"[Scheduler] Started with news refresh every {interval_minutes} minutes"
    )


def stop_scheduler():
    if scheduler.running:
        scheduler.shutdown()
        logger.info("[Scheduler] Stopped")
