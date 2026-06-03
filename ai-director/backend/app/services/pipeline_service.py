import asyncio
import json
import threading
import time
import logging
from typing import Optional

from app.engine.narrative_engine import generate_script
from app.engine.material_matcher import match_shot_to_materials, llm_refine_match
from app.models.script import Script
from app.models.material import Material, MatchResult

logger = logging.getLogger("ai-director")

_main_loop: Optional[asyncio.AbstractEventLoop] = None

_progress_callbacks: dict[str, list] = {}
_jobs: dict[str, dict] = {}
_jobs_lock = threading.Lock()

JOB_TTL_SECONDS = 1800


def set_main_loop(loop: asyncio.AbstractEventLoop):
    """由 FastAPI startup 事件调用，设置主事件循环引用"""
    global _main_loop
    _main_loop = loop


def register_progress(job_id: str, callback):
    with _jobs_lock:
        _progress_callbacks.setdefault(job_id, []).append(callback)


def _broadcast(job_id: str, data: dict):
    with _jobs_lock:
        _jobs[job_id] = dict(data)

    # 使用 list() 复制避免迭代中修改
    with _jobs_lock:
        callbacks = list(_progress_callbacks.get(job_id, []))

    for cb in callbacks:
        try:
            cb(data)
        except Exception:
            pass

    # 从同步线程安全地向主事件循环提交协程
    if _main_loop is not None:
        try:
            from app.main import ws_connections
            message = json.dumps(data, ensure_ascii=False)

            async def _send():
                for ws in list(ws_connections.get(job_id, [])):
                    try:
                        await ws.send_text(message)
                    except Exception:
                        pass

            if _main_loop.is_running():
                asyncio.run_coroutine_threadsafe(_send(), _main_loop)
            else:
                asyncio.run(_send())
        except Exception:
            pass

    stage = data.get("stage", "")
    if stage in ("done", "failed"):
        # 记录完成时间戳
        with _jobs_lock:
            if job_id in _jobs:
                _jobs[job_id]["_completed_at"] = time.time()


# 单个后台定时清理线程
_cleanup_interval = 300  # 每5分钟扫描一次


def _start_cleanup_timer():
    def _clean():
        while True:
            time.sleep(_cleanup_interval)
            now = time.time()
            with _jobs_lock:
                expired = [jid for jid, job in _jobs.items()
                           if job.get("status") in ("done", "failed")
                           and now - job.get("_completed_at", now) > JOB_TTL_SECONDS]
                for jid in expired:
                    _jobs.pop(jid, None)
                    _progress_callbacks.pop(jid, None)

    t = threading.Thread(target=_clean, daemon=True)
    t.start()


_start_cleanup_timer()


def get_job_status(job_id: str) -> Optional[dict]:
    with _jobs_lock:
        return _jobs.get(job_id)


def run_pipeline(
    job_id: str,
    theme: str,
    narrative_type: str,
    materials: list[Material],
    target_duration_sec: float = 120.0,
    shot_count: Optional[int] = None,
    auto_match: bool = True,
):
    try:
        _broadcast(job_id, {
            "stage": "narrating",
            "progress": 0.05,
            "message": "正在生成分镜脚本...",
        })

        script = generate_script(
            theme=theme,
            narrative_type=narrative_type,
            materials=materials,
            target_duration_sec=target_duration_sec,
            shot_count=shot_count,
        )

        _broadcast(job_id, {
            "stage": "narrating",
            "progress": 0.25,
            "message": f"生成了 {len(script.shots)} 个分镜",
            "script": script.model_dump(),
        })

        if not auto_match or not materials:
            _broadcast(job_id, {
                "stage": "done",
                "progress": 1.0,
                "message": "分镜生成完成",
                "script": script.model_dump(),
            })
            return

        _broadcast(job_id, {
            "stage": "matching",
            "progress": 0.30,
            "message": "正在匹配素材...",
        })

        shot_matches: dict[int, list[MatchResult]] = {}
        total_shots = len(script.shots)

        for i, shot in enumerate(script.shots):
            matches = match_shot_to_materials(shot, top_k=5)
            shot_matches[shot.index] = matches

            progress = 0.30 + (0.65 * (i + 1) / total_shots)
            _broadcast(job_id, {
                "stage": "matching",
                "progress": progress,
                "message": f"匹配分镜 {shot.index}/{total_shots}: {len(matches)} 个候选",
            })

        _broadcast(job_id, {
            "stage": "done",
            "progress": 1.0,
            "message": "处理完成",
            "script": script.model_dump(),
            "shot_matches": {
                str(k): [m.model_dump() for m in v]
                for k, v in shot_matches.items()
            },
        })

    except Exception as e:
        logger.error(f"Pipeline job {job_id} failed: {e}", exc_info=True)
        _broadcast(job_id, {
            "stage": "failed",
            "progress": 1.0,
            "message": f"处理失败: {str(e)}",
        })
