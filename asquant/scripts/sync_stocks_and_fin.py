import asyncio
import sys
import time
import logging

logging.basicConfig(level=logging.WARNING)

sys.path.insert(0, r"c:\Users\hexi\Desktop\VScode\asquant\backend")

from app.database import async_session
from app.services.data_service import SyncManager, _bulk_upsert, _safe_val
from app.models.market import Stock, FinancialReport
from sqlalchemy import select
from pandas import isna as pd_isna
import math


async def sync_stock_list_only():
    async with async_session() as db:
        sm = SyncManager(db)
        t0 = time.time()
        print("Syncing stock list...")
        count = await sm.sync_stock_list()
        await db.commit()
        print(f"Done: {count} stocks in {time.time()-t0:.1f}s")


async def sync_fin_with_progress():
    async with async_session() as db:
        sm = SyncManager(db)

        result = await db.execute(select(Stock.code).limit(300))
        all_codes = [r[0] for r in result.all()]
        print(f"Total codes to sync: {len(all_codes)}")

        total_reports = 0
        t0 = time.time()

        for idx, code in enumerate(all_codes):
            try:
                reports_dict = {}

                income_df = await sm.bs.fetch_income_statement(code)
                if income_df is not None and not income_df.empty:
                    for _, row in income_df.iterrows():
                        key = (code, row["report_date"], row.get("report_type", "quarterly"))
                        if key not in reports_dict:
                            reports_dict[key] = {}
                        pd_val = row.get("public_date")
                        try:
                            if pd_val is not None and pd_isna(pd_val):
                                pd_val = None
                        except (TypeError, ValueError):
                            pass
                        reports_dict[key]["public_date"] = pd_val
                        reports_dict[key]["revenue"] = _safe_val(row.get("revenue"))
                        reports_dict[key]["net_profit_parent"] = _safe_val(row.get("net_profit_parent"))
                        reports_dict[key]["roe_val"] = _safe_val(row.get("roe"))
                        reports_dict[key]["net_margin_val"] = _safe_val(row.get("net_margin"))
                        reports_dict[key]["gross_margin_val"] = _safe_val(row.get("gross_margin"))
                        reports_dict[key]["total_shares_val"] = _safe_val(row.get("total_shares"))
                        reports_dict[key]["float_shares_val"] = _safe_val(row.get("float_shares"))

                balance_df = await sm.bs.fetch_balance_sheet(code)
                if balance_df is not None and not balance_df.empty:
                    for _, row in balance_df.iterrows():
                        key = (code, row["report_date"], row.get("report_type", "quarterly"))
                        if key not in reports_dict:
                            reports_dict[key] = {}
                        if not reports_dict[key].get("public_date"):
                            pd_val = row.get("public_date")
                            try:
                                if pd_val is not None and pd_isna(pd_val):
                                    pd_val = None
                            except (TypeError, ValueError):
                                pass
                            reports_dict[key]["public_date"] = pd_val
                        reports_dict[key]["liability_to_asset"] = _safe_val(row.get("liability_to_asset"))
                        reports_dict[key]["asset_to_equity"] = _safe_val(row.get("asset_to_equity"))
                        reports_dict[key]["current_ratio"] = _safe_val(row.get("current_ratio"))

                        d = reports_dict[key]
                        roe = d.get("roe_val")
                        np_val = d.get("net_profit_parent")
                        ate = _safe_val(row.get("asset_to_equity"))
                        if np_val and roe and float(roe) > 0:
                            equity = float(np_val) / float(roe)
                            if equity > 0:
                                reports_dict[key]["total_equity"] = equity
                                if ate and float(ate) > 0:
                                    reports_dict[key]["total_assets"] = equity * float(ate)
                                    reports_dict[key]["total_liabilities"] = equity * float(ate) - equity

                cash_df = await sm.bs.fetch_cash_flow(code)
                if cash_df is not None and not cash_df.empty:
                    for _, row in cash_df.iterrows():
                        key = (code, row["report_date"], row.get("report_type", "quarterly"))
                        if key not in reports_dict:
                            reports_dict[key] = {}
                        if not reports_dict[key].get("public_date"):
                            pd_val = row.get("public_date")
                            try:
                                if pd_val is not None and pd_isna(pd_val):
                                    pd_val = None
                            except (TypeError, ValueError):
                                pass
                            reports_dict[key]["public_date"] = pd_val
                        rev = reports_dict[key].get("revenue")
                        cfo_ratio = _safe_val(row.get("operating_cash_to_revenue"))
                        if rev and cfo_ratio is not None and not pd_isna(cfo_ratio):
                            reports_dict[key]["operating_cash_flow"] = float(rev) * float(cfo_ratio)

                growth_df = await sm.bs.fetch_growth_data(code)
                if growth_df is not None and not growth_df.empty:
                    for _, row in growth_df.iterrows():
                        key = (code, row["report_date"], row.get("report_type", "quarterly"))
                        if key not in reports_dict:
                            reports_dict[key] = {}
                        if not reports_dict[key].get("public_date"):
                            pd_val = row.get("public_date")
                            try:
                                if pd_val is not None and pd_isna(pd_val):
                                    pd_val = None
                            except (TypeError, ValueError):
                                pass
                            reports_dict[key]["public_date"] = pd_val
                        reports_dict[key]["yoy_profit_growth"] = _safe_val(row.get("yoy_net_profit_growth"))
                        reports_dict[key]["yoy_parent_profit_growth"] = _safe_val(row.get("yoy_parent_net_profit_growth"))
                        reports_dict[key]["yoy_revenue_growth"] = _safe_val(row.get("yoy_asset_growth"))

                FIN_FIELDS = [
                    "public_date",
                    "revenue", "operating_cost", "operating_profit", "net_profit", "net_profit_parent",
                    "total_assets", "total_liabilities", "total_equity", "current_assets", "current_liabilities",
                    "operating_cash_flow", "investing_cash_flow", "financing_cash_flow",
                    "roe_val", "net_margin_val", "gross_margin_val", "total_shares_val", "float_shares_val",
                    "yoy_revenue_growth", "yoy_profit_growth", "yoy_parent_profit_growth",
                ]

                if reports_dict:
                    report_rows = []
                    for (c, report_date, report_type), data in reports_dict.items():
                        row_dict = {
                            "stock_code": c,
                            "report_date": report_date,
                            "report_type": report_type,
                        }
                        for f in FIN_FIELDS:
                            v = data.get(f)
                            try:
                                if v is not None and pd_isna(v):
                                    v = None
                            except (TypeError, ValueError):
                                pass
                            row_dict[f] = v
                        report_rows.append(row_dict)

                    await _bulk_upsert(db, FinancialReport, report_rows, ["stock_code", "report_date", "report_type"])
                    total_reports += len(report_rows)

                if (idx + 1) % 20 == 0:
                    await db.commit()
                    elapsed = time.time() - t0
                    pub_count = sum(1 for r in reports_dict.values() if r.get("public_date"))
                    print(f"  [{idx+1}/{len(all_codes)}] {code}: {len(reports_dict)} reports ({pub_count} with pub_date), total={total_reports}, {elapsed:.1f}s")

            except Exception as e:
                print(f"  [{idx+1}] {code} ERROR: {e}")

            if (idx + 1) % 10 == 0:
                await asyncio.sleep(0.5)

        await db.commit()
        elapsed = time.time() - t0
        print(f"\nDone! {total_reports} reports in {elapsed:.1f}s")


async def main():
    print("Step 1: Stock list sync (skip if already done)")
    import sqlite3
    conn = sqlite3.connect(r"c:\Users\hexi\Desktop\VScode\asquant\data\asquant.db")
    c = conn.execute("SELECT COUNT(*) FROM stocks WHERE list_date IS NOT NULL")
    has_list = c.fetchone()[0]
    conn.close()
    if has_list > 0:
        print(f"  Already have {has_list} stocks with list_date, skipping")
    else:
        await sync_stock_list_only()

    print("\nStep 2: Financial reports sync with public_date")
    await sync_fin_with_progress()

    import sqlite3
    conn = sqlite3.connect(r"c:\Users\hexi\Desktop\VScode\asquant\data\asquant.db")
    c1 = conn.execute("SELECT COUNT(*) FROM financial_reports WHERE public_date IS NOT NULL")
    c2 = conn.execute("SELECT COUNT(*) FROM financial_reports")
    print(f"\nFinal: {c1.fetchone()[0]} reports with public_date / {c2.fetchone()[0]} total")
    conn.close()


asyncio.run(main())
