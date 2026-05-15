import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { fetchBacktestDetail, fetchBacktestDaily } from "@/api/backtest";
import { LoadingSpinner } from "@/components/common/LoadingSpinner";
import { MetricCard } from "@/components/common/MetricCard";
import ReactECharts from "echarts-for-react";

export function ReportPage() {
  const { runId } = useParams<{ runId: string }>();
  const navigate = useNavigate();

  const detail = useQuery({
    queryKey: ["backtest-detail", runId],
    queryFn: () => fetchBacktestDetail(runId!),
    enabled: !!runId,
  });
  const daily = useQuery({
    queryKey: ["backtest-daily", runId],
    queryFn: () => fetchBacktestDaily(runId!),
    enabled: !!runId,
  });

  if (detail.isLoading) return <LoadingSpinner text="加载报告..." />;
  if (!detail.data || !detail.data.summary) return <p className="text-gray-400">未找到该回测报告</p>;

  const { name, config, summary: s } = detail.data;
  const dailyData = daily.data || [];

  const equityOption = {
    tooltip: { trigger: "axis" },
    legend: { data: ["组合净值", "基准净值"], textStyle: { color: "#9ca3af" } },
    grid: { left: 60, right: 20, top: 30, bottom: 30 },
    xAxis: { type: "category", data: dailyData.map((d) => d.date.slice(0, 10)), axisLabel: { color: "#9ca3af" } },
    yAxis: { type: "value", axisLabel: { color: "#9ca3af" } },
    series: [
      { name: "组合净值", type: "line", data: dailyData.map((d) => d.portfolio_value),
        smooth: true, lineStyle: { color: "#3b82f6" }, symbol: "none", areaStyle: { color: "rgba(59,130,246,0.1)" } },
      { name: "基准净值", type: "line", data: dailyData.map((d) => d.benchmark_value),
        smooth: true, lineStyle: { color: "#9ca3af", type: "dashed" }, symbol: "none" },
    ],
  };

  const ddSeries = dailyData.map((d, i) => {
    const peak = Math.max(...dailyData.slice(0, i + 1).map((x) => x.portfolio_value));
    return peak > 0 ? ((d.portfolio_value / peak - 1) * 100) : 0;
  });
  const ddOption = {
    tooltip: { trigger: "axis", valueFormatter: (v: number) => `${v.toFixed(2)}%` },
    grid: { left: 50, right: 20, top: 10, bottom: 30 },
    xAxis: { type: "category", data: dailyData.map((d) => d.date.slice(0, 10)), axisLabel: { color: "#9ca3af" } },
    yAxis: { type: "value", axisLabel: { color: "#9ca3af", formatter: "{v}%" } },
    series: [{
      type: "line", data: ddSeries, areaStyle: { color: "rgba(239,68,68,0.4)" },
      lineStyle: { color: "#ef4444", width: 1 }, symbol: "none",
    }],
  };

  // Rolling Sharpe (60-day)
  const rfDaily = 0.02 / 252;
  const rollSharpe = dailyData.map((_, i) => {
    if (i < 60) return null;
    const slice = dailyData.slice(i - 59, i + 1).map((d) => d.daily_return);
    const excess = slice.map((r) => r - rfDaily);
    const mean = excess.reduce((a, b) => a + b, 0) / excess.length;
    const std = Math.sqrt(excess.reduce((a, b) => a + (b - mean) ** 2, 0) / excess.length) || 1;
    return (mean / std * Math.sqrt(252)).toFixed(2);
  });
  const rollSharpeOption = {
    tooltip: { trigger: "axis" },
    grid: { left: 50, right: 20, top: 10, bottom: 30 },
    xAxis: { type: "category", data: dailyData.map((d) => d.date.slice(0, 10)), axisLabel: { color: "#9ca3af" } },
    yAxis: { type: "value", name: "Sharpe", axisLabel: { color: "#9ca3af" } },
    series: [{
      type: "line", data: rollSharpe, symbol: "none", lineStyle: { color: "#f59e0b", width: 1.5 },
      markLine: { silent: true, data: [{ yAxis: 0, lineStyle: { color: "#6b7280", type: "dashed" } }] },
    }],
  };

  // Return distribution
  const rets = dailyData.map((d) => d.daily_return * 100);
  const distOption = {
    tooltip: {},
    grid: { left: 50, right: 20, top: 10, bottom: 30 },
    xAxis: { type: "value", name: "日收益%", axisLabel: { color: "#9ca3af" } },
    yAxis: { type: "value", name: "频次", axisLabel: { color: "#9ca3af" } },
    series: [{
      type: "histogram", data: rets,
    }],
  };

  // Monthly returns
  const monthlyOption = s.monthly_returns?.length ? {
    tooltip: { valueFormatter: (v: number) => `${(v * 100).toFixed(2)}%` },
    grid: { left: 50, right: 20, top: 10, bottom: 30 },
    xAxis: { type: "category", data: s.monthly_returns.map((_, i) => `M${i + 1}`), axisLabel: { color: "#9ca3af" } },
    yAxis: { type: "value", axisLabel: { color: "#9ca3af", formatter: "{v}%" } },
    series: [{ type: "bar", data: s.monthly_returns.map((m) => ({
      value: m.return, itemStyle: { color: m.return >= 0 ? "#ff6b6b" : "#4ecdc4" },
    })) }],
  } : null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-100">{name}</h1>
        <button className="btn-secondary text-sm" onClick={() => navigate("/backtest")}>返回列表</button>
      </div>

      {/* Return Metrics */}
      <section>
        <h2 className="text-sm font-bold text-slate-400 mb-3 flex items-center gap-2"><span className="w-1 h-4 rounded-full bg-teal-400" />收益指标</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <MetricCard label="累计收益" value={`${(s.total_return * 100).toFixed(2)}%`} change={s.total_return * 100} />
          <MetricCard label="年化收益" value={`${(s.annual_return * 100).toFixed(2)}%`} />
          <MetricCard label="年化波动" value={`${(s.volatility * 100).toFixed(2)}%`} />
          <MetricCard label="最大回撤" value={`${(s.max_drawdown * 100).toFixed(2)}%`} change={s.max_drawdown * 100} />
          <MetricCard label="回撤持续" value={`${s.max_drawdown_duration || 0}天`} />
          <MetricCard label="CVaR (95%)" value={`${((s.cvar_95 ?? 0) * 100).toFixed(2)}%`} />
          <MetricCard label="偏度" value={s.skewness?.toFixed(2) || "-"} />
          <MetricCard label="峰度" value={s.kurtosis?.toFixed(2) || "-"} />
        </div>
      </section>

      {/* Ratios */}
      <section>
        <h2 className="text-sm font-bold text-slate-400 mb-3 flex items-center gap-2"><span className="w-1 h-4 rounded-full bg-teal-400" />风险比率</h2>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <MetricCard label="Sharpe" value={s.sharpe.toFixed(2)} />
          <MetricCard label="Calmar" value={s.calmar.toFixed(2)} />
          <MetricCard label="Sortino" value={s.sortino.toFixed(2)} />
          <MetricCard label="Info Ratio" value={s.information_ratio.toFixed(2)} />
          <MetricCard label="Treynor" value={s.treynor?.toFixed(2) || "-"} />
        </div>
      </section>

      {/* Trading stats */}
      <section>
        <h2 className="text-sm font-bold text-slate-400 mb-3 flex items-center gap-2"><span className="w-1 h-4 rounded-full bg-teal-400" />交易统计</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <MetricCard label="胜率" value={`${((s.win_rate ?? 0) * 100).toFixed(1)}%`} />
          <MetricCard label="盈亏比" value={s.profit_factor?.toFixed(2) || "-"} />
          <MetricCard label="平均盈亏比" value={s.avg_win_loss?.toFixed(2) || "-"} />
          <MetricCard label="VaR (95%)" value={`${(s.var_95 * 100).toFixed(2)}%`} />
        </div>
      </section>

      {/* Attribution */}
      <section>
        <h2 className="text-sm font-bold text-slate-400 mb-3 flex items-center gap-2"><span className="w-1 h-4 rounded-full bg-teal-400" />归因分析</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <MetricCard label="Alpha" value={`${(s.alpha * 100).toFixed(2)}%`} change={s.alpha * 100} />
          <MetricCard label="Beta" value={s.beta.toFixed(2)} />
          <MetricCard label="R²" value={s.r_squared.toFixed(3)} />
          <MetricCard label="跟踪误差" value={s.tracking_error != null ? `${(s.tracking_error * 100).toFixed(2)}%` : "-"} />
        </div>
      </section>

      {/* Charts */}
      <section className="card">
        <h2 className="text-sm font-bold text-slate-400 mb-3 flex items-center gap-2"><span className="w-1 h-4 rounded-full bg-teal-400" />净值曲线</h2>
        {dailyData.length > 0 ? <ReactECharts option={equityOption} style={{ height: 350 }} /> : <p className="text-sm text-gray-500">暂无数据</p>}
      </section>

      <section className="card">
        <h2 className="text-sm font-bold text-slate-400 mb-3 flex items-center gap-2"><span className="w-1 h-4 rounded-full bg-teal-400" />回撤曲线</h2>
        {dailyData.length > 0 ? <ReactECharts option={ddOption} style={{ height: 200 }} /> : <p className="text-sm text-gray-500">暂无数据</p>}
      </section>

      <section className="card">
        <h2 className="text-sm font-bold text-slate-400 mb-3 flex items-center gap-2"><span className="w-1 h-4 rounded-full bg-teal-400" />滚动 Sharpe (60日)</h2>
        {dailyData.length > 60 ? <ReactECharts option={rollSharpeOption} style={{ height: 200 }} /> : <p className="text-sm text-gray-500">数据不足（需要60个交易日以上）</p>}
      </section>

      <section className="card">
        <h2 className="text-sm font-bold text-slate-400 mb-3 flex items-center gap-2"><span className="w-1 h-4 rounded-full bg-teal-400" />日收益分布</h2>
        {rets.length > 0 ? <ReactECharts option={distOption} style={{ height: 220 }} /> : <p className="text-sm text-gray-500">暂无数据</p>}
      </section>

      {monthlyOption && (
        <section className="card">
          <h2 className="text-sm font-bold text-slate-400 mb-3 flex items-center gap-2"><span className="w-1 h-4 rounded-full bg-teal-400" />月度收益</h2>
          <ReactECharts option={monthlyOption} style={{ height: 200 }} />
        </section>
      )}

      {/* Export */}
      <section className="flex gap-3">
        <a href={`/api/v1/report/${runId}/export/html`} target="_blank" className="btn-secondary text-sm" rel="noreferrer">导出 HTML</a>
        <a href={`/api/v1/report/${runId}/export/pdf`} className="btn-primary text-sm">导出 PDF</a>
      </section>
    </div>
  );
}
