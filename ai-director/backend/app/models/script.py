from pydantic import BaseModel, Field
from typing import Optional


class ShotSpec(BaseModel):
    index: int
    description: str = Field(description="场景描述，用于素材匹配")
    duration_sec: float = Field(description="建议时长（秒）")
    tone: str = Field(
        default="neutral",
        description="情绪基调: calm/excited/tense/warm/reflective/neutral"
    )
    transition_in: str = Field(default="cut", description="入转场: cut/dissolve/fade_in")
    transition_out: str = Field(default="cut", description="出转场: cut/dissolve/fade_out")
    narration: Optional[str] = Field(default=None, description="可选旁白文本")
    music_style: Optional[str] = Field(default=None, description="建议音乐风格")


class Script(BaseModel):
    theme: str = Field(description="用户输入主题")
    narrative_type: str = Field(
        default="three_act",
        description="叙事模板: three_act/five_stage/montage/highlight_reel"
    )
    target_duration_sec: float = Field(default=120.0, description="目标总时长（秒）")
    shots: list[ShotSpec] = Field(default_factory=list)
    soundtrack_notes: str = Field(default="", description="音轨建议")