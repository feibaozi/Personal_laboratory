import logging

from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.routers.auth import get_current_user
from app.models.user import User
from app.services.recommend_service import RecommendService
from app.schemas.recommend import (
    RecommendRequest,
    RecommendResponse,
    BehaviorLogRequest,
    BehaviorLogResponse,
    BehaviorListResponse,
    BehaviorItem,
    RecommendHistoryResponse,
    RecommendHistoryItem,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/recommend", tags=["recommend"])


@router.post("/shops", response_model=RecommendResponse)
async def recommend_shops(
    req: RecommendRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service = RecommendService(db)
    items = await service.recommend_shops(
        user_id=current_user.id,
        limit=req.limit,
        platform=req.platform,
    )
    return RecommendResponse(
        user_id=current_user.id,
        recommend_type="shop",
        items=items,
        total=len(items),
    )


@router.post("/products", response_model=RecommendResponse)
async def recommend_products(
    req: RecommendRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service = RecommendService(db)
    items = await service.recommend_products(
        user_id=current_user.id,
        limit=req.limit,
        platform=req.platform,
    )
    return RecommendResponse(
        user_id=current_user.id,
        recommend_type="product",
        items=items,
        total=len(items),
    )


@router.post("/behavior", response_model=BehaviorLogResponse)
async def log_behavior(
    req: BehaviorLogRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    valid_types = {"order", "click", "view", "search", "favorite", "compare"}
    if req.behavior_type not in valid_types:
        raise HTTPException(
            status_code=400,
            detail=f"无效行为类型: {req.behavior_type}，支持: {', '.join(valid_types)}",
        )

    valid_targets = {"shop", "product", "coupon"}
    if req.target_type not in valid_targets:
        raise HTTPException(
            status_code=400,
            detail=f"无效目标类型: {req.target_type}，支持: {', '.join(valid_targets)}",
        )

    service = RecommendService(db)
    success = await service.log_behavior(
        user_id=current_user.id,
        behavior_type=req.behavior_type,
        target_type=req.target_type,
        target_id=req.target_id,
        target_name=req.target_name,
        context=req.context,
    )

    return BehaviorLogResponse(
        success=success,
        message="行为记录成功" if success else "行为记录失败",
    )


@router.get("/behaviors", response_model=BehaviorListResponse)
async def get_behaviors(
    limit: int = Query(default=50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service = RecommendService(db)
    behaviors = await service.get_user_behaviors(
        user_id=current_user.id, limit=limit,
    )
    return BehaviorListResponse(
        user_id=current_user.id,
        behaviors=[BehaviorItem(**b) for b in behaviors],
        total=len(behaviors),
    )


@router.get("/history", response_model=RecommendHistoryResponse)
async def get_recommend_history(
    recommend_type: str = Query(default="shop", description="推荐类型: shop / product"),
    limit: int = Query(default=5, ge=1, le=20),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service = RecommendService(db)
    history = await service.get_recommend_history(
        user_id=current_user.id,
        recommend_type=recommend_type,
        limit=limit,
    )
    return RecommendHistoryResponse(
        user_id=current_user.id,
        history=[RecommendHistoryItem(**h) for h in history],
        total=len(history),
    )