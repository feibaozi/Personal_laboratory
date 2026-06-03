import json
import re
import threading
import uuid
from pathlib import Path
from datetime import datetime, timezone

from pydantic import BaseModel
from fastapi import APIRouter, HTTPException, Request

from app.models.project import Project, ProjectStatus
from app.models.script import Script

router = APIRouter(prefix="/api/projects", tags=["projects"])

DATA_DIR = Path("./data/projects")
DATA_DIR.mkdir(parents=True, exist_ok=True)

_projects_cache: dict[str, Project] = {}
_projects_lock = threading.Lock()


def _validate_project_id(project_id: str) -> str:
    """校验 project_id 仅含合法字符，防止路径遍历"""
    if not re.match(r'^[a-zA-Z0-9_-]+$', project_id):
        raise HTTPException(status_code=400, detail="非法的项目ID")
    return project_id


def _load_projects():
    global _projects_cache
    with _projects_lock:
        _projects_cache = {}
        for f in DATA_DIR.glob("*.json"):
            try:
                with open(f, encoding="utf-8") as fh:
                    data = json.loads(fh.read())
                _projects_cache[data["id"]] = Project(**data)
            except Exception:
                pass


def _serialize(obj):
    return json.dumps(obj, ensure_ascii=False, indent=2)


def _save_project(project: Project):
    _projects_cache[project.id] = project
    path = DATA_DIR / f"{project.id}.json"
    path.write_text(
        _serialize(project.model_dump()),
        encoding="utf-8",
    )


class CreateProjectRequest(BaseModel):
    name: str = "untitled"
    theme: str = ""


class UpdateProjectRequest(BaseModel):
    name: str | None = None
    theme: str | None = None
    status: str | None = None
    script: dict | None = None
    shot_matches: dict | None = None
    output_path: str | None = None
    material_ids: list[str] | None = None


@router.post("")
async def create_project(request: Request):
    name = "untitled"
    theme = ""

    try:
        body = await request.json()
        name = body.get("name", "untitled")
        theme = body.get("theme", "")
    except Exception:
        name = request.query_params.get("name", "untitled")
        theme = request.query_params.get("theme", "")

    project_id = uuid.uuid4().hex[:12]
    now = datetime.now(timezone.utc)

    project = Project(
        id=project_id,
        name=name,
        theme=theme,
        status=ProjectStatus.DRAFT,
        created_at=now,
        updated_at=now,
    )

    _save_project(project)
    return project.model_dump()


@router.get("")
async def list_projects():
    _load_projects()
    return sorted(
        [p.model_dump() for p in _projects_cache.values()],
        key=lambda x: x["updated_at"],
        reverse=True,
    )


@router.get("/{project_id}")
async def get_project(project_id: str):
    _validate_project_id(project_id)
    _load_projects()
    if project_id not in _projects_cache:
        raise HTTPException(status_code=404, detail="项目不存在")
    return _projects_cache[project_id].model_dump()


@router.patch("/{project_id}")
async def update_project(project_id: str, request: Request):
    _validate_project_id(project_id)
    _load_projects()
    if project_id not in _projects_cache:
        raise HTTPException(status_code=404, detail="项目不存在")

    project = _projects_cache[project_id]

    try:
        body = await request.json()
    except Exception:
        body = dict(request.query_params)

    allowed = {"name", "theme", "status", "script", "shot_matches", "output_path", "material_ids"}
    for key, value in body.items():
        if key in allowed:
            if key == "script" and isinstance(value, dict):
                # script 字段通过 Pydantic 验证后再赋值
                setattr(project, key, Script(**value))
            else:
                setattr(project, key, value)

    project.updated_at = datetime.now(timezone.utc)
    _save_project(project)
    return project.model_dump()


@router.delete("/{project_id}")
async def delete_project(project_id: str):
    _validate_project_id(project_id)
    _load_projects()
    if project_id in _projects_cache:
        del _projects_cache[project_id]
    path = DATA_DIR / f"{project_id}.json"
    path.unlink(missing_ok=True)
    return {"status": "deleted"}
