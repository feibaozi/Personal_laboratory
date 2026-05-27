from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_
from database.connection import get_session
from database.models import SentimentEvent, EventCluster, Stock
from nlp.sentiment import sentiment_classifier
from nlp.clustering import event_clusterer
from nlp.preprocessor import preprocessor
from collectors.news import NewsCollector

router = APIRouter(prefix="/api/sentiment", tags=["sentiment"])

news_collector = NewsCollector()


@router.get("/events")
async def list_sentiment_events(
    stock_id: int | None = None,
    sentiment: str | None = None,
    limit: int = 50,
    offset: int = 0,
    session: AsyncSession = Depends(get_session),
):
    query = select(SentimentEvent).order_by(SentimentEvent.published_at.desc())

    if stock_id:
        query = query.where(SentimentEvent.stock_id == stock_id)
    if sentiment:
        query = query.where(SentimentEvent.sentiment == sentiment)

    query = query.offset(offset).limit(limit)
    result = await session.execute(query)
    events = result.scalars().all()

    stock_map = {}
    if events:
        stock_ids = list(set(e.stock_id for e in events if e.stock_id))
        if stock_ids:
            stocks_result = await session.execute(
                select(Stock).where(Stock.id.in_(stock_ids))
            )
            stock_map = {s.id: s.name for s in stocks_result.scalars().all()}

    return [
        {
            "id": e.id,
            "stock_id": e.stock_id,
            "stock_name": stock_map.get(e.stock_id, ""),
            "source": e.source,
            "source_url": e.source_url,
            "title": e.title,
            "content": e.content[:200] if e.content else "",
            "sentiment": e.sentiment,
            "sentiment_score": e.sentiment_score,
            "impact_score": e.impact_score,
            "event_cluster_id": e.event_cluster_id,
            "published_at": str(e.published_at) if e.published_at else None,
        }
        for e in events
    ]


@router.get("/clusters")
async def list_event_clusters(
    severity: str | None = None,
    limit: int = 20,
    session: AsyncSession = Depends(get_session),
):
    query = select(EventCluster).order_by(EventCluster.start_time.desc())

    if severity:
        query = query.where(EventCluster.severity == severity)

    query = query.limit(limit)
    result = await session.execute(query)
    clusters = result.scalars().all()

    return [
        {
            "id": c.id,
            "cluster_id": c.cluster_id,
            "title": c.title,
            "stock_ids": c.stock_ids,
            "event_type": c.event_type,
            "severity": c.severity,
            "start_time": str(c.start_time) if c.start_time else None,
            "end_time": str(c.end_time) if c.end_time else None,
            "summary": c.summary,
        }
        for c in clusters
    ]


@router.get("/stats")
async def get_sentiment_stats(
    stock_id: int | None = None,
    days: int = 7,
    session: AsyncSession = Depends(get_session),
):
    from datetime import datetime, timedelta

    since = datetime.now() - timedelta(days=days)

    base_filter = SentimentEvent.published_at >= since
    if stock_id:
        base_filter = and_(base_filter, SentimentEvent.stock_id == stock_id)

    total_result = await session.execute(
        select(func.count(SentimentEvent.id)).where(base_filter)
    )
    total = total_result.scalar() or 0

    pos_result = await session.execute(
        select(func.count(SentimentEvent.id)).where(
            and_(base_filter, SentimentEvent.sentiment == "positive")
        )
    )
    positive = pos_result.scalar() or 0

    neg_result = await session.execute(
        select(func.count(SentimentEvent.id)).where(
            and_(base_filter, SentimentEvent.sentiment == "negative")
        )
    )
    negative = neg_result.scalar() or 0

    neutral = total - positive - negative

    trend = []
    for i in range(days):
        day = datetime.now() - timedelta(days=days - i - 1)
        day_start = day.replace(hour=0, minute=0, second=0)
        day_end = day.replace(hour=23, minute=59, second=59)

        day_filter = and_(
            SentimentEvent.published_at >= day_start,
            SentimentEvent.published_at <= day_end,
        )
        if stock_id:
            day_filter = and_(day_filter, SentimentEvent.stock_id == stock_id)

        day_total = (
            await session.execute(select(func.count(SentimentEvent.id)).where(day_filter))
        ).scalar() or 0

        day_pos = (
            await session.execute(
                select(func.count(SentimentEvent.id)).where(
                    and_(day_filter, SentimentEvent.sentiment == "positive")
                )
            )
        ).scalar() or 0

        day_neg = (
            await session.execute(
                select(func.count(SentimentEvent.id)).where(
                    and_(day_filter, SentimentEvent.sentiment == "negative")
                )
            )
        ).scalar() or 0

        trend.append(
            {
                "date": day_start.strftime("%Y-%m-%d"),
                "total": day_total,
                "positive": day_pos,
                "negative": day_neg,
                "neutral": day_total - day_pos - day_neg,
            }
        )

    return {
        "total": total,
        "positive": positive,
        "negative": negative,
        "neutral": neutral,
        "trend": trend,
    }


@router.get("/keywords")
async def get_top_keywords(
    stock_id: int | None = None,
    limit: int = 30,
    session: AsyncSession = Depends(get_session),
):
    from datetime import datetime, timedelta

    since = datetime.now() - timedelta(days=7)

    query = select(SentimentEvent.title, SentimentEvent.content).where(
        SentimentEvent.published_at >= since
    )
    if stock_id:
        query = query.where(SentimentEvent.stock_id == stock_id)

    result = await session.execute(query.limit(200))
    rows = result.all()

    all_keywords = []
    for title, content in rows:
        text = (title or "") + " " + (content or "")
        kws = preprocessor.extract_keywords(text, top_k=5)
        all_keywords.extend(kws)

    from collections import Counter

    counter = Counter(all_keywords)
    top = counter.most_common(limit)

    return [{"keyword": kw, "count": cnt} for kw, cnt in top]


@router.post("/analyze")
async def analyze_and_update_events():
    from database.connection import sync_session
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

    cluster_result = event_clusterer.cluster_events()

    return {
        "events_analyzed": updated,
        "clusters_created": cluster_result.get("clusters_created", 0),
    }


@router.post("/collect")
async def collect_news(stock_code: str | None = None):
    if stock_code:
        result = await news_collector.collect(stock_code=stock_code, limit=30)
    else:
        result = await news_collector.collect(limit=50)
    return result
