import asyncio
import pandas as pd
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_
from pydantic import BaseModel
from database.connection import get_session
from database.models import Stock, Financial
from collectors.stock_info import StockInfoCollector
from collectors.financials import FinancialCollector

router = APIRouter(prefix="/api/stocks", tags=["stocks"])

stock_info_collector = StockInfoCollector()
financial_collector = FinancialCollector()


class StockCreate(BaseModel):
    code: str
    name: str
    market: str | None = None
    industry: str | None = None
    watch_status: str = "observing"
    notes: str = ""


class StockUpdate(BaseModel):
    name: str | None = None
    market: str | None = None
    industry: str | None = None
    watch_status: str | None = None
    notes: str | None = None


class StockResponse(BaseModel):
    id: int
    code: str
    name: str
    market: str | None
    industry: str | None
    watch_status: str
    notes: str

    class Config:
        from_attributes = True


@router.get("/", response_model=list[StockResponse])
async def list_stocks(session: AsyncSession = Depends(get_session)):
    result = await session.execute(
        select(Stock).order_by(Stock.watch_status, Stock.id)
    )
    return result.scalars().all()


@router.get("/search")
async def search_stocks(q: str, session: AsyncSession = Depends(get_session)):
    keyword = q.strip()
    results = []
    fallback_to_online = True

    db_result = await session.execute(
        select(Stock).where(
            or_(
                Stock.code.contains(keyword),
                Stock.name.contains(keyword),
            )
        ).limit(20)
    )
    local_stocks = db_result.scalars().all()

    if local_stocks:
        results = [
            {
                "code": s.code,
                "name": s.name,
                "market": s.market or "",
                "price": 0,
                "change_pct": 0,
            }
            for s in local_stocks
        ]
        fallback_to_online = False

    if fallback_to_online:
        try:
            import akshare as ak

            def _fetch():
                df = ak.stock_zh_a_spot_em()
                mask = df["代码"].astype(str).str.contains(keyword) | df["名称"].astype(str).str.contains(keyword)
                return df[mask].head(20)

            df = await asyncio.wait_for(
                asyncio.get_event_loop().run_in_executor(None, _fetch),
                timeout=12,
            )

            for _, row in df.iterrows():
                code = str(row.get("代码", ""))
                name = str(row.get("名称", ""))
                market = "SH" if code.startswith("6") else "SZ"
                price = row.get("最新价", 0)
                change_pct = row.get("涨跌幅", 0)

                results.append(
                    {
                        "code": code,
                        "name": name,
                        "market": market,
                        "price": float(price) if pd.notna(price) else 0,
                        "change_pct": float(change_pct) if pd.notna(change_pct) else 0,
                    }
                )
        except asyncio.TimeoutError:
            pass
        except Exception:
            pass

    return results


@router.get("/watchlist")
async def get_watchlist(session: AsyncSession = Depends(get_session)):
    result = await session.execute(
        select(Stock).where(Stock.watch_status.in_(["focused", "observing"]))
    )
    stocks = result.scalars().all()
    return [StockResponse.model_validate(s) for s in stocks]


@router.get("/{stock_id}", response_model=StockResponse)
async def get_stock(stock_id: int, session: AsyncSession = Depends(get_session)):
    result = await session.execute(select(Stock).where(Stock.id == stock_id))
    stock = result.scalar_one_or_none()
    if not stock:
        raise HTTPException(status_code=404, detail="Stock not found")
    return stock


@router.get("/{stock_id}/financials")
async def get_stock_financials(
    stock_id: int, session: AsyncSession = Depends(get_session)
):
    result = await session.execute(select(Stock).where(Stock.id == stock_id))
    stock = result.scalar_one_or_none()
    if not stock:
        raise HTTPException(status_code=404, detail="Stock not found")

    fin_result = await session.execute(
        select(Financial)
        .where(Financial.stock_id == stock_id)
        .order_by(Financial.report_date.desc())
    )
    financials = fin_result.scalars().all()

    return [
        {
            "id": f.id,
            "report_date": f.report_date,
            "report_type": f.report_type,
            "revenue": f.revenue,
            "net_profit": f.net_profit,
            "total_assets": f.total_assets,
            "total_liabilities": f.total_liabilities,
            "operating_cf": f.operating_cf,
            "gross_margin": f.gross_margin,
            "roe": f.roe,
            "debt_ratio": f.debt_ratio,
            "receivables": f.receivables,
        }
        for f in financials
    ]


@router.post("/", response_model=StockResponse)
async def create_stock(
    data: StockCreate, session: AsyncSession = Depends(get_session)
):
    existing = await session.execute(
        select(Stock).where(Stock.code == data.code)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Stock already exists")

    stock = Stock(**data.model_dump())
    session.add(stock)
    await session.commit()
    await session.refresh(stock)

    try:
        detail = await stock_info_collector.get_stock_detail(data.code)
        if detail and detail.get("industry"):
            stock.industry = detail["industry"]
            await session.commit()
            await session.refresh(stock)
    except Exception:
        pass

    return stock


@router.post("/{stock_id}/collect-financials")
async def collect_financials(stock_id: int, session: AsyncSession = Depends(get_session)):
    result = await session.execute(select(Stock).where(Stock.id == stock_id))
    stock = result.scalar_one_or_none()
    if not stock:
        raise HTTPException(status_code=404, detail="Stock not found")

    data = await financial_collector.collect(stock.code)
    return data


@router.put("/{stock_id}", response_model=StockResponse)
async def update_stock(
    stock_id: int,
    data: StockUpdate,
    session: AsyncSession = Depends(get_session),
):
    result = await session.execute(select(Stock).where(Stock.id == stock_id))
    stock = result.scalar_one_or_none()
    if not stock:
        raise HTTPException(status_code=404, detail="Stock not found")

    update_data = data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(stock, key, value)

    await session.commit()
    await session.refresh(stock)
    return stock


@router.delete("/{stock_id}")
async def delete_stock(stock_id: int, session: AsyncSession = Depends(get_session)):
    result = await session.execute(select(Stock).where(Stock.id == stock_id))
    stock = result.scalar_one_or_none()
    if not stock:
        raise HTTPException(status_code=404, detail="Stock not found")

    await session.delete(stock)
    await session.commit()
    return {"ok": True}
