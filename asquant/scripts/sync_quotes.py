"""Sync daily quotes with retries and rate limiting."""
import asyncio
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend"))

import time
import akshare as ak
from datetime import date
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session
from app.models.market import DailyQuote, Stock

DB_PATH = os.path.join(os.path.dirname(__file__), "..", "data", "asquant.db")
engine = create_engine(f"sqlite:///{DB_PATH}")

CODES = [
    "000001", "000002", "000063", "000100", "000333", "000338", "000425",
    "000568", "000625", "000651", "000725", "000792", "000858", "000876",
    "002007", "002142", "002230", "002352", "002415", "002460", "002475",
    "002594", "002714", "300015", "300059", "300124", "300274", "300750",
    "600000", "600009", "600019", "600028", "600030", "600031", "600036",
    "600048", "600050", "600104", "600111", "600276", "600309", "600406",
    "600436", "600519", "600585", "600887", "600900", "601012", "601088",
    "601166", "601318", "601336", "601398", "601668", "601857", "603259",
    "603288", "688981",
]


def sync_one(code: str) -> int:
    for attempt in range(3):
        try:
            df = ak.stock_zh_a_hist(
                symbol=code, period="daily",
                start_date="20240101", end_date="20260514",
                adjust="qfq",
            )
            if df is None or df.empty:
                return 0
            with Session(engine) as session:
                for _, row in df.iterrows():
                    dq = DailyQuote(
                        stock_code=code,
                        trade_date=date.fromisoformat(str(row["日期"])),
                        open=float(row["开盘"]),
                        high=float(row["最高"]),
                        low=float(row["最低"]),
                        close=float(row["收盘"]),
                        volume=int(row["成交量"]),
                        amount=float(row["成交额"]),
                        turnover_rate=float(row.get("换手率", 0) or 0),
                        change_pct=float(row.get("涨跌幅", 0) or 0),
                    )
                    session.merge(dq)
                session.commit()
            return len(df)
        except Exception as e:
            if attempt < 2:
                time.sleep(5 * (attempt + 1))
            else:
                return 0
    return 0


def main():
    total = 0
    for i, code in enumerate(CODES):
        count = sync_one(code)
        total += count
        if count > 0:
            print(f"[{i+1}/{len(CODES)}] {code}: {count} rows")
        else:
            print(f"[{i+1}/{len(CODES)}] {code}: FAILED")
        time.sleep(1.5)
    print(f"\nDone. Total synced: {total} rows for {len(CODES)} stocks")


if __name__ == "__main__":
    main()
