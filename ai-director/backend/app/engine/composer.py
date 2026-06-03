import subprocess
import json
import logging
from pathlib import Path
from typing import Optional

from app.config import settings
from app.models.script import Script, ShotSpec
from app.models.material import Material, MaterialType

_logger = logging.getLogger("ai-director")


TRANSITION_MAP = {
    "cut": None,
    "dissolve": "dissolve",
    "fade_in": "fade",
    "fade_out": "fade",
    "fadeblack": "fadeblack",
    "fadewhite": "fadewhite",
    "wipeleft": "wipeleft",
    "wiperight": "wiperight",
    "slideleft": "slideleft",
    "slideright": "slideright",
    "slidedown": "slidedown",
    "slideup": "slideup",
    "smoothleft": "smoothleft",
    "smoothright": "smoothright",
    "smoothup": "smoothup",
    "smoothdown": "smoothdown",
    "circlecrop": "circlecrop",
    "circleopen": "circleopen",
    "circleclose": "circleclose",
    "rectcrop": "rectcrop",
    "distance": "distance",
    "radial": "radial",
    "pixelize": "pixelize",
    "hlslice": "hlslice",
    "hrslice": "hrslice",
    "vuslice": "vuslice",
    "vdslice": "vdslice",
    "vertopen": "vertopen",
    "vertclose": "vertclose",
    "horzopen": "horzopen",
    "horzclose": "horzclose",
    "diagtl": "diagtl",
    "diagtr": "diagtr",
    "diagbl": "diagbl",
    "diagbr": "diagbr",
    "squeezeh": "squeezeh",
    "squeezev": "squeezev",
    "zoomin": "zoomin",
}

DEFAULT_TRANSITION_DURATION = 0.8


def _run_ffmpeg(args: list[str], timeout: int = 300) -> subprocess.CompletedProcess:
    cmd = [settings.ffmpeg_path] + args
    _logger.debug(f"FFmpeg 命令: {' '.join(cmd)}")
    result = subprocess.run(
        cmd,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        timeout=timeout,
    )
    if result.returncode != 0:
        raise RuntimeError(
            f"FFmpeg failed (code {result.returncode}): {result.stderr.decode(errors='replace')[:500]}"
        )
    return result


def _get_duration(file_path: str) -> float:
    cmd = [
        settings.ffmpeg_path.replace("ffmpeg", "ffprobe"),
        "-v", "quiet",
        "-print_format", "json",
        "-show_format",
        file_path,
    ]
    result = subprocess.run(cmd, capture_output=True, timeout=30)
    if result.returncode == 0:
        info = json.loads(result.stdout)
        return float(info.get("format", {}).get("duration", 0))
    return 0.0


def _trim_clip(
    input_path: str,
    output_path: str,
    start_sec: float = 0,
    duration_sec: Optional[float] = None,
) -> str:
    args = ["-y", "-i", input_path]
    if start_sec > 0:
        args += ["-ss", str(start_sec)]
    if duration_sec is not None:
        args += ["-t", str(duration_sec)]
    args += [
        "-c:v", "libx264", "-preset", "fast", "-crf", "23",
        "-c:a", "aac", "-b:a", "128k",
        "-movflags", "+faststart",
        output_path,
    ]
    _run_ffmpeg(args)
    return output_path


def _image_to_video(
    image_path: str,
    output_path: str,
    duration_sec: float = 5.0,
) -> str:
    args = [
        "-y",
        "-loop", "1", "-i", image_path,
        "-t", str(duration_sec),
        "-c:v", "libx264", "-preset", "fast", "-crf", "23",
        "-pix_fmt", "yuv420p",
        "-vf", "scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2:black",
        "-c:a", "aac", "-b:a", "128k",
        "-movflags", "+faststart",
        output_path,
    ]
    _run_ffmpeg(args)
    return output_path


def _audio_to_video(
    audio_path: str,
    output_path: str,
    duration_sec: float,
) -> str:
    args = [
        "-y",
        "-f", "lavfi", "-i", f"color=c=black:s=1920x1080:d={duration_sec}:r=30",
        "-i", audio_path,
        "-c:v", "libx264", "-preset", "fast", "-crf", "23",
        "-pix_fmt", "yuv420p",
        "-c:a", "aac", "-b:a", "128k",
        "-shortest",
        "-movflags", "+faststart",
        output_path,
    ]
    _run_ffmpeg(args)
    return output_path


def compose_video(
    script: Script,
    shot_material_map: dict[int, str],
    output_path: str,
    work_dir: str = "./output/work",
    transition_duration: float = DEFAULT_TRANSITION_DURATION,
) -> str:
    Path(work_dir).mkdir(parents=True, exist_ok=True)
    Path(settings.output_dir).mkdir(parents=True, exist_ok=True)

    trimmed_clips: list[str] = []

    for shot in script.shots:
        material_path = shot_material_map.get(shot.index)
        if not material_path:
            continue

        clip_path = str(Path(work_dir) / f"shot_{shot.index}.mp4")

        ext = Path(material_path).suffix.lower()
        image_exts = {".jpg", ".jpeg", ".png", ".gif", ".bmp", ".webp"}
        audio_exts = {".mp3", ".wav", ".aac", ".flac", ".ogg", ".m4a", ".wma"}

        if ext in image_exts:
            _image_to_video(material_path, clip_path, shot.duration_sec)
        elif ext in audio_exts:
            _audio_to_video(material_path, clip_path, shot.duration_sec)
        else:
            source_duration = _get_duration(material_path)
            if source_duration > 0 and shot.duration_sec < source_duration:
                _trim_clip(material_path, clip_path, start_sec=0, duration_sec=shot.duration_sec)
            else:
                _trim_clip(material_path, clip_path, start_sec=0)

        trimmed_clips.append(clip_path)

    if not trimmed_clips:
        raise ValueError("没有可用的素材片段")

    if len(trimmed_clips) == 1:
        import shutil
        shutil.copy2(trimmed_clips[0], output_path)
        return output_path

    return _xfade_concat(trimmed_clips, script, output_path, transition_duration, work_dir)


def _xfade_concat(
    clips: list[str],
    script: Script,
    output_path: str,
    transition_duration: float,
    work_dir: str,
) -> str:
    if len(clips) == 2:
        return _xfade_two(clips[0], clips[1], script, output_path, transition_duration)

    intermediate_outputs: list[str] = []
    current_input = clips[0]
    accumulated_offset = _get_duration(clips[0]) - transition_duration
    accumulated_offset_prev = accumulated_offset  # 记录上一个有效 offset

    for i in range(1, len(clips)):
        shot = script.shots[i] if i < len(script.shots) else script.shots[-1]
        transition_type = TRANSITION_MAP.get(shot.transition_in, "dissolve") or "dissolve"

        if i < len(clips) - 1:
            out_path = str(Path(work_dir) / f"xfade_step_{i}.mp4")
        else:
            out_path = output_path

        # offset 非负校验
        offset = accumulated_offset
        current_transition = transition_duration
        if offset < 0:
            # 片段太短，跳过转场，直接拼接
            _logger.warning(f"xfade offset 为负值 ({offset:.2f})，跳过转场")
            offset = accumulated_offset_prev
            current_transition = 0

        filter_complex = (
            f"[0:v][1:v]xfade=transition={transition_type}"
            f":duration={current_transition}:offset={offset}[v]"
        )

        args = [
            "-y",
            "-i", current_input,
            "-i", clips[i],
            "-filter_complex", filter_complex,
            "-map", "[v]",
            "-c:v", "libx264", "-preset", "fast", "-crf", "23",
            "-movflags", "+faststart",
            out_path,
        ]

        try:
            _run_ffmpeg(args, timeout=600)
        except Exception:
            # xfade 失败时，使用 concat demuxer 简单拼接
            _logger.warning(f"xfade 失败，使用 concat demuxer 回退拼接 step {i}")
            concat_list = Path(work_dir) / f"concat_fallback_{i}.txt"
            concat_list.write_text(f"file '{current_input}'\nfile '{clips[i]}'\n", encoding="utf-8")
            fallback_args = [settings.ffmpeg_path, "-y", "-f", "concat", "-safe", "0", "-i", str(concat_list), "-c", "copy", str(out_path)]
            _run_ffmpeg(fallback_args)

        current_input = out_path
        next_duration = _get_duration(clips[i])
        accumulated_offset_prev = accumulated_offset
        accumulated_offset += next_duration - transition_duration

    return current_input


def _xfade_two(
    clip1: str,
    clip2: str,
    script: Script,
    output_path: str,
    transition_duration: float,
) -> str:
    shot = script.shots[1] if len(script.shots) > 1 else script.shots[0]
    transition_type = TRANSITION_MAP.get(shot.transition_in, "dissolve") or "dissolve"
    offset = _get_duration(clip1) - transition_duration

    filter_complex = (
        f"[0:v][1:v]xfade=transition={transition_type}"
        f":duration={transition_duration}:offset={offset}[v]"
    )

    args = [
        "-y",
        "-i", clip1,
        "-i", clip2,
        "-filter_complex", filter_complex,
        "-map", "[v]",
        "-c:v", "libx264", "-preset", "fast", "-crf", "23",
        "-movflags", "+faststart",
        output_path,
    ]

    _run_ffmpeg(args, timeout=300)
    return output_path


def _has_audio_stream(video_path: str) -> bool:
    """检查视频文件是否包含音频流"""
    cmd = [
        settings.ffmpeg_path.replace("ffmpeg", "ffprobe"),
        "-v", "quiet",
        "-select_streams", "a",
        "-show_entries", "stream=codec_type",
        "-of", "csv=p=0",
        video_path,
    ]
    try:
        result = subprocess.run(cmd, capture_output=True, timeout=30)
        return b"audio" in result.stdout
    except Exception:
        return False


def add_audio_to_video(
    video_path: str,
    audio_path: str,
    output_path: str,
    audio_weight: float = 0.3,
    video_weight: float = 1.0,
) -> str:
    # 检查视频是否有音频流，没有则添加静音轨
    if not _has_audio_stream(video_path):
        _logger.info("视频无音频流，先添加静音轨")
        silent_path = str(Path(output_path).parent / "silent_temp.mp4")
        silent_args = [
            "-y", "-i", video_path,
            "-f", "lavfi", "-i", "anullsrc=channel_layout=stereo:sample_rate=44100",
            "-c:v", "copy", "-c:a", "aac", "-b:a", "128k",
            "-shortest", silent_path,
        ]
        _run_ffmpeg(silent_args)
        video_path = silent_path

    args = [
        "-y",
        "-i", video_path,
        "-i", audio_path,
        "-filter_complex",
        f"[0:a]volume={video_weight:.2f}[a0];[1:a]volume={audio_weight:.2f}[a1];[a0][a1]amix=inputs=2:duration=first[aout]",
        "-map", "0:v",
        "-map", "[aout]",
        "-c:v", "copy",
        "-c:a", "aac", "-b:a", "128k",
        "-shortest",
        output_path,
    ]
    _run_ffmpeg(args, timeout=300)
    return output_path