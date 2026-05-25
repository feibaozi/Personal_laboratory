import subprocess
import os
from dataclasses import dataclass
from pathlib import Path

from clip_magic.config import settings
from clip_magic.logger import logger


@dataclass
class AudioInfo:
    path: Path
    duration_sec: float
    sample_rate: int
    has_audio: bool = True
    audio_confidence: float = 1.0


def extract_audio(video_path: str, output_dir: str = ".") -> AudioInfo:
    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    video_stem = Path(video_path).stem
    audio_path = output_dir / f"{video_stem}_audio.wav"

    cmd = [
        settings.ffmpeg_path, "-y",
        "-i", video_path,
        "-vn",
        "-acodec", "pcm_s16le",
        "-ar", "16000",
        "-ac", "1",
        str(audio_path),
    ]

    subprocess.run(cmd, check=True, capture_output=True, text=True)

    duration_cmd = [
        settings.ffmpeg_path,
        "-i", video_path,
        "-f", "null", "-",
    ]
    result = subprocess.run(
        duration_cmd, capture_output=True, text=True
    )
    duration_sec = _parse_duration(result.stderr)

    has_audio, confidence = _detect_audio_content(str(audio_path), duration_sec)

    return AudioInfo(
        path=audio_path,
        duration_sec=duration_sec,
        sample_rate=16000,
        has_audio=has_audio,
        audio_confidence=confidence,
    )


def get_video_duration(video_path: str) -> float:
    cmd = [
        settings.ffmpeg_path,
        "-i", video_path,
        "-f", "null", "-",
    ]
    result = subprocess.run(cmd, capture_output=True, encoding='utf-8', errors='ignore')
    return _parse_duration(result.stderr or "")


def _parse_duration(stderr_output: str) -> float:
    if not stderr_output:
        return 0.0
    for line in stderr_output.split("\n"):
        if "Duration" in line:
            time_str = line.split("Duration: ")[1].split(",")[0].strip()
            h, m, s = time_str.split(":")
            return float(h) * 3600 + float(m) * 60 + float(s)
    return 0.0


def _detect_audio_content(audio_path: str, duration_sec: float) -> tuple[bool, float]:
    if duration_sec < 1.0:
        return False, 0.0

    cmd = [
        settings.ffmpeg_path,
        "-i", audio_path,
        "-af", "volumedetect",
        "-f", "null", "-",
    ]
    result = subprocess.run(cmd, capture_output=True, text=True)

    max_volume = 0.0
    for line in (result.stdout + result.stderr).split("\n"):
        if "max_volume" in line:
            try:
                max_volume = float(line.split(":")[1].strip().replace("dB", ""))
            except:
                pass

    if max_volume > -60:
        return True, min(1.0, max(0.0, (max_volume + 60) / 60))
    elif max_volume > -80:
        return True, min(0.5, max(0.0, (max_volume + 80) / 40))
    else:
        return False, 0.0


def has_valid_audio(video_path: str) -> tuple[bool, float, str]:
    try:
        audio_info = extract_audio(video_path, os.path.join(os.path.dirname(video_path), "temp_audio_check"))

        if not audio_info.has_audio or audio_info.audio_confidence < 0.1:
            return False, audio_info.audio_confidence, "检测到视频没有有效音频内容"

        if audio_info.audio_confidence < 0.3:
            return False, audio_info.audio_confidence, "检测到音频音量过低，可能影响转录效果"

        os.remove(audio_info.path)
        return True, audio_info.audio_confidence, "音频检测通过"
    except Exception as e:
        logger.warning("Audio detection failed: %s", e)
        return False, 0.0, f"音频检测失败: {str(e)[:50]}"