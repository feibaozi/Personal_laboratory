from datetime import datetime
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User, UserPreference
from app.models.order import OrderHistory


async def get_preference(session: AsyncSession, user_id: int) -> UserPreference | None:
    result = await session.execute(
        select(UserPreference).where(UserPreference.user_id == user_id)
    )
    return result.scalar_one_or_none()


async def upsert_preference(
    session: AsyncSession, user_id: int, data: dict
) -> UserPreference:
    pref = await get_preference(session, user_id)
    if pref:
        for k, v in data.items():
            setattr(pref, k, v)
        pref.updated_at = datetime.utcnow()
    else:
        pref = UserPreference(user_id=user_id, **data)
        session.add(pref)
    await session.commit()
    await session.refresh(pref)
    return pref


async def get_order_history(
    session: AsyncSession, user_id: int, limit: int = 50
) -> list[OrderHistory]:
    result = await session.execute(
        select(OrderHistory)
        .where(OrderHistory.user_id == user_id)
        .order_by(OrderHistory.order_time.desc())
        .limit(limit)
    )
    return list(result.scalars().all())


async def add_order_history(
    session: AsyncSession, user_id: int, data: dict
) -> OrderHistory:
    order = OrderHistory(user_id=user_id, **data)
    session.add(order)
    await session.commit()
    await session.refresh(order)
    return order