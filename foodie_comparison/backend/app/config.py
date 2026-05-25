import os
from pathlib import Path
from pydantic_settings import BaseSettings
from dotenv import load_dotenv

PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
load_dotenv(PROJECT_ROOT / ".env")


class Settings(BaseSettings):
    # Database - SQLite for dev, PostgreSQL for prod via env
    database_url: str = (
        "sqlite+aiosqlite:///./foodie_dev.db"
    )
    database_url_sync: str = (
        "sqlite:///./foodie_dev.db"
    )

    # Redis
    redis_url: str = "redis://localhost:6379/0"

    # JWT
    jwt_secret_key: str = "dev-secret-change-in-production"
    jwt_algorithm: str = "HS256"
    jwt_access_token_expire_minutes: int = 1440

    # App
    app_env: str = "development"
    log_level: str = "DEBUG"
    api_port: int = 8000
    cors_origins: list = ["http://localhost:3000", "http://localhost:8080"]

    # Collectors
    collector_rate_limit: int = 2
    collector_max_retries: int = 3
    collector_proxy_enabled: bool = False
    collector_user_agent: str = (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/125.0.0.0 Safari/537.36"
    )

    # Recommendation
    recommend_min_behaviors: int = 10
    recommend_model_path: str = "data/recommend_model.pkl"

    # OCR
    ocr_confidence_threshold: float = 0.85
    ocr_use_gpu: bool = False

    model_config = {"env_prefix": "", "case_sensitive": False}


settings = Settings()