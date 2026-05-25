import datetime
from sqlalchemy import Column, Integer, String, Float, DateTime, JSON

from app.database import Base


class UserBehavior(Base):
    __tablename__ = "user_behaviors"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, nullable=False, index=True)

    behavior_type = Column(String(32), nullable=False, index=True)

    target_type = Column(String(32), default="shop")
    target_id = Column(Integer, nullable=False, default=0)
    target_name = Column(String(256), default="")

    context = Column(JSON, default=dict)

    weight = Column(Float, default=1.0)

    behavior_time = Column(
        DateTime, default=datetime.datetime.utcnow, index=True
    )


class RecommendResult(Base):
    __tablename__ = "recommend_results"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, nullable=False, index=True)

    recommend_type = Column(String(32), nullable=False)

    items = Column(JSON, default=list)

    algorithm_version = Column(String(32), default="v1.0")

    generated_at = Column(DateTime, default=datetime.datetime.utcnow)
    expires_at = Column(DateTime, nullable=True)