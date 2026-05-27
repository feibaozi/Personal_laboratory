from abc import ABC, abstractmethod
from datetime import datetime
import logging

logger = logging.getLogger(__name__)


class BaseCollector(ABC):
    def __init__(self, name: str):
        self.name = name

    @abstractmethod
    async def collect(self, **kwargs):
        pass

    def log_info(self, msg: str):
        logger.info(f"[{self.name}] {msg}")

    def log_error(self, msg: str):
        logger.error(f"[{self.name}] {msg}")
