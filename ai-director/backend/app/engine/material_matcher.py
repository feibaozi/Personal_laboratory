import json
import logging
import re
from typing import Optional

from openai import OpenAI

from app.config import settings
from app.models.script import ShotSpec
from app.models.material import Material, MaterialType, MatchResult

_logger = logging.getLogger("ai-director")


def _get_embedder():
    from app.engine.multimodal_embedder import embedder
    return embedder


def _get_chroma():
    from app.services.chroma_service import chroma_service
    return chroma_service


def match_shot_to_materials(
    shot: ShotSpec,
    top_k: int = 5,
) -> list[MatchResult]:
    embedder = _get_embedder()
    chroma = _get_chroma()
    text_embedding = embedder.encode_text(shot.description)

    visual_results = chroma.query_visual(
        embedding=text_embedding.tolist(),
        top_k=top_k,
    )

    audio_keywords = ["安静", "拥挤", "轻音乐", "音乐", "声音", "嘈杂", "寂静",
                      "quiet", "crowded", "music", "sound", "noisy", "silent"]
    has_audio_hint = any(kw in shot.description for kw in audio_keywords)

    if has_audio_hint:
        audio_results = chroma.query_audio(
            embedding=text_embedding.tolist(),
            top_k=3,
        )
        visual_results.extend(audio_results)

    if shot.music_style:
        music_embedding = embedder.encode_text(f"音乐风格: {shot.music_style}")
        music_results = chroma.query_audio(
            embedding=music_embedding.tolist(),
            top_k=3,
        )
        visual_results.extend(music_results)

    results = []
    seen_ids = set()
    for item in visual_results:
        if item["material_id"] in seen_ids:
            continue
        seen_ids.add(item["material_id"])

        media_type = item.get("media_type", "video")
        results.append(MatchResult(
            material_id=item["material_id"],
            filename=item.get("filename", ""),
            media_type=MaterialType(media_type) if media_type in [e.value for e in MaterialType] else MaterialType.VIDEO,
            score=item.get("score", 0.0),
            thumbnail_path=item.get("thumbnail_path") or None,
            tags=item.get("tags", []),
        ))

    results.sort(key=lambda x: x.score, reverse=True)
    return results[:top_k]


def llm_refine_match(
    shot_description: str,
    candidates: list[MatchResult],
) -> Optional[str]:
    # 空列表检查
    if not candidates:
        return None

    if not settings.has_valid_llm_key() or len(candidates) <= 1:
        return candidates[0].material_id

    candidate_text = "\n".join(
        f"  [{i}] {c.filename} (tags: {', '.join(c.tags)})"
        for i, c in enumerate(candidates)
    )

    prompt = f"""你是一个视频素材匹配助手。请根据场景描述，从候选素材中选择最合适的一个。

场景描述: "{shot_description}"

候选素材:
{candidate_text}

请只输出你认为最合适的素材编号（数字），不要其他内容。"""

    try:
        # 复用 narrative_engine 的 OpenAI 客户端
        from app.engine.narrative_engine import _get_openai_client
        client = _get_openai_client()
        response = client.chat.completions.create(
            model=settings.llm_model,
            messages=[{"role": "user", "content": prompt}],
            temperature=0.2,
            max_tokens=10,
        )
        content = response.choices[0].message.content or ""
        numbers = re.findall(r"\d+", content)
        if numbers:
            idx = int(numbers[0])
            if 0 <= idx < len(candidates):
                return candidates[idx].material_id
    except Exception:
        _logger.exception("LLM 素材匹配失败")

    return candidates[0].material_id