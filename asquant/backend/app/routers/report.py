from fastapi import APIRouter, Depends
from fastapi.responses import HTMLResponse, Response
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db
from ..services.report_service import ReportService

router = APIRouter(prefix="/api/v1/report", tags=["report"])


@router.get("/{run_id}/metrics")
async def report_metrics(run_id: str, db: AsyncSession = Depends(get_db)):
    svc = ReportService(db)
    data = await svc.get_full_metrics(run_id)
    if not data:
        return {"error": "not found"}
    return data


@router.get("/{run_id}/export/html", response_class=HTMLResponse)
async def report_html(run_id: str, db: AsyncSession = Depends(get_db)):
    svc = ReportService(db)
    html = await svc.generate_html(run_id)
    if not html:
        return HTMLResponse(content="<h1>Report not found</h1>", status_code=404)
    return HTMLResponse(content=html)


@router.get("/{run_id}/export/pdf")
async def report_pdf(run_id: str, db: AsyncSession = Depends(get_db)):
    svc = ReportService(db)
    pdf_bytes = await svc.generate_pdf(run_id)
    if not pdf_bytes:
        return Response(content="PDF generation failed", status_code=500)
    is_html = pdf_bytes.startswith(b"<!DOCTYPE") or pdf_bytes.startswith(b"<html")
    media_type = "text/html" if is_html else "application/pdf"
    filename = f"report_{run_id}.{'html' if is_html else 'pdf'}"
    return Response(
        content=pdf_bytes,
        media_type=media_type,
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )
