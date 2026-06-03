import json
import uuid
import threading
from pathlib import Path
from typing import Optional

import chromadb


from app.config import settings
from app.models.material import Material, MaterialType, MaterialIndexResult


class ChromaService:
    _instance: Optional["ChromaService"] = None
    _lock = threading.Lock()

    def __init__(self):
        Path(settings.chroma_persist_dir).mkdir(parents=True, exist_ok=True)
        self._client = chromadb.PersistentClient(path=settings.chroma_persist_dir)
        self._visual_collection = self._get_or_create("visual_materials")
        self._audio_collection = self._get_or_create("audio_materials")

    @classmethod
    def get_instance(cls) -> "ChromaService":
        if cls._instance is not None:
            return cls._instance
        with cls._lock:
            if cls._instance is not None:
                return cls._instance
            cls._instance = cls()
            return cls._instance

    def _get_or_create(self, name: str):
        try:
            return self._client.get_collection(name)
        except Exception as e:
            # 区分 "collection 不存在" 和其他异常
            err_msg = str(e).lower()
            if "does not exist" in err_msg or "not found" in err_msg:
                return self._client.create_collection(
                    name=name,
                    metadata={"hnsw:space": "cosine"},
                )
            # 其他异常，尝试创建
            try:
                return self._client.create_collection(
                    name=name,
                    metadata={"hnsw:space": "cosine"},
                )
            except Exception:
                raise

    def index_visual(
        self,
        material: Material,
        embedding: list[float],
        metadata: Optional[dict] = None,
    ) -> MaterialIndexResult:
        meta = {
            "file_path": material.file_path,
            "filename": material.filename,
            "media_type": material.media_type.value,
            "duration_sec": material.duration_sec,
            "tags": json.dumps(material.tags, ensure_ascii=False),
            "description": material.description,
            "thumbnail_path": material.thumbnail_path or "",
        }
        if metadata:
            meta.update(metadata)

        self._visual_collection.upsert(
            ids=[material.id],
            embeddings=[embedding],
            metadatas=[meta],
        )

        return MaterialIndexResult(
            material_id=material.id,
            embedding_dim=len(embedding),
            status="indexed",
        )

    def index_audio(
        self,
        material: Material,
        embedding: list[float],
    ) -> MaterialIndexResult:
        meta = {
            "file_path": material.file_path,
            "filename": material.filename,
            "media_type": material.media_type.value,
            "duration_sec": material.duration_sec,
            "tags": json.dumps(material.tags, ensure_ascii=False),
            "description": material.description,
        }

        self._audio_collection.upsert(
            ids=[material.id],
            embeddings=[embedding],
            metadatas=[meta],
        )

        return MaterialIndexResult(
            material_id=material.id,
            embedding_dim=len(embedding),
            status="indexed",
        )

    def query_visual(
        self,
        embedding: list[float],
        top_k: int = 5,
        exclude_ids: Optional[list[str]] = None,
    ) -> list[dict]:
        # 多查一些再过滤 exclude_ids
        query_n = top_k * 2 if exclude_ids else top_k
        results = self._visual_collection.query(
            query_embeddings=[embedding],
            n_results=query_n,
            include=["metadatas", "distances"],
        )

        items = []
        if results["ids"] and results["ids"][0]:
            for i, material_id in enumerate(results["ids"][0]):
                # 在结果中过滤掉 exclude_ids
                if exclude_ids and material_id in exclude_ids:
                    continue
                distance = results["distances"][0][i] if results["distances"] else 0
                score = 1.0 - min(distance, 1.0)
                meta = results["metadatas"][0][i] if results["metadatas"] else {}

                # 使用 JSON 反序列化 tags
                tags_raw = meta.get("tags", "[]")
                try:
                    tags = json.loads(tags_raw) if isinstance(tags_raw, str) else tags_raw
                except (json.JSONDecodeError, TypeError):
                    tags = tags_raw.split(",") if isinstance(tags_raw, str) else []

                items.append({
                    "material_id": material_id,
                    "filename": meta.get("filename", ""),
                    "media_type": meta.get("media_type", "video"),
                    "score": round(score, 4),
                    "thumbnail_path": meta.get("thumbnail_path", ""),
                    "tags": tags,
                })

                if len(items) >= top_k:
                    break

        return items

    def query_audio(
        self,
        embedding: list[float],
        top_k: int = 5,
    ) -> list[dict]:
        results = self._audio_collection.query(
            query_embeddings=[embedding],
            n_results=top_k,
            include=["metadatas", "distances"],
        )

        items = []
        if results["ids"] and results["ids"][0]:
            for i, material_id in enumerate(results["ids"][0]):
                distance = results["distances"][0][i] if results["distances"] else 0
                score = 1.0 - min(distance, 1.0)
                meta = results["metadatas"][0][i] if results["metadatas"] else {}

                # 使用 JSON 反序列化 tags
                tags_raw = meta.get("tags", "[]")
                try:
                    tags = json.loads(tags_raw) if isinstance(tags_raw, str) else tags_raw
                except (json.JSONDecodeError, TypeError):
                    tags = tags_raw.split(",") if isinstance(tags_raw, str) else []

                items.append({
                    "material_id": material_id,
                    "filename": meta.get("filename", ""),
                    "media_type": meta.get("media_type", "audio"),
                    "score": round(score, 4),
                    "thumbnail_path": "",
                    "tags": tags,
                })

        return items

    def remove_material(self, material_id: str):
        try:
            self._visual_collection.delete(ids=[material_id])
        except Exception:
            pass
        try:
            self._audio_collection.delete(ids=[material_id])
        except Exception:
            pass

    def clear_all(self):
        self._client.delete_collection("visual_materials")
        self._client.delete_collection("audio_materials")
        self._visual_collection = self._get_or_create("visual_materials")
        self._audio_collection = self._get_or_create("audio_materials")


chroma_service = ChromaService.get_instance()