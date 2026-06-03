import asyncio
import logging
logging.basicConfig(level=logging.WARNING)

import sys
sys.path.insert(0, r"c:\Users\hexi\Desktop\VScode\asquant\backend")

from app.database import async_session
from app.services.data_service import SyncManager
from sqlalchemy import select
from app.models.market import Stock


async def test():
    async with async_session() as db:
        sm = SyncManager(db)
        result = await db.execute(select(Stock.code).limit(3))
        codes = [r[0] for r in result.all()]
        print("Testing with codes:", codes)

        for code in codes:
            try:
                income_df = await sm.bs.fetch_income_statement(code)
                if income_df is not None and not income_df.empty:
                    pd_col = "public_date" in income_df.columns
                    sample = income_df["public_date"].iloc[0] if pd_col else "N/A"
                    print(f"  {code} income: {len(income_df)} rows, public_date={sample}")
                else:
                    print(f"  {code} income: empty")

                balance_df = await sm.bs.fetch_balance_sheet(code)
                if balance_df is not None and not balance_df.empty:
                    pd_col = "public_date" in balance_df.columns
                    sample = balance_df["public_date"].iloc[0] if pd_col else "N/A"
                    print(f"  {code} balance: {len(balance_df)} rows, public_date={sample}")
                else:
                    print(f"  {code} balance: empty")

                growth_df = await sm.bs.fetch_growth_data(code)
                if growth_df is not None and not growth_df.empty:
                    pd_col = "public_date" in growth_df.columns
                    sample = growth_df["public_date"].iloc[0] if pd_col else "N/A"
                    print(f"  {code} growth: {len(growth_df)} rows, public_date={sample}")
                else:
                    print(f"  {code} growth: empty")
            except Exception as e:
                print(f"  {code} error: {e}")
                import traceback
                traceback.print_exc()


asyncio.run(test())
