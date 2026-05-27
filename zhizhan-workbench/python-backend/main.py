import os
import logging
import uvicorn
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from config import settings
from database.connection import init_db
from api.stocks import router as stocks_router
from api.research import router as research_router
from api.sentiment import router as sentiment_router
from api.alerts import router as alerts_router
from api.settings_api import router as settings_router
from collectors.scheduler import start_scheduler, stop_scheduler

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(name)s] %(levelname)s: %(message)s",
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    os.makedirs("data", exist_ok=True)
    await init_db()
    start_scheduler()
    logging.info(f"[API] Server started on port {settings.python_port}")
    yield
    stop_scheduler()
    logging.info("[API] Server shutting down")


app = FastAPI(title="智研工作台 API", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(stocks_router)
app.include_router(research_router)
app.include_router(sentiment_router)
app.include_router(alerts_router)
app.include_router(settings_router)


@app.get("/health")
async def health_check():
    return {"status": "ok", "version": "0.1.0"}


if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host="127.0.0.1",
        port=settings.python_port,
        reload=settings.debug,
    )
