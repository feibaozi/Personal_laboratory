import json
import csv
import html as html_module
import io
from datetime import date
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from ..models.backtest import BacktestRun, BacktestDaily, BacktestSummary, BacktestTrade


def _build_monthly_table(monthly_returns: list[dict]) -> str:
    """Build monthly returns HTML table with proper escaping."""
    if not monthly_returns:
        return ""
    rows = []
    for m in monthly_returns:
        month = html_module.escape(str(m.get("month", "")))
        ret = m.get("return", 0)
        cls = "value positive" if ret > 0 else "value negative"
        rows.append(f'<tr><td>{month}</td><td class="{cls}">{ret * 100:.2f}%</td></tr>')
    return f'<h2>月度收益</h2><table><tr><th>月份</th><th>收益率</th></tr>{"".join(rows)}</table>'


async def generate_csv_export(run_id: str, db: AsyncSession) -> str:
    run_result = await db.execute(select(BacktestRun).where(BacktestRun.id == run_id))
    run = run_result.scalar_one_or_none()
    if not run:
        return ""

    daily_result = await db.execute(
        select(BacktestDaily).where(BacktestDaily.run_id == run_id).order_by(BacktestDaily.trade_date)
    )
    daily_rows = daily_result.scalars().all()

    summary_result = await db.execute(select(BacktestSummary).where(BacktestSummary.run_id == run_id))
    summary = summary_result.scalar_one_or_none()

    output = io.StringIO()
    writer = csv.writer(output)

    # Header info
    config = run.config_json or {}
    writer.writerow(["回测名称", run.name])
    writer.writerow(["回测区间", f"{config.get('start_date', '')} ~ {config.get('end_date', '')}"])
    writer.writerow(["因子", ", ".join(config.get("factor_names", []))])
    writer.writerow([])

    # Summary metrics
    if summary:
        writer.writerow(["指标", "数值"])
        writer.writerow(["总收益率", f"{summary.total_return:.4%}" if summary.total_return else "0.00%"])
        writer.writerow(["年化收益率", f"{summary.annual_return:.4%}" if summary.annual_return else "0.00%"])
        writer.writerow(["年化波动率", f"{summary.volatility:.4%}" if summary.volatility else "0.00%"])
        writer.writerow(["最大回撤", f"{summary.max_drawdown:.4%}" if summary.max_drawdown else "0.00%"])
        writer.writerow(["Sharpe比率", f"{summary.sharpe:.4f}" if summary.sharpe else "0.0000"])
        writer.writerow(["Calmar比率", f"{summary.calmar:.4f}" if summary.calmar else "0.0000"])
        writer.writerow(["Sortino比率", f"{summary.sortino:.4f}" if summary.sortino else "0.0000"])
        writer.writerow(["Alpha", f"{summary.alpha:.4%}" if summary.alpha else "0.00%"])
        writer.writerow(["Beta", f"{summary.beta:.4f}" if summary.beta else "0.0000"])
        writer.writerow(["R²", f"{summary.r_squared:.4f}" if summary.r_squared else "0.0000"])
        writer.writerow(["信息比率", f"{summary.information_ratio:.4f}" if summary.information_ratio else "0.0000"])
        writer.writerow(["胜率", f"{summary.win_rate:.4%}" if summary.win_rate else "0.00%"])
        writer.writerow(["盈亏比", f"{summary.profit_factor:.4f}" if summary.profit_factor else "0.0000"])
        writer.writerow([])

    # Daily data
    writer.writerow(["日期", "组合净值", "基准净值", "日收益", "基准收益", "换手率", "现金"])
    for d in daily_rows:
        writer.writerow([
            d.trade_date.isoformat() if d.trade_date else "",
            d.portfolio_value,
            d.benchmark_value,
            d.daily_return,
            d.benchmark_return,
            d.turnover,
            d.cash,
        ])

    writer.writerow([])

    # Trades
    trade_result = await db.execute(
        select(BacktestTrade).where(BacktestTrade.run_id == run_id).order_by(BacktestTrade.trade_date)
    )
    trades = trade_result.scalars().all()
    if trades:
        writer.writerow(["交易明细"])
        writer.writerow(["日期", "股票", "方向", "股数", "价格", "金额", "成本", "滑点"])
        for t in trades:
            writer.writerow([
                t.trade_date.isoformat() if t.trade_date else "",
                t.stock_code,
                t.direction,
                t.shares,
                t.price,
                t.amount,
                t.cost,
                t.slippage,
            ])

    return output.getvalue()


async def generate_html_report(run_id: str, db: AsyncSession) -> str:
    run_result = await db.execute(select(BacktestRun).where(BacktestRun.id == run_id))
    run = run_result.scalar_one_or_none()
    if not run:
        return "<html><body><h1>Report not found</h1></body></html>"

    summary_result = await db.execute(select(BacktestSummary).where(BacktestSummary.run_id == run_id))
    summary = summary_result.scalar_one_or_none()

    daily_result = await db.execute(
        select(BacktestDaily).where(BacktestDaily.run_id == run_id).order_by(BacktestDaily.trade_date)
    )
    daily_rows = daily_result.scalars().all()

    trade_result = await db.execute(
        select(BacktestTrade).where(BacktestTrade.run_id == run_id).order_by(BacktestTrade.trade_date)
    )
    trades = trade_result.scalars().all()

    config = run.config_json or {}
    s = summary

    # Build daily values array for ECharts
    daily_dates = [d.trade_date.isoformat() if d.trade_date else "" for d in daily_rows]
    daily_values = [d.portfolio_value for d in daily_rows]
    daily_bm = [d.benchmark_value for d in daily_rows]

    # Monthly returns
    monthly_returns = json.loads(s.monthly_returns_json) if s and s.monthly_returns_json else []

    html = f"""<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <title>回测报告 - {html_module.escape(run.name)}</title>
    <script src="https://cdn.jsdelivr.net/npm/echarts@5.5.0/dist/echarts.min.js"></script>
    <style>
        * {{ margin: 0; padding: 0; box-sizing: border-box; }}
        body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #111827; color: #e5e7eb; padding: 2rem; }}
        .container {{ max-width: 1000px; margin: 0 auto; }}
        h1 {{ font-size: 1.5rem; margin-bottom: 0.5rem; }}
        .meta {{ color: #9ca3af; font-size: 0.875rem; margin-bottom: 2rem; }}
        .grid {{ display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem; margin-bottom: 2rem; }}
        .card {{ background: #1f2937; border-radius: 8px; padding: 1rem; text-align: center; }}
        .card .label {{ color: #9ca3af; font-size: 0.75rem; margin-bottom: 0.25rem; }}
        .card .value {{ font-size: 1.125rem; font-weight: 600; }}
        .card .value.positive {{ color: #22c55e; }}
        .card .value.negative {{ color: #ef4444; }}
        .chart {{ height: 400px; background: #1f2937; border-radius: 8px; margin-bottom: 2rem; padding: 1rem; }}
        table {{ width: 100%; border-collapse: collapse; margin-bottom: 2rem; background: #1f2937; border-radius: 8px; overflow: hidden; }}
        th, td {{ padding: 0.5rem 0.75rem; text-align: left; font-size: 0.8125rem; }}
        th {{ color: #9ca3af; border-bottom: 1px solid #374151; }}
        td {{ border-bottom: 1px solid #1f2937; }}
        tr:nth-child(even) {{ background: #1a2332; }}
        h2 {{ font-size: 1.125rem; margin-bottom: 1rem; margin-top: 2rem; }}
        @media print {{ body {{ background: white; color: black; }} .card {{ background: #f3f4f6; }} }}
    </style>
</head>
<body>
<div class="container">
    <h1>回测报告: {html_module.escape(run.name)}</h1>
    <p class="meta">区间: {html_module.escape(str(config.get('start_date', '')))} ~ {html_module.escape(str(config.get('end_date', '')))} | 因子: {html_module.escape(', '.join(config.get('factor_names', [])))} | 权重: {html_module.escape(str(config.get('weighting', 'equal')))}</p>

    <div class="grid">
        <div class="card">
            <div class="label">总收益率</div>
            <div class="value {'positive' if s and s.total_return and s.total_return > 0 else 'negative'}">{(s.total_return * 100) if s else 0:.2f}%</div>
        </div>
        <div class="card">
            <div class="label">年化收益率</div>
            <div class="value {'positive' if s and s.annual_return and s.annual_return > 0 else 'negative'}">{(s.annual_return * 100) if s else 0:.2f}%</div>
        </div>
        <div class="card">
            <div class="label">Sharpe 比率</div>
            <div class="value">{s.sharpe if s else 0:.3f}</div>
        </div>
        <div class="card">
            <div class="label">最大回撤</div>
            <div class="value negative">{(s.max_drawdown * 100) if s else 0:.2f}%</div>
        </div>
        <div class="card">
            <div class="label">年化波动率</div>
            <div class="value">{(s.volatility * 100) if s else 0:.2f}%</div>
        </div>
        <div class="card">
            <div class="label">Calmar 比率</div>
            <div class="value">{s.calmar if s else 0:.3f}</div>
        </div>
        <div class="card">
            <div class="label">Alpha</div>
            <div class="value">{(s.alpha * 100) if s else 0:.2f}%</div>
        </div>
        <div class="card">
            <div class="label">胜率</div>
            <div class="value">{(s.win_rate * 100) if s else 0:.1f}%</div>
        </div>
    </div>

    <h2>净值曲线</h2>
    <div class="chart" id="navChart"></div>

    <h2>风险指标</h2>
    <table>
        <tr><th>指标</th><th>数值</th><th>指标</th><th>数值</th></tr>
        <tr><td>Sortino比率</td><td>{s.sortino if s else 0:.4f}</td><td>Beta</td><td>{s.beta if s else 1:.4f}</td></tr>
        <tr><td>VaR(95%)</td><td>{(s.var_95 * 100) if s else 0:.2f}%</td><td>CVaR(95%)</td><td>{(s.cvar_95 * 100) if s else 0:.2f}%</td></tr>
        <tr><td>信息比率</td><td>{s.information_ratio if s else 0:.4f}</td><td>R²</td><td>{s.r_squared if s else 0:.4f}</td></tr>
        <tr><td>盈亏比</td><td>{s.profit_factor if s else 0:.4f}</td><td>盈亏平均比</td><td>{s.avg_win_loss if s else 0:.4f}</td></tr>
        <tr><td>偏度</td><td>{s.skewness if s else 0:.4f}</td><td>峰度</td><td>{s.kurtosis if s else 0:.4f}</td></tr>
        <tr><td>最大回撤持续</td><td>{s.max_drawdown_duration if s else 0} 天</td><td>Treynor</td><td>{s.treynor if s else 0:.4f}</td></tr>
    </table>

    {_build_monthly_table(monthly_returns)}

    <h2>交易统计</h2>
    <p style="color:#9ca3af;font-size:0.875rem;margin-bottom:1rem;">共 {len(trades)} 笔交易 | 买入 {sum(1 for t in trades if t.direction == 'buy')} 笔 | 卖出 {sum(1 for t in trades if t.direction == 'sell')} 笔</p>
    {"<table><tr><th>日期</th><th>股票</th><th>方向</th><th>股数</th><th>价格</th><th>金额</th><th>成本</th></tr>" + "".join(f'<tr><td>{html_module.escape(t.trade_date.isoformat() if t.trade_date else "")}</td><td>{html_module.escape(t.stock_code)}</td><td>{html_module.escape(t.direction)}</td><td>{t.shares}</td><td>{t.price:.2f}</td><td>{t.amount:.2f}</td><td>{t.cost:.2f}</td></tr>' for t in trades[:100]) + "</table>" if trades else ""}
    {f'<p style="color:#9ca3af;font-size:0.75rem;">仅显示前 100 笔交易（共 {len(trades)} 笔）</p>' if len(trades) > 100 else ""}

    <p style="color:#6b7280;font-size:0.75rem;margin-top:2rem;text-align:center;">生成于 AsQuant 回测引擎</p>
</div>
<script>
    var chart = echarts.init(document.getElementById('navChart'));
    chart.setOption({{
        tooltip: {{ trigger: 'axis' }},
        legend: {{ data: ['组合净值', '基准净值'], textStyle: {{ color: '#9ca3af' }} }},
        grid: {{ left: 60, right: 20, top: 20, bottom: 30 }},
        xAxis: {{ type: 'category', data: {json.dumps(daily_dates)}, axisLabel: {{ color: '#9ca3af', fontSize: 10 }} }},
        yAxis: {{ type: 'value', axisLabel: {{ color: '#9ca3af' }} }},
        series: [
            {{ name: '组合净值', type: 'line', data: {json.dumps(daily_values)}, lineStyle: {{ color: '#22c55e' }}, itemStyle: {{ color: '#22c55e' }}, symbol: 'none' }},
            {{ name: '基准净值', type: 'line', data: {json.dumps(daily_bm)}, lineStyle: {{ color: '#f59e0b', type: 'dashed' }}, itemStyle: {{ color: '#f59e0b' }}, symbol: 'none' }}
        ]
    }});
    window.addEventListener('resize', function() {{ chart.resize(); }});
</script>
</body>
</html>"""
    return html