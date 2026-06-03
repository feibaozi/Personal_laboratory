from pathlib import Path
from typing import Optional

from app.config import settings


def _escape_ass_text(text: str) -> str:
    """转义 ASS 字幕中的特殊字符"""
    text = text.replace("\\", "\\\\")
    text = text.replace("{", "\\{")
    text = text.replace("}", "\\}")
    text = text.replace("\n", "\\N")
    return text


ASS_TEMPLATE = """[Script Info]
Title: AI Director Subtitles
ScriptType: v4.00+
PlayResX: 1920
PlayResY: 1080
WrapStyle: 0

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,{font},{fontsize},{primary_colour},&H000000FF,{outline_colour},&H00000000,0,0,0,0,100,100,0,0,1,{outline},0,2,10,10,50,1
Style: CN,{font},{fontsize},{primary_colour},&H000000FF,{outline_colour},&H00000000,0,0,0,0,100,100,0,0,1,{outline},0,2,10,10,50,1
Style: EN,{font},{en_fontsize},&H00AAAAFF,&H000000FF,{outline_colour},&H00000000,0,1,0,0,100,100,0,0,1,{outline},0,2,10,10,90,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
{events}"""


def _format_ass_time(seconds: float) -> str:
    # ASS 格式为 H:MM:SS.CC，CC 是厘秒（百分之一秒），这是标准格式
    h = int(seconds // 3600)
    m = int((seconds % 3600) // 60)
    s = int(seconds % 60)
    cs = int((seconds % 1) * 100)
    return f"{h}:{m:02d}:{s:02d}.{cs:02d}"


def generate_ass_subtitles(
    segments: list[dict],
    output_path: str,
    style: str = "CN",
    font: Optional[str] = None,
    fontsize: Optional[int] = None,
    primary_colour: Optional[str] = None,
    outline_colour: Optional[str] = None,
    outline_width: Optional[int] = None,
    bilingual_segments: Optional[list[dict]] = None,
) -> str:
    font = font or settings.subtitle_font
    fontsize = fontsize or settings.subtitle_fontsize
    primary_colour = primary_colour or settings.subtitle_primary_colour
    outline_colour = outline_colour or settings.subtitle_outline_colour
    outline_width = outline_width or settings.subtitle_outline_width

    events = []
    for seg in segments:
        start = _format_ass_time(seg.get("start", 0))
        end = _format_ass_time(seg.get("end", 0))
        text = _escape_ass_text(seg.get("text", ""))
        events.append(f"Dialogue: 0,{start},{end},{style},,0,0,0,,{text}")

    if bilingual_segments:
        for seg in bilingual_segments:
            start = _format_ass_time(seg.get("start", 0))
            end = _format_ass_time(seg.get("end", 0))
            text = _escape_ass_text(seg.get("text", ""))
            events.append(f"Dialogue: 0,{start},{end},EN,,0,0,0,,{text}")

    ass_content = ASS_TEMPLATE.format(
        font=font,
        fontsize=fontsize,
        en_fontsize=max(fontsize - 6, 14),
        primary_colour=primary_colour,
        outline_colour=outline_colour,
        outline=outline_width,
        events="\n".join(events),
    )

    Path(output_path).parent.mkdir(parents=True, exist_ok=True)
    Path(output_path).write_text(ass_content, encoding="utf-8")
    return output_path


def burn_subtitles(
    video_path: str,
    ass_path: str,
    output_path: str,
) -> str:
    from app.engine.composer import _run_ffmpeg

    # 使用更安全的路径传递方式，处理 Windows 路径中的特殊字符
    ass_path_resolved = Path(ass_path).resolve()
    escaped_ass = str(ass_path_resolved).replace("\\", "/").replace(":", "\\:").replace("'", "\\'").replace("[", "\\[").replace("]", "\\]")

    args = [
        "-y",
        "-i", video_path,
        "-vf", f"subtitles='{escaped_ass}'",
        "-c:v", "libx264", "-preset", "fast", "-crf", "23",
        "-c:a", "copy",
        "-movflags", "+faststart",
        output_path,
    ]
    _run_ffmpeg(args, timeout=600)
    return output_path


def polish_subtitles_with_llm(
    segments: list[dict],
) -> list[dict]:
    from openai import OpenAI
    from app.config import settings as s

    if not s.has_valid_llm_key():
        return segments

    text_lines = []
    for i, seg in enumerate(segments):
        text_lines.append(f"[{i}] {seg.get('text', '')}")

    prompt = f"""请对以下字幕文本进行润色：
1. 去除语气词（嗯、啊、那个、就是说等）
2. 优化断句，使每行字幕长度适中
3. 修正口语化表达为更清晰的书面语
4. 保持原意不变

字幕文本：
{chr(10).join(text_lines)}

请按相同格式输出润色后的字幕，每行格式: [序号] 润色后文本"""

    try:
        client = OpenAI(api_key=s.llm_api_key, base_url=s.llm_base_url, timeout=30.0)
        response = client.chat.completions.create(
            model=s.llm_model,
            messages=[{"role": "user", "content": prompt}],
            temperature=0.3,
            max_tokens=2000,
        )
        content = response.choices[0].message.content or ""

        import re
        polished = {}
        for line in content.strip().split("\n"):
            match = re.match(r"\[(\d+)\]\s*(.+)", line)
            if match:
                polished[int(match.group(1))] = match.group(2)

        result = []
        for i, seg in enumerate(segments):
            new_seg = dict(seg)
            if i in polished:
                new_seg["text"] = polished[i]
            result.append(new_seg)
        return result

    except Exception:
        return segments