import os
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    python_port: int = 8765
    database_url: str = "sqlite+aiosqlite:///data/zhizhan.db"
    chroma_persist_dir: str = "data/chromadb"
    llm_provider: str = "deepseek"
    llm_api_key: str = ""
    llm_model: str = "deepseek-chat"
    llm_base_url: str = "https://api.deepseek.com/v1"
    data_refresh_interval: int = 30
    debug: bool = True

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


settings = Settings()
