import logging
from datetime import datetime, timedelta

from app.celery_app import celery_app
from app.database import get_sync_db
from app.models.price import PriceSnapshot
from app.models.recommend import UserBehavior

logger = logging.getLogger(__name__)


@celery_app.task(
    name="app.tasks.cleanup.cleanup_old_data",
    bind=True,
    max_retries=1,
)
def cleanup_old_data(self):
    db_gen = get_sync_db()
    db = next(db_gen)
    try:
        cutoffs = {
            "price_snapshots": datetime.utcnow() - timedelta(days=90),
            "user_behaviors": datetime.utcnow() - timedelta(days=180),
        }

        deleted_prices = (
            db.query(PriceSnapshot)
            .filter(PriceSnapshot.recorded_at < cutoffs["price_snapshots"])
            .delete(synchronize_session="fetch")
        )

        deleted_behaviors = (
            db.query(UserBehavior)
            .filter(UserBehavior.behavior_time < cutoffs["user_behaviors"])
            .delete(synchronize_session="fetch")
        )

        db.commit()
        logger.info(
            "Cleanup: deleted %d price snapshots, %d user behaviors",
            deleted_prices, deleted_behaviors,
        )
        return {
            "deleted_price_snapshots": deleted_prices,
            "deleted_user_behaviors": deleted_behaviors,
        }
    except Exception as e:
        logger.error("Cleanup task failed: %s", e)
        raise self.retry(exc=e)
    finally:
        db.close()