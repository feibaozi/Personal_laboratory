from pathlib import Path
from typing import Optional

from app.config import settings

# 尝试导入 CosyVoice，失败则标记不可用
try:
    from cosyvoice.cli.cosyvoice import CosyVoice as CosyVoiceModel
    COSYVOICE_AVAILABLE = True
except ImportError:
    CosyVoiceModel = None
    COSYVOICE_AVAILABLE = False

# CosyVoice 模型单例缓存
_cosyvoice_model = None


def _get_cosyvoice_model():
    """获取 CosyVoice 模型单例，避免每次调用重载"""
    global _cosyvoice_model
    if _cosyvoice_model is not None:
        return _cosyvoice_model
    model_dir = settings.tts_model_dir
    if not Path(model_dir).exists():
        raise FileNotFoundError(f"CosyVoice model not found at {model_dir}")
    _cosyvoice_model = CosyVoiceModel(model_dir)
    return _cosyvoice_model


def synthesize_speech(
    text: str,
    output_path: str,
    reference_audio: Optional[str] = None,
    speed: float = 1.0,
) -> str:
    if not settings.tts_enabled:
        return _fallback_tts(text, output_path)

    try:
        return _cosyvoice_tts(text, output_path, reference_audio, speed)
    except Exception:
        return _fallback_tts(text, output_path)


def _cosyvoice_tts(
    text: str,
    output_path: str,
    reference_audio: Optional[str] = None,
    speed: float = 1.0,
) -> str:
    if not COSYVOICE_AVAILABLE:
        return _fallback_tts(text, output_path)

    model = _get_cosyvoice_model()

    prompt_speech = None
    if reference_audio and Path(reference_audio).exists():
        from cosyvoice.utils.file_utils import load_wav
        prompt_speech = load_wav(reference_audio, 16000)

    Path(output_path).parent.mkdir(parents=True, exist_ok=True)

    if prompt_speech is not None:
        output = model.inference_zero_shot(text, text, prompt_speech, speed=speed)
    else:
        output = model.inference_sft(text, "中文女", speed=speed)

    import soundfile as sf
    for i, chunk in enumerate(output):
        if i == 0:
            sf.write(output_path, chunk["tts_speech"].numpy().flatten(), 22050)
        else:
            data = sf.read(output_path)
            import numpy as np
            combined = np.concatenate([data[0], chunk["tts_speech"].numpy().flatten()])
            sf.write(output_path, combined, 22050)

    return output_path


def _fallback_tts(text: str, output_path: str) -> str:
    import logging
    log = logging.getLogger("ai-director")
    log.warning(
        "TTS 模型未就绪（CosyVoice 2 未安装或模型未下载），" 
        f"将生成静音替代。文本片段: {text[:80]}..."
    )

    from app.engine.composer import _run_ffmpeg

    Path(output_path).parent.mkdir(parents=True, exist_ok=True)

    safe_text = text.replace("'", "'").replace('"', '\\"')[:200]

    args = [
        "-y",
        "-f", "lavfi", "-i", f"anullsrc=r=44100:cl=stereo",
        "-t", str(max(len(text) * 0.15, 2.0)),
        "-c:a", "pcm_s16le",
        output_path.replace(".mp3", ".wav"),
    ]

    wav_path = output_path.replace(".mp3", ".wav")
    try:
        _run_ffmpeg(args, timeout=30)
    except Exception:
        pass

    if Path(wav_path).exists():
        return wav_path

    Path(output_path).write_bytes(b"")
    return output_path


def mix_narration_into_video(
    video_path: str,
    narration_path: str,
    bgm_path: Optional[str] = None,
    output_path: str = "",
    narration_weight: float = 1.0,
    bgm_weight: float = 0.3,
    original_weight: float = 0.6,
) -> str:
    from app.engine.composer import _run_ffmpeg

    if not output_path:
        output_path = str(Path(video_path).parent / (Path(video_path).stem + "_narrated.mp4"))

    inputs = ["-y", "-i", video_path, "-i", narration_path]
    filter_parts = []
    input_count = 2

    if bgm_path and Path(bgm_path).exists():
        inputs += ["-i", bgm_path]
        filter_parts.append(f"[2:a]volume={bgm_weight}[a2]")
        input_count = 3

    filter_parts.insert(0, f"[0:a]volume={original_weight}[a0]")
    filter_parts.insert(1, f"[1:a]volume={narration_weight}[a1]")

    if input_count == 3:
        mix_inputs = "[a0][a1][a2]"
    else:
        mix_inputs = "[a0][a1]"

    filter_parts.append(
        f"{mix_inputs}amix=inputs={input_count}:duration=first:weights={original_weight} {narration_weight}" +
        (f" {bgm_weight}" if input_count == 3 else "") + "[aout]"
    )

    filter_complex = ";".join(filter_parts)

    args = inputs + [
        "-filter_complex", filter_complex,
        "-map", "0:v",
        "-map", "[aout]",
        "-c:v", "copy",
        "-c:a", "aac", "-b:a", "128k",
        "-shortest",
        "-movflags", "+faststart",
        output_path,
    ]

    _run_ffmpeg(args, timeout=300)
    return output_path