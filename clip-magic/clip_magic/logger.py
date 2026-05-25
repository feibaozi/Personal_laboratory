import logging
import sys
from pathlib import Path


_logger_initialized = False


def setup_logger(name: str = "clip-magic", level: int = logging.INFO) -> logging.Logger:
    global _logger_initialized
    logger = logging.getLogger(name)
    if _logger_initialized and logger.handlers:
        return logger

    logger.setLevel(logging.DEBUG)

    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setLevel(level)
    console_fmt = logging.Formatter("[%(levelname)s] %(name)s: %(message)s")
    console_handler.setFormatter(console_fmt)
    logger.addHandler(console_handler)

    log_dir = Path.home() / ".cache" / "clip-magic-logs"
    log_dir.mkdir(parents=True, exist_ok=True)
    file_handler = logging.FileHandler(log_dir / "app.log", encoding="utf-8")
    file_handler.setLevel(logging.DEBUG)
    file_fmt = logging.Formatter(
        "%(asctime)s [%(levelname)s] %(name)s:%(lineno)d: %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )
    file_handler.setFormatter(file_fmt)
    logger.addHandler(file_handler)

    _logger_initialized = True
    return logger


logger = setup_logger()