import json
import akshare as ak
import pandas as pd
from database.connection import sync_session
from database.models import Stock, Financial
from collectors.base import BaseCollector


class FinancialCollector(BaseCollector):
    def __init__(self):
        super().__init__("Financial")

    async def collect(self, stock_code: str, years: int = 5):
        self.log_info(f"Collecting financial data for {stock_code}, {years} years")
        try:
            balance_df = ak.stock_financial_report_sina(stock=stock_code, symbol="资产负债表")
            income_df = ak.stock_financial_report_sina(stock=stock_code, symbol="利润表")
            cashflow_df = ak.stock_financial_report_sina(stock=stock_code, symbol="现金流量表")

            with sync_session() as session:
                stock = session.query(Stock).filter(Stock.code == stock_code).first()
                if not stock:
                    self.log_error(f"Stock {stock_code} not in watchlist")
                    return {"error": "Stock not in watchlist"}

                count = 0
                reports = self._merge_reports(balance_df, income_df, cashflow_df)

                for report in reports[: years * 4]:
                    existing = (
                        session.query(Financial)
                        .filter(
                            Financial.stock_id == stock.id,
                            Financial.report_date == report.get("report_date", ""),
                        )
                        .first()
                    )

                    if existing:
                        continue

                    financial = Financial(
                        stock_id=stock.id,
                        report_date=report.get("report_date", ""),
                        report_type=report.get("report_type", ""),
                        revenue=report.get("revenue"),
                        net_profit=report.get("net_profit"),
                        total_assets=report.get("total_assets"),
                        total_liabilities=report.get("total_liabilities"),
                        operating_cf=report.get("operating_cf"),
                        gross_margin=report.get("gross_margin"),
                        roe=report.get("roe"),
                        debt_ratio=report.get("debt_ratio"),
                        receivables=report.get("receivables"),
                        raw_json=json.dumps(report, ensure_ascii=False, default=str),
                    )
                    session.add(financial)
                    count += 1

                session.commit()

            self.log_info(f"Collected {count} new financial reports for {stock_code}")
            return {"collected": count}

        except Exception as e:
            self.log_error(f"Failed to collect financials for {stock_code}: {e}")
            return {"error": str(e)}

    def _merge_reports(self, balance_df, income_df, cashflow_df):
        reports = []
        income_data = self._parse_income(income_df)
        balance_data = self._parse_balance(balance_df)
        cashflow_data = self._parse_cashflow(cashflow_df)

        all_dates = set()
        all_dates.update(income_data.keys())
        all_dates.update(balance_data.keys())
        all_dates.update(cashflow_data.keys())

        for date in sorted(all_dates, reverse=True):
            inc = income_data.get(date, {})
            bal = balance_data.get(date, {})
            cf = cashflow_data.get(date, {})

            revenue = inc.get("revenue", 0) or 0
            net_profit = inc.get("net_profit", 0) or 0
            total_assets = bal.get("total_assets", 0) or 0
            total_liabilities = bal.get("total_liabilities", 0) or 0
            receivables = bal.get("receivables", 0) or 0
            operating_cf = cf.get("operating_cf", 0) or 0

            gross_margin = None
            roe = None
            debt_ratio = None

            if total_assets and total_assets > 0:
                debt_ratio = total_liabilities / total_assets
            if revenue and revenue > 0:
                cost = inc.get("operating_cost", 0) or 0
                gross_margin = (revenue - cost) / revenue
            if total_assets and total_assets > 0 and net_profit:
                equity = total_assets - total_liabilities
                if equity and equity > 0:
                    roe = net_profit / equity

            report_type = "annual"
            if "-03-31" in date:
                report_type = "Q1"
            elif "-06-30" in date:
                report_type = "Q2"
            elif "-09-30" in date:
                report_type = "Q3"

            reports.append(
                {
                    "report_date": date,
                    "report_type": report_type,
                    "revenue": revenue,
                    "net_profit": net_profit,
                    "total_assets": total_assets,
                    "total_liabilities": total_liabilities,
                    "operating_cf": operating_cf,
                    "gross_margin": gross_margin,
                    "roe": roe,
                    "debt_ratio": debt_ratio,
                    "receivables": receivables,
                }
            )

        return reports

    def _parse_income(self, df: pd.DataFrame) -> dict:
        result = {}
        if df is None or df.empty:
            return result

        date_col = None
        for col in df.columns:
            if "报告期" in str(col) or "日期" in str(col):
                date_col = col
                break

        if date_col is None and len(df.columns) > 0:
            date_col = df.columns[0]

        if date_col is None:
            return result

        for _, row in df.iterrows():
            date = str(row[date_col])
            result[date] = {
                "revenue": self._safe_float(row, ["营业收入", "营业总收入"]),
                "net_profit": self._safe_float(row, ["净利润", "归属于母公司所有者的净利润"]),
                "operating_cost": self._safe_float(row, ["营业成本", "营业总成本"]),
            }

        return result

    def _parse_balance(self, df: pd.DataFrame) -> dict:
        result = {}
        if df is None or df.empty:
            return result

        date_col = None
        for col in df.columns:
            if "报告期" in str(col) or "日期" in str(col):
                date_col = col
                break

        if date_col is None and len(df.columns) > 0:
            date_col = df.columns[0]

        if date_col is None:
            return result

        for _, row in df.iterrows():
            date = str(row[date_col])
            result[date] = {
                "total_assets": self._safe_float(row, ["资产总计", "总资产"]),
                "total_liabilities": self._safe_float(row, ["负债合计", "总负债"]),
                "receivables": self._safe_float(row, ["应收账款"]),
            }

        return result

    def _parse_cashflow(self, df: pd.DataFrame) -> dict:
        result = {}
        if df is None or df.empty:
            return result

        date_col = None
        for col in df.columns:
            if "报告期" in str(col) or "日期" in str(col):
                date_col = col
                break

        if date_col is None and len(df.columns) > 0:
            date_col = df.columns[0]

        if date_col is None:
            return result

        for _, row in df.iterrows():
            date = str(row[date_col])
            result[date] = {
                "operating_cf": self._safe_float(
                    row, ["经营活动产生的现金流量净额", "经营现金流净额"]
                ),
            }

        return result

    @staticmethod
    def _safe_float(row, keys: list) -> float | None:
        for key in keys:
            for col in row.index:
                if key in str(col):
                    val = row[col]
                    if pd.notna(val):
                        try:
                            return float(val)
                        except (ValueError, TypeError):
                            pass
        return None
