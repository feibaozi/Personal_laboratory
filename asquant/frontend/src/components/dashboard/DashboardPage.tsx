import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import ReactECharts from "echarts-for-react";
import dayjs from "dayjs";
import { fetchIndicesLatest, fetchIndexHistory, fetchSectorHeatmap, fetchNorthBound, fetchWatchlist, deleteWatchlist } from "@/api/market";
import { MetricCard } from "@/components/common/MetricCard";
import { LoadingSpinner } from "@/components/common/LoadingSpinner";
import { usePolling } from "@/hooks/usePolling";

export function DashboardPage() {
  const navigate = useNavigate();

  const indices = useQuery({ queryKey: ["indices-latest"], queryFn: fetchIndicesLatest });
  const sectors = useQuery({ queryKey: ["sectors-heatmap"], queryFn: fetchSectorHeatmap });
  const northBound = useQuery({
    queryKey: ["north-bound"],
    queryFn: () => fetchNorthBound(dayjs().subtract(60, "day").format("YYYY-MM-DD"), dayjs().format("YYYY-MM-DD")),
  });
  const watchlist = useQuery({ queryKey: ["watchlist"], queryFn: fetchWatchlist });
  const indexHist = useQuery({
    queryKey: ["index-history"],
    queryFn: () => fetchIndexHistory("000300", dayjs().subtract(60, "day").format("YYYY-MM-DD"), dayjs().format("YYYY-MM-DD")),
  });

  usePolling(() => { indices.refetch(); sectors.refetch(); watchlist.refetch(); }, 3000, 60000, true);

  if (indices.isLoading) return <LoadingSpinner text="加载行情数据..." />;

  // 1. Index sparkline option for each card
  const indexSparkline = (histData: { close: number }[] | undefined) => {
    if (!histData || histData.length < 2) return null;
    const vals = histData.map((d) => d.close);
    const isUp = vals[vals.length - 1] >= vals[0];
    return {
      grid: { left: 0, right: 0, top: 0, bottom: 0 },
      xAxis: { type: "category", show: false, data: vals.map(() => "") },
      yAxis: { type: "value", show: false },
      series: [{ type: "line", data: vals, smooth: true, symbol: "none",
        lineStyle: { color: isUp ? "#ff6b6b" : "#4ecdc4", width: 1.5 },
        areaStyle: { color: isUp ? "rgba(239,68,68,0.1)" : "rgba(34,197,94,0.1)" } }],
    };
  };

  // 2. Sector treemap
  const sectorList = sectors.data || [];
  const treemapOption = sectorList.length > 0 ? {
    tooltip: { formatter: (p: { name: string; value: number }) => `${p.name}: ${p.value >= 0 ? "+" : ""}${p.value.toFixed(2)}%` },
    series: [{
      type: "treemap", roam: false, nodeClick: false as const, width: "100%", height: "100%",
      label: { show: true, formatter: (p: { name: string }) => p.name.length > 4 ? p.name.slice(0, 4) + ".." : p.name, fontSize: 10, color: "#e5e7eb" },
      data: sectorList.slice(0, 30).map((s) => ({
        name: s.name, value: Math.abs(s.change_pct) * 100,
        itemStyle: { color: s.change_pct >= 0 ? `rgba(239,68,68,${0.3 + Math.min(Math.abs(s.change_pct) / 10, 0.7)})` : `rgba(34,197,94,${0.3 + Math.min(Math.abs(s.change_pct) / 10, 0.7)})` },
      })),
    }],
  } : null;

  // 3. North-bound dual-axis chart
  const nbData = northBound.data || [];
  const northOption = nbData.length > 0 ? {
    tooltip: { trigger: "axis" },
    legend: { data: ["日净流入", "累计净流入"], textStyle: { color: "#9ca3af" }, top: 0 },
    grid: { left: 60, right: 60, top: 30, bottom: 30 },
    xAxis: { type: "category", data: nbData.map((d) => d.date.slice(5)), axisLabel: { color: "#9ca3af" } },
    yAxis: [
      { type: "value", name: "亿", axisLabel: { color: "#9ca3af" } },
      { type: "value", name: "累计(亿)", axisLabel: { color: "#9ca3af" } },
    ],
    series: [
      { name: "日净流入", type: "bar", data: nbData.map((d) => d.net_flow_total),
        itemStyle: { color: (p: { value: number }) => p.value >= 0 ? "#ff6b6b" : "#4ecdc4" } },
      { name: "累计净流入", type: "line", yAxisIndex: 1, symbol: "none",
        data: (() => { let cum = 0; return nbData.map((d) => { cum += d.net_flow_total; return cum.toFixed(1); }); })(),
        lineStyle: { color: "#3b82f6" } },
    ],
  } : null;

  // 4. Multi-index comparison (normalized)
  const compareOption = indexHist.data ? {
    tooltip: { trigger: "axis" },
    legend: { data: ["沪深300"], textStyle: { color: "#9ca3af" }, top: 0 },
    grid: { left: 60, right: 20, top: 30, bottom: 30 },
    xAxis: { type: "category", data: (indexHist.data.data as { date: string }[] || []).map((d) => d.date.slice(5)), axisLabel: { color: "#9ca3af" } },
    yAxis: { type: "value", name: "归一化(100)", axisLabel: { color: "#9ca3af" } },
    series: [{
      name: "沪深300", type: "line", symbol: "none", smooth: true,
      data: (() => {
        const closes = (indexHist.data.data as { close: number }[] || []).map((d) => d.close);
        if (closes.length === 0) return [];
        const base = closes[0];
        return closes.map((c: number) => ((c / base) * 100).toFixed(1));
      })(),
      lineStyle: { color: "#3b82f6" },
      areaStyle: { color: "rgba(59,130,246,0.1)" },
    }],
  } : null;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-100">仪表盘</h1>

      {/* Index Overview */}
      <section>
        <h2 className="text-sm font-bold text-slate-400 mb-3 flex items-center gap-2">
          <span className="w-1 h-4 rounded-full bg-rose-400" />
          指数概览
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {indices.data?.map((idx, i) => {
            const accents = ["#ff6b6b", "#ffd93d", "#4ecdc4", "#a78bfa", "#f472b6", "#60a5fa"];
            const acc = accents[i % accents.length];
            return (
              <div key={idx.code}
                className="card flex flex-col gap-1 cursor-pointer hover:-translate-y-1 transition-all duration-200"
                style={{ borderLeft: `3px solid ${acc}` }}
                onClick={() => navigate(`/stock/${idx.code}`)}
              >
                <span className="text-xs text-slate-400 truncate">{idx.name}</span>
                <span className="text-lg font-extrabold text-slate-100">{idx.close?.toFixed(0)}</span>
                <span className={`text-xs font-semibold ${(idx.change_pct ?? 0) >= 0 ? "text-up" : "text-down"}`}>
                  {(idx.change_pct ?? 0) >= 0 ? "+" : ""}{idx.change_pct?.toFixed(2)}%
                </span>
              </div>
            );
          })}
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Sector Treemap */}
        <section className="card">
          <h2 className="text-sm font-bold text-slate-400 mb-3 flex items-center gap-2">
            <span className="w-1 h-4 rounded-full bg-amber-400" />板块涨跌
          </h2>
          {treemapOption ? (
            <ReactECharts option={treemapOption} style={{ height: 280 }} />
          ) : <p className="text-sm text-gray-500">暂无板块数据</p>}
        </section>

        {/* North-bound Flow */}
        <section className="card">
          <h2 className="text-sm font-bold text-slate-400 mb-3 flex items-center gap-2"><span className="w-1 h-4 rounded-full bg-teal-400" />北向资金 (近60日)</h2>
          {northOption ? (
            <ReactECharts option={northOption} style={{ height: 280 }} />
          ) : <p className="text-sm text-gray-500">暂无北向资金数据</p>}
        </section>
      </div>

      {/* Index Comparison */}
      {compareOption && (
        <section className="card">
          <h2 className="text-sm font-bold text-slate-400 mb-3 flex items-center gap-2"><span className="w-1 h-4 rounded-full bg-teal-400" />沪深300 走势 (近60日归一化)</h2>
          <ReactECharts option={compareOption} style={{ height: 250 }} />
        </section>
      )}

      {/* Watchlist */}
      <section className="card">
        <h2 className="text-sm font-bold text-slate-400 mb-3 flex items-center gap-2"><span className="w-1 h-4 rounded-full bg-teal-400" />
          自选股
          <button className="ml-3 text-xs text-blue-400 hover:text-blue-300" onClick={() => navigate("/data")}>管理</button>
        </h2>
        {watchlist.data && watchlist.data.length > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {watchlist.data.map((w) => (
              <div key={w.id} className="flex items-center justify-between p-2 rounded bg-gray-900 hover:bg-gray-800 cursor-pointer"
                onClick={() => navigate(`/stock/${w.stock_code}`)}>
                <div>
                  <span className="font-mono text-sm text-gray-300">{w.stock_code}</span>
                  {w.notes && <span className="text-xs text-gray-500 ml-2">{w.notes}</span>}
                </div>
                <button className="text-xs text-red-400 hover:text-red-300"
                  onClick={(e) => { e.stopPropagation(); deleteWatchlist(w.id).then(() => watchlist.refetch()); }}>
                  ×
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-500">暂无自选股，在数据管理页面添加</p>
        )}
      </section>
    </div>
  );
}
