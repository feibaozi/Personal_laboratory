import logging

from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.routers.auth import get_current_user
from app.models.user import User
from app.services.compare_service import CompareService
from app.schemas.compare import (
    CompareProductRequest,
    CompareProductResponse,
    CompareShopResponse,
    SavingRankResponse,
    PlatformPriceDetail,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/compare", tags=["compare"])


@router.post("/product", response_model=CompareProductResponse)
async def compare_product(
    req: CompareProductRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service = CompareService(db)
    results = await service.compare_product(
        product_name=req.product_name,
        platforms=req.platforms,
        user_coupons=req.user_coupons,
    )

    best_platform = ""
    best_price = 0
    max_savings = 0

    if results:
        best = results[0]
        best_platform = best["platform"]
        best_price = best["final_price"]
        if len(results) > 1:
            max_savings = round(
                max(r["original_total"] for r in results) - best_price, 2
            )

    return CompareProductResponse(
        product_name=req.product_name,
        results=[PlatformPriceDetail(**r) for r in results],
        best_platform=best_platform,
        best_price=best_price,
        max_savings=max_savings,
    )


@router.get("/shop", response_model=CompareShopResponse)
async def compare_shop(
    shop_name: str = Query(..., description="店铺名称关键词"),
    platforms: str = Query(
        default="meituan,eleme,jd_waimai",
        description="逗号分隔的平台列表",
    ),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service = CompareService(db)
    platform_list = [p.strip() for p in platforms.split(",") if p.strip()]
    results = await service.compare_shop(shop_name, platform_list)

    return CompareShopResponse(
        shop_name=shop_name,
        results=results,
    )


@router.get("/saving-rank", response_model=SavingRankResponse)
async def saving_rank(
    platform: str = Query(default=None, description="筛选平台"),
    limit: int = Query(default=10, ge=1, le=50, description="返回数量"),
    db: AsyncSession = Depends(get_db),
):
    service = CompareService(db)
    items = await service.get_saving_rank(platform=platform, limit=limit)

    return SavingRankResponse(
        items=items,
        total=len(items),
    )