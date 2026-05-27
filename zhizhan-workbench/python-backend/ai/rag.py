import os
import json
import logging
from datetime import datetime
from database.connection import sync_session
from database.models import Stock, SentimentEvent, Financial
from nlp.preprocessor import preprocessor
from config import settings

logger = logging.getLogger(__name__)


class RAGPipeline:
    def __init__(self):
        self._collection = None
        self._client = None

    def _get_client(self):
        if self._client is not None:
            return self._client

        try:
            import chromadb

            persist_dir = settings.chroma_persist_dir
            os.makedirs(persist_dir, exist_ok=True)

            self._client = chromadb.PersistentClient(path=persist_dir)
            self._collection = self._client.get_or_create_collection(
                name="zhizhan_docs",
                metadata={"hnsw:space": "cosine"},
            )
            logger.info("[RAG] ChromaDB initialized")
            return self._client
        except ImportError:
            logger.warning("[RAG] chromadb not installed, RAG disabled")
            return None
        except Exception as e:
            logger.error(f"[RAG] Failed to initialize ChromaDB: {e}")
            return None

    def index_stock_documents(self, stock_code: str):
        client = self._get_client()
        if client is None:
            return {"indexed": 0, "error": "ChromaDB not available"}

        with sync_session() as session:
            stock = session.query(Stock).filter(Stock.code == stock_code).first()
            if not stock:
                return {"indexed": 0, "error": "Stock not found"}

            events = (
                session.query(SentimentEvent)
                .filter(SentimentEvent.stock_id == stock.id)
                .all()
            )

            financials = (
                session.query(Financial)
                .filter(Financial.stock_id == stock.id)
                .all()
            )

        documents = []
        metadatas = []
        ids = []

        for event in events:
            text = f"{event.title}"
            if event.content:
                text += f" {event.content[:500]}"
            if not text.strip():
                continue

            doc_id = f"event_{event.id}"
            documents.append(text)
            metadatas.append({
                "stock_code": stock_code,
                "type": "news",
                "source": event.source or "",
                "sentiment": event.sentiment or "neutral",
                "date": str(event.published_at) if event.published_at else "",
            })
            ids.append(doc_id)

        for fin in financials:
            text = (
                f"{stock.name} {fin.report_date} {fin.report_type}财报: "
                f"营收{fin.revenue} 净利润{fin.net_profit} "
                f"毛利率{fin.gross_margin} ROE{fin.roe} "
                f"负债率{fin.debt_ratio}"
            )
            doc_id = f"financial_{fin.id}"
            documents.append(text)
            metadatas.append({
                "stock_code": stock_code,
                "type": "financial",
                "report_date": fin.report_date or "",
            })
            ids.append(doc_id)

        if not documents:
            return {"indexed": 0}

        try:
            existing = self._collection.get(ids=ids)
            existing_ids = set(existing["ids"]) if existing["ids"] else set()
            new_docs = []
            new_metas = []
            new_ids = []

            for doc, meta, doc_id in zip(documents, metadatas, ids):
                if doc_id not in existing_ids:
                    new_docs.append(doc)
                    new_metas.append(meta)
                    new_ids.append(doc_id)

            if new_docs:
                self._collection.add(
                    documents=new_docs,
                    metadatas=new_metas,
                    ids=new_ids,
                )

            return {"indexed": len(new_docs), "total": len(documents)}
        except Exception as e:
            logger.error(f"[RAG] Failed to index documents: {e}")
            return {"indexed": 0, "error": str(e)}

    def search(self, query: str, stock_code: str | None = None, top_k: int = 5) -> list[str]:
        client = self._get_client()
        if client is None:
            return []

        try:
            where_filter = None
            if stock_code:
                where_filter = {"stock_code": stock_code}

            results = self._collection.query(
                query_texts=[query],
                n_results=top_k,
                where=where_filter,
            )

            if results and results["documents"]:
                return results["documents"][0]
            return []
        except Exception as e:
            logger.error(f"[RAG] Search failed: {e}")
            return []

    def get_context_for_report(self, stock_code: str) -> str:
        contexts = []

        industry_ctx = self.search(
            f"{stock_code} 行业分析 竞争优势", stock_code=stock_code, top_k=3
        )
        if industry_ctx:
            contexts.append("## 相关历史资讯\n" + "\n".join(f"- {c}" for c in industry_ctx))

        financial_ctx = self.search(
            f"{stock_code} 财务数据 营收 利润", stock_code=stock_code, top_k=3
        )
        if financial_ctx:
            contexts.append("## 相关财务记录\n" + "\n".join(f"- {c}" for c in financial_ctx))

        return "\n\n".join(contexts) if contexts else ""


rag_pipeline = RAGPipeline()
