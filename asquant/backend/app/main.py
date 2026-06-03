import logging
from contextlib import asynccontextmanager
from pathlib import Path
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from datetime import date, timedelta

from .database import init_db, async_session
from .routers import data, market, factor, backtest, report, paper, strategy
from .services.seed import seed_factors

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("asquant")

scheduler = AsyncIOScheduler()


async def _auto_sync():
    try:
        from .services.data_service import SyncManager
        async with async_session() as db:
            mgr = SyncManager(db)
            end_str = date.today().isoformat()
            start_str = (date.today() - timedelta(days=7)).isoformat()
            results = await mgr.sync_selected(["daily_quotes", "indices"], start_date=start_str, end_date=end_str)
            await db.commit()
            logger.info(f"Auto-sync completed: {results}")
    except Exception as e:
        logger.error(f"Auto-sync failed: {e}")


async def _paper_trade_daily():
    try:
        from .models.backtest import PaperTradeRun
        from .engine.paper_engine import PaperTradeEngine
        async with async_session() as db:
            result = await db.execute(
                __import__("sqlalchemy").sql.select(PaperTradeRun).where(PaperTradeRun.status == "active")
            )
            active_runs = result.scalars().all()
            if not active_runs:
                return
            engine = PaperTradeEngine(db)
            today = date.today()
            for run in active_runs:
                try:
                    r = await engine.run_once(run.id, today)
                    logger.info(f"[{today}] Paper run {run.id}: {r.get('signals', 0)} signals, {r.get('filled', 0)} filled")
                except Exception as e:
                    logger.error(f"[{today}] Paper run {run.id} failed: {e}")
    except Exception as e:
        logger.error(f"Paper trade daily failed: {e}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    async with async_session() as db:
        await seed_factors(db)
        from .models.strategy import seed_strategies
        await seed_strategies(db)
    scheduler.add_job(_auto_sync, CronTrigger(hour=15, minute=31, timezone="Asia/Shanghai"), id="daily_sync")
    scheduler.add_job(_paper_trade_daily, CronTrigger(hour=15, minute=32, day_of_week="mon-fri", timezone="Asia/Shanghai"), id="paper_daily")
    scheduler.start()
    logger.info("AsQuant startup complete")
    yield
    scheduler.shutdown(wait=False)


app = FastAPI(title="AsQuant", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(data.router)
app.include_router(market.router)
app.include_router(factor.router)
app.include_router(backtest.router)
app.include_router(report.router)
app.include_router(paper.router)
app.include_router(strategy.router)


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.exception(f"Unhandled error on {request.method} {request.url.path}")
    return JSONResponse(
        status_code=500,
        content={"error": str(type(exc).__name__), "detail": str(exc)[:500]},
    )


@app.get("/api/health")
async def health():
    return {"status": "ok"}


frontend_dist = Path(__file__).parent.parent.parent / "frontend" / "dist"
if frontend_dist.exists():
    assets_dir = frontend_dist / "assets"
    if assets_dir.exists():
        app.mount("/assets", StaticFiles(directory=str(assets_dir)), name="assets")

    index_html = frontend_dist / "index.html"

    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str, request: Request):
        if full_path.startswith("api/"):
            from fastapi.responses import JSONResponse
            return JSONResponse({"detail": "Not Found"}, status_code=404)
        path = frontend_dist / full_path
        if path.is_file():
            return FileResponse(path)
        return FileResponse(index_html)
