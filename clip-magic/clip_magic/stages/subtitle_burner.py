import subprocess
import shutil
import os
import cv2
import numpy as np
from pathlib import Path

from clip_magic.config import settings
from clip_magic.stages.audio_extractor import get_video_duration


def _get_clip_duration(video_path: str) -> float:
    return get_video_duration(video_path)


def burn_subtitles_to_clip(
    video_path: str,
    segments: list,
    output_path: str,
):
    if not segments:
        shutil.copy2(video_path, output_path)
        return output_path

    video_duration = _get_clip_duration(video_path)
    clip_start_ms = segments[0].start_ms if segments else 0
    video_duration_ms = int(video_duration * 1000)

    cap = cv2.VideoCapture(video_path)
    fps = cap.get(cv2.CAP_PROP_FPS)
    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))

    fourcc = cv2.VideoWriter_fourcc(*'mp4v')
    temp_output = str(Path(output_path).parent / "temp_no_audio.mp4")
    out = cv2.VideoWriter(temp_output, fourcc, fps, (width, height))

    font = cv2.FONT_HERSHEY_SIMPLEX
    font_scale = min(width, height) / 400
    font_thickness = max(2, int(font_scale * 2))

    subtitle_text = ""
    current_segment_idx = 0

    for frame_idx in range(total_frames):
        ret, frame = cap.read()
        if not ret:
            break

        current_time_ms = (frame_idx / fps) * 1000

        while current_segment_idx < len(segments):
            seg = segments[current_segment_idx]
            rel_start_ms = seg.start_ms - clip_start_ms
            rel_end_ms = seg.end_ms - clip_start_ms

            if rel_start_ms < 0:
                rel_start_ms = 0
            if rel_end_ms > video_duration_ms:
                rel_end_ms = video_duration_ms

            if current_time_ms >= rel_start_ms and current_time_ms <= rel_end_ms:
                subtitle_text = seg.text
                break
            elif current_time_ms > rel_end_ms:
                current_segment_idx += 1
                subtitle_text = ""
            else:
                break

        if subtitle_text:
            text_size, _ = cv2.getTextSize(subtitle_text, font, font_scale, font_thickness)
            text_width, text_height = text_size
            x = (width - text_width) // 2
            y = height - 100

            cv2.putText(frame, subtitle_text, (x, y), font, font_scale,
                        (0, 0, 0), font_thickness + 2, cv2.LINE_AA)
            cv2.putText(frame, subtitle_text, (x, y), font, font_scale,
                        (255, 255, 255), font_thickness, cv2.LINE_AA)

        out.write(frame)

    cap.release()
    out.release()

    cmd = [
        settings.ffmpeg_path, "-y",
        "-i", temp_output,
        "-i", video_path,
        "-c:v", "libx264",
        "-preset", "fast",
        "-crf", "23",
        "-c:a", "aac",
        "-b:a", "128k",
        "-movflags", "+faststart",
        "-map", "0:v",
        "-map", "1:a",
        output_path,
    ]

    try:
        subprocess.run(cmd, check=True, capture_output=True, encoding='utf-8', errors='ignore')
    except subprocess.CalledProcessError:
        shutil.copy2(video_path, output_path)

    try:
        os.remove(temp_output)
    except OSError:
        pass

    return output_path