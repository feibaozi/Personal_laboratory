from pathlib import Path
from typing import Optional
import threading

from app.config import settings


def analyze_beats(audio_path: str) -> dict:
    if not Path(audio_path).exists():
        return {"bpm": 120, "beats": [], "downbeats": []}

    try:
        return _madmom_beats(audio_path)
    except Exception:
        return _simple_beats(audio_path)


def _madmom_beats(audio_path: str) -> dict:
    import madmom

    proc = madmom.features.beats.BeatTrackingProcessor(fps=100)
    act = madmom.features.beats.RNNBeatProcessor()(audio_path)
    beats = proc(act)

    try:
        db_proc = madmom.features.beats.DBNBeatTrackingProcessor(
            fps=100, transition_lambda=100
        )
        db_act = madmom.features.beats.RNNBeatProcessor()(audio_path)
        downbeats = db_proc(db_act)
    except Exception:
        downbeats = beats[::4].tolist() if len(beats) > 4 else beats.tolist()

    from app.engine.composer import _get_duration
    duration = _get_duration(audio_path)
    bpm = (len(beats) / max(duration, 1)) * 60 if duration > 0 else 120

    return {
        "bpm": round(bpm, 1),
        "beats": beats.tolist(),
        "downbeats": downbeats if isinstance(downbeats, list) else downbeats.tolist(),
    }


def _simple_beats(audio_path: str) -> dict:
    from app.engine.composer import _get_duration
    duration = _get_duration(audio_path)

    if duration <= 0:
        return {"bpm": 120, "beats": [], "downbeats": []}

    bpm = 120
    interval = 60.0 / bpm
    beats = []
    t = 0
    while t < duration:
        beats.append(round(t, 3))
        t += interval

    downbeats = beats[::4]

    return {
        "bpm": bpm,
        "beats": beats,
        "downbeats": downbeats,
    }


def analyze_emotion(audio_path: str) -> list[dict]:
    if not Path(audio_path).exists():
        return []

    try:
        return _emotion2vec_analysis(audio_path)
    except Exception:
        return _simple_emotion_analysis(audio_path)


# emotion2vec 模型缓存单例
_emotion2vec_model = None
_emotion2vec_processor = None
_emotion2vec_lock = threading.Lock()


def _get_emotion2vec_model():
    """获取或加载 emotion2vec 模型（线程安全单例）"""
    global _emotion2vec_model, _emotion2vec_processor
    if _emotion2vec_model is not None:
        return _emotion2vec_model, _emotion2vec_processor
    with _emotion2vec_lock:
        if _emotion2vec_model is not None:
            return _emotion2vec_model, _emotion2vec_processor
        from transformers import AutoModel, AutoFeatureExtractor
        model_name = settings.emotion2vec_model or "emotion2vec/emotion2vec_plus_large"
        _emotion2vec_model = AutoModel.from_pretrained(model_name, trust_remote_code=True)
        _emotion2vec_processor = AutoFeatureExtractor.from_pretrained(model_name)
        _emotion2vec_model.eval()
        return _emotion2vec_model, _emotion2vec_processor


def _emotion2vec_analysis(audio_path: str) -> list[dict]:
    import torch
    import torchaudio
    import numpy as np

    model, feature_extractor = _get_emotion2vec_model()

    waveform, sr = torchaudio.load(audio_path)
    if sr != 16000:
        waveform = torchaudio.transforms.Resample(sr, 16000)(waveform)
        sr = 16000

    window_sec = 1.0
    window_samples = int(sr * window_sec)
    results = []

    for start in range(0, waveform.shape[1], window_samples):
        chunk = waveform[:, start:start + window_samples]
        if chunk.shape[1] < sr * 0.3:
            continue

        inputs = feature_extractor(chunk.squeeze().numpy(), sampling_rate=sr, return_tensors="pt")
        with torch.no_grad():
            outputs = model(**inputs)

        t = round(start / sr, 1)
        # 使用最后一层 hidden state 的均值作为情感嵌入
        pooled = outputs.last_hidden_state[:, 0, :].squeeze().cpu().numpy()
        # 使用 PCA-like 投影将高维嵌入映射到 VAD 空间（简化近似）
        valence = float(np.tanh(np.mean(pooled[:len(pooled)//3])))
        arousal = float(np.tanh(np.mean(pooled[len(pooled)//3:2*len(pooled)//3])))
        dominance = float(np.tanh(np.mean(pooled[2*len(pooled)//3:])))

        results.append({
            "t": t,
            "valence": round(valence, 3),
            "arousal": round(arousal, 3),
            "dominance": round(dominance, 3),
        })

    return results


def _simple_emotion_analysis(audio_path: str) -> list[dict]:
    from app.engine.composer import _get_duration
    duration = _get_duration(audio_path)

    results = []
    for t in range(int(duration)):
        results.append({
            "t": float(t),
            "valence": 0.5,
            "arousal": 0.3 + 0.2 * (t / max(duration, 1)),
            "dominance": 0.5,
            "_note": "占位数据，非真实分析结果",
        })

    return results


def apply_rhythm_to_script(
    script,
    beats_data: dict,
    emotion_data: list[dict],
) -> dict:
    adjustments = {
        "shot_timing": [],
        "transition_alignment": [],
        "tempo_changes": [],
    }

    downbeats = beats_data.get("downbeats", [])
    bpm = beats_data.get("bpm", 120)

    accumulated_time = 0.0
    for shot in script.shots:
        original_duration = shot.duration_sec

        if emotion_data:
            shot_start_idx = min(int(accumulated_time), len(emotion_data) - 1)
            shot_end_idx = min(int(accumulated_time + original_duration), len(emotion_data) - 1)
            avg_arousal = sum(
                e["arousal"] for e in emotion_data[shot_start_idx:shot_end_idx + 1]
            ) / max(shot_end_idx - shot_start_idx + 1, 1)

            if avg_arousal > 0.7:
                adjusted_duration = original_duration * 0.8
                tempo_note = "fast"
            elif avg_arousal < 0.3:
                adjusted_duration = original_duration * 1.3
                tempo_note = "slow"
            else:
                adjusted_duration = original_duration
                tempo_note = "normal"
        else:
            adjusted_duration = original_duration
            tempo_note = "normal"

        if downbeats:
            nearest_downbeat = min(
                downbeats,
                key=lambda b: abs(b - (accumulated_time + adjusted_duration)),
            )
            aligned_duration = nearest_downbeat - accumulated_time
            if aligned_duration > 0:
                adjusted_duration = max(aligned_duration, original_duration * 0.5)

        adjustments["shot_timing"].append({
            "shot_index": shot.index,
            "original_duration": original_duration,
            "adjusted_duration": round(adjusted_duration, 2),
            "tempo": tempo_note,
        })

        if downbeats:
            transition_time = accumulated_time + adjusted_duration
            nearest = min(downbeats, key=lambda b: abs(b - transition_time))
            adjustments["transition_alignment"].append({
                "shot_index": shot.index,
                "transition_at": round(nearest, 3),
                "nearest_downbeat": round(nearest, 3),
            })

        accumulated_time += adjusted_duration

    return adjustments