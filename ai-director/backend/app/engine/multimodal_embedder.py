from pathlib import Path
from typing import Optional
import threading
import logging
import numpy as np
import hashlib

from app.config import settings

_logger = logging.getLogger("ai-director")


class MultimodalEmbedder:
    _instance: Optional["MultimodalEmbedder"] = None
    _lock = threading.Lock()

    def __init__(self):
        self._model = None
        self._processor = None

    @property
    def is_clip_ready(self) -> bool:
        return self._model is not None

    @classmethod
    def get_instance(cls) -> "MultimodalEmbedder":
        if cls._instance is not None:
            return cls._instance
        with cls._lock:
            if cls._instance is not None:
                return cls._instance
            cls._instance = cls()
            return cls._instance

    def try_load_clip(self):
        if self._model is not None:
            return
        try:
            import torch
            from transformers import CLIPModel, CLIPProcessor
            self._model = CLIPModel.from_pretrained(settings.clip_model_name)
            self._processor = CLIPProcessor.from_pretrained(settings.clip_model_name)
            self._model.eval()
        except Exception:
            _logger.exception("CLIP 模型加载失败")
            self._model = None
            self._processor = None

    def _text_fallback(self, text: str) -> list[float]:
        words = text.lower().split()
        vec = np.zeros(384)
        for i, word in enumerate(words[:32]):
            seed = int(hashlib.md5(word.encode()).hexdigest()[:8], 16)
            rng = np.random.default_rng(seed)
            vec[i * 12:(i + 1) * 12] = rng.standard_normal(12)
        norm = np.linalg.norm(vec)
        if norm > 0:
            vec = vec / norm
        return vec.tolist()

    def encode_text(self, text: str) -> np.ndarray:
        if self._model is not None:
            try:
                inputs = self._processor(
                    text=[text], return_tensors="pt", padding=True
                )
                with np.errstate(all="ignore"):
                    import torch
                    with torch.no_grad():
                        features = self._model.get_text_features(**inputs)
                features = features / features.norm(dim=-1, keepdim=True)
                return features.cpu().numpy().flatten()
            except Exception:
                return np.array(self._text_fallback(text))
        return np.array(self._text_fallback(text))

    def encode_image(self, image_path: str) -> np.ndarray:
        if self._model is None:
            return np.array(self._text_fallback(Path(image_path).stem))
        try:
            from PIL import Image
            with Image.open(image_path) as img:
                image = img.convert("RGB")
            inputs = self._processor(images=image, return_tensors="pt")
            import torch
            with torch.no_grad():
                features = self._model.get_image_features(**inputs)
            features = features / features.norm(dim=-1, keepdim=True)
            return features.cpu().numpy().flatten()
        except Exception:
            return np.array(self._text_fallback(Path(image_path).stem))

    def encode_image_batch(self, image_paths: list[str]) -> np.ndarray:
        if self._model is None:
            raise RuntimeError("CLIP image encoding not available")
        from PIL import Image
        images = []
        for p in image_paths:
            with Image.open(p) as img:
                images.append(img.convert("RGB"))
        inputs = self._processor(images=images, return_tensors="pt")
        import torch
        with torch.no_grad():
            features = self._model.get_image_features(**inputs)
        features = features / features.norm(dim=-1, keepdim=True)
        return features.cpu().numpy()


embedder = MultimodalEmbedder.get_instance()
