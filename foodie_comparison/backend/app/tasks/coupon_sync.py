import logging
from datetime import datetime

from app.celery_app import celery_app
from app.database import get_sync_db
from app.models.coupon import Coupon

logger = logging.getLogger(__name__)


@celery_app.task(
    name="app.tasks.coupon_sync.sync_all_coupons",
    bind=True,
    max_retries=2,
    default_retry_delay=600,
)
def sync_all_coupons(self):
    db_gen = get_sync_db()
    db = next(db_gen)
    try:
        expired = (
            db.query(Coupon)
            .filter(Coupon.expire_time < datetime.utcnow())
            .filter(Coupon.is_active == True)
            .all()
        )

        for coupon in expired:
            coupon.is_active = False

        db.commit()
        logger.info(
            "Coupon sync: deactivated %d expired coupons", len(expired)
        )
        return {"deactivated": len(expired)}
    except Exception as e:
        logger.error("Coupon sync task failed: %s", e)
        raise self.retry(exc=e)
    finally:
        db.close()


@celery_app.task(
    name="app.tasks.coupon_sync.sync_platform_coupons",
    bind=True,
    max_retries=1,
)
def sync_platform_coupons(self, platform: str):
    db_gen = get_sync_db()
    db = next(db_gen)
    try:
        expired = (
            db.query(Coupon)
            .filter(Coupon.platform == platform)
            .filter(Coupon.expire_time < datetime.utcnow())
            .filter(Coupon.is_active == True)
            .all()
        )

        for coupon in expired:
            coupon.is_active = False

        db.commit()
        logger.info(
            "Platform coupon sync for %s: deactivated %d", platform, len(expired)
        )
        return {"platform": platform, "deactivated": len(expired)}
    except Exception as e:
        logger.error("Platform coupon sync failed for %s: %s", platform, e)
        raise self.retry(exc=e)
    finally:
        db.close()