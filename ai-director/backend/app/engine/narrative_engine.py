import json
import logging
import re
from pathlib import Path
from typing import Optional

from jinja2 import Environment, FileSystemLoader
from openai import OpenAI

from app.config import settings
from app.models.script import Script, ShotSpec
from app.models.material import Material

_logger = logging.getLogger("ai-director")


TEMPLATES_DIR = Path(__file__).parent / "templates"
_jinja_env = Environment(loader=FileSystemLoader(str(TEMPLATES_DIR)))

NARRATIVE_DEFAULTS = {
    "three_act": {"shot_count": 6, "duration": 120.0},
    "five_stage": {"shot_count": 5, "duration": 180.0},
    "montage": {"shot_count": 10, "duration": 60.0},
    "highlight_reel": {"shot_count": 3, "duration": 135.0},
}

# OpenAI 客户端单例
_openai_client = None


def _get_openai_client():
    global _openai_client
    if _openai_client is not None:
        return _openai_client
    _openai_client = OpenAI(api_key=settings.llm_api_key, base_url=settings.llm_base_url)
    return _openai_client


def generate_script(
    theme: str,
    narrative_type: str = "three_act",
    materials: Optional[list[Material]] = None,
    target_duration_sec: Optional[float] = None,
    shot_count: Optional[int] = None,
    subtitle_text: str = "",
) -> Script:
    if narrative_type not in NARRATIVE_DEFAULTS:
        narrative_type = "three_act"

    defaults = NARRATIVE_DEFAULTS[narrative_type]
    if target_duration_sec is None:
        target_duration_sec = defaults["duration"]
    if shot_count is None:
        shot_count = defaults["shot_count"]

    template = _jinja_env.get_template(f"{narrative_type}.j2")

    prompt = template.render(
        theme=theme,
        materials=materials or [],
        target_duration_sec=target_duration_sec,
        shot_count=shot_count,
        subtitle_text=subtitle_text,
        highlight_duration=settings.highlight_duration_sec,
    )

    if not settings.has_valid_llm_key():
        return _mock_script(theme, narrative_type, target_duration_sec, shot_count)

    client = _get_openai_client()

    response = client.chat.completions.create(
        model=settings.llm_model,
        messages=[{"role": "user", "content": prompt}],
        temperature=0.7,
        response_format={"type": "json_object"},
    )

    if not response.choices:
        _logger.warning("LLM 返回空 choices，回退到 mock 数据")
        return _mock_script(theme, narrative_type, target_duration_sec, shot_count)

    content = response.choices[0].message.content or "{}"

    json_match = re.search(r"```json\s*(.*?)\s*```", content, re.DOTALL)
    if json_match:
        content = json_match.group(1)

    try:
        data = json.loads(content)
    except (json.JSONDecodeError, KeyError) as e:
        _logger.warning(f"LLM 返回的 JSON 解析失败: {e}，回退到 mock 数据")
        return _mock_script(theme, narrative_type, target_duration_sec, shot_count)

    shots = []
    for item in data.get("shots", []):
        shots.append(ShotSpec(
            index=item.get("index", len(shots) + 1),
            description=item.get("description", ""),
            duration_sec=item.get("duration_sec", 15.0),
            tone=item.get("tone", "neutral"),
            transition_in=item.get("transition_in", "cut"),
            transition_out=item.get("transition_out", "cut"),
            narration=item.get("narration"),
            music_style=item.get("music_style"),
        ))

    return Script(
        theme=data.get("theme", theme),
        narrative_type=data.get("narrative_type", narrative_type),
        target_duration_sec=data.get("target_duration_sec", target_duration_sec),
        shots=shots,
        soundtrack_notes=data.get("soundtrack_notes", ""),
    )


def _mock_script(
    theme: str,
    narrative_type: str,
    target_duration_sec: float,
    shot_count: int,
) -> Script:
    if narrative_type == "three_act":
        shot_descriptions = [
            ("清晨的阳光洒在城市街道上，人们开始新的一天", "calm", 0.30),
            ("繁忙的办公室里，主角面对着堆积如山的工作", "tense", 0.25),
            ("意外的转折发生了，一个电话改变了所有计划", "excited", 0.25),
            ("主角克服困难，团队协作的关键时刻", "tense", 0.25),
            ("问题解决，办公室里的庆祝场景", "excited", 0.25),
            ("夜幕降临，城市灯火通明，主角望着窗外微笑", "warm", 0.20),
        ]
    elif narrative_type == "five_stage":
        shot_descriptions = [
            ("引入主题，提出核心问题", "neutral", 0.15),
            ("背景介绍，展示相关数据和事实", "calm", 0.20),
            ("核心内容深度讲解，关键知识点", "neutral", 0.30),
            ("实际案例分析和应用场景", "warm", 0.20),
            ("总结要点，展望未来发展方向", "reflective", 0.15),
        ]
    elif narrative_type == "montage":
        shot_descriptions = [
            ("快速切换的城市风景", "excited", 0.10),
            ("人群中的笑脸特写", "warm", 0.10),
            ("运动的瞬间定格", "excited", 0.10),
            ("自然风光的大全景", "calm", 0.10),
            ("霓虹灯下的夜晚街道", "excited", 0.10),
            ("朋友聚会的欢乐场景", "warm", 0.10),
            ("日出的延时摄影", "reflective", 0.10),
            ("海浪拍打岩石的慢动作", "calm", 0.10),
        ]
    else:
        shot_descriptions = [
            ("开场高光时刻，引人入胜的画面", "excited", 0.18),
            ("动态追逐场景，紧张刺激", "tense", 0.18),
            ("精彩反转瞬间，出人意料", "excited", 0.18),
            ("感人温情片段，触动心弦", "warm", 0.18),
            ("震撼大场面，视觉冲击", "excited", 0.16),
            ("精彩收尾，余味悠长", "calm", 0.12),
        ]

    shots = []
    for i, (desc, tone, ratio) in enumerate(shot_descriptions[:shot_count]):
        shots.append(ShotSpec(
            index=i + 1,
            description=desc,
            duration_sec=round(target_duration_sec * ratio, 1),
            tone=tone,
            transition_in="fade_in" if i == 0 else "cut",
            transition_out="fade_out" if i == len(shot_descriptions[:shot_count]) - 1 else "dissolve",
        ))

    return Script(
        theme=theme,
        narrative_type=narrative_type,
        target_duration_sec=target_duration_sec,
        shots=shots,
        soundtrack_notes="",
    )