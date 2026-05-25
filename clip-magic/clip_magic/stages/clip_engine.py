import subprocess
from dataclasses import dataclass
from pathlib import Path

from clip_magic.config import settings
from clip_magic.stages.highlight_detector import HighlightClip
from clip_magic.stages.audio_extractor import get_video_duration


@dataclass
class ClipResult:
    rank: int
    output_path: str
    start_ms: int
    end_ms: int
    title: str


def clip_segments(
    video_path: str,
    highlights: list[HighlightClip],
    output_dir: str = "./output",
) -> list[ClipResult]:
    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    video_stem = Path(video_path).stem
    video_duration_ms = int(get_video_duration(video_path) * 1000)
    results: list[ClipResult] = []

    for hl in highlights:
        safe_start = max(0, hl.start_ms)
        safe_end = min(video_duration_ms, hl.end_ms)
        if safe_end - safe_start < 1000:
            safe_end = min(video_duration_ms, safe_start + 1000)

        start_sec = safe_start / 1000
        end_sec = safe_end / 1000
        duration = end_sec - start_sec

        safe_title = "".join(c for c in hl.title if c.isalnum() or c in " _-")[:30]
        output_name = f"{video_stem}_clip{hl.rank:02d}_{safe_title}.mp4"
        output_path = str(output_dir / output_name)

        cmd = [
            settings.ffmpeg_path, "-y",
            "-ss", str(start_sec),
            "-i", video_path,
            "-t", str(duration),
            "-c:v", "libx264",
            "-preset", "fast",
            "-crf", "23",
            "-c:a", "aac",
            "-b:a", "128k",
            "-movflags", "+faststart",
            output_path,
        ]

        try:
            subprocess.run(cmd, check=True, capture_output=True, encoding='utf-8', errors='ignore')
        except subprocess.CalledProcessError:
            continue

        results.append(ClipResult(
            rank=hl.rank,
            output_path=output_path,
            start_ms=safe_start,
            end_ms=safe_end,
            title=hl.title,
        ))

    return results