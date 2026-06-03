import uuid
import threading
from typing import Optional
from pydantic import BaseModel, Field

from fastapi import APIRouter, HTTPException, Request

from app.models.script import Script
from app.models.material import Material
from app.engine.narrative_engine import generate_script
from app.engine.material_matcher import match_shot_to_materials
from app.services.pipeline_service import run_pipeline, register_progress

router = APIRouter(prefix="/api/narrative", tags=["narrative"])


class GenerateRequest(BaseModel):
    theme: str
    narrative_type: str = Field(default="three_act", description="三幕式/五段式/蒙太奇/精华集锦")
    material_ids: Optional[str] = None
    target_duration_sec: float = 120.0
    shot_count: Optional[int] = None


class PipelineRequest(GenerateRequest):
    auto_match: bool = True


class ShotMatchRequest(BaseModel):
    description: str
    top_k: int = 5


async def _parse_request(request: Request, model_cls):
    """优先解析 JSON body，失败则回退到 query 参数"""
    try:
        body = await request.json()
        return model_cls(**body)
    except Exception:
        # 回退到 query 参数
        params = dict(request.query_params)
        # 类型转换
        if "target_duration_sec" in params:
            params["target_duration_sec"] = float(params["target_duration_sec"])
        if "shot_count" in params and params["shot_count"]:
            params["shot_count"] = int(params["shot_count"])
        if "auto_match" in params:
            params["auto_match"] = params["auto_match"].lower() in ("true", "1", "yes")
        if "top_k" in params:
            params["top_k"] = int(params["top_k"])
        return model_cls(**params)


@router.post("/generate")
async def generate(request: Request):
    req = await _parse_request(request, GenerateRequest)

    import json
    from app.routers.material import _load_materials

    materials = []
    if req.material_ids:
        all_materials = _load_materials()
        ids = [i.strip() for i in req.material_ids.split(",") if i.strip()]
        materials = [m for m in all_materials if m.id in ids]

    script = generate_script(
        theme=req.theme,
        narrative_type=req.narrative_type,
        materials=materials,
        target_duration_sec=req.target_duration_sec,
        shot_count=req.shot_count,
    )

    return script.model_dump()


@router.post("/pipeline")
async def run_narrative_pipeline(request: Request):
    req = await _parse_request(request, PipelineRequest)

    from app.routers.material import _load_materials

    materials = []
    if req.material_ids:
        all_materials = _load_materials()
        ids = [i.strip() for i in req.material_ids.split(",") if i.strip()]
        materials = [m for m in all_materials if m.id in ids]

    job_id = uuid.uuid4().hex[:12]

    t = threading.Thread(
        target=run_pipeline,
        args=(job_id, req.theme, req.narrative_type, materials, req.target_duration_sec, req.shot_count, req.auto_match),
    )
    t.start()

    return {"job_id": job_id, "status": "processing"}


@router.get("/pipeline/{job_id}/status")
async def get_pipeline_status(job_id: str):
    status_data = {"job_id": job_id, "status": "unknown"}

    def _collect(data):
        status_data.update(data)

    register_progress(job_id, _collect)
    import asyncio
    await asyncio.sleep(0.1)

    return status_data


@router.post("/shot-match")
async def match_single_shot(request: Request):
    req = await _parse_request(request, ShotMatchRequest)

    from app.models.script import ShotSpec as ShotSpecModel

    shot = ShotSpecModel(
        index=0,
        description=req.description,
        duration_sec=10.0,
        tone="neutral",
        transition_in="cut",
        transition_out="cut",
    )
    matches = match_shot_to_materials(shot, top_k=req.top_k)
    return [m.model_dump() for m in matches]