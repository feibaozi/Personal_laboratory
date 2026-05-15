from pydantic_settings import BaseSettings
from pathlib import Path


class Settings(BaseSettings):
    BASE_DIR: Path = Path(__file__).parent.parent.parent
    DB_PATH: str = str(BASE_DIR / "data" / "asquant.db")
    DATA_DIR: str = str(BASE_DIR / "data")
    SYNC_HOUR: int = 15
    SYNC_MINUTE: int = 31
    GMT_OFFSET: int = 8

    model_config = {"env_prefix": "ASQUANT_", "env_file": ".env"}


settings = Settings()
