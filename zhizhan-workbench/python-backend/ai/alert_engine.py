import json
import logging
from datetime import datetime, timedelta
from database.connection import sync_session
from database.models import Alert, SentimentEvent, Stock, Financial
from nlp.sentiment import sentiment_classifier

logger = logging.getLogger(__name__)


class AlertEngine:
    def __init__(self):
        self.rules = [
            self._check_sentiment_spike,
            self._check_alert_keywords,
            self._check_financial_anomaly,
        ]

    def run_all_checks(self) -> dict:
        total_alerts = 0
        for rule in self.rules:
            try:
                count = rule()
                total_alerts += count
            except Exception as e:
                logger.error(f"[AlertEngine] Rule {rule.__name__} failed: {e}")

        return {"alerts_created": total_alerts}

    def _check_sentiment_spike(self) -> int:
        alerts_created = 0
        now = datetime.now()
        yesterday = now - timedelta(days=1)

        with sync_session() as session:
            stocks = (
                session.query(Stock)
                .filter(Stock.watch_status.in_(["focused", "observing"]))
                .all()
            )

            for stock in stocks:
                today_neg = (
                    session.query(SentimentEvent)
                    .filter(
                        SentimentEvent.stock_id == stock.id,
                        SentimentEvent.sentiment == "negative",
                        SentimentEvent.published_at >= yesterday,
                    )
                    .count()
                )

                prev_week = now - timedelta(days=8)
                prev_day = now - timedelta(days=7)
                week_neg = (
                    session.query(SentimentEvent)
                    .filter(
                        SentimentEvent.stock_id == stock.id,
                        SentimentEvent.sentiment == "negative",
                        SentimentEvent.published_at >= prev_week,
                        SentimentEvent.published_at < prev_day,
                    )
                    .count()
                )

                if today_neg > 3 and (week_neg == 0 or today_neg > week_neg * 3):
                    existing = (
                        session.query(Alert)
                        .filter(
                            Alert.stock_id == stock.id,
                            Alert.alert_type == "sentiment",
                            Alert.title.like("%负面舆情暴增%"),
                            Alert.created_at >= yesterday,
                        )
                        .first()
                    )

                    if not existing:
                        alert = Alert(
                            stock_id=stock.id,
                            alert_type="sentiment",
                            severity="high",
                            title=f"{stock.name} 负面舆情暴增",
                            description=f"近24小时负面舆情 {today_neg} 条，较上周同期显著增加",
                            related_data=json.dumps(
                                {"today_neg": today_neg, "week_neg": week_neg}
                            ),
                        )
                        session.add(alert)
                        alerts_created += 1

            session.commit()

        return alerts_created

    def _check_alert_keywords(self) -> int:
        alerts_created = 0
        yesterday = datetime.now() - timedelta(days=1)

        with sync_session() as session:
            events = (
                session.query(SentimentEvent)
                .filter(SentimentEvent.published_at >= yesterday)
                .all()
            )

            for event in events:
                text = (event.title or "") + " " + (event.content or "")
                result = sentiment_classifier.classify(text)

                if result["is_alert"]:
                    existing = (
                        session.query(Alert)
                        .filter(
                            Alert.alert_type == "sentiment",
                            Alert.title == event.title,
                        )
                        .first()
                    )

                    if not existing:
                        stock_name = ""
                        if event.stock_id:
                            stock = session.query(Stock).get(event.stock_id)
                            stock_name = stock.name if stock else ""

                        alert = Alert(
                            stock_id=event.stock_id,
                            alert_type="sentiment",
                            severity="high",
                            title=f"{stock_name} {result['alert_type']}" if stock_name else result["alert_type"],
                            description=event.title,
                            related_data=json.dumps(
                                {
                                    "event_id": event.id,
                                    "alert_keyword": result["alert_type"],
                                }
                            ),
                        )
                        session.add(alert)
                        alerts_created += 1

            session.commit()

        return alerts_created

    def _check_financial_anomaly(self) -> int:
        alerts_created = 0

        with sync_session() as session:
            stocks = (
                session.query(Stock)
                .filter(Stock.watch_status.in_(["focused", "observing"]))
                .all()
            )

            for stock in stocks:
                financials = (
                    session.query(Financial)
                    .filter(Financial.stock_id == stock.id)
                    .order_by(Financial.report_date.desc())
                    .limit(4)
                    .all()
                )

                if len(financials) < 2:
                    continue

                latest = financials[0]
                previous = financials[1]

                if latest.revenue and previous.revenue and previous.revenue > 0:
                    receivable_ratio = (
                        latest.receivables / latest.revenue
                        if latest.revenue and latest.revenue > 0
                        else 0
                    )
                    prev_receivable_ratio = (
                        previous.receivables / previous.revenue
                        if previous.revenue and previous.revenue > 0
                        else 0
                    )

                    if (
                        prev_receivable_ratio > 0
                        and receivable_ratio > prev_receivable_ratio * 1.3
                    ):
                        existing = (
                            session.query(Alert)
                            .filter(
                                Alert.stock_id == stock.id,
                                Alert.alert_type == "financial",
                                Alert.title.like("%应收占比异常%"),
                            )
                            .first()
                        )

                        if not existing:
                            alert = Alert(
                                stock_id=stock.id,
                                alert_type="financial",
                                severity="high",
                                title=f"{stock.name} 应收占比异常上升",
                                description=f"应收/营收比从 {prev_receivable_ratio:.2%} 升至 {receivable_ratio:.2%}",
                                related_data=json.dumps(
                                    {
                                        "current_ratio": receivable_ratio,
                                        "previous_ratio": prev_receivable_ratio,
                                    }
                                ),
                            )
                            session.add(alert)
                            alerts_created += 1

                if (
                    latest.operating_cf is not None
                    and latest.net_profit is not None
                    and latest.net_profit > 0
                    and latest.operating_cf / latest.net_profit < 0.5
                ):
                    existing = (
                        session.query(Alert)
                        .filter(
                            Alert.stock_id == stock.id,
                            Alert.alert_type == "financial",
                            Alert.title.like("%现金流异常%"),
                        )
                        .first()
                    )

                    if not existing:
                        ratio = latest.operating_cf / latest.net_profit
                        alert = Alert(
                            stock_id=stock.id,
                            alert_type="financial",
                            severity="high",
                            title=f"{stock.name} 经营现金流/净利润异常",
                            description=f"经营现金流/净利润比值仅 {ratio:.2f}，利润质量存疑",
                            related_data=json.dumps(
                                {
                                    "operating_cf": latest.operating_cf,
                                    "net_profit": latest.net_profit,
                                    "ratio": ratio,
                                }
                            ),
                        )
                        session.add(alert)
                        alerts_created += 1

            session.commit()

        return alerts_created


alert_engine = AlertEngine()
