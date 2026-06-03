from enum import Enum
from pydantic import BaseModel, Field
from typing import Optional


class MaterialType(str, Enum):
    VIDEO = "video"
    IMAGE = "image"
    AUDIO = "audio"


class Material(BaseModel):
    id: str
    file_path: str
    media_type: MaterialType
    filename: str
    duration_sec: float = 0.0
    thumbnail_path: Optional[str] = None
    tags: list[str] = Field(default_factory=list)
    description: str = ""


class MaterialIndexResult(BaseModel):
    material_id: str
    embedding_dim: int
    status: str


class MatchResult(BaseModel):
    material_id: str
    filename: str
    media_type: MaterialType
    score: float
    thumbnail_path: Optional[str] = None
    tags: list[str] = Field(default_factory=list)