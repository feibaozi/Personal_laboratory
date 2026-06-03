import uuid
import threading
import copy
import shutil
import logging
from pathlib import Path
from typing import Optional
from pydantic import BaseModel

from fastapi import APIRouter, HTTPException, Request

from app.models.script import Script
from app.models.material import Material
from app.config import settings
from app.services.pipeline_service import _broadcast, get_job_status

logger = logging.getLogger("ai-director")

router = APIRouter(prefix="/api/compose", tags=["compose"])


def _validate_media_path(file_path: str) -> Path:
    """校验文件路径在允许的目录内，防止路径遍历"""
    resolved = Path(file_path).resolve()
    allowed_dirs = [
        Path(settings.upload_dir).resolve(),
        Path(settings.data_dir).resolve(),
        Path(settings.output_dir).resolve(),
    ]
    if not any(str(resolved).startswith(str(d)) for d in allowed_dirs):
        raise HTTPException(status_code=400, detail="非法的文件路径")
    if not resolved.exists():
        raise HTTPException(status_code=404, detail="文件不存在")
    return resolved


class ExportRequest(BaseModel):
    project_id: str
    include_subtitles: bool = True
    include_narration: bool = False
    bgm_path: Optional[str] = None
    apply_rhythm: bool = False


class RecommendTransitionRequest(BaseModel):
    shot_description: str
    current_tone: str = "neutral"


async def _parse_request(request: Request, model_cls):
    """优先解析 JSON body，失败则回退到 query 参数"""
    try:
        body = await request.json()
        return model_cls(**body)
    except Exception:
        # 回退到 query 参数
        params = dict(request.query_params)
        # 类型转换
        bool_keys = ["include_subtitles", "include_narration", "apply_rhythm"]
        for key in bool_keys:
            if key in params:
                params[key] = params[key].lower() in ("true", "1", "yes")
        return model_cls(**params)


@router.post("/export")
async def export_video(request: Request):
    req = await _parse_request(request, ExportRequest)

    from app.routers.project import _load_projects, _save_project, _projects_cache
    from app.routers.material import _load_materials
    from app.engine.composer import compose_video, add_audio_to_video
    from app.engine.subtitle_engine import generate_ass_subtitles, burn_subtitles
    from app.engine.tts_engine import synthesize_speech, mix_narration_into_video
    from app.engine.rhythm_analyzer import analyze_beats, analyze_emotion, apply_rhythm_to_script

    _load_projects()
    project = _projects_cache.get(req.project_id)
    if not project or not project.script:
        raise HTTPException(status_code=404, detail="项目或分镜脚本不存在")

    job_id = uuid.uuid4().hex[:12]

    def _do_export():
        try:
            _broadcast(job_id, {"stage": "composing", "progress": 0.05, "message": "准备素材..."})

            all_materials = _load_materials()
            material_map = {m.id: m for m in all_materials}

            shot_material_paths: dict[int, str] = {}
            for shot_index, matches in (project.shot_matches or {}).items():
                if matches:
                    first = matches[0]
                    mat_id = first.material_id if hasattr(first, 'material_id') else first.get('material_id', '')
                    mat = material_map.get(mat_id)
                    if mat:
                        shot_material_paths[int(shot_index)] = mat.file_path

            script = copy.deepcopy(project.script)
            output_dir = Path(settings.output_dir)
            output_dir.mkdir(parents=True, exist_ok=True)
            work_dir = str(output_dir / f"work_{req.project_id}")
            video_path = str(output_dir / f"{req.project_id}_raw.mp4")

            if req.apply_rhythm and req.bgm_path and _validate_media_path(req.bgm_path).exists():
                _broadcast(job_id, {"stage": "composing", "progress": 0.15, "message": "分析音乐节奏..."})
                beats_data = analyze_beats(req.bgm_path)
                emotion_data = analyze_emotion(req.bgm_path)
                rhythm_adj = apply_rhythm_to_script(script, beats_data, emotion_data)

                for adj in rhythm_adj.get("shot_timing", []):
                    idx = adj["shot_index"]
                    for shot in script.shots:
                        if shot.index == idx:
                            shot.duration_sec = adj["adjusted_duration"]
                            break

            _broadcast(job_id, {"stage": "composing", "progress": 0.25, "message": "拼接视频片段..."})
            compose_video(
                script=script,
                shot_material_map=shot_material_paths,
                output_path=video_path,
                work_dir=work_dir,
            )

            current_video = video_path

            if req.include_subtitles:
                _broadcast(job_id, {"stage": "composing", "progress": 0.55, "message": "生成字幕..."})
                segments = []
                accumulated = 0.0
                for shot in script.shots:
                    if shot.narration:
                        segments.append({
                            "start": accumulated,
                            "end": accumulated + shot.duration_sec,
                            "text": shot.narration,
                        })
                    accumulated += shot.duration_sec

                if segments:
                    ass_path = str(output_dir / f"{req.project_id}.ass")
                    sub_video = str(output_dir / f"{req.project_id}_subtitled.mp4")
                    generate_ass_subtitles(segments, ass_path)
                    burn_subtitles(current_video, ass_path, sub_video)
                    current_video = sub_video

            if req.include_narration:
                _broadcast(job_id, {"stage": "composing", "progress": 0.70, "message": "合成旁白..."})
                narration_segments = []
                for shot in script.shots:
                    if shot.narration:
                        narration_segments.append(shot)

                if narration_segments:
                    from app.engine.composer import _run_ffmpeg
                    combined_narration = str(output_dir / f"{req.project_id}_narration.wav")
                    segment_files = []
                    for i, shot in enumerate(narration_segments):
                        seg_path = str(output_dir / f"narr_{i}.wav")
                        synthesize_speech(shot.narration, seg_path)
                        segment_files.append(seg_path)

                    if segment_files:
                        concat_file = str(output_dir / "narr_concat.txt")
                        with open(concat_file, "w", encoding="utf-8") as f:
                            for sf in segment_files:
                                f.write(f"file '{sf}'\n")

                        _run_ffmpeg([
                            "-y", "-f", "concat", "-safe", "0",
                            "-i", concat_file,
                            "-c:a", "pcm_s16le",
                            combined_narration,
                        ])

                        narrated_video = str(output_dir / f"{req.project_id}_final.mp4")
                        mix_narration_into_video(
                            current_video, combined_narration,
                            bgm_path=req.bgm_path,
                            output_path=narrated_video,
                        )
                        current_video = narrated_video

            elif req.bgm_path and _validate_media_path(req.bgm_path).exists():
                _broadcast(job_id, {"stage": "composing", "progress": 0.80, "message": "混入背景音乐..."})
                bgm_video = str(output_dir / f"{req.project_id}_with_bgm.mp4")
                add_audio_to_video(current_video, req.bgm_path, bgm_video, audio_weight=0.3)
                current_video = bgm_video

            _broadcast(job_id, {
                "stage": "done",
                "progress": 1.0,
                "message": "导出完成",
                "output_path": current_video,
                "download_url": f"/output/{Path(current_video).name}",
            })

            try:
                shutil.rmtree(work_dir, ignore_errors=True)
            except Exception:
                pass

        except Exception as e:
            logger.error(f"Export job {job_id} failed: {e}", exc_info=True)
            _broadcast(job_id, {
                "stage": "failed",
                "progress": 1.0,
                "message": f"导出失败: {str(e)}",
            })

            try:
                shutil.rmtree(work_dir, ignore_errors=True)
            except Exception:
                pass

    t = threading.Thread(target=_do_export)
    t.start()

    return {"job_id": job_id, "status": "composing"}


@router.get("/export/{job_id}/status")
async def get_export_status(job_id: str):
    status = get_job_status(job_id)
    if status:
        return {"job_id": job_id, **status}
    return {"job_id": job_id, "status": "unknown", "stage": "pending", "progress": 0}


@router.get("/transitions")
async def list_transitions():
    from app.engine.composer import TRANSITION_MAP
    transitions = [
        {"name": k, "xfade": v}
        for k, v in sorted(TRANSITION_MAP.items())
        if v is not None
    ]
    return transitions


@router.post("/recommend-transition")
async def recommend_transition(request: Request):
    req = await _parse_request(request, RecommendTransitionRequest)

    from app.engine.composer import TRANSITION_MAP

    if not settings.has_valid_llm_key():
        tone_map = {
            "calm": "dissolve",
            "excited": "wipeleft",
            "tense": "cut",
            "warm": "dissolve",
            "reflective": "fadeblack",
            "neutral": "dissolve",
        }
        return {"recommended": tone_map.get(req.current_tone, "dissolve"), "source": "rule"}

    from openai import OpenAI
    available = [k for k, v in TRANSITION_MAP.items() if v is not None]

    prompt = f"""根据以下分镜描述和情绪，推荐最合适的视频转场效果。

分镜描述: {req.shot_description}
情绪基调: {req.current_tone}

可选转场: {', '.join(available)}

只输出一个转场名称，不要其他内容。"""

    try:
        client = OpenAI(api_key=settings.llm_api_key, base_url=settings.llm_base_url, timeout=15.0)
        response = client.chat.completions.create(
            model=settings.llm_model,
            messages=[{"role": "user", "content": prompt}],
            temperature=0.3,
            max_tokens=10,
        )
        content = response.choices[0].message.content or "dissolve"
        recommended = content.strip().lower()

        if recommended in TRANSITION_MAP and TRANSITION_MAP[recommended]:
            return {"recommended": recommended, "source": "llm"}
    except Exception:
        pass

    return {"recommended": "dissolve", "source": "fallback"}