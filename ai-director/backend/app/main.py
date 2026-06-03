from pathlib import Path
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from starlette.middleware.base import BaseHTTPMiddleware

from app.config import settings
from app.logging_config import setup_logging
setup_logging(level="INFO", log_file=settings.log_file)

from app.routers.project import router as project_router
from app.routers.material import router as material_router
from app.routers.narrative import router as narrative_router
from app.routers.compose import router as compose_router
from app.services.pipeline_service import set_main_loop
import asyncio

app = FastAPI(title="AI Director API")

# CORS 配置：从环境变量读取允许源
_cors_origins = [o.strip() for o in settings.cors_origins.split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# API Key 认证中间件
_AUTH_WHITELIST = {"/api/health", "/docs", "/openapi.json", "/redoc"}


class APIKeyMiddleware(BaseHTTPMiddleware):
    """检查请求头 X-API-Key 是否匹配环境变量，未配置则跳过认证"""

    async def dispatch(self, request: Request, call_next):
        if not settings.api_key:
            return await call_next(request)

        # 白名单路径跳过认证
        if request.url.path in _AUTH_WHITELIST:
            return await call_next(request)

        # WebSocket 路径跳过（由其他机制保护）
        if request.url.path.startswith("/ws/"):
            return await call_next(request)

        api_key = request.headers.get("X-API-Key", "")
        if api_key != settings.api_key:
            return Response(status_code=401, content="Unauthorized: invalid API key")

        return await call_next(request)


app.add_middleware(APIKeyMiddleware)

app.include_router(project_router)
app.include_router(material_router)
app.include_router(narrative_router)
app.include_router(compose_router)


@app.on_event("startup")
async def startup_event():
    set_main_loop(asyncio.get_event_loop())


@app.get("/api/health")
async def health_check():
    checks = {"status": "ok", "version": "0.3.0", "service": "ai-director"}

    # 检查 FFmpeg
    ffmpeg_ok = False
    try:
        import subprocess
        result = subprocess.run([settings.ffmpeg_path, "-version"], capture_output=True, timeout=5)
        ffmpeg_ok = result.returncode == 0
    except Exception:
        pass
    checks["ffmpeg"] = "ok" if ffmpeg_ok else "unavailable"

    # 检查数据目录
    data_ok = Path(settings.output_dir).exists()
    checks["data_dir"] = "ok" if data_ok else "missing"

    # 检查 LLM 配置
    checks["llm"] = "configured" if settings.has_valid_llm_key() else "not_configured"

    if not ffmpeg_ok or not data_ok:
        checks["status"] = "degraded"

    return checks

ws_connections: dict[str, list[WebSocket]] = {}
_WS_MAX_CONNECTIONS_PER_JOB = 10  # 每 job 最大 WebSocket 连接数


@app.websocket("/ws/{job_id}")
async def websocket_endpoint(websocket: WebSocket, job_id: str):
    await websocket.accept()
    conns = ws_connections.setdefault(job_id, [])
    # 限制每 job 最大连接数
    if len(conns) >= _WS_MAX_CONNECTIONS_PER_JOB:
        await websocket.close(code=1013, reason="连接数已达上限")
        return
    conns.append(websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        try:
            conns.remove(websocket)
        except ValueError:
            pass

OUTPUT_DIR = Path("./output")
OUTPUT_DIR.mkdir(exist_ok=True)
if OUTPUT_DIR.exists():
    app.mount("/output", StaticFiles(directory=str(OUTPUT_DIR)), name="output")

FRONTEND_DIR = Path(__file__).parent.parent.parent / "frontend" / "dist"
if FRONTEND_DIR.exists():
    app.mount("/", StaticFiles(directory=str(FRONTEND_DIR), html=True), name="frontend")


def main():
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8788, reload=settings.debug)


if __name__ == "__main__":
    main()