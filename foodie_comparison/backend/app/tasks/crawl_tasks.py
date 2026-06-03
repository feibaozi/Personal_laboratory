import asyncio
import logging
from datetime import datetime, timezone

from app.celery_app import celery_app
from app.database import _get_sync_session_local
from app.models.shop import Shop, ShopPlatformLink
from app.models.product import Product
from app.redis_client import cache_get, cache_set

logger = logging.getLogger(__name__)


def _run_async(coro):
    loop = asyncio.new_event_loop()
    try:
        return loop.run_until_complete(coro)
    finally:
        loop.close()


@celery_app.task(bind=True, max_retries=2, default_retry_delay=120)
def crawl_shop_by_keyword(self, keyword: str, city: str = "北京", platform: str = "meituan"):
    logger.info("CrawlTask: search '%s' in %s on %s", keyword, city, platform)

    try:
        from app.collectors.crawler_manager import crawler_manager

        result = _run_async(crawler_manager.search_shops(
            keyword=keyword, city=city, platforms=[platform],
        ))

        shops = result.get("shops", [])
        if not shops:
            logger.info("CrawlTask: no shops found for '%s'", keyword)
            return {"status": "no_results", "keyword": keyword, "shops_count": 0}

        saved = 0
        for shop_data in shops[:10]:
            try:
                _save_shop_to_db(platform, shop_data)
                saved += 1
            except Exception as e:
                logger.warning("CrawlTask: save shop failed: %s", e)

        _run_async(_update_search_cache(keyword, city, platform, shops))

        logger.info("CrawlTask: saved %d/%d shops for '%s'", saved, len(shops), keyword)
        return {"status": "success", "keyword": keyword, "shops_count": len(shops), "saved": saved}

    except Exception as exc:
        logger.error("CrawlTask failed: %s", exc)
        raise self.retry(exc=exc)


@celery_app.task(bind=True, max_retries=2, default_retry_delay=60)
def crawl_shop_menu(self, platform: str, shop_url: str):
    logger.info("CrawlTask: menu for %s %s", platform, shop_url)

    try:
        from app.collectors.crawler_manager import crawler_manager

        result = _run_async(crawler_manager.get_shop_menu(
            platform=platform, shop_url=shop_url,
        ))

        if not result.get("success"):
            logger.warning("CrawlTask: menu crawl failed: %s", result.get("message"))
            return {"status": "failed", "message": result.get("message")}

        data = result.get("data", result)
        saved = _save_menu_to_db(platform, data)

        logger.info("CrawlTask: menu saved %d items", saved)
        return {"status": "success", "saved": saved}

    except Exception as exc:
        logger.error("CrawlTask menu failed: %s", exc)
        raise self.retry(exc=exc)


@celery_app.task(bind=True, max_retries=1, default_retry_delay=300)
def crawl_shop_by_url(self, url: str):
    logger.info("CrawlTask: url %s", url)

    try:
        from app.collectors.crawler_manager import crawler_manager

        result = _run_async(crawler_manager.collect_from_url(url))

        if not result.get("success"):
            return {"status": "failed", "message": result.get("message")}

        platform = result.get("platform", "unknown")
        data = result.get("data", result)
        saved = _save_menu_to_db(platform, data)

        return {"status": "success", "platform": platform, "saved": saved}

    except Exception as exc:
        logger.error("CrawlTask url failed: %s", exc)
        raise self.retry(exc=exc)


@celery_app.task
def crawl_popular_shops():
    logger.info("CrawlTask: crawling popular shops")

    popular_keywords = ["麻辣烫", "奶茶", "炸鸡", "汉堡", "火锅", "烧烤", "盖饭", "面条"]
    city = "北京"
    platform = "meituan"

    total_saved = 0
    for keyword in popular_keywords:
        try:
            result = crawl_shop_by_keyword.apply_async(
                args=[keyword, city, platform],
                countdown=popular_keywords.index(keyword) * 30,
            )
            logger.info("CrawlTask: dispatched keyword '%s'", keyword)
        except Exception as e:
            logger.error("CrawlTask: dispatch failed for '%s': %s", keyword, e)

    return {"status": "dispatched", "keywords": len(popular_keywords)}


def _save_shop_to_db(platform: str, shop_data: dict):
    session_local = _get_sync_session_local()
    db = session_local()

    try:
        from sqlalchemy import select as sa_select
        from app.models.shop import Shop as ShopModel, ShopPlatformLink as LinkModel

        name = shop_data.get("name", "")
        result = db.execute(sa_select(ShopModel).where(ShopModel.name == name).limit(1))
        shop = result.scalar_one_or_none()

        if shop is None:
            shop = ShopModel(
                name=name,
                image_url=shop_data.get("image_url", ""),
                rating=float(shop_data.get("rating", 0)),
                category=shop_data.get("category", ""),
                address=shop_data.get("address", ""),
            )
            db.add(shop)
            db.flush()

        platform_shop_id = str(shop_data.get("platform_shop_id", shop_data.get("id", "")))
        link_result = db.execute(
            sa_select(LinkModel).where(
                LinkModel.shop_id == shop.id,
                LinkModel.platform == platform,
            ).limit(1)
        )
        link = link_result.scalar_one_or_none()

        if link is None:
            link = LinkModel(
                shop_id=shop.id,
                platform=platform,
                platform_shop_id=platform_shop_id,
                platform_url=shop_data.get("url", shop_data.get("platform_url", "")),
                extra_data={
                    "delivery_fee": float(shop_data.get("delivery_fee", 0)),
                    "min_delivery_time": int(shop_data.get("min_delivery_time", 25)),
                    "max_delivery_time": int(shop_data.get("max_delivery_time", 45)),
                    "rating": float(shop_data.get("rating", shop.rating)),
                },
            )
            db.add(link)
        else:
            link.extra_data = {
                "delivery_fee": float(shop_data.get("delivery_fee", 0)),
                "min_delivery_time": int(shop_data.get("min_delivery_time", 25)),
                "max_delivery_time": int(shop_data.get("max_delivery_time", 45)),
                "rating": float(shop_data.get("rating", shop.rating)),
            }

        db.commit()
    except Exception as e:
        db.rollback()
        logger.error("Save shop to DB failed: %s", e)
        raise
    finally:
        db.close()


def _save_menu_to_db(platform: str, data: dict) -> int:
    session_local = _get_sync_session_local()
    db = session_local()
    saved = 0

    try:
        from sqlalchemy import select as sa_select
        from app.models.shop import Shop as ShopModel
        from app.models.product import Product as ProductModel
        from app.models.price import PriceSnapshot as PriceModel
        from app.models.coupon import Coupon as CouponModel, CouponType

        shop_data = data.get("shop", {})
        shop_name = shop_data.get("name", "")

        if not shop_name:
            return 0

        result = db.execute(sa_select(ShopModel).where(ShopModel.name == shop_name).limit(1))
        shop = result.scalar_one_or_none()

        if shop is None:
            shop = ShopModel(
                name=shop_name,
                image_url=shop_data.get("image_url", ""),
                rating=float(shop_data.get("rating", 0)),
                category=shop_data.get("category", ""),
                address=shop_data.get("address", ""),
            )
            db.add(shop)
            db.flush()

        products = data.get("products", [])
        for p in products:
            p_name = p.get("name", "")
            if not p_name:
                continue

            p_result = db.execute(
                sa_select(ProductModel).where(
                    ProductModel.shop_id == shop.id,
                    ProductModel.name == p_name,
                ).limit(1)
            )
            product = p_result.scalar_one_or_none()

            if product is None:
                product = ProductModel(
                    shop_id=shop.id,
                    name=p_name,
                    image_url=p.get("image_url", ""),
                    category=p.get("category", ""),
                    is_available=True,
                )
                db.add(product)
                db.flush()

            base_price = float(p.get("price", 0))
            delivery_fee = float(p.get("delivery_fee", 0))
            final_price = base_price + delivery_fee

            snapshot = PriceModel(
                product_id=product.id,
                platform=platform,
                base_price=base_price,
                package_fee=float(p.get("package_fee", 0)),
                delivery_fee=delivery_fee,
                min_order_amount=float(p.get("min_order_amount", 0)),
                final_price=final_price,
                source="crawler",
            )
            db.add(snapshot)
            saved += 1

        coupons = data.get("coupons", [])
        now = datetime.now(timezone.utc)
        for c in coupons:
            title = c.get("title", c.get("name", ""))
            if not title:
                continue

            coupon = CouponModel(
                title=title,
                type=CouponType.FULL_REDUCTION if c.get("min_spend", 0) > 0 else CouponType.DIRECT,
                value=float(c.get("value", c.get("discount", 0))),
                min_spend=float(c.get("min_spend", c.get("threshold", 0))),
                platform=platform,
                description=c.get("description", ""),
                start_time=now,
                expire_time=datetime(2026, 12, 31, tzinfo=timezone.utc),
                is_active=True,
            )
            db.add(coupon)

        db.commit()
    except Exception as e:
        db.rollback()
        logger.error("Save menu to DB failed: %s", e)
    finally:
        db.close()

    return saved


async def _update_search_cache(keyword: str, city: str, platform: str, shops: list):
    cache_key = f"shop_search:{keyword}:{city}:{platform}"
    import json
    await cache_set(cache_key, json.dumps(shops, ensure_ascii=False), ttl=1800)
