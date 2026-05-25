import sys
import os
import time
import json
from pathlib import Path

ROOT = r"C:\Users\hexi\Desktop\VScode\clip-magic"
sys.path.insert(0, ROOT)

TEST_VIDEO = os.path.join(ROOT, "test_video.mp4")
OUTPUT_DIR = os.path.join(ROOT, "output_e2e")
TEMP_DIR = os.path.join(ROOT, "temp_e2e")
os.makedirs(OUTPUT_DIR, exist_ok=True)
os.makedirs(TEMP_DIR, exist_ok=True)

from clip_magic.config import settings
from clip_magic.stages.audio_extractor import extract_audio
from clip_magic.stages.clip_engine import clip_segments
from clip_magic.stages.highlight_detector import (
    HighlightClip, detect_highlights,
    _compute_density_score, _fallback_select, _rough_filter,
)
from clip_magic.stages.cover_generator import generate_cover
from clip_magic.stages.subtitle_burner import burn_subtitles_to_clip
from clip_magic.model_downloader import is_model_cached


def format_ms(ms):
    m = ms // 60000
    s = (ms % 60000) // 1000
    return f"{m:02d}:{s:02d}"


def build_mock_segments(audio_duration_ms: int):
    from clip_magic.stages.transcriber import SubtitleSegment
    segments = []
    emotion_texts = [
        ("大家好啊，欢迎来到今天的节目！", 0, 5000),
        ("今天我们要聊一个非常震撼的话题", 5000, 9000),
        ("你们知道吗，科学家刚刚发现了一件让人不敢相信的事情", 9000, 14000),
        ("这太离谱了！简直让人笑死", 14000, 17000),
        ("我们来分析一下背后的原因", 25000, 29000),
        ("这个发现彻底改变了我们对世界的认知", 29000, 34000),
        ("不得不说，这绝对是一个重大突破", 34000, 39000),
        ("让我们继续深入探讨这个话题", 60000, 65000),
        ("你们可能不知道，但实际上...", 65000, 70000),
        ("这就是为什么我们要保持开放的心态", 75000, 81000),
        ("想象一下，如果这一切都是真的", 81000, 86000),
        ("我们必须重新思考很多事情", 100000, 105000),
        ("这是一个让人震惊的真相", 105000, 110000),
        ("绝对会让大家大开眼界", 110000, 115000),
        ("让我们一起期待接下来会发生什么", 140000, 146000),
    ]
    for text, start, end in emotion_texts:
        if end <= audio_duration_ms:
            segments.append(SubtitleSegment(
                text=text,
                start_ms=start,
                end_ms=end,
                confidence=0.9,
            ))
    return segments


def main():
    use_mock = "--mock" in sys.argv
    use_real = "--real" in sys.argv

    if not use_mock and not use_real:
        model_ready = is_model_cached(settings.whisper_model_size)
        if model_ready:
            use_real = True
            print("Whisper model cached, using real transcription.")
        else:
            use_mock = True
            print("Whisper model not cached, using mock segments.")
            print("Run 'python -m clip_magic.model_downloader download' to download the model.")

    print("=" * 60)
    print("Clip Magic — End-to-End Pipeline Test")
    print(f"Mode: {'Mock' if use_mock else 'Real'} transcription")
    print(f"LLM: {'Enabled' if settings.has_valid_llm_key() else 'Fallback (rule-based)'}")
    print("=" * 60)

    if not os.path.exists(TEST_VIDEO):
        print(f"ERROR: Test video not found: {TEST_VIDEO}")
        return

    file_size = os.path.getsize(TEST_VIDEO) / (1024 * 1024)
    print(f"Input: {TEST_VIDEO} ({file_size:.1f} MB)")

    start_total = time.time()

    print("\n[Stage 1/6] Extracting audio...")
    t0 = time.time()
    audio_info = extract_audio(TEST_VIDEO, TEMP_DIR)
    audio_duration_ms = int(audio_info.duration_sec * 1000)
    print(f"  Audio: {audio_info.path}")
    print(f"  Duration: {audio_info.duration_sec:.1f}s")
    print(f"  Time: {time.time()-t0:.1f}s")

    print(f"\n[Stage 2/6] Transcribing...")
    t1 = time.time()
    if use_real:
        print("  Using real Whisper transcription...")
        from clip_magic.stages.transcriber import transcribe
        segments = transcribe(str(audio_info.path))
        print(f"  Segments: {len(segments)} (real)")
    else:
        print("  Using mock segments...")
        segments = build_mock_segments(audio_duration_ms)
        print(f"  Segments: {len(segments)} (mock)")
    for seg in segments[:3]:
        print(f"    [{format_ms(seg.start_ms)}-{format_ms(seg.end_ms)}] {seg.text[:50]}")
    if len(segments) > 3:
        print(f"    ... ({len(segments)-3} more)")
    print(f"  Time: {time.time()-t1:.1f}s")

    print(f"\n[Stage 3/6] Detecting highlights...")
    t2 = time.time()
    if settings.has_valid_llm_key():
        print("  Using LLM semantic analysis...")
    else:
        print("  Using rule-based scoring (fallback)...")
    highlights = detect_highlights(segments)
    if not highlights:
        print("  WARNING: No highlights detected, skipping remaining stages")
        print("  建议使用包含清晰语音的视频文件")
        return
    print(f"  Found {len(highlights)} highlights:")
    for hl in highlights:
        print(f"    #{hl.rank}: [{format_ms(hl.start_ms)}-{format_ms(hl.end_ms)}] "
              f"score={hl.score:.1f} — {hl.title}")
        if hl.reason:
            print(f"      理由: {hl.reason}")
    print(f"  Time: {time.time()-t2:.1f}s")

    print("\n[Stage 4/6] Clipping video segments...")
    t3 = time.time()
    clip_results = clip_segments(TEST_VIDEO, highlights, OUTPUT_DIR)
    for r in clip_results:
        size = os.path.getsize(r.output_path) / (1024 * 1024)
        dur = (r.end_ms - r.start_ms) / 1000
        print(f"  #{r.rank}: {Path(r.output_path).name} ({size:.1f} MB, {dur:.1f}s)")
    print(f"  Time: {time.time()-t3:.1f}s")

    print("\n[Stage 5/6] Generating cover images...")
    t4 = time.time()
    covers = []
    for r in clip_results:
        cover_path = os.path.join(OUTPUT_DIR, f"cover_{r.rank}.jpg")
        hl = next((h for h in highlights if h.rank == r.rank), None)
        title = hl.title if hl else f"Clip {r.rank}"
        mid_ms = (r.start_ms + r.end_ms) // 2
        generate_cover(r.output_path, title, r.rank, mid_ms, cover_path)
        size_kb = os.path.getsize(cover_path) / 1024
        covers.append(cover_path)
        print(f"  #{r.rank}: {Path(cover_path).name} ({size_kb:.0f} KB)")
    print(f"  Time: {time.time()-t4:.1f}s")

    print("\n[Stage 6/6] Burning subtitles to clips...")
    t5 = time.time()
    subtitle_files = []
    for r in clip_results:
        clip_segs = [s for s in segments if s.start_ms >= r.start_ms and s.end_ms <= r.end_ms]
        hl = next((h for h in highlights if h.rank == r.rank), None)
        clip_title = hl.title if hl else f"Clip {r.rank}"
        subtitle_path = os.path.join(OUTPUT_DIR, f"subtitle_{r.rank}.mp4")

        from clip_magic.stages.subtitle_burner import burn_subtitles_to_clip
        burn_subtitles_to_clip(r.output_path, clip_segs, subtitle_path)
        size_mb = os.path.getsize(subtitle_path) / (1024 * 1024)
        subtitle_files.append(subtitle_path)
        print(f"  #{r.rank}: {Path(subtitle_path).name} ({size_mb:.2f} MB) — {clip_title}")
    print(f"  Time: {time.time()-t5:.1f}s")

    total_time = time.time() - start_total
    print("\n" + "=" * 60)
    print(f"Pipeline complete in {total_time:.1f}s")
    print(f"Mode: {'Real Whisper' if use_real else 'Mock'} + {'LLM' if settings.has_valid_llm_key() else 'Fallback'}")
    print("=" * 60)

    print("\nOutput files:")
    all_files = sorted(Path(OUTPUT_DIR).glob("*"), key=lambda p: p.stat().st_mtime, reverse=True)
    for f in all_files:
        size = f.stat().st_size
        unit = "KB" if size < 1024 * 1024 else "MB"
        val = size / 1024 if size < 1024 * 1024 else size / (1024 * 1024)
        print(f"  {f.name:<45} {val:>8.1f} {unit}")

    manifest = {
        "transcription_mode": "real" if use_real else "mock",
        "analysis_mode": "llm" if settings.has_valid_llm_key() else "fallback",
        "video": TEST_VIDEO,
        "segments_count": len(segments),
        "highlights_count": len(highlights),
        "total_time_sec": round(total_time, 1),
        "clips": [
            {
                "rank": r.rank,
                "title": r.title,
                "start_ms": r.start_ms,
                "end_ms": r.end_ms,
                "score": round(next((h.score for h in highlights if h.rank == r.rank), 0), 1),
                "reason": next((h.reason for h in highlights if h.rank == r.rank), ""),
            }
            for r in clip_results
        ]
    }
    manifest_path = os.path.join(OUTPUT_DIR, "manifest.json")
    with open(manifest_path, "w", encoding="utf-8") as f:
        json.dump(manifest, f, ensure_ascii=False, indent=2)
    print(f"\nManifest: {manifest_path}")


if __name__ == "__main__":
    main()