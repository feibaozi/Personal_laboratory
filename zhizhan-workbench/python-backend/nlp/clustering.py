import hashlib
import re
from datetime import datetime
from database.connection import sync_session
from database.models import SentimentEvent, EventCluster
from nlp.preprocessor import preprocessor


class EventClusterer:
    def __init__(self, similarity_threshold: float = 0.4):
        self.similarity_threshold = similarity_threshold

    def cluster_events(self, unclustered_only: bool = True):
        with sync_session() as session:
            query = session.query(SentimentEvent)
            if unclustered_only:
                query = query.filter(SentimentEvent.event_cluster_id == None)
            events = query.order_by(SentimentEvent.published_at.desc()).limit(200).all()

            if not events:
                return {"clusters_created": 0}

            clusters_created = 0
            used_events = set()

            for i, event in enumerate(events):
                if event.id in used_events:
                    continue

                keywords_i = set(preprocessor.extract_keywords(event.title + " " + (event.content or ""), top_k=5))
                if not keywords_i:
                    continue

                cluster_members = [event]
                used_events.add(event.id)

                for j in range(i + 1, len(events)):
                    if events[j].id in used_events:
                        continue

                    keywords_j = set(
                        preprocessor.extract_keywords(
                            events[j].title + " " + (events[j].content or ""), top_k=5
                        )
                    )

                    if not keywords_j:
                        continue

                    intersection = keywords_i & keywords_j
                    union = keywords_i | keywords_j
                    jaccard = len(intersection) / len(union) if union else 0

                    if jaccard >= self.similarity_threshold:
                        cluster_members.append(events[j])
                        used_events.add(events[j].id)

                if len(cluster_members) >= 2:
                    cluster_id = self._generate_cluster_id(cluster_members)
                    existing = (
                        session.query(EventCluster)
                        .filter(EventCluster.cluster_id == cluster_id)
                        .first()
                    )

                    if not existing:
                        title = self._generate_cluster_title(cluster_members)
                        stock_ids = list(set(
                            m.stock_id for m in cluster_members if m.stock_id
                        ))

                        sentiments = [m.sentiment for m in cluster_members if m.sentiment]
                        neg_count = sentiments.count("negative")
                        severity = "high" if neg_count >= 2 else "medium" if neg_count >= 1 else "low"

                        cluster = EventCluster(
                            cluster_id=cluster_id,
                            title=title,
                            stock_ids=str(stock_ids),
                            event_type=self._detect_event_type(cluster_members),
                            severity=severity,
                            start_time=min(
                                m.published_at or datetime.now() for m in cluster_members
                            ),
                            end_time=max(
                                m.published_at or datetime.now() for m in cluster_members
                            ),
                            summary=title,
                        )
                        session.add(cluster)
                        clusters_created += 1

                    for member in cluster_members:
                        member.event_cluster_id = cluster_id

            session.commit()

        return {"clusters_created": clusters_created}

    def _generate_cluster_id(self, events: list) -> str:
        titles = "".join(sorted(e.title for e in events))
        return hashlib.md5(titles.encode()).hexdigest()[:16]

    def _generate_cluster_title(self, events: list) -> str:
        all_keywords = []
        for event in events:
            kws = preprocessor.extract_keywords(event.title, top_k=3)
            all_keywords.extend(kws)

        from collections import Counter
        counter = Counter(all_keywords)
        top_keywords = [w for w, _ in counter.most_common(3)]

        if top_keywords:
            return "、".join(top_keywords) + " 相关事件"
        return events[0].title[:30]

    def _detect_event_type(self, events: list) -> str:
        text = " ".join(e.title + " " + (e.content or "") for e in events)

        if any(kw in text for kw in ["业绩", "财报", "营收", "利润", "年报", "季报"]):
            return "earnings"
        if any(kw in text for kw in ["公告", "通知", "决议"]):
            return "regulation"
        if any(kw in text for kw in ["传闻", "据说", "疑似"]):
            return "rumor"
        return "news"


event_clusterer = EventClusterer()
