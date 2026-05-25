import logging
from datetime import datetime

from sqlalchemy.orm import Session

from app.models.conversation import Conversation, Message
from app.services.llm_engine import LLMEngine
from app.config import settings

logger = logging.getLogger(__name__)


class ContextMemory:
    def __init__(self, llm: LLMEngine, db_session_factory):
        self.llm = llm
        self.db_session_factory = db_session_factory

    def get_or_create_conversation(self, contact_name: str) -> Conversation:
        db: Session = self.db_session_factory()
        try:
            conv = db.query(Conversation).filter_by(
                contact_name=contact_name).first()
            if not conv:
                conv = Conversation(contact_name=contact_name)
                db.add(conv)
                db.commit()
                db.refresh(conv)
            return conv
        finally:
            db.close()

    def add_message(self, contact_name: str, role: str, content: str,
                    is_auto_reply: bool = False):
        db: Session = self.db_session_factory()
        try:
            conv = db.query(Conversation).filter_by(
                contact_name=contact_name).first()
            if not conv:
                conv = Conversation(contact_name=contact_name)
                db.add(conv)
                db.commit()
                db.refresh(conv)

            msg = Message(
                conversation_id=conv.id,
                role=role,
                content=content,
                is_auto_reply=is_auto_reply,
            )
            db.add(msg)
            conv.updated_at = datetime.utcnow()
            db.commit()

            self._maybe_generate_summary(db, conv)
        finally:
            db.close()

    def get_recent_messages(self, contact_name: str,
                            limit: int | None = None) -> list[dict]:
        limit = limit or settings.short_term_memory_rounds
        db: Session = self.db_session_factory()
        try:
            conv = db.query(Conversation).filter_by(
                contact_name=contact_name).first()
            if not conv:
                return []
            msgs = (db.query(Message)
                    .filter_by(conversation_id=conv.id)
                    .order_by(Message.created_at.desc())
                    .limit(limit * 2)
                    .all())
            msgs.reverse()
            return [{"role": m.role, "content": m.content} for m in msgs]
        finally:
            db.close()

    def get_summary(self, contact_name: str) -> str:
        db: Session = self.db_session_factory()
        try:
            conv = db.query(Conversation).filter_by(
                contact_name=contact_name).first()
            return conv.summary if conv else ""
        finally:
            db.close()

    def format_history_text(self, messages: list[dict]) -> str:
        lines = []
        for m in messages:
            role_label = "对方" if m["role"] == "user" else "我"
            lines.append(f"{role_label}: {m['content']}")
        return "\n".join(lines)

    def _maybe_generate_summary(self, db: Session, conv: Conversation):
        msg_count = db.query(Message).filter_by(
            conversation_id=conv.id).count()
        if msg_count % settings.long_term_summary_threshold != 0:
            return

        logger.info("Generating summary for %s (msg count: %d)",
                    conv.contact_name, msg_count)
        recent = self.get_recent_messages(
            conv.contact_name, limit=settings.long_term_summary_threshold)
        history_text = self.format_history_text(recent)

        prompt = (
            "下面是一段聊天记录。请用一句话概括这段对话的核心内容：\n\n"
            f"{history_text}\n\n"
            "概括（一句话，不超过30字）："
        )
        try:
            summary = self.llm.chat_with_persona(
                system_prompt="你是一个对话摘要助手，用一句话概括对话。",
                user_message=prompt,
                temperature=0.3,
            )
            conv.summary = summary.strip()
            db.commit()
            logger.info("Summary for %s: %s", conv.contact_name, conv.summary)
        except Exception as e:
            logger.error("Summary generation failed: %s", e)
