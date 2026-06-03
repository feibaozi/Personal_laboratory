import json
import logging
from typing import Optional

from fastapi import APIRouter, Depends, Query, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.user import User
from app.routers.auth import get_current_user
from app.collectors.crawler_manager import crawler_manager
from app.services.crawl_service import CrawlService
from app.redis_client import cache_get, cache_set

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/crawl", tags=["crawl"])


class CrawlUrlRequest(BaseModel):
    url: str
    platform: Optional[str] = None


class SearchShopsRequest(BaseModel):
    keyword: str
    city: str = "北京"
    platforms: list[str] = ["meituan"]
    latitude: Optional[float] = None
    longitude: Optional[float] = None


class ShopMenuRequest(BaseModel):
    platform: str
    shop_url: Optional[str] = None
    shop_id: Optional[str] = None


@router.post("/search")
async def search_shops(
    req: SearchShopsRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    service = CrawlService(db)
    cached = await service.search_shops_cached(
        keyword=req.keyword,
        city=req.city,
        platform=req.platforms[0] if len(req.platforms) == 1 else None,
    )
    if cached:
        return {
            "source": "cache",
            "keyword": req.keyword,
            "city": req.city,
            "total_shops": len(cached),
            "shops": cached,
        }

    result = await crawler_manager.search_shops(
        keyword=req.keyword,
        city=req.city,
        platforms=req.platforms,
        latitude=req.latitude,
        longitude=req.longitude,
    )

    shops = result.get("shops", [])
    if shops:
        for platform, platform_data in result.get("platform_results", {}).items():
            if platform_data.get("success") and platform_data.get("data", {}).get("shops"):
                try:
                    await service.save_crawled_data(platform, platform_data["data"])
                except Exception as e:
                    logger.warning("Save crawled shops failed: %s", e)

    return result


@router.post("/url")
async def crawl_from_url(
    req: CrawlUrlRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await crawler_manager.collect_from_url(req.url)
    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("message", "采集失败"))

    service = CrawlService(db)
    try:
        saved = await service.save_crawled_data(
            result.get("platform", "meituan"),
            result.get("data", result),
        )
        result["saved"] = saved
    except Exception as e:
        logger.warning("Save crawled URL data failed: %s", e)
        result["saved"] = {"error": str(e)}

    return result


@router.post("/menu")
async def get_shop_menu(
    req: ShopMenuRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if not req.shop_url and not req.shop_id:
        raise HTTPException(status_code=400, detail="需要提供 shop_url 或 shop_id")

    result = await crawler_manager.get_shop_menu(
        platform=req.platform,
        shop_url=req.shop_url,
        shop_id=req.shop_id,
    )
    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("message", "采集失败"))

    service = CrawlService(db)
    try:
        saved = await service.save_crawled_data(req.platform, result.get("data", result))
        result["saved"] = saved
    except Exception as e:
        logger.warning("Save crawled menu failed: %s", e)
        result["saved"] = {"error": str(e)}

    return result


@router.get("/shops/search")
async def search_shops_cached(
    keyword: str = Query(..., description="搜索关键词"),
    city: str = Query(default="北京"),
    platform: str = Query(default=None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    service = CrawlService(db)
    shops = await service.search_shops_cached(keyword=keyword, city=city, platform=platform)

    if shops:
        return {
            "source": "database",
            "keyword": keyword,
            "city": city,
            "total_shops": len(shops),
            "shops": shops,
        }

    from app.tasks.crawl_tasks import crawl_shop_by_keyword
    crawl_shop_by_keyword.delay(keyword, city, platform or "meituan")

    return {
        "source": "crawling",
        "keyword": keyword,
        "city": city,
        "total_shops": 0,
        "shops": [],
        "message": "正在采集数据，请稍后刷新查看",
    }


@router.get("/shops/{shop_id}")
async def get_shop_detail(
    shop_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    service = CrawlService(db)
    detail = await service.get_shop_detail_cached(shop_id)
    if not detail:
        raise HTTPException(status_code=404, detail="店铺不存在")
    return {"source": "database", "data": detail}


@router.get("/compliance")
async def get_compliance_report(
    current_user: User = Depends(get_current_user),
):
    return crawler_manager.get_compliance_report()


@router.get("/stats")
async def get_daily_stats(
    current_user: User = Depends(get_current_user),
):
    return crawler_manager.get_daily_stats()


@router.get("/platforms")
async def list_platforms():
    from app.collectors.crawler_manager import PLATFORM_NAMES, PLATFORM_COLLECTORS, PLATFORM_ROBOTS_STATUS
    return {
        "platforms": [
            {
                "id": pid,
                "name": PLATFORM_NAMES.get(pid, pid),
                "supported": pid in PLATFORM_COLLECTORS,
                "robots_allowed": PLATFORM_ROBOTS_STATUS.get(pid, {}).get("allowed"),
                "robots_note": PLATFORM_ROBOTS_STATUS.get(pid, {}).get("note", ""),
            }
            for pid in PLATFORM_NAMES
        ]
    }


@router.post("/trigger/popular")
async def trigger_popular_crawl(
    current_user: User = Depends(get_current_user),
):
    from app.tasks.crawl_tasks import crawl_popular_shops
    task = crawl_popular_shops.delay()
    return {
        "status": "dispatched",
        "task_id": task.id,
        "message": "热门店铺爬取任务已提交，预计5-10分钟完成",
    }
