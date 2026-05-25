import subprocess
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import textwrap

from clip_magic.config import settings
from clip_magic.stages.audio_extractor import get_video_duration


def generate_cover(
    video_path: str,
    title: str,
    rank: int,
    timestamp_ms: int,
    output_path: str,
):
    thumb_path = Path(output_path).with_suffix(".thumb.jpg")
    thumb_ok = False

    video_duration_sec = get_video_duration(video_path)

    if video_duration_sec > 0:
        safe_ts = min(timestamp_ms / 1000, max(0, video_duration_sec - 1))
        try:
            _extract_frame(video_path, int(safe_ts * 1000), str(thumb_path))
            if thumb_path.exists() and thumb_path.stat().st_size > 0:
                thumb_ok = True
        except Exception:
            pass

    if not thumb_ok:
        try:
            _extract_frame(video_path, 0, str(thumb_path))
            if thumb_path.exists() and thumb_path.stat().st_size > 100:
                thumb_ok = True
        except Exception:
            pass

    cover = _create_cover_image(str(thumb_path) if thumb_ok else None, title, rank)
    cover.save(output_path, quality=95)
    thumb_path.unlink(missing_ok=True)
    return output_path


def _extract_frame(video_path: str, timestamp_ms: int, output_path: str):
    ts = timestamp_ms / 1000
    cmd = [
        settings.ffmpeg_path, "-y",
        "-ss", str(ts),
        "-i", video_path,
        "-vframes", "1",
        "-q:v", "2",
        output_path,
    ]
    subprocess.run(cmd, check=True, capture_output=True, encoding='utf-8', errors='ignore')


def _create_cover_image(thumb_path, title: str, rank: int) -> Image.Image:
    W, H = 1080, 1920

    if thumb_path and Path(thumb_path).exists():
        try:
            bg = Image.open(thumb_path).convert("RGB")
            bg = bg.resize((W, H), Image.LANCZOS)
        except Exception:
            bg = _make_gradient_background(W, H)
    else:
        bg = _make_gradient_background(W, H)

    overlay = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)

    gradient = Image.new("RGBA", (W, H // 3), (0, 0, 0, 0))
    for y in range(H // 3):
        alpha = int(180 * (1 - y / (H // 3)))
        for x in range(W):
            gradient.putpixel((x, y), (0, 0, 0, alpha))
    overlay.paste(gradient, (0, H - H // 3), gradient)

    try:
        title_font = ImageFont.truetype("msyh.ttc", 72)
        num_font = ImageFont.truetype("msyh.ttc", 120)
    except Exception:
        title_font = ImageFont.load_default()
        num_font = ImageFont.load_default()

    rank_text = f"#{rank}"
    rank_bbox = draw.textbbox((0, 0), rank_text, font=num_font)
    rank_w = rank_bbox[2] - rank_bbox[0]
    rank_x = (W - rank_w) // 2
    rank_y = 60

    for ox, oy in [(-3, 0), (3, 0), (0, -3), (0, 3)]:
        draw.text((rank_x + ox, rank_y + oy), rank_text, font=num_font, fill=(0, 0, 0, 200))
    draw.text((rank_x, rank_y), rank_text, font=num_font, fill=(255, 215, 0, 255))

    wrapped = textwrap.fill(title, width=14)
    lines = wrapped.split("\n")
    y = H - 280
    for line in lines:
        bbox = draw.textbbox((0, 0), line, font=title_font)
        line_w = bbox[2] - bbox[0]
        line_x = (W - line_w) // 2

        for ox, oy in [(-2, 0), (2, 0), (0, -2), (0, 2)]:
            draw.text((line_x + ox, y + oy), line, font=title_font, fill=(0, 0, 0, 200))
        draw.text((line_x, y), line, font=title_font, fill=(255, 255, 255, 255))
        y += 90

    draw.line([(W // 2 - 40, y + 20), (W // 2 + 40, y + 20)], fill=(255, 215, 0, 255), width=6)

    return Image.alpha_composite(bg.convert("RGBA"), overlay).convert("RGB")


def _make_gradient_background(W: int, H: int) -> Image.Image:
    bg = Image.new("RGB", (W, H))
    for y in range(H):
        r = int(18 + (30 - 18) * (y / H))
        g = int(18 + (60 - 18) * (y / H))
        b = int(24 + (100 - 24) * (y / H))
        for x in range(W):
            bg.putpixel((x, y), (r, g, b))
    return bg