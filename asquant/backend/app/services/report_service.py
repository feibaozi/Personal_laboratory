"""Report service: metrics computation, chart rendering, PDF/HTML generation."""
import io
import base64
import json
import logging
from datetime import date
import numpy as np
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.figure import Figure
from matplotlib.ticker import FuncFormatter
from jinja2 import Environment, FileSystemLoader, Template
from pathlib import Path

from ..models.backtest import BacktestRun, BacktestDaily, BacktestSummary
from ..engine.performance import compute_all_metrics

logger = logging.getLogger(__name__)

# Chinese-friendly matplotlib setup
plt.rcParams["font.sans-serif"] = ["SimHei", "Microsoft YaHei", "DejaVu Sans"]
plt.rcParams["axes.unicode_minus"] = False

TEMPLATE_DIR = Path(__file__).parent.parent.parent / "templates"


class ReportService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_full_metrics(self, run_id: str) -> dict | None:
        run_result = await self.db.execute(select(BacktestRun).where(BacktestRun.id == run_id))
        run = run_result.scalar_one_or_none()
        if not run:
            return None

        sum_result = await self.db.execute(select(BacktestSummary).where(BacktestSummary.run_id == run_id))
        summary = sum_result.scalar_one_or_none()

        daily_result = await self.db.execute(
            select(BacktestDaily).where(BacktestDaily.run_id == run_id).order_by(BacktestDaily.trade_date)
        )
        daily_rows = daily_result.scalars().all()

        if not summary:
            return {"error": "no summary data"}

        daily_returns = [d.daily_return for d in daily_rows]
        daily_values = [d.portfolio_value for d in daily_rows]
        bm_returns = [d.benchmark_return for d in daily_rows]
        dates = [d.trade_date.isoformat() if d.trade_date else "" for d in daily_rows]

        monthly = json.loads(summary.monthly_returns_json) if summary.monthly_returns_json else []

        return {
            "config": run.config_json or {},
            "name": run.name,
            "status": run.status,
            "started_at": run.started_at.isoformat() if run.started_at else "",
            "completed_at": run.completed_at.isoformat() if run.completed_at else "",
            "summary": {
                "total_return": summary.total_return,
                "annual_return": summary.annual_return,
                "volatility": summary.volatility,
                "max_drawdown": summary.max_drawdown,
                "max_drawdown_duration": summary.max_drawdown_duration,
                "sharpe": summary.sharpe,
                "calmar": summary.calmar,
                "sortino": summary.sortino,
                "alpha": summary.alpha,
                "beta": summary.beta,
                "r_squared": summary.r_squared,
                "information_ratio": summary.information_ratio,
                "var_95": summary.var_95,
                "cvar_95": summary.cvar_95,
                "monthly_returns": monthly,
            },
            "daily": {
                "dates": dates,
                "values": daily_values,
                "returns": daily_returns,
                "benchmark_values": [d.benchmark_value for d in daily_rows],
                "benchmark_returns": bm_returns,
            },
        }

    async def generate_html(self, run_id: str) -> str | None:
        data = await self.get_full_metrics(run_id)
        if not data or "error" in data:
            return None

        charts = self._generate_charts(data)

        env = Environment(loader=FileSystemLoader(str(TEMPLATE_DIR)))
        try:
            template = env.get_template("report.html")
        except Exception:
            template = Template(HTML_TEMPLATE)

        return template.render(
            name=data["name"],
            config=data["config"],
            summary=data["summary"],
            daily=data["daily"],
            charts=charts,
            generated_at=date.today().isoformat(),
        )

    async def generate_pdf(self, run_id: str) -> bytes | None:
        html = await self.generate_html(run_id)
        if not html:
            return None
        try:
            from weasyprint import HTML
            return HTML(string=html).write_pdf()
        except ImportError:
            logger.warning("WeasyPrint not installed, returning HTML bytes")
            return html.encode("utf-8")

    def _generate_charts(self, data: dict) -> dict[str, str]:
        """Generate base64-encoded chart images."""
        charts = {}
        try:
            charts["equity"] = self._equity_chart(data)
        except Exception:
            charts["equity"] = ""
        try:
            charts["drawdown"] = self._drawdown_chart(data)
        except Exception:
            charts["drawdown"] = ""
        try:
            charts["monthly"] = self._monthly_chart(data)
        except Exception:
            charts["monthly"] = ""
        try:
            charts["distribution"] = self._distribution_chart(data)
        except Exception:
            charts["distribution"] = ""
        return charts

    def _fig_to_b64(self, fig: Figure) -> str:
        buf = io.BytesIO()
        fig.savefig(buf, format="png", dpi=100, bbox_inches="tight")
        buf.seek(0)
        b64 = base64.b64encode(buf.read()).decode()
        plt.close(fig)
        return f"data:image/png;base64,{b64}"

    def _equity_chart(self, data: dict) -> str:
        fig, ax = plt.subplots(figsize=(8, 3.5))
        d = data["daily"]
        x = list(range(len(d["dates"])))
        ax.plot(x, d["values"], color="#3b82f6", linewidth=1.5, label="Portfolio")
        ax.plot(x, d["benchmark_values"], color="#9ca3af", linewidth=1, linestyle="--", label="Benchmark")
        ax.legend(loc="upper left", fontsize=8)
        ax.set_title("Equity Curve", fontsize=10)
        ax.grid(alpha=0.3)
        ax.yaxis.set_major_formatter(FuncFormatter(lambda v, _: f"{v:,.0f}"))
        return self._fig_to_b64(fig)

    def _drawdown_chart(self, data: dict) -> str:
        fig, ax = plt.subplots(figsize=(8, 2))
        values = np.array(data["daily"]["values"])
        peak = np.maximum.accumulate(values)
        dd = (values / peak - 1) * 100
        ax.fill_between(range(len(dd)), dd, 0, color="#ef4444", alpha=0.3)
        ax.plot(dd, color="#ef4444", linewidth=0.8)
        ax.set_title("Drawdown (%)", fontsize=10)
        ax.grid(alpha=0.3)
        ax.yaxis.set_major_formatter(FuncFormatter(lambda v, _: f"{v:.0f}%"))
        return self._fig_to_b64(fig)

    def _monthly_chart(self, data: dict) -> str:
        monthly = data["summary"].get("monthly_returns", [])
        if not monthly:
            return ""
        fig, ax = plt.subplots(figsize=(8, 2.5))
        values = [m["return"] * 100 for m in monthly]
        colors = ["#ef4444" if v >= 0 else "#22c55e" for v in values]
        ax.bar(range(len(values)), values, color=colors)
        ax.set_title("Monthly Returns (%)", fontsize=10)
        ax.grid(alpha=0.3, axis="y")
        ax.axhline(y=0, color="white", linewidth=0.5)
        ax.yaxis.set_major_formatter(FuncFormatter(lambda v, _: f"{v:.1f}%"))
        return self._fig_to_b64(fig)

    def _distribution_chart(self, data: dict) -> str:
        returns = data["daily"]["returns"]
        if not returns:
            return ""
        fig, ax = plt.subplots(figsize=(8, 2.5))
        ax.hist(np.array(returns) * 100, bins=30, color="#3b82f6", alpha=0.7, edgecolor="white")
        ax.axvline(x=0, color="white", linewidth=0.5)
        ax.set_title("Daily Return Distribution", fontsize=10)
        ax.grid(alpha=0.3, axis="y")
        ax.xaxis.set_major_formatter(FuncFormatter(lambda v, _: f"{v:.1f}%"))
        return self._fig_to_b64(fig)


HTML_TEMPLATE = """<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8"/>
<title>{{ name }} - AsQuant Report</title>
<style>
  body { font-family: 'Microsoft YaHei', Arial, sans-serif; background: #111827; color: #e5e7eb; padding: 30px; max-width: 900px; margin: auto; }
  h1 { color: #f9fafb; border-bottom: 2px solid #374151; padding-bottom: 10px; }
  h2 { color: #9ca3af; font-size: 1em; margin-top: 24px; }
  .metrics { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin: 16px 0; }
  .metric { background: #1f2937; border: 1px solid #374151; border-radius: 8px; padding: 12px; text-align: center; }
  .metric .label { font-size: 0.75em; color: #9ca3af; }
  .metric .value { font-size: 1.4em; font-weight: bold; color: #f9fafb; }
  .metric .pos { color: #ef4444; }
  .metric .neg { color: #22c55e; }
  table { width: 100%; border-collapse: collapse; font-size: 0.85em; margin: 12px 0; }
  th { text-align: left; color: #9ca3af; border-bottom: 1px solid #374151; padding: 8px 4px; }
  td { padding: 6px 4px; border-bottom: 1px solid #1f2937; }
  img { max-width: 100%; margin: 8px 0; border-radius: 6px; }
  .footer { margin-top: 30px; font-size: 0.75em; color: #6b7280; text-align: center; }
</style>
</head>
<body>
<h1>{{ name }}</h1>
<p style="color:#9ca3af;font-size:0.85em;">
  {{ config.start_date }} ~ {{ config.end_date }} |
  Generated: {{ generated_at }}
</p>

<h2>Performance Summary</h2>
<div class="metrics">
  <div class="metric"><div class="label">Cumulative Return</div><div class="value {{ 'pos' if summary.total_return > 0 else 'neg' }}">{{ '{:.2%}'.format(summary.total_return) }}</div></div>
  <div class="metric"><div class="label">Annual Return</div><div class="value">{{ '{:.2%}'.format(summary.annual_return) }}</div></div>
  <div class="metric"><div class="label">Volatility</div><div class="value">{{ '{:.2%}'.format(summary.volatility) }}</div></div>
  <div class="metric"><div class="label">Max Drawdown</div><div class="value">{{ '{:.2%}'.format(summary.max_drawdown) }}</div></div>
</div>
<div class="metrics">
  <div class="metric"><div class="label">Sharpe</div><div class="value">{{ '{:.2f}'.format(summary.sharpe) }}</div></div>
  <div class="metric"><div class="label">Calmar</div><div class="value">{{ '{:.2f}'.format(summary.calmar) }}</div></div>
  <div class="metric"><div class="label">Sortino</div><div class="value">{{ '{:.2f}'.format(summary.sortino) }}</div></div>
  <div class="metric"><div class="label">Info Ratio</div><div class="value">{{ '{:.2f}'.format(summary.information_ratio) }}</div></div>
</div>
<div class="metrics">
  <div class="metric"><div class="label">Alpha</div><div class="value">{{ '{:.2%}'.format(summary.alpha) }}</div></div>
  <div class="metric"><div class="label">Beta</div><div class="value">{{ '{:.2f}'.format(summary.beta) }}</div></div>
  <div class="metric"><div class="label">R²</div><div class="value">{{ '{:.3f}'.format(summary.r_squared) }}</div></div>
  <div class="metric"><div class="label">VaR (95%)</div><div class="value">{{ '{:.2%}'.format(summary.var_95) }}</div></div>
</div>

{% if charts.equity %}
<h2>Equity Curve</h2>
<img src="{{ charts.equity }}" alt="Equity Curve"/>
{% endif %}

{% if charts.drawdown %}
<h2>Drawdown</h2>
<img src="{{ charts.drawdown }}" alt="Drawdown"/>
{% endif %}

{% if charts.distribution %}
<h2>Return Distribution</h2>
<img src="{{ charts.distribution }}" alt="Distribution"/>
{% endif %}

{% if summary.monthly_returns %}
<h2>Monthly Returns</h2>
<table>
  <tr><th>Month</th><th>Return</th></tr>
  {% for m in summary.monthly_returns %}
  <tr><td>{{ loop.index }}</td><td class="{{ 'pos' if m.return > 0 else 'neg' }}">{{ '{:.2%}'.format(m.return) }}</td></tr>
  {% endfor %}
</table>
{% endif %}

<div class="footer">AsQuant Report &mdash; Generated {{ generated_at }}</div>
</body>
</html>"""
