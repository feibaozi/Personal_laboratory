from enum import Enum
from datetime import datetime
from pydantic import BaseModel, Field, ConfigDict
from typing import Optional
from app.models.script import Script
from app.models.material import MatchResult


class ProjectStatus(str, Enum):
    DRAFT = "draft"
    NARRATING = "narrating"
    MATCHING = "matching"
    READY = "ready"
    COMPOSING = "composing"
    DONE = "done"
    FAILED = "failed"


class Project(BaseModel):
    model_config = ConfigDict(
        # 允许从 JSON 中加载 datetime 字符串并自动转换
        json_encoders={datetime: lambda v: v.isoformat()},
    )

    id: str
    name: str
    theme: str = ""
    status: ProjectStatus = ProjectStatus.DRAFT
    script: Optional[Script] = None
    material_ids: list[str] = Field(default_factory=list)
    shot_matches: dict[str, list[MatchResult]] = Field(default_factory=dict)
    output_path: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)