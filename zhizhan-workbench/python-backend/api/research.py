import asyncio
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from database.connection import get_session
from database.models import Stock, Financial, Report
from ai.report_generator import report_generator
from ai.rag import rag_pipeline
from collectors.financials import FinancialCollector

router = APIRouter(prefix="/api/research", tags=["research"])

financial_collector = FinancialCollector()


class ResearchRequest(BaseModel):
    stock_code: str
    report_type: str = "deep_research"


@router.post("/generate")
async def generate_report(request: ResearchRequest):
    loop = asyncio.get_event_loop()

    if request.report_type == "quick":
        result = await loop.run_in_executor(
            None, report_generator.generate_quick_analysis, request.stock_code
        )
    else:
        result = await loop.run_in_executor(
            None, report_generator.generate_deep_report, request.stock_code
        )

    return result


@router.get("/reports")
async def list_reports(
    stock_id: int | None = None,
    limit: int = 20,
    session: AsyncSession = Depends(get_session),
):
    query = select(Report).order_by(Report.created_at.desc())

    if stock_id:
        query = query.where(Report.stock_id == stock_id)

    query = query.limit(limit)
    result = await session.execute(query)
    reports = result.scalars().all()

    stock_map = {}
    if reports:
        stock_ids = list(set(r.stock_id for r in reports if r.stock_id))
        if stock_ids:
            stocks_result = await session.execute(
                select(Stock).where(Stock.id.in_(stock_ids))
            )
            stock_map = {s.id: s.name for s in stocks_result.scalars().all()}

    return [
        {
            "id": r.id,
            "stock_id": r.stock_id,
            "stock_name": stock_map.get(r.stock_id, ""),
            "report_type": r.report_type,
            "title": r.title,
            "model_used": r.model_used,
            "created_at": str(r.created_at) if r.created_at else None,
        }
        for r in reports
    ]


@router.get("/reports/{report_id}")
async def get_report(report_id: int, session: AsyncSession = Depends(get_session)):
    result = await session.execute(select(Report).where(Report.id == report_id))
    report = result.scalar_one_or_none()
    if not report:
        return {"error": "Report not found"}

    stock_name = ""
    if report.stock_id:
        stock_result = await session.execute(
            select(Stock).where(Stock.id == report.stock_id)
        )
        stock = stock_result.scalar_one_or_none()
        if stock:
            stock_name = stock.name

    return {
        "id": report.id,
        "stock_id": report.stock_id,
        "stock_name": stock_name,
        "report_type": report.report_type,
        "title": report.title,
        "content_markdown": report.content_markdown,
        "model_used": report.model_used,
        "tokens_used": report.tokens_used,
        "created_at": str(report.created_at) if report.created_at else None,
    }


@router.post("/index-rag")
async def index_rag(stock_code: str):
    result = rag_pipeline.index_stock_documents(stock_code)
    return result


@router.post("/collect-financials")
async def collect_financials(stock_code: str):
    loop = asyncio.get_event_loop()
    result = await loop.run_in_executor(
        None, financial_collector.collect, stock_code
    )
    return result
