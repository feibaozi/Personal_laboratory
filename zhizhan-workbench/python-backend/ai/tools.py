import json
from langchain_core.tools import tool

from database.connection import sync_session
from database.models import Stock, Financial, SentimentEvent
from collectors.stock_info import StockInfoCollector
from collectors.financials import FinancialCollector
from collectors.news import NewsCollector
from nlp.preprocessor import preprocessor
from nlp.sentiment import sentiment_classifier

stock_info_collector = StockInfoCollector()
financial_collector = FinancialCollector()
news_collector = NewsCollector()


@tool
def get_financials(stock_code: str, years: int = 5) -> str:
    """获取指定股票近N年的财务报表数据，包括营收、净利润、ROE、毛利率、负债率等关键指标。
    参数: stock_code - 股票代码如600519, years - 年数默认5"""
    with sync_session() as session:
        stock = session.query(Stock).filter(Stock.code == stock_code).first()
        if not stock:
            return f"未找到股票 {stock_code}，请先添加到关注列表"

        financials = (
            session.query(Financial)
            .filter(Financial.stock_id == stock.id)
            .order_by(Financial.report_date.desc())
            .limit(years * 4)
            .all()
        )

        if not financials:
            return f"{stock.name}({stock_code}) 暂无财务数据，请先采集"

        result = {
            "stock": stock.name,
            "code": stock.code,
            "industry": stock.industry,
            "reports": [
                {
                    "date": f.report_date,
                    "type": f.report_type,
                    "revenue": f.revenue,
                    "net_profit": f.net_profit,
                    "total_assets": f.total_assets,
                    "total_liabilities": f.total_liabilities,
                    "operating_cf": f.operating_cf,
                    "gross_margin": f.gross_margin,
                    "roe": f.roe,
                    "debt_ratio": f.debt_ratio,
                    "receivables": f.receivables,
                }
                for f in financials
            ],
        }
        return json.dumps(result, ensure_ascii=False, default=str)


@tool
def get_price_history(stock_code: str, period: str = "1y") -> str:
    """获取指定股票的行情数据概览，包括当前价格、涨跌幅等。
    参数: stock_code - 股票代码, period - 时间范围"""
    import akshare as ak

    try:
        df = ak.stock_zh_a_spot_em()
        row = df[df["代码"] == stock_code]
        if row.empty:
            return f"未找到 {stock_code} 的行情数据"

        r = row.iloc[0]
        result = {
            "code": stock_code,
            "name": str(r.get("名称", "")),
            "price": float(r.get("最新价", 0)) if r.get("最新价") else None,
            "change_pct": float(r.get("涨跌幅", 0)) if r.get("涨跌幅") else None,
            "change_amt": float(r.get("涨跌额", 0)) if r.get("涨跌额") else None,
            "volume": float(r.get("成交量", 0)) if r.get("成交量") else None,
            "turnover": float(r.get("换手率", 0)) if r.get("换手率") else None,
            "pe": float(r.get("市盈率-动态", 0)) if r.get("市盈率-动态") else None,
            "pb": float(r.get("市净率", 0)) if r.get("市净率") else None,
            "total_mv": float(r.get("总市值", 0)) if r.get("总市值") else None,
            "circ_mv": float(r.get("流通市值", 0)) if r.get("流通市值") else None,
        }
        return json.dumps(result, ensure_ascii=False, default=str)
    except Exception as e:
        return f"获取行情数据失败: {e}"


@tool
def get_sentiment(stock_code: str, days: int = 30) -> str:
    """获取指定股票的舆情分析数据，包括情绪趋势、关键事件、情绪分布。
    参数: stock_code - 股票代码, days - 天数默认30"""
    with sync_session() as session:
        stock = session.query(Stock).filter(Stock.code == stock_code).first()
        if not stock:
            return f"未找到股票 {stock_code}"

        from datetime import datetime, timedelta
        since = datetime.now() - timedelta(days=days)

        events = (
            session.query(SentimentEvent)
            .filter(
                SentimentEvent.stock_id == stock.id,
                SentimentEvent.published_at >= since,
            )
            .order_by(SentimentEvent.published_at.desc())
            .limit(50)
            .all()
        )

        pos = sum(1 for e in events if e.sentiment == "positive")
        neg = sum(1 for e in events if e.sentiment == "negative")
        neu = sum(1 for e in events if e.sentiment == "neutral")

        recent_titles = [
            {"title": e.title, "sentiment": e.sentiment, "score": e.sentiment_score}
            for e in events[:10]
        ]

        all_text = " ".join(e.title + " " + (e.content or "") for e in events)
        keywords = preprocessor.extract_keywords(all_text, top_k=10)

        result = {
            "stock": stock.name,
            "code": stock.code,
            "period_days": days,
            "total_events": len(events),
            "positive": pos,
            "negative": neg,
            "neutral": neu,
            "keywords": keywords,
            "recent_events": recent_titles,
        }
        return json.dumps(result, ensure_ascii=False, default=str)


@tool
def search_news(stock_code: str, days: int = 7) -> str:
    """搜索并采集指定股票的最新新闻和公告。
    参数: stock_code - 股票代码, days - 天数"""
    try:
        result = news_collector.collect(stock_code=stock_code, limit=20)
        return json.dumps(result, ensure_ascii=False)
    except Exception as e:
        return f"搜索新闻失败: {e}"


@tool
def compare_peers(stock_code: str) -> str:
    """对比同行业可比公司的关键财务指标。
    参数: stock_code - 股票代码"""
    with sync_session() as session:
        stock = session.query(Stock).filter(Stock.code == stock_code).first()
        if not stock:
            return f"未找到股票 {stock_code}"

        industry = stock.industry
        if not industry:
            return f"{stock.name} 缺少行业信息，无法对比"

        peers = (
            session.query(Stock)
            .filter(Stock.industry == industry, Stock.code != stock_code)
            .limit(5)
            .all()
        )

        if not peers:
            return f"同行业({industry})暂无其他关注标的"

        result = {"target": stock.name, "industry": industry, "peers": []}

        for peer in peers:
            fin = (
                session.query(Financial)
                .filter(Financial.stock_id == peer.id)
                .order_by(Financial.report_date.desc())
                .first()
            )
            peer_data = {
                "name": peer.name,
                "code": peer.code,
            }
            if fin:
                peer_data.update({
                    "revenue": fin.revenue,
                    "net_profit": fin.net_profit,
                    "gross_margin": fin.gross_margin,
                    "roe": fin.roe,
                    "debt_ratio": fin.debt_ratio,
                })
            result["peers"].append(peer_data)

        target_fin = (
            session.query(Financial)
            .filter(Financial.stock_id == stock.id)
            .order_by(Financial.report_date.desc())
            .first()
        )
        if target_fin:
            result["target_financials"] = {
                "revenue": target_fin.revenue,
                "net_profit": target_fin.net_profit,
                "gross_margin": target_fin.gross_margin,
                "roe": target_fin.roe,
                "debt_ratio": target_fin.debt_ratio,
            }

        return json.dumps(result, ensure_ascii=False, default=str)


@tool
def calculate_valuation(stock_code: str, growth_rate: float = 0.1, discount_rate: float = 0.08, years: int = 10) -> str:
    """使用简化DCF模型计算估值区间。需要先有财务数据。
    参数: stock_code - 股票代码, growth_rate - 预期增长率默认10%, discount_rate - 折现率默认8%, years - 预测年数默认10"""
    with sync_session() as session:
        stock = session.query(Stock).filter(Stock.code == stock_code).first()
        if not stock:
            return f"未找到股票 {stock_code}"

        fin = (
            session.query(Financial)
            .filter(Financial.stock_id == stock.id)
            .order_by(Financial.report_date.desc())
            .first()
        )

        if not fin or not fin.net_profit:
            return f"{stock.name} 缺少财务数据，无法估值"

        base_fcf = fin.operating_cf if fin.operating_cf and fin.operating_cf > 0 else fin.net_profit * 0.8

        pv_fcf = 0
        for i in range(1, years + 1):
            fcf = base_fcf * (1 + growth_rate) ** i
            pv = fcf / (1 + discount_rate) ** i
            pv_fcf += pv

        terminal_growth = 0.03
        terminal_fcf = base_fcf * (1 + growth_rate) ** years * (1 + terminal_growth)
        terminal_value = terminal_fcf / (discount_rate - terminal_growth)
        pv_terminal = terminal_value / (1 + discount_rate) ** years

        total_value = pv_fcf + pv_terminal

        result = {
            "stock": stock.name,
            "code": stock.code,
            "method": "DCF (简化)",
            "assumptions": {
                "base_fcf": base_fcf,
                "growth_rate": growth_rate,
                "discount_rate": discount_rate,
                "projection_years": years,
                "terminal_growth": terminal_growth,
            },
            "results": {
                "pv_fcf": round(pv_fcf, 2),
                "pv_terminal": round(pv_terminal, 2),
                "enterprise_value": round(total_value, 2),
            },
            "note": "此为简化DCF模型，仅供参考。实际投资决策需结合更多因素。",
        }
        return json.dumps(result, ensure_ascii=False, default=str)


@tool
def detect_anomalies(stock_code: str) -> str:
    """检测财务数据中的异常信号，如应收占比异常、现金流恶化、毛利率下降等。
    参数: stock_code - 股票代码"""
    with sync_session() as session:
        stock = session.query(Stock).filter(Stock.code == stock_code).first()
        if not stock:
            return f"未找到股票 {stock_code}"

        financials = (
            session.query(Financial)
            .filter(Financial.stock_id == stock.id)
            .order_by(Financial.report_date.desc())
            .limit(8)
            .all()
        )

        if len(financials) < 2:
            return f"{stock.name} 财务数据不足，无法检测异常"

        anomalies = []

        latest = financials[0]
        previous = financials[1]

        if latest.revenue and previous.revenue and previous.revenue > 0:
            latest_ratio = latest.receivables / latest.revenue if latest.receivables and latest.revenue > 0 else 0
            prev_ratio = previous.receivables / previous.revenue if previous.receivables and previous.revenue > 0 else 0
            if prev_ratio > 0 and latest_ratio > prev_ratio * 1.3:
                anomalies.append({
                    "type": "应收占比异常上升",
                    "severity": "high",
                    "detail": f"应收/营收比从 {prev_ratio:.2%} 升至 {latest_ratio:.2%}",
                })

        if latest.net_profit and latest.net_profit > 0 and latest.operating_cf is not None:
            ratio = latest.operating_cf / latest.net_profit
            if ratio < 0.5:
                anomalies.append({
                    "type": "经营现金流/净利润异常",
                    "severity": "high",
                    "detail": f"比值仅 {ratio:.2f}，利润质量存疑",
                })

        if len(financials) >= 4:
            margins = [f.gross_margin for f in financials[:4] if f.gross_margin is not None]
            if len(margins) >= 3 and all(margins[i] < margins[i + 1] for i in range(len(margins) - 1)):
                anomalies.append({
                    "type": "毛利率连续下降",
                    "severity": "medium",
                    "detail": f"近{len(margins)}期毛利率持续下降: {[f'{m:.2%}' for m in margins]}",
                })

        if latest.debt_ratio and latest.debt_ratio > 0.7:
            anomalies.append({
                "type": "资产负债率偏高",
                "severity": "medium",
                "detail": f"资产负债率 {latest.debt_ratio:.2%}",
            })

        if not anomalies:
            return f"{stock.name} 近期财务数据未发现明显异常信号"

        result = {"stock": stock.name, "code": stock.code, "anomalies": anomalies}
        return json.dumps(result, ensure_ascii=False, default=str)


ALL_TOOLS = [
    get_financials,
    get_price_history,
    get_sentiment,
    search_news,
    compare_peers,
    calculate_valuation,
    detect_anomalies,
]
