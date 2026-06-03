import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { fetchBacktestDetail, fetchBacktestDaily, fetchBacktestAttribution, fetchBacktestTrades, fetchBacktestPositions, fetchBacktestTurnover, fetchBacktestBarra } from "@/api/backtest";
import { LoadingSpinner } from "@/components/common/LoadingSpinner";
import { MetricCard } from "@/components/common/MetricCard";
import ReactECharts from "echarts-for-react";

const TABS = ["概览", "归因", "交易", "持仓", "换手率"] as const;

export function ReportPage() {
  const { runId } = useParams<{ runId: string }>();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<string>("概览");

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
  const attribution = useQuery({
    queryKey: ["backtest-attribution", runId],
    queryFn: () => fetchBacktestAttribution(runId!),
    enabled: !!runId,
  });
  const trades = useQuery({
    queryKey: ["backtest-trades", runId],
    queryFn: () => fetchBacktestTrades(runId!),
    enabled: !!runId && activeTab === "交易",
  });
  const positions = useQuery({
    queryKey: ["backtest-positions", runId],
    queryFn: () => fetchBacktestPositions(runId!),
    enabled: !!runId && activeTab === "持仓",
  });
  const turnover = useQuery({
    queryKey: ["backtest-turnover", runId],
    queryFn: () => fetchBacktestTurnover(runId!),
    enabled: !!runId && activeTab === "换手率",
  });
  const barra = useQuery({
    queryKey: ["backtest-barra", runId],
    queryFn: () => fetchBacktestBarra(runId!),
    enabled: !!runId && activeTab === "归因",
  });

  if (detail.isLoading) return <LoadingSpinner text="加载报告..." />;
  if (!detail.data || !detail.data.summary) return <p className="text-gray-400">未找到该回测报告</p>;

  const { name, summary: s } = detail.data;
  const dailyData = daily.data || [];

  // --- Chart options ---
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

  const rets = dailyData.map((d) => d.daily_return * 100);
  const distOption = {
    tooltip: {},
    grid: { left: 50, right: 20, top: 10, bottom: 30 },
    xAxis: { type: "value", name: "日收益%", axisLabel: { color: "#9ca3af" } },
    yAxis: { type: "value", name: "频次", axisLabel: { color: "#9ca3af" } },
    series: [{ type: "histogram", data: rets }],
  };

  const monthlyOption = s.monthly_returns?.length ? {
    tooltip: { valueFormatter: (v: number) => `${(v * 100).toFixed(2)}%` },
    grid: { left: 50, right: 20, top: 10, bottom: 30 },
    xAxis: { type: "category", data: s.monthly_returns.map((_, i) => `M${i + 1}`), axisLabel: { color: "#9ca3af" } },
    yAxis: { type: "value", axisLabel: { color: "#9ca3af", formatter: "{v}%" } },
    series: [{ type: "bar", data: s.monthly_returns.map((m) => ({
      value: m.return, itemStyle: { color: m.return >= 0 ? "#ff6b6b" : "#4ecdc4" },
    })) }],
  } : null;

  // Barra chart option
  const barraData = barra.data;
  const barraOption = barraData?.factor_contributions?.length ? {
    tooltip: { trigger: "axis", valueFormatter: (v: number) => `${v.toFixed(4)}%` },
    grid: { left: 80, right: 20, top: 10, bottom: 30 },
    xAxis: { type: "category", data: barraData.factor_names || barraData.factor_contributions.map((fc) => fc.factor), axisLabel: { color: "#9ca3af" } },
    yAxis: { type: "value", name: "贡献", axisLabel: { color: "#9ca3af" } },
    series: [{
      type: "bar",
      data: barraData.factor_contributions.map((fc) => ({
        value: fc.contribution,
        itemStyle: { color: fc.contribution >= 0 ? "#ef4444" : "#22c55e" },
      })),
    }],
  } : null;

  // Turnover chart option
  const turnoverData = turnover.data;
  const turnoverOption = turnoverData?.turnover_series?.length ? {
    tooltip: { trigger: "axis", valueFormatter: (v: number) => `${(v * 100).toFixed(2)}%` },
    grid: { left: 60, right: 20, top: 10, bottom: 30 },
    xAxis: { type: "category", data: turnoverData.turnover_series.map((t) => t.date.slice(0, 10)), axisLabel: { color: "#9ca3af" } },
    yAxis: { type: "value", name: "换手率", axisLabel: { color: "#9ca3af" } },
    series: [{
      type: "bar",
      data: turnoverData.turnover_series.map((t) => t.turnover),
      itemStyle: { color: "#8b5cf6" },
    }],
  } : null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-100">{name}</h1>
        <button className="btn-secondary text-sm" onClick={() => navigate("/backtest")}>返回列表</button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-700 pb-2">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setActiveTab(t)}
            className={`px-4 py-1.5 text-sm rounded-t transition-colors ${
              activeTab === t
                ? "bg-blue-600/20 text-blue-300 border border-blue-500/50"
                : "text-gray-500 hover:text-gray-300"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* === Tab: 概览 === */}
      {activeTab === "概览" && (
        <>
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

          <section>
            <h2 className="text-sm font-bold text-slate-400 mb-3 flex items-center gap-2"><span className="w-1 h-4 rounded-full bg-teal-400" />交易统计</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <MetricCard label="胜率" value={`${((s.win_rate ?? 0) * 100).toFixed(1)}%`} />
              <MetricCard label="盈亏比" value={s.profit_factor?.toFixed(2) || "-"} />
              <MetricCard label="平均盈亏比" value={s.avg_win_loss?.toFixed(2) || "-"} />
              <MetricCard label="VaR (95%)" value={`${(s.var_95 * 100).toFixed(2)}%`} />
            </div>
          </section>

          <section>
            <h2 className="text-sm font-bold text-slate-400 mb-3 flex items-center gap-2"><span className="w-1 h-4 rounded-full bg-teal-400" />Alpha/Beta</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <MetricCard label="Alpha (年化)" value={`${((attribution.data?.alpha_annual ?? s.alpha) * 100).toFixed(2)}%`} change={(attribution.data?.alpha_annual ?? s.alpha) * 100} />
              <MetricCard label="Beta" value={(attribution.data?.beta ?? s.beta).toFixed(2)} />
              <MetricCard label="R²" value={(attribution.data?.r_squared ?? s.r_squared).toFixed(3)} />
              <MetricCard label="特质波动率" value={attribution.data?.idiosyncratic_vol ? `${(attribution.data.idiosyncratic_vol * 100).toFixed(2)}%` : "-"} />
            </div>
          </section>

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
        </>
      )}

      {/* === Tab: 归因 === */}
      {activeTab === "归因" && (
        <>
          {/* Brinson Sector Attribution */}
          {attribution.data?.sector_attribution && attribution.data.sector_attribution.length > 0 && (
            <section className="card">
              <h2 className="text-sm font-bold text-slate-400 mb-3 flex items-center gap-2"><span className="w-1 h-4 rounded-full bg-teal-400" />Brinson 行业归因</h2>
              {attribution.data.summary && (
                <div className="grid grid-cols-4 gap-3 mb-4">
                  <MetricCard label="配置效应" value={`${(attribution.data.summary.total_allocation * 100).toFixed(3)}%`} />
                  <MetricCard label="选股效应" value={`${(attribution.data.summary.total_selection * 100).toFixed(3)}%`} />
                  <MetricCard label="交互效应" value={`${(attribution.data.summary.total_interaction * 100).toFixed(3)}%`} />
                  <MetricCard label="总超额" value={`${(attribution.data.summary.total_excess * 100).toFixed(3)}%`} />
                </div>
              )}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-slate-400 border-b border-slate-700">
                        <th className="text-left py-2 px-2">行业</th>
                        <th className="text-right py-2 px-2">组合权重</th>
                        <th className="text-right py-2 px-2">基准权重</th>
                        <th className="text-right py-2 px-2">配置效应</th>
                        <th className="text-right py-2 px-2">选股效应</th>
                        <th className="text-right py-2 px-2">交互效应</th>
                        <th className="text-right py-2 px-2">总效应</th>
                      </tr>
                    </thead>
                    <tbody>
                      {attribution.data.sector_attribution.map((row) => (
                        <tr key={row.sector} className="border-b border-slate-800 hover:bg-slate-800/50">
                          <td className="py-1.5 px-2 text-gray-200">{row.sector}</td>
                          <td className="text-right py-1.5 px-2 text-gray-300">{(row.portfolio_weight * 100).toFixed(1)}%</td>
                          <td className="text-right py-1.5 px-2 text-gray-300">{(row.benchmark_weight * 100).toFixed(1)}%</td>
                          <td className={`text-right py-1.5 px-2 ${row.allocation_effect >= 0 ? "text-red-400" : "text-green-400"}`}>{(row.allocation_effect * 100).toFixed(3)}%</td>
                          <td className={`text-right py-1.5 px-2 ${row.selection_effect >= 0 ? "text-red-400" : "text-green-400"}`}>{(row.selection_effect * 100).toFixed(3)}%</td>
                          <td className={`text-right py-1.5 px-2 ${row.interaction_effect >= 0 ? "text-red-400" : "text-green-400"}`}>{(row.interaction_effect * 100).toFixed(3)}%</td>
                          <td className={`text-right py-1.5 px-2 font-medium ${row.total_effect >= 0 ? "text-red-400" : "text-green-400"}`}>{(row.total_effect * 100).toFixed(3)}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <ReactECharts
                  option={{
                    tooltip: { trigger: "item", valueFormatter: (v: number) => `${(v * 100).toFixed(1)}%` },
                    series: [{
                      type: "pie",
                      radius: ["35%", "65%"],
                      label: { color: "#9ca3af", fontSize: 10 },
                      data: attribution.data.sector_attribution
                        .filter((r) => r.portfolio_weight > 0.01)
                        .map((r) => ({ name: r.sector, value: parseFloat((r.portfolio_weight * 100).toFixed(1)) })),
                    }],
                  }}
                  style={{ height: 280 }}
                />
              </div>
            </section>
          )}

          {/* Factor Attribution */}
          {attribution.data?.factor_attribution && attribution.data.factor_attribution.length > 0 && (
            <section className="card">
              <h2 className="text-sm font-bold text-slate-400 mb-3 flex items-center gap-2"><span className="w-1 h-4 rounded-full bg-teal-400" />因子归因</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-slate-400 border-b border-slate-700">
                      <th className="text-left py-2 px-3">因子</th>
                      <th className="text-right py-2 px-3">Beta</th>
                      <th className="text-right py-2 px-3">贡献</th>
                    </tr>
                  </thead>
                  <tbody>
                    {attribution.data.factor_attribution.map((row) => (
                      <tr key={row.factor} className="border-b border-slate-800 hover:bg-slate-800/50">
                        <td className="py-1.5 px-3 text-gray-200">{row.factor}</td>
                        <td className="text-right py-1.5 px-3 text-gray-300">{row.beta.toFixed(4)}</td>
                        <td className={`text-right py-1.5 px-3 ${row.contribution >= 0 ? "text-red-400" : "text-green-400"}`}>{(row.contribution * 100).toFixed(3)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* Barra Attribution */}
          {barra.isLoading ? <LoadingSpinner text="加载 Barra 归因..." /> :
            barraOption ? (
              <section className="card">
                <h2 className="text-sm font-bold text-slate-400 mb-3 flex items-center gap-2"><span className="w-1 h-4 rounded-full bg-teal-400" />Barra 多因子归因</h2>
                <div className="grid grid-cols-3 gap-3 mb-4">
                  <MetricCard label="R²" value={barraData!.r_squared.toFixed(3)} />
                  <MetricCard label="已解释收益" value={`${(barraData!.total_explained * 100).toFixed(2)}%`} />
                  <MetricCard label="特质收益" value={`${(barraData!.specific_return * 100).toFixed(2)}%`} />
                </div>
                <ReactECharts option={barraOption} style={{ height: 280 }} />
              </section>
            ) : (
              <p className="text-sm text-gray-500">Barra 归因数据不可用</p>
            )
          }
        </>
      )}

      {/* === Tab: 交易 === */}
      {activeTab === "交易" && (
        <section className="card">
          <h2 className="text-sm font-bold text-slate-400 mb-3 flex items-center gap-2"><span className="w-1 h-4 rounded-full bg-teal-400" />交易明细</h2>
          {trades.isLoading ? <LoadingSpinner text="加载交易明细..." /> :
            trades.data && trades.data.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-slate-400 border-b border-slate-700">
                      <th className="text-left py-2 px-2">日期</th>
                      <th className="text-left py-2 px-2">代码</th>
                      <th className="text-left py-2 px-2">方向</th>
                      <th className="text-right py-2 px-2">数量</th>
                      <th className="text-right py-2 px-2">价格</th>
                      <th className="text-right py-2 px-2">金额</th>
                      <th className="text-right py-2 px-2">成本</th>
                      <th className="text-right py-2 px-2">滑点</th>
                    </tr>
                  </thead>
                  <tbody>
                    {trades.data.map((t, i) => (
                      <tr key={i} className="border-b border-slate-800 hover:bg-slate-800/50">
                        <td className="py-1.5 px-2 text-gray-300">{typeof t.trade_date === "string" ? t.trade_date.slice(0, 10) : t.trade_date}</td>
                        <td className="py-1.5 px-2 text-gray-200 font-mono">{t.stock_code}</td>
                        <td className={`py-1.5 px-2 ${t.direction === "buy" ? "text-red-400" : "text-green-400"}`}>{t.direction === "buy" ? "买入" : "卖出"}</td>
                        <td className="text-right py-1.5 px-2 text-gray-300">{t.shares.toLocaleString()}</td>
                        <td className="text-right py-1.5 px-2 text-gray-300">{t.price.toFixed(2)}</td>
                        <td className="text-right py-1.5 px-2 text-gray-300">{t.amount.toLocaleString()}</td>
                        <td className="text-right py-1.5 px-2 text-gray-400">{t.cost.toFixed(2)}</td>
                        <td className="text-right py-1.5 px-2 text-gray-400">{(t.slippage * 100).toFixed(3)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-gray-500">暂无交易明细</p>
            )
          }
        </section>
      )}

      {/* === Tab: 持仓 === */}
      {activeTab === "持仓" && (
        <section className="card">
          <h2 className="text-sm font-bold text-slate-400 mb-3 flex items-center gap-2"><span className="w-1 h-4 rounded-full bg-teal-400" />持仓历史</h2>
          {positions.isLoading ? <LoadingSpinner text="加载持仓数据..." /> :
            positions.data && positions.data.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-slate-400 border-b border-slate-700">
                      <th className="text-left py-2 px-2">日期</th>
                      <th className="text-left py-2 px-2">持仓股票</th>
                      <th className="text-left py-2 px-2">权重</th>
                    </tr>
                  </thead>
                  <tbody>
                    {positions.data
                      .filter((p) => Object.keys(p.weights).length > 0)
                      .slice(-50)
                      .map((p, i) => (
                        <tr key={i} className="border-b border-slate-800 hover:bg-slate-800/50">
                          <td className="py-1.5 px-2 text-gray-300">{p.trade_date.slice(0, 10)}</td>
                          <td className="py-1.5 px-2 text-gray-200 font-mono text-[10px]">{Object.keys(p.weights).join(", ")}</td>
                          <td className="py-1.5 px-2 text-gray-300 font-mono text-[10px]">
                            {Object.entries(p.weights)
                              .sort(([, a], [, b]) => b - a)
                              .slice(0, 5)
                              .map(([k, v]) => `${k}:${(v * 100).toFixed(1)}%`)
                              .join("  ")}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-gray-500">暂无持仓数据</p>
            )
          }
        </section>
      )}

      {/* === Tab: 换手率 === */}
      {activeTab === "换手率" && (
        <section className="card">
          <h2 className="text-sm font-bold text-slate-400 mb-3 flex items-center gap-2"><span className="w-1 h-4 rounded-full bg-teal-400" />换手率分析</h2>
          {turnover.isLoading ? <LoadingSpinner text="加载换手率..." /> :
            turnoverData ? (
              <>
                <div className="grid grid-cols-3 gap-3 mb-4">
                  <MetricCard label="平均换手率" value={`${(turnoverData.avg_turnover * 100).toFixed(2)}%`} />
                  <MetricCard label="最大换手率" value={`${(turnoverData.max_turnover * 100).toFixed(2)}%`} />
                  <MetricCard label="交易次数" value={String(turnoverData.trade_count)} />
                </div>
                {turnoverOption ? <ReactECharts option={turnoverOption} style={{ height: 250 }} /> : <p className="text-sm text-gray-500">暂无换手率数据</p>}
              </>
            ) : (
              <p className="text-sm text-gray-500">暂无换手率数据</p>
            )
          }
        </section>
      )}

      {/* Export */}
      <section className="flex gap-3">
        <a href={`/api/v1/backtest/runs/${runId}/report?format=html`} target="_blank" className="btn-secondary text-sm" rel="noreferrer">导出 HTML</a>
        <a href={`/api/v1/backtest/runs/${runId}/report?format=csv`} className="btn-secondary text-sm">导出 CSV</a>
      </section>
    </div>
  );
}
