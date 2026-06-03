import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend"))
import asyncio
from app.database import async_session, init_db
from app.models import *  # ensure all models registered with Base.metadata
from app.services.seed import seed_factors
from app.services.data_service import SyncManager


async def main():
    await init_db()
    async with async_session() as db:
        await seed_factors(db)
        mgr = SyncManager(db)
        start = "2026-01-01"
        end = "2026-05-14"
        print(f"Syncing data from {start} to {end}...")
        results = await mgr.sync_selected(
            ["stock_list", "indices", "daily_quotes", "stock_info", "financial_reports"],
            start_date=start, end_date=end,
        )
        for r in results:
            print(f"  {r['type']}: {r['status']} ({r.get('count', 0)} rows)")
    print("Sync complete!")


if __name__ == "__main__":
    asyncio.run(main())
