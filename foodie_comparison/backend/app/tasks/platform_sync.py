import logging
from datetime import datetime

from app.celery_app import celery_app
from app.database import get_sync_db
from app.models.platform import PlatformActivity, FlashSale

logger = logging.getLogger(__name__)


@celery_app.task(
    name="app.tasks.platform_sync.sync_platform_activities",
    bind=True,
    max_retries=2,
    default_retry_delay=600,
)
def sync_platform_activities(self):
    db_gen = get_sync_db()
    db = next(db_gen)
    try:
        now = datetime.utcnow()

        expired_activities = (
            db.query(PlatformActivity)
            .filter(PlatformActivity.end_time < now)
            .filter(PlatformActivity.is_active == True)
            .all()
        )

        for activity in expired_activities:
            activity.is_active = False

        expired_sales = (
            db.query(FlashSale)
            .filter(FlashSale.end_time < now)
            .filter(FlashSale.is_active == True)
            .all()
        )

        for sale in expired_sales:
            sale.is_active = False

        db.commit()
        logger.info(
            "Platform sync: deactivated %d activities, %d flash sales",
            len(expired_activities), len(expired_sales),
        )
        return {
            "deactivated_activities": len(expired_activities),
            "deactivated_flash_sales": len(expired_sales),
        }
    except Exception as e:
        logger.error("Platform sync task failed: %s", e)
        raise self.retry(exc=e)
    finally:
        db.close()


@celery_app.task(
    name="app.tasks.platform_sync.sync_platform_activities_for_platform",
    bind=True,
    max_retries=1,
)
def sync_platform_activities_for_platform(self, platform: str):
    db_gen = get_sync_db()
    db = next(db_gen)
    try:
        now = datetime.utcnow()

        expired_activities = (
            db.query(PlatformActivity)
            .filter(PlatformActivity.platform == platform)
            .filter(PlatformActivity.end_time < now)
            .filter(PlatformActivity.is_active == True)
            .all()
        )

        for activity in expired_activities:
            activity.is_active = False

        db.commit()
        logger.info(
            "Platform activity sync for %s: deactivated %d",
            platform, len(expired_activities),
        )
        return {"platform": platform, "deactivated": len(expired_activities)}
    except Exception as e:
        logger.error("Platform activity sync failed: %s", e)
        raise self.retry(exc=e)
    finally:
        db.close()