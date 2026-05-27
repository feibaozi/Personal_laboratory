import asyncio
import logging
from datetime import datetime, timezone, timedelta

from app.celery_app import celery_app
from app.database import get_sync_db
from app.models.recommend import RecommendResult
from app.models.user import User

logger = logging.getLogger(__name__)


async def _rebuild_for_user_async(user_id: int):
    from app.database import _get_async_session_local
    from app.services.recommend_service import RecommendService

    session_local = _get_async_session_local()
    async with session_local() as db:
        try:
            service = RecommendService(db)
            items = await service.recommend_shops(user_id, limit=10)
            return {"user_id": user_id, "status": "completed", "items_count": len(items)}
        except Exception as e:
            logger.error("Async recommend rebuild failed for user %d: %s", user_id, str(e))
            return {"user_id": user_id, "status": "failed", "error": str(e)}


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

                result = asyncio.run(_rebuild_for_user_async(user.id))
                if result.get("status") == "completed":
                    built_count += 1
            except Exception as e:
                logger.error(
                    "Recommend rebuild failed for user %d: %s",
                    user.id, str(e),
                )

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
    try:
        result = asyncio.run(_rebuild_for_user_async(user_id))
        if result.get("status") == "completed":
            logger.info("Recommend rebuild for user %d completed", user_id)
        else:
            logger.error(
                "Recommend rebuild for user %d failed: %s",
                user_id, result.get("error", "unknown"),
            )
        return result
    except Exception as e:
        logger.error("Recommend rebuild for user %d failed: %s", user_id, e)
        raise self.retry(exc=e)
