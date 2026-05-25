import json
import re
from dataclasses import dataclass
from typing import Optional

from openai import OpenAI

from clip_magic.config import settings
from clip_magic.stages.transcriber import SubtitleSegment


@dataclass
class HighlightClip:
    rank: int
    start_ms: int
    end_ms: int
    score: float
    reason: str
    title: str


def _build_text_with_timestamps(segments: list[SubtitleSegment]) -> str:
    lines = []
    for seg in segments:
        start_sec = seg.start_ms / 1000
        end_sec = seg.end_ms / 1000
        lines.append(f"[{start_sec:.1f}s-{end_sec:.1f}s] {seg.text}")
    return "\n".join(lines)


def _rough_filter(segments: list[SubtitleSegment], window_ms: int = 45000) -> list[SubtitleSegment]:
    candidate_count = settings.highlight_candidate_count
    windows: list[tuple[float, int, int]] = []

    step_ms = 5000

    for i in range(0, len(segments)):
        window_start_ms = segments[i].start_ms
        window_end_ms = window_start_ms + window_ms

        window_texts = []
        for seg in segments:
            if seg.start_ms >= window_start_ms and seg.end_ms <= window_end_ms:
                window_texts.append(seg.text)

        if not window_texts:
            continue

        combined = " ".join(window_texts)
        score = _compute_density_score(combined)
        windows.append((score, window_start_ms, window_end_ms))

    windows.sort(key=lambda x: x[0], reverse=True)

    seen_ranges: list[tuple[int, int]] = []
    selected: list[SubtitleSegment] = []

    for score, start, end in windows:
        overlap = any(
            not (end <= rs or start >= re) for rs, re in seen_ranges
        )
        if overlap:
            continue

        seen_ranges.append((start, end))
        window_segs = [
            s for s in segments
            if s.start_ms >= start and s.end_ms <= end
        ]
        selected.extend(window_segs)

        if len(seen_ranges) >= candidate_count:
            break

    return selected


def _compute_density_score(text: str) -> float:
    score = 0.0

    words = text.split()
    if not words:
        return 0.0

    score += len(words) * 0.3

    unique_ratio = len(set(w.lower() for w in words)) / len(words)
    score += unique_ratio * 2.0

    emotion_keywords = [
        "震惊", "太棒了", "不敢相信", "笑死", "绝了", "离谱", "牛",
        "amazing", "unbelievable", "incredible", "shocking", "hilarious",
        "哈哈", "卧槽", "天哪", "真的假的", "疯了吧",
    ]
    question_keywords = ["为什么", "怎么", "难道", "究竟", "到底", "why", "how"]
    conflict_keywords = ["但是", "不过", "然而", "可是", "but", "however", "实际上"]

    for kw in emotion_keywords:
        score += text.lower().count(kw) * 1.5
    for kw in question_keywords:
        score += text.lower().count(kw) * 1.0
    for kw in conflict_keywords:
        score += text.lower().count(kw) * 1.0

    sentences = re.split(r"[。！？.!?\n]+", text)
    if len(sentences) >= 2:
        lengths = [len(s) for s in sentences if s.strip()]
        if lengths:
            avg_len = sum(lengths) / len(lengths)
            variance = sum((l - avg_len) ** 2 for l in lengths) / len(lengths)
            score += (variance / max(avg_len, 1)) * 1.0

    numbers = len(re.findall(r"\d+", text))
    score += numbers * 0.5

    return score


def test_llm_connection() -> tuple[bool, str]:
    if not settings.has_valid_llm_key():
        return False, "未配置有效的 API Key（当前为占位符或太短）"

    try:
        client = OpenAI(
            api_key=settings.llm_api_key,
            base_url=settings.llm_base_url,
            timeout=10.0,
        )
        response = client.chat.completions.create(
            model=settings.llm_model,
            messages=[{"role": "user", "content": "回复: ok"}],
            max_tokens=5,
            temperature=0,
        )
        content = response.choices[0].message.content or ""
        return True, f"连接成功 (model={settings.llm_model}, base={settings.llm_base_url})"
    except Exception as e:
        return False, f"连接失败: {str(e)[:200]}"


def _llm_select(segments: list[SubtitleSegment], duration_ms: int) -> list[HighlightClip]:
    if not settings.has_valid_llm_key():
        return _fallback_select(segments, duration_ms)

    try:
        client = OpenAI(
            api_key=settings.llm_api_key,
            base_url=settings.llm_base_url,
            timeout=60.0,
        )

        text_with_ts = _build_text_with_timestamps(segments)

        prompt = f"""你是一个专业的短视频内容策划。以下是某段视频/播客的带时间戳字幕文本。

请从中找出 {settings.highlight_count} 个最精彩的片段，每个片段时长约 {settings.highlight_duration_sec} 秒。

评选标准：
1. 信息密度：单位时间内包含最多的有价值信息、观点或数据
2. 情绪张力：幽默、争议、冲突、感动等能引发观众共鸣的时刻
3. 传播力：独立成段后依然完整、有爆点，适合在短视频平台传播

请以 JSON 格式输出，格式如下：
```json
[
  {{
    "rank": 1,
    "start_second": 120.0,
    "end_second": 165.0,
    "score": 9.2,
    "reason": "这个片段包含了一个出人意料的观点转折...",
    "title": "15字以内的吸引人标题"
  }}
]
```

注意：
- start_second 和 end_second 必须精确匹配下面字幕中已有的时间戳
- rank 从 1 开始，1 表示最精彩
- score 范围 0-10
- title 控制在15个字以内，要吸引眼球
- 只输出 JSON，不要其他内容

字幕文本：
{text_with_ts}"""

        response = client.chat.completions.create(
            model=settings.llm_model,
            messages=[{"role": "user", "content": prompt}],
            temperature=0.7,
        )

        content = response.choices[0].message.content or ""
        json_match = re.search(r"```json\s*(.*?)\s*```", content, re.DOTALL)
        if json_match:
            content = json_match.group(1)

        try:
            data = json.loads(content)
        except json.JSONDecodeError:
            return _fallback_select(segments, duration_ms)

        results = []
        for item in data[:settings.highlight_count]:
            results.append(HighlightClip(
                rank=item["rank"],
                start_ms=int(item["start_second"] * 1000),
                end_ms=int(item["end_second"] * 1000),
                score=item["score"],
                reason=item["reason"],
                title=item["title"],
            ))

        return results

    except Exception:
        return _fallback_select(segments, duration_ms)


def _fallback_select(segments: list[SubtitleSegment], duration_ms: int) -> list[HighlightClip]:
    if not segments:
        return []

    candidate = _rough_filter(segments, duration_ms)

    segment_scores = [
        (s, _compute_density_score(s.text))
        for s in segments
    ]
    segment_scores.sort(key=lambda x: x[1], reverse=True)

    results = []
    used_ranges = []
    count = min(settings.highlight_count, len(segment_scores))

    for seg, score in segment_scores:
        if len(results) >= count:
            break
        overlap = any(
            not (seg.end_ms <= rs or seg.start_ms >= re)
            for rs, re in used_ranges
        )
        if overlap:
            continue
        used_ranges.append((seg.start_ms, seg.end_ms))
        results.append(HighlightClip(
            rank=len(results) + 1,
            start_ms=seg.start_ms,
            end_ms=seg.end_ms,
            score=round(min(score, 10.0), 1),
            reason="High density segment",
            title=f"Highlight {len(results) + 1}",
        ))

    return results


def detect_highlights(segments: list[SubtitleSegment]) -> list[HighlightClip]:
    if not segments:
        return []

    duration_ms = settings.highlight_duration_sec * 1000
    candidates = _rough_filter(segments, duration_ms)

    if not candidates:
        return []

    return _llm_select(candidates, duration_ms)