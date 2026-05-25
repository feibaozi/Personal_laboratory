import logging
from datetime import datetime

from app.celery_app import celery_app
from app.database import get_sync_db
from app.models.recommend import RecommendResult
from app.models.user import User

logger = logging.getLogger(__name__)


@celery_app.task(
    name="app.tasks.recommend_rebuild.rebuild_recommendations",
    bind=True,
    max_retries=2,
    default_retry_delay=900,
)
def rebuild_recommendations(self):
    db_gen = get_sync_db()
    db = next(db_gen)
    try:
        users = db.query(User).filter(User.is_active == True).all()

        built_count = 0
        for user in users:
            try:
                existing = (
                    db.query(RecommendResult)
                    .filter(RecommendResult.user_id == user.id)
                    .filter(RecommendResult.recommend_type == "shop")
                    .order_by(RecommendResult.generated_at.desc())
                    .first()
                )

                if existing and (
                    datetime.utcnow() - existing.generated_at
                ).seconds < 43200:
                    continue

                result = RecommendResult(
                    user_id=user.id,
                    recommend_type="shop",
                    items=[],
                    algorithm_version="v1.0",
                    generated_at=datetime.utcnow(),
                )
                db.add(result)
                built_count += 1
            except Exception as e:
                logger.error(
                    "Recommend rebuild failed for user %d: %s",
                    user.id, str(e),
                )

        db.commit()
        logger.info("Recommend rebuild: %d users processed", built_count)
        return {"built": built_count}
    except Exception as e:
        logger.error("Recommend rebuild task failed: %s", e)
        raise self.retry(exc=e)
    finally:
        db.close()


@celery_app.task(
    name="app.tasks.recommend_rebuild.rebuild_for_user",
    bind=True,
    max_retries=1,
)
def rebuild_for_user(self, user_id: int):
    db_gen = get_sync_db()
    db = next(db_gen)
    try:
        result = RecommendResult(
            user_id=user_id,
            recommend_type="shop",
            items=[],
            algorithm_version="v1.0",
            generated_at=datetime.utcnow(),
        )
        db.add(result)
        db.commit()
        logger.info("Recommend rebuild for user %d completed", user_id)
        return {"user_id": user_id, "status": "completed"}
    except Exception as e:
        logger.error("Recommend rebuild for user %d failed: %s", user_id, e)
        raise self.retry(exc=e)
    finally:
        db.close()