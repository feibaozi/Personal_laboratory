import logging
from datetime import datetime

from app.celery_app import celery_app
from app.database import get_sync_db
from app.models.product import Product, CrossPlatformProduct
from app.models.price import PriceSnapshot

logger = logging.getLogger(__name__)

PLATFORM_COLLECTOR_MAP = {
    "meituan": "MeituanCollector",
    "eleme": "ElemeCollector",
    "jd_waimai": "JDCollector",
    "douyin_waimai": "DouyinCollector",
}


@celery_app.task(
    name="app.tasks.price_sync.sync_all_prices",
    bind=True,
    max_retries=2,
    default_retry_delay=300,
)
def sync_all_prices(self):
    db_gen = get_sync_db()
    db = next(db_gen)
    try:
        products = (
            db.query(Product)
            .filter(Product.is_available == True)
            .all()
        )
        if not products:
            logger.info("No products to sync")
            return {"synced": 0, "message": "No products found"}

        synced_count = 0
        error_count = 0

        for product in products:
            cross_links = (
                db.query(CrossPlatformProduct)
                .filter(CrossPlatformProduct.product_id == product.id)
                .all()
            )

            for link in cross_links:
                try:
                    latest = (
                        db.query(PriceSnapshot)
                        .filter(
                            PriceSnapshot.product_id == product.id,
                            PriceSnapshot.platform == link.platform,
                        )
                        .order_by(PriceSnapshot.recorded_at.desc())
                        .first()
                    )

                    if latest and (datetime.utcnow() - latest.recorded_at).seconds < 3600:
                        continue

                    snapshot = PriceSnapshot(
                        product_id=product.id,
                        platform=link.platform,
                        base_price=0.0,
                        final_price=0.0,
                        source="celery_sync",
                    )
                    db.add(snapshot)
                    synced_count += 1
                except Exception as e:
                    logger.error(
                        "Price sync failed for product %d on %s: %s",
                        product.id, link.platform, str(e),
                    )
                    error_count += 1

        db.commit()
        logger.info(
            "Price sync completed: %d synced, %d errors",
            synced_count, error_count,
        )
        return {"synced": synced_count, "errors": error_count}
    except Exception as e:
        logger.error("Price sync task failed: %s", e)
        raise self.retry(exc=e)
    finally:
        db.close()


@celery_app.task(
    name="app.tasks.price_sync.sync_platform_prices",
    bind=True,
    max_retries=1,
)
def sync_platform_prices(self, platform: str):
    db_gen = get_sync_db()
    db = next(db_gen)
    try:
        links = (
            db.query(CrossPlatformProduct)
            .filter(CrossPlatformProduct.platform == platform)
            .all()
        )

        synced = 0
        for link in links:
            snapshot = PriceSnapshot(
                product_id=link.product_id,
                platform=link.platform,
                base_price=0.0,
                final_price=0.0,
                source="celery_sync",
            )
            db.add(snapshot)
            synced += 1

        db.commit()
        logger.info("Platform price sync for %s: %d products", platform, synced)
        return {"platform": platform, "synced": synced}
    except Exception as e:
        logger.error("Platform price sync failed for %s: %s", platform, e)
        raise self.retry(exc=e)
    finally:
        db.close()