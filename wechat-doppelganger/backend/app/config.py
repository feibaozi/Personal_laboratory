from pathlib import Path
from pydantic_settings import BaseSettings
from dotenv import load_dotenv

PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
load_dotenv(PROJECT_ROOT / ".env")


class Settings(BaseSettings):
    llm_provider: str = "deepseek"
    llm_api_key: str = ""
    llm_base_url: str = "https://api.deepseek.com"
    llm_model: str = "deepseek-chat"

    telegram_bot_token: str = ""
    telegram_chat_id: str = ""
    telegram_proxy: str = ""   # e.g. socks5://127.0.0.1:1080 or http://127.0.0.1:7890

    database_url: str = f"sqlite:///{PROJECT_ROOT / 'backend' / 'data' / 'doppelganger.db'}"
    draft_mode: bool = True
    log_level: str = "INFO"

    whitelist_path: str = "config/whitelist.txt"
    polling_interval_seconds: float = 6.0

    min_reply_delay_seconds: float = 2.0
    max_reply_delay_seconds: float = 15.0
    max_replies_per_minute: int = 5

    short_term_memory_rounds: int = 20
    long_term_summary_threshold: int = 50

    model_config = {"env_prefix": "", "case_sensitive": False}


settings = Settings()