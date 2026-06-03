import json
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete

from ..database import get_db
from ..models.strategy import Strategy

router = APIRouter(prefix="/api/v1/strategies", tags=["strategies"])


@router.get("")
async def list_strategies(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Strategy).order_by(Strategy.category, Strategy.created_at.desc())
    )
    strategies = result.scalars().all()
    return {
        "strategies": [{
            "id": s.id,
            "name": s.name,
            "description": s.description,
            "config": s.get_config(),
            "category": s.category,
            "created_at": s.created_at.isoformat() if s.created_at else None,
            "updated_at": s.updated_at.isoformat() if s.updated_at else None,
        } for s in strategies]
    }


@router.post("")
async def create_strategy(body: dict, db: AsyncSession = Depends(get_db)):
    s = Strategy(
        name=body.get("name", "Untitled Strategy"),
        description=body.get("description"),
        category=body.get("category", "custom"),
    )
    config = body.get("config", {})
    s.set_config(config)
    db.add(s)
    await db.commit()
    await db.refresh(s)
    return {
        "id": s.id,
        "name": s.name,
        "description": s.description,
        "config": s.get_config(),
        "category": s.category,
    }


@router.put("/{strategy_id}")
async def update_strategy(strategy_id: int, body: dict, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Strategy).where(Strategy.id == strategy_id))
    s = result.scalar_one_or_none()
    if not s:
        return {"error": "Strategy not found"}
    if "name" in body:
        s.name = body["name"]
    if "description" in body:
        s.description = body["description"]
    if "config" in body:
        s.set_config(body["config"])
    await db.commit()
    return {
        "id": s.id,
        "name": s.name,
        "description": s.description,
        "config": s.get_config(),
        "category": s.category,
    }


@router.delete("/{strategy_id}")
async def delete_strategy(strategy_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Strategy).where(Strategy.id == strategy_id))
    s = result.scalar_one_or_none()
    if s:
        await db.delete(s)
        await db.commit()
    return {"ok": True}
