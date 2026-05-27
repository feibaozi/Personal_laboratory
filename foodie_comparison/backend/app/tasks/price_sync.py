import asyncio
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


def _get_collector(platform: str):
    if platform == "meituan":
        from app.collectors.meituan_collector import MeituanCollector
        return MeituanCollector()
    elif platform == "eleme":
        from app.collectors.eleme_collector import ElemeCollector
        return ElemeCollector()
    elif platform == "jd_waimai":
        from app.collectors.jd_collector import JDCollector
        return JDCollector()
    elif platform == "douyin_waimai":
        from app.collectors.douyin_collector import DouyinCollector
        return DouyinCollector()
    return None


async def _collect_and_save_prices(product_id: int, platform: str, platform_shop_id: str, db):
    collector = _get_collector(platform)
    if collector is None:
        logger.warning("No collector for platform %s", platform)
        return None

    try:
        result = await collector.collect_products(platform_shop_id)
        if not result.success:
            logger.warning(
                "Price collection failed for product %d on %s: %s",
                product_id, platform, result.error,
            )
            return None

        data = result.data
        products = data.get("products", [])
        delivery = data.get("delivery", {})

        base_price = 0.0
        final_price = 0.0
        if products:
            prices = [p.get("price", 0.0) for p in products if p.get("price", 0.0) > 0]
            if prices:
                base_price = sum(prices) / len(prices)
                final_price = base_price

        package_fee = 0.0
        delivery_fee = delivery.get("fee", 0.0)
        min_order_amount = delivery.get("min_order", 0.0)

        coupons = data.get("coupons", [])
        import json
        discount_info = json.dumps(coupons, ensure_ascii=False) if coupons else "[]"

        snapshot = PriceSnapshot(
            product_id=product_id,
            platform=platform,
            base_price=base_price,
            package_fee=package_fee,
            delivery_fee=delivery_fee,
            min_order_amount=min_order_amount,
            discount_info=discount_info,
            final_price=final_price,
            source=result.source or "celery_sync",
        )
        db.add(snapshot)
        return snapshot
    except Exception as e:
        logger.error(
            "Price collection exception for product %d on %s: %s",
            product_id, platform, str(e),
        )
        return None
    finally:
        await collector.close()


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

                    snapshot = asyncio.run(
                        _collect_and_save_prices(
                            product.id, link.platform, link.platform_shop_id, db
                        )
                    )
                    if snapshot is not None:
                        synced_count += 1
                    else:
                        error_count += 1
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
        errors = 0
        for link in links:
            try:
                snapshot = asyncio.run(
                    _collect_and_save_prices(
                        link.product_id, link.platform, link.platform_shop_id, db
                    )
                )
                if snapshot is not None:
                    synced += 1
                else:
                    errors += 1
            except Exception as e:
                logger.error(
                    "Platform price sync failed for product %d on %s: %s",
                    link.product_id, platform, str(e),
                )
                errors += 1

        db.commit()
        logger.info(
            "Platform price sync for %s: %d synced, %d errors",
            platform, synced, errors,
        )
        return {"platform": platform, "synced": synced, "errors": errors}
    except Exception as e:
        logger.error("Platform price sync failed for %s: %s", platform, e)
        raise self.retry(exc=e)
    finally:
        db.close()
