from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from database.connection import get_session
from database.models import Alert, Stock
from ai.alert_engine import alert_engine

router = APIRouter(prefix="/api/alerts", tags=["alerts"])


@router.get("/")
async def list_alerts(
    unread_only: bool = False,
    severity: str | None = None,
    limit: int = 50,
    session: AsyncSession = Depends(get_session),
):
    query = select(Alert).order_by(Alert.created_at.desc())

    if unread_only:
        query = query.where(Alert.is_read == False)
    if severity:
        query = query.where(Alert.severity == severity)

    query = query.where(Alert.dismissed == False).limit(limit)
    result = await session.execute(query)
    alerts = result.scalars().all()

    stock_map = {}
    if alerts:
        stock_ids = list(set(a.stock_id for a in alerts if a.stock_id))
        if stock_ids:
            stocks_result = await session.execute(
                select(Stock).where(Stock.id.in_(stock_ids))
            )
            stock_map = {s.id: s.name for s in stocks_result.scalars().all()}

    return [
        {
            "id": a.id,
            "stock_id": a.stock_id,
            "stock_name": stock_map.get(a.stock_id, ""),
            "alert_type": a.alert_type,
            "severity": a.severity,
            "title": a.title,
            "description": a.description,
            "is_read": a.is_read,
            "dismissed": a.dismissed,
            "created_at": str(a.created_at) if a.created_at else None,
        }
        for a in alerts
    ]


@router.get("/count")
async def get_unread_count(session: AsyncSession = Depends(get_session)):
    result = await session.execute(
        select(Alert).where(Alert.is_read == False, Alert.dismissed == False)
    )
    alerts = result.scalars().all()
    return {"unread": len(alerts)}


@router.put("/{alert_id}/read")
async def mark_alert_read(
    alert_id: int, session: AsyncSession = Depends(get_session)
):
    result = await session.execute(select(Alert).where(Alert.id == alert_id))
    alert = result.scalar_one_or_none()
    if alert:
        alert.is_read = True
        await session.commit()
    return {"ok": True}


@router.put("/{alert_id}/dismiss")
async def dismiss_alert(
    alert_id: int, session: AsyncSession = Depends(get_session)
):
    result = await session.execute(select(Alert).where(Alert.id == alert_id))
    alert = result.scalar_one_or_none()
    if alert:
        alert.dismissed = True
        await session.commit()
    return {"ok": True}


@router.post("/run-checks")
async def run_alert_checks():
    result = alert_engine.run_all_checks()
    return result
