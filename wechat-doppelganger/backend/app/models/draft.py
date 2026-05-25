import datetime
import enum
from sqlalchemy import Column, Integer, String, Text, DateTime, Enum as SAEnum

from app.database import Base


class DraftStatus(str, enum.Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    MODIFIED = "modified"


class DraftMessage(Base):
    __tablename__ = "draft_messages"

    id = Column(Integer, primary_key=True, autoincrement=True)
    contact_name = Column(String(256), nullable=False, index=True)
    incoming_message = Column(Text, nullable=False)
    ai_draft = Column(Text, nullable=False)
    final_reply = Column(Text, nullable=True)
    status = Column(SAEnum(DraftStatus), default=DraftStatus.PENDING, nullable=False)
    telegram_message_id = Column(Integer, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    resolved_at = Column(DateTime, nullable=True)
