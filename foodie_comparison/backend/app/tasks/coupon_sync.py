import asyncio
import hashlib
import logging
from datetime import datetime, timedelta

from app.celery_app import celery_app
from app.database import get_sync_db
from app.models.coupon import Coupon, CouponType

logger = logging.getLogger(__name__)

PLATFORMS = ["meituan", "eleme", "jd_waimai", "douyin_waimai"]


def _map_coupon_type(raw_type: str) -> CouponType:
    mapping = {
        "full_reduction": CouponType.FULL_REDUCTION,
        "delivery_free": CouponType.DELIVERY_FREE,
        "new_user": CouponType.NEW_USER,
        "platform": CouponType.PLATFORM,
    }
    return mapping.get(raw_type, CouponType.DIRECT)


def _generate_platform_coupon_id(platform: str, coupon_data: dict) -> str:
    parts = [
        platform,
        coupon_data.get("type", "unknown"),
        str(coupon_data.get("value", coupon_data.get("discount", 0))),
        coupon_data.get("description", "")[:50],
    ]
    raw = "|".join(parts)
    return hashlib.md5(raw.encode("utf-8")).hexdigest()[:16]


async def _fetch_and_store_coupons(platform: str, db) -> int:
    from app.collectors.coupon_collector import CouponCollector

    collector = CouponCollector()
    inserted = 0
    try:
        result = await collector.collect_coupons_for_platform(platform)
        if not result.success:
            logger.warning(
                "Coupon collection failed for %s: %s", platform, result.error
            )
            return 0

        coupons_data = result.data.get("coupons", [])
        for coupon_data in coupons_data:
            try:
                platform_coupon_id = _generate_platform_coupon_id(platform, coupon_data)

                existing = (
                    db.query(Coupon)
                    .filter(Coupon.platform_coupon_id == platform_coupon_id)
                    .first()
                )
                if existing:
                    continue

                coupon_type = _map_coupon_type(coupon_data.get("type", "direct"))
                value = coupon_data.get("value", coupon_data.get("discount", 0.0))
                description = coupon_data.get("description", "")
                threshold = coupon_data.get("threshold", 0.0)

                now = datetime.utcnow()
                coupon = Coupon(
                    title=description[:256] if description else f"{platform}优惠券",
                    type=coupon_type,
                    value=float(value) if value else 0.0,
                    min_spend=float(threshold) if threshold else 0.0,
                    platform=platform,
                    platform_coupon_id=platform_coupon_id,
                    description=description,
                    start_time=now,
                    expire_time=now + timedelta(days=7),
                    total_quota=0,
                    remaining_quota=0,
                    is_active=True,
                )
                db.add(coupon)
                inserted += 1
            except Exception as e:
                logger.error(
                    "Failed to store coupon for %s: %s", platform, str(e)
                )

        if inserted > 0:
            db.flush()
    except Exception as e:
        logger.error("Coupon fetch exception for %s: %s", platform, str(e))
    finally:
        await collector.close()

    return inserted


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

        deactivated_count = len(expired)

        total_inserted = 0
        for platform in PLATFORMS:
            try:
                inserted = asyncio.run(_fetch_and_store_coupons(platform, db))
                total_inserted += inserted
            except Exception as e:
                logger.error("Coupon sync failed for %s: %s", platform, str(e))

        db.commit()
        logger.info(
            "Coupon sync: deactivated %d expired, inserted %d new",
            deactivated_count, total_inserted,
        )
        return {"deactivated": deactivated_count, "inserted": total_inserted}
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

        deactivated_count = len(expired)

        inserted = 0
        try:
            inserted = asyncio.run(_fetch_and_store_coupons(platform, db))
        except Exception as e:
            logger.error("Platform coupon fetch failed for %s: %s", platform, str(e))

        db.commit()
        logger.info(
            "Platform coupon sync for %s: deactivated %d, inserted %d",
            platform, deactivated_count, inserted,
        )
        return {
            "platform": platform,
            "deactivated": deactivated_count,
            "inserted": inserted,
        }
    except Exception as e:
        logger.error("Platform coupon sync failed for %s: %s", platform, e)
        raise self.retry(exc=e)
    finally:
        db.close()
