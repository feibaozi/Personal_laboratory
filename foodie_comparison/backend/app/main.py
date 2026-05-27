from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from loguru import logger

from app.config import settings
from app.database import init_db, close_db
from app.redis_client import close_redis
from app.models import *  # noqa: 确保所有模型在 init_db 前注册


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Initializing database...")
    await init_db()
    logger.info("Database initialized")
    yield
    logger.info("Shutting down...")
    await close_db()
    await close_redis()
    logger.info("Shutdown complete")


app = FastAPI(
    title="Foodie Comparison API",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

from app.routers import auth, user, ocr, compare, recommend, home, admin
app.include_router(auth.router)
app.include_router(user.router)
app.include_router(ocr.router)
app.include_router(compare.router)
app.include_router(recommend.router)
app.include_router(home.router)
app.include_router(admin.router)


@app.get("/health")
async def health():
    return {"status": "ok", "version": "0.1.0"}


@app.get("/health/ready")
async def readiness():
    try:
        from app.redis_client import get_redis
        redis = await get_redis()
        await redis.ping()
        return {"status": "ready", "db": "ok", "redis": "ok"}
    except Exception as e:
        return {"status": "not_ready", "error": str(e)}