import datetime
from sqlalchemy import Column, Integer, String, DateTime

from app.database import Base


class PersonaBinding(Base):
    __tablename__ = "persona_bindings"

    id = Column(Integer, primary_key=True, autoincrement=True)
    contact_name = Column(String(256), unique=True, nullable=False, index=True)
    profile_name = Column(String(64), nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
