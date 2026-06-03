import json
import threading
import uuid
from typing import Optional

from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Query

from app.models.material import Material, MaterialType, MatchResult


def _get_embedder():
    from app.engine.multimodal_embedder import embedder
    return embedder


def _get_chroma():
    from app.services.chroma_service import chroma_service
    return chroma_service

router = APIRouter(prefix="/api/materials", tags=["materials"])

UPLOAD_DIR = "./data/uploads"
MATERIALS_FILE = "./data/materials.json"

# 文件锁保护 JSON 读写
_materials_lock = threading.Lock()


def _load_materials() -> list[Material]:
    with _materials_lock:
        try:
            with open(MATERIALS_FILE, encoding="utf-8") as f:
                data = json.loads(f.read())
            return [Material(**item) for item in data]
        except Exception:
            return []


def _save_materials(materials: list[Material]):
    with _materials_lock:
        with open(MATERIALS_FILE, "w", encoding="utf-8") as f:
            json.dump([m.model_dump() for m in materials], f, ensure_ascii=False, indent=2)


def _infer_type(filename: str) -> MaterialType:
    # 取最后一个 . 后的部分作为扩展名
    ext = filename.lower().rsplit(".", 1)[-1] if "." in filename else ""
    video_exts = {"mp4", "mov", "mkv", "avi", "webm", "flv"}
    image_exts = {"jpg", "jpeg", "png", "gif", "bmp", "webp"}
    audio_exts = {"mp3", "wav", "aac", "flac", "ogg", "m4a", "wma"}

    if ext in video_exts:
        return MaterialType.VIDEO
    elif ext in image_exts:
        return MaterialType.IMAGE
    elif ext in audio_exts:
        return MaterialType.AUDIO
    return MaterialType.VIDEO


MAX_UPLOAD_SIZE = 500 * 1024 * 1024  # 500MB
ALLOWED_EXTENSIONS = {
    ".mp4", ".mov", ".mkv", ".avi", ".webm",
    ".jpg", ".jpeg", ".png", ".gif", ".bmp", ".webp",
    ".mp3", ".wav", ".aac", ".flac", ".ogg", ".m4a", ".wma",
}


@router.post("/upload")
async def upload_material(
    file: UploadFile = File(...),
    tags: str = Form(""),
    description: str = Form(""),
):
    import shutil
    from pathlib import Path

    filename = file.filename or "unknown"
    ext = Path(filename).suffix.lower()

    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail=f"不支持的文件类型: {ext}")

    Path(UPLOAD_DIR).mkdir(parents=True, exist_ok=True)

    material_id = uuid.uuid4().hex[:12]
    save_path = Path(UPLOAD_DIR) / f"{material_id}{ext}"

    total_size = 0
    with open(save_path, "wb") as f:
        while chunk := await file.read(1024 * 1024):
            total_size += len(chunk)
            if total_size > MAX_UPLOAD_SIZE:
                f.close()
                save_path.unlink(missing_ok=True)
                raise HTTPException(status_code=413, detail="文件大小超过 500MB 限制")
            f.write(chunk)

    media_type = _infer_type(filename)
    tag_list = [t.strip() for t in tags.split(",") if t.strip()]

    duration_sec: Optional[float] = None
    if media_type in (MaterialType.VIDEO, MaterialType.AUDIO):
        try:
            from app.engine.composer import _get_duration
            duration_sec = _get_duration(str(save_path.resolve()))
        except Exception:
            pass

    material = Material(
        id=material_id,
        file_path=str(save_path.resolve()),
        media_type=media_type,
        filename=filename,
        tags=tag_list,
        description=description,
        duration_sec=duration_sec,
    )

    materials = _load_materials()
    materials.append(material)
    _save_materials(materials)

    return {"material": material.model_dump(), "total": len(materials)}


@router.post("/index")
async def index_material(material_id: str):
    materials = _load_materials()
    material = next((m for m in materials if m.id == material_id), None)
    if not material:
        raise HTTPException(status_code=404, detail="素材不存在")

    embedder = _get_embedder()
    chroma = _get_chroma()
    text = material.description or " ".join(material.tags) or material.filename
    embedding = embedder.encode_text(text).tolist()
    if material.media_type == MaterialType.AUDIO:
        result = chroma.index_audio(material, embedding)
    else:
        result = chroma.index_visual(material, embedding)

    return result.model_dump()


@router.post("/index-all")
async def index_all_materials():
    embedder = _get_embedder()
    chroma = _get_chroma()
    materials = _load_materials()
    results = []
    for material in materials:
        try:
            text = material.description or " ".join(material.tags) or material.filename
            embedding = embedder.encode_text(text).tolist()
            if material.media_type == MaterialType.AUDIO:
                result = chroma.index_audio(material, embedding)
            else:
                result = chroma.index_visual(material, embedding)
            results.append(result.model_dump())
        except Exception as e:
            results.append({
                "material_id": material.id,
                "status": f"failed: {str(e)[:50]}",
            })

    return {"indexed": len(results), "results": results}


@router.get("")
async def list_materials():
    materials = _load_materials()
    return [m.model_dump() for m in materials]


@router.delete("/{material_id}")
async def delete_material(material_id: str):
    from pathlib import Path as P

    from app.routers.project import _load_projects, _projects_cache
    _load_projects()
    for proj in _projects_cache.values():
        if material_id in (proj.material_ids or []):
            raise HTTPException(
                status_code=409,
                detail=f"素材正在被项目 '{proj.name}' 使用，请先从项目中移除",
            )

    chroma = _get_chroma()
    materials = _load_materials()
    target = next((m for m in materials if m.id == material_id), None)

    if target:
        try:
            P(target.file_path).unlink(missing_ok=True)
        except Exception:
            pass

    materials = [m for m in materials if m.id != material_id]
    _save_materials(materials)
    chroma.remove_material(material_id)
    return {"status": "deleted"}


@router.post("/match")
async def match_material(description: str = Query(...), top_k: int = Query(5)):
    embedder = _get_embedder()
    chroma = _get_chroma()
    embedding = embedder.encode_text(description).tolist()
    results = chroma.query_visual(embedding, top_k=top_k)
    return results