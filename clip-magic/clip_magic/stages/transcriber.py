import os
import ssl
from dataclasses import dataclass
from pathlib import Path

from clip_magic.config import settings
from clip_magic.model_downloader import is_model_cached, get_model_dir, MODEL_CACHE_DIR


os.environ.setdefault("HF_ENDPOINT", "https://hf-mirror.com")

_SSL_PATCHED = False


def _patch_ssl():
    global _SSL_PATCHED
    if _SSL_PATCHED:
        return
    _SSL_PATCHED = True

    try:
        import certifi
        ssl_cert = certifi.where()
        os.environ["SSL_CERT_FILE"] = ssl_cert
    except Exception:
        pass

    try:
        import ssl as _ssl
        _orig_ssl_ctx = _ssl.create_default_context

        def _ssl_ctx_with_certs(*a, **k):
            ctx = _orig_ssl_ctx(*a, **k)
            try:
                import certifi as _certifi
                ctx.load_verify_locations(_certifi.where())
            except Exception:
                pass
            return ctx

        _ssl.create_default_context = _ssl_ctx_with_certs

        import httpcore._backends.sync as _sync_backend
        if hasattr(_sync_backend, 'ssl'):
            _sync_backend.ssl.create_default_context = _ssl_ctx_with_certs
    except Exception:
        pass


@dataclass
class SubtitleSegment:
    text: str
    start_ms: int
    end_ms: int
    confidence: float = 1.0


class ModelNotFoundError(Exception):
    pass


def transcribe(audio_path: str) -> list[SubtitleSegment]:
    _patch_ssl()

    from faster_whisper import WhisperModel

    model_size = settings.whisper_model_size

    if is_model_cached(model_size):
        model_path = str(get_model_dir(model_size))
        errors = []
        for device, compute in [
            (settings.whisper_device, settings.whisper_compute_type),
            ("cuda", "float16"),
            ("cuda", "int8"),
            ("cpu", "int8"),
        ]:
            try:
                model = WhisperModel(
                    model_path,
                    device=device,
                    compute_type=compute,
                    local_files_only=True,
                )
                return _do_transcribe(model, audio_path)
            except Exception as e:
                errors.append(f"{device}/{compute} (local): {e}")

        raise RuntimeError(
            f"Failed to load cached model '{model_size}' at '{model_path}' after "
            f"{len(errors)} attempts. Please re-download:\n"
            f"  python -m clip_magic.model_downloader download -m {model_size}"
        )

    attempts = []
    for device, compute in [
        (settings.whisper_device, settings.whisper_compute_type),
        ("cuda", "float16"),
        ("cuda", "int8"),
        ("cpu", "int8"),
    ]:
        for model_arg in [model_size, f"Systran/{model_size}"]:
            try:
                model = WhisperModel(
                    model_arg,
                    device=device,
                    compute_type=compute,
                    download_root=str(MODEL_CACHE_DIR),
                )
                return _do_transcribe(model, audio_path)
            except Exception as e:
                attempts.append(f"{device}/{compute}/{model_arg}: {e}")

    raise RuntimeError(
        f"Whisper model '{model_size}' download/load failed after {len(attempts)} attempts.\n\n"
        f"Please pre-download the model manually:\n"
        f"  python -m clip_magic.model_downloader download -m {model_size}\n\n"
        f"Or via CLI:\n"
        f"  clip-magic model download -s {model_size}\n\n"
        f"Last errors:\n  " + "\n  ".join(attempts[-3:])
    )


def _do_transcribe(model, audio_path: str) -> list[SubtitleSegment]:
    segments, _ = model.transcribe(
        audio_path,
        beam_size=5,
        word_timestamps=True,
        vad_filter=True,
        language=None,
    )

    results: list[SubtitleSegment] = []
    for seg in segments:
        results.append(SubtitleSegment(
            text=seg.text.strip(),
            start_ms=int(seg.start * 1000),
            end_ms=int(seg.end * 1000),
            confidence=seg.avg_logprob,
        ))

    return results