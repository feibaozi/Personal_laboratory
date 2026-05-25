from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.user import User
from app.schemas.user import (
    PreferenceUpdate, PreferenceResponse,
    OrderHistoryItem, OrderHistoryList,
)
from app.services.user_service import (
    get_preference, upsert_preference,
    get_order_history, add_order_history,
)
from app.routers.auth import get_current_user

router = APIRouter(prefix="/api/user", tags=["user"])


@router.get("/preference", response_model=PreferenceResponse)
async def read_preference(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    pref = await get_preference(db, current_user.id)
    if not pref:
        return PreferenceResponse(
            cuisine_weights={},
            taste_weights={},
            avg_order_amount=0.0,
            price_sensitivity=0.5,
            preferred_platforms=[],
            preferred_delivery_time=30,
        )
    return PreferenceResponse(
        cuisine_weights=pref.cuisine_weights or {},
        taste_weights=pref.taste_weights or {},
        avg_order_amount=pref.avg_order_amount or 0.0,
        price_sensitivity=pref.price_sensitivity or 0.5,
        preferred_platforms=pref.preferred_platforms or [],
        preferred_delivery_time=pref.preferred_delivery_time or 30,
        updated_at=pref.updated_at.isoformat() if pref.updated_at else None,
    )


@router.put("/preference", response_model=PreferenceResponse)
async def update_preference(
    data: PreferenceUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    pref = await upsert_preference(
        db, current_user.id, data.model_dump()
    )
    return PreferenceResponse(
        cuisine_weights=pref.cuisine_weights or {},
        taste_weights=pref.taste_weights or {},
        avg_order_amount=pref.avg_order_amount or 0.0,
        price_sensitivity=pref.price_sensitivity or 0.5,
        preferred_platforms=pref.preferred_platforms or [],
        preferred_delivery_time=pref.preferred_delivery_time or 30,
        updated_at=pref.updated_at.isoformat() if pref.updated_at else None,
    )


@router.get("/orders", response_model=OrderHistoryList)
async def list_orders(
    limit: int = 50,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    orders = await get_order_history(db, current_user.id, limit)
    items = [
        OrderHistoryItem(
            id=o.id,
            shop_id=o.shop_id,
            shop_name=o.shop_name,
            platform=o.platform,
            order_amount=o.order_amount,
            actual_amount=o.actual_amount,
            savings=o.savings,
            order_time=o.order_time.isoformat() if o.order_time else "",
        )
        for o in orders
    ]
    total_savings = sum(o.savings for o in orders)
    return OrderHistoryList(items=items, total_savings=total_savings)


@router.post("/orders", response_model=OrderHistoryItem)
async def create_order(
    data: dict,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    order = await add_order_history(db, current_user.id, data)
    return OrderHistoryItem(
        id=order.id,
        shop_id=order.shop_id,
        shop_name=order.shop_name,
        platform=order.platform,
        order_amount=order.order_amount,
        actual_amount=order.actual_amount,
        savings=order.savings,
        order_time=order.order_time.isoformat() if order.order_time else "",
    )