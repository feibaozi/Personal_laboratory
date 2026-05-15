from datetime import datetime, time, date, timedelta
from zoneinfo import ZoneInfo

CST = ZoneInfo("Asia/Shanghai")

MORNING_OPEN = time(9, 30)
MORNING_CLOSE = time(11, 30)
AFTERNOON_OPEN = time(13, 0)
AFTERNOON_CLOSE = time(15, 0)


def is_market_open() -> bool:
    now = datetime.now(CST)
    if now.weekday() >= 5:
        return False
    if MORNING_OPEN <= now.time() <= MORNING_CLOSE:
        return True
    if AFTERNOON_OPEN <= now.time() <= AFTERNOON_CLOSE:
        return True
    return False


def today_str() -> str:
    return datetime.now(CST).strftime("%Y-%m-%d")


def date_range(start: date, end: date):
    for n in range((end - start).days + 1):
        yield start + timedelta(days=n)
