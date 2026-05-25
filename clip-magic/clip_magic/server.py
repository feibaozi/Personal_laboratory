import asyncio
import json
import uuid
import shutil
import threading
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, UploadFile, File, Form, WebSocket, WebSocketDisconnect
from fastapi.responses import FileResponse, HTMLResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware

from clip_magic.config import settings
from clip_magic.stages.audio_extractor import extract_audio, has_valid_audio
from clip_magic.stages.transcriber import transcribe
from clip_magic.stages.highlight_detector import detect_highlights
from clip_magic.stages.clip_engine import clip_segments
from clip_magic.stages.cover_generator import generate_cover
from clip_magic.stages.subtitle_burner import burn_subtitles_to_clip

app = FastAPI(title="Clip Magic API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

OUTPUT_BASE = Path("output")
OUTPUT_BASE.mkdir(exist_ok=True)

jobs: dict[str, dict] = {}
ws_clients: dict[str, list[WebSocket]] = {}
processing_lock = threading.Lock()


async def _broadcast(job_id: str, data: dict):
    if job_id in ws_clients:
        dead = []
        for ws in ws_clients[job_id]:
            try:
                await ws.send_json(data)
            except Exception:
                dead.append(ws)
        for ws in dead:
            ws_clients[job_id].remove(ws)


def _report_progress(job_id: str, stage: str, percent: float, message: str = ""):
    if job_id in jobs:
        jobs[job_id]["stage"] = stage
        jobs[job_id]["progress"] = percent
        jobs[job_id]["message"] = message

    try:
        asyncio.run(_broadcast(job_id, {
            "stage": stage,
            "progress": percent,
            "message": message,
        }))
    except Exception:
        pass


def _process_job(job_id: str, video_path: str):
    try:
        job_dir = OUTPUT_BASE / job_id
        job_dir.mkdir(parents=True, exist_ok=True)

        _report_progress(job_id, "extracting", 0.02, "正在检测音频...")
        audio_ok, audio_confidence, audio_msg = has_valid_audio(video_path)
        jobs[job_id]["audio_confidence"] = audio_confidence

        if not audio_ok:
            _report_progress(job_id, "extracting", 0.05,
                             f"音频检测警告: {audio_msg}")

        _report_progress(job_id, "extracting", 0.05, "正在分离音轨...")
        audio_info = extract_audio(video_path, str(job_dir))
        _report_progress(job_id, "extracting", 0.15, "音轨分离完成")

        _report_progress(job_id, "transcribing", 0.20, "Whisper 语音转文字中...")
        segments = transcribe(str(audio_info.path))

        use_mock = len(segments) == 0
        transcription_mode = "mock" if use_mock else "real"
        jobs[job_id]["transcription_mode"] = transcription_mode

        if use_mock:
            from clip_magic.pipeline import _create_mock_segments
            segments = _create_mock_segments(audio_info.duration_sec)
            _report_progress(job_id, "transcribing", 0.50,
                             f"未检测到语音，使用模拟字幕 ({len(segments)} 段)")
        else:
            _report_progress(job_id, "transcribing", 0.50,
                             f"真实转录完成 ({len(segments)} 段)")

        analysis_mode = "llm" if settings.has_valid_llm_key() else "fallback"
        jobs[job_id]["analysis_mode"] = analysis_mode

        _report_progress(job_id, "analyzing", 0.55, "LLM 分析高光片段...")
        highlights = detect_highlights(segments)

        if not highlights:
            _report_progress(job_id, "analyzing", 0.70, "未检测到高光片段")
            return

        _report_progress(job_id, "analyzing", 0.70, f"找到 {len(highlights)} 个高光片段")

        _report_progress(job_id, "clipping", 0.75, "FFmpeg 裁剪中...")
        results = clip_segments(video_path, highlights, str(job_dir))
        _report_progress(job_id, "clipping", 0.85, "裁剪完成")

        _report_progress(job_id, "post_processing", 0.90, "生成封面和字幕...")
        output_items = []
        for i, r in enumerate(results):
            hl = next((h for h in highlights if h.rank == r.rank), None)
            title = hl.title if hl else f"精彩片段 {r.rank}"

            cover_name = f"cover_{r.rank}.jpg"
            cover_path = str(job_dir / cover_name)
            generate_cover(r.output_path, title, r.rank, 0, cover_path)

            subtitle_name = f"subtitle_{r.rank}.mp4"
            subtitle_path = str(job_dir / subtitle_name)
            clip_segs = [s for s in segments
                         if s.start_ms >= r.start_ms and s.end_ms <= r.end_ms]
            burn_subtitles_to_clip(r.output_path, clip_segs, subtitle_path)
            subtitle_path = subtitle_path if Path(subtitle_path).exists() else r.output_path

            output_items.append({
                "rank": r.rank,
                "title": title,
                "start_ms": r.start_ms,
                "end_ms": r.end_ms,
                "reason": hl.reason if hl else "",
                "score": hl.score if hl else 0,
                "video_url": f"/api/jobs/{job_id}/download/{r.rank}/video",
                "subtitle_video_url": f"/api/jobs/{job_id}/download/{r.rank}/subtitle",
                "cover_url": f"/api/jobs/{job_id}/download/{r.rank}/cover",
            })

        jobs[job_id]["status"] = "done"
        jobs[job_id]["results"] = output_items
        jobs[job_id]["transcription_mode"] = transcription_mode
        jobs[job_id]["analysis_mode"] = analysis_mode
        _report_progress(job_id, "done", 1.0, "处理完成")

    except Exception as e:
        jobs[job_id]["status"] = "failed"
        jobs[job_id]["error"] = str(e)
        _report_progress(job_id, "failed", 1.0, f"处理失败: {e}")


@app.post("/api/jobs")
async def create_job(
    file: Optional[UploadFile] = File(None),
    url: Optional[str] = Form(None),
    count: int = Form(3),
    duration: int = Form(45),
):
    job_id = uuid.uuid4().hex[:12]

    if file and file.filename:
        job_dir = OUTPUT_BASE / job_id
        job_dir.mkdir(parents=True, exist_ok=True)
        ext = Path(file.filename).suffix or ".mp4"
        video_path = job_dir / f"source{ext}"
        with open(video_path, "wb") as f:
            shutil.copyfileobj(file.file, f)
        video_path = str(video_path)
    elif url:
        import yt_dlp
        job_dir = OUTPUT_BASE / job_id
        job_dir.mkdir(parents=True, exist_ok=True)
        video_path = str(job_dir / "source.mp4")
        opts = {
            "outtmpl": str(job_dir / "source.%(ext)s"),
            "format": "mp4/best",
            "quiet": True,
        }
        with yt_dlp.YoutubeDL(opts) as ydl:
            info = ydl.extract_info(url, download=True)
            actual = str(job_dir / f"source.{info.get('ext', 'mp4')}")
            if Path(actual).exists():
                video_path = actual
    else:
        return JSONResponse({"error": "请上传文件或提供 URL"}, status_code=400)

    settings.highlight_count = count
    settings.highlight_duration_sec = duration

    jobs[job_id] = {
        "status": "processing",
        "stage": "starting",
        "progress": 0.0,
        "message": "任务已创建",
        "transcription_mode": "",
        "analysis_mode": "",
        "audio_confidence": 0.0,
    }

    t = threading.Thread(target=_process_job, args=(job_id, video_path))
    t.start()

    _report_progress(job_id, "starting", 0.0, "任务已创建")

    return {"job_id": job_id, "status": "processing"}


@app.get("/api/jobs/{job_id}")
async def get_job_status(job_id: str):
    if job_id not in jobs:
        return JSONResponse({"error": "任务不存在"}, status_code=404)
    job = jobs[job_id]
    return {
        "job_id": job_id,
        "status": job.get("status"),
        "stage": job.get("stage"),
        "progress": job.get("progress", 0),
        "message": job.get("message"),
        "results": job.get("results", []),
        "error": job.get("error"),
        "transcription_mode": job.get("transcription_mode", ""),
        "analysis_mode": job.get("analysis_mode", ""),
        "audio_confidence": job.get("audio_confidence", 0.0),
    }


@app.get("/api/jobs/{job_id}/download/{rank}/{file_type}")
async def download_file(job_id: str, rank: int, file_type: str):
    job_dir = OUTPUT_BASE / job_id
    if file_type in ("video", "subtitle"):
        ext = "mp4"
        prefix = f"source_clip{rank:02d}"
        if file_type == "subtitle":
            subtitle_file = job_dir / f"subtitle_{rank}.mp4"
            if subtitle_file.exists():
                return FileResponse(subtitle_file, media_type="video/mp4")
        matches = sorted(job_dir.glob(f"{prefix}*"), key=lambda p: p.stat().st_mtime)
        if matches:
            return FileResponse(matches[0], media_type="video/mp4")
    elif file_type == "cover":
        cover_file = job_dir / f"cover_{rank}.jpg"
        if cover_file.exists():
            return FileResponse(cover_file, media_type="image/jpeg")
    return JSONResponse({"error": "文件不存在"}, status_code=404)


@app.websocket("/ws/{job_id}")
async def websocket_endpoint(websocket: WebSocket, job_id: str):
    await websocket.accept()
    ws_clients.setdefault(job_id, []).append(websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        ws_clients[job_id].remove(websocket)


FRONTEND_DIR = Path(__file__).parent.parent / "frontend" / "dist"
if FRONTEND_DIR.exists():
    app.mount("/", StaticFiles(directory=str(FRONTEND_DIR), html=True), name="frontend")


def main():
    import uvicorn
    uvicorn.run("clip_magic.server:app", host="0.0.0.0", port=8787, reload=True)


if __name__ == "__main__":
    main()