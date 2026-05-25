import { useState, useMemo, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import ReactECharts from "echarts-for-react";
import dayjs from "dayjs";
import { fetchStockQuotes, fetchStockProfile, fetchStocks, fetchWatchlist, addWatchlist, deleteWatchlist, fetchPositions, addPosition, closePosition, deletePosition } from "@/api/market";
import { api } from "@/api/client";
import { LoadingSpinner } from "@/components/common/LoadingSpinner";
import { MetricCard } from "@/components/common/MetricCard";

type Freq = "d" | "w" | "m" | "1" | "5" | "15" | "30" | "60";
const FREQ_LABELS: Record<Freq, string> = { d: "日K", w: "周K", m: "月K", "1": "1分", "5": "5分", "15": "15分", "30": "30分", "60": "60分" };
const isMinute = (f: Freq) => ["1", "5", "15", "30", "60"].includes(f);

type Coverage = { daily: { min_date: string | null; max_date: string | null; trading_days: number }; minute: { freq: string; min_date: string | null; max_date: string | null; trading_days: number; real_days: number }[] };

function DataCoverage({ code, freq, source, onToggleSource, autoSource, onAutoDone }:
  { code: string; freq: Freq; source: string; onToggleSource: (v: "real" | "all") => void; autoSource: boolean; onAutoDone: () => void }) {
  const { data } = useQuery<Coverage>({
    queryKey: ["coverage", code],
    queryFn: () => api.get(`/market/stocks/${code}/minute/coverage`),
    enabled: !!code,
  });
  if (!data) return null;

  if (isMinute(freq)) {
    const m = data.minute.find((x) => x.freq === freq);
    if (!m || m.trading_days === 0) {
      return <span className="text-xs px-2 py-1 rounded bg-gray-700/50 text-gray-500 border border-gray-600/30">无数据</span>;
    }
    const real = m.real_days || 0;
    const total = m.trading_days;
    const synth = total - real;

    // Auto-switch: if no real data, use "all" mode
    if (autoSource && real === 0 && total > 0 && source === "real") {
      setTimeout(() => { onToggleSource("all"); onAutoDone(); }, 0);
    }

    // Mixed data: show toggle buttons
    if (real > 0 && synth > 0) {
      return (
        <div className="flex gap-1">
          <button
            className={`text-xs px-2 py-1 rounded border transition-colors ${source === "real"
              ? "bg-green-600/20 text-green-400 border-green-500/50"
              : "bg-gray-800 text-gray-500 border-gray-700 hover:border-green-500/30"}`}
            onClick={() => onToggleSource("real")}
            title="仅显示真实数据"
          >
            {real}天真实
          </button>
          <button
            className={`text-xs px-3 py-1 rounded border transition-colors ${source === "all"
              ? "bg-blue-600/20 text-blue-400 border-blue-500/50"
              : "bg-gray-800 text-gray-500 border-gray-700 hover:border-blue-500/30"}`}
            onClick={() => onToggleSource("all")}
            title="显示全部数据（含合成）"
          >
            +{synth}天合成
          </button>
        </div>
      );
    }

    // All real
    if (real > 0) {
      return <span className="text-xs px-2 py-1 rounded bg-green-600/15 text-green-400 border border-green-600/30">真实 {real}天</span>;
    }
    // All synthetic ← source auto-switched to "all" above
    return <span className="text-xs px-2 py-1 rounded bg-gray-700/50 text-gray-500 border border-gray-600/30">合成 {total}天</span>;
  }

  const d = data.daily;
  if (d?.trading_days) {
    return <span className="text-xs px-2 py-1 rounded bg-green-600/15 text-green-400 border border-green-600/30">真实 {d.trading_days}天</span>;
  }
  return null;
}

function SyncButton({ code, onSuccess, freq = "d", startDate, endDate }:
  { code: string; onSuccess: () => void; freq?: string; startDate: string; endDate: string }) {
  const isMin = ["1", "5", "15", "30", "60"].includes(freq);
  const syncMutation = useMutation<{ status: string }>({
    mutationFn: async () => {
      if (isMin) {
        return api.post(`/data/sync/stock/${code}/minute?freq=all&start_date=${startDate}&end_date=${endDate}`);
      }
      return api.post(`/data/sync/stock/${code}?start_date=${startDate}&end_date=${endDate}`);
    },
    onSuccess: (data) => {
      if ((data as { status: string }).status === "done") onSuccess();
    },
  });
  return (
    <button className="btn-primary" disabled={syncMutation.isPending}
      onClick={() => syncMutation.mutate()}>
      {syncMutation.isPending ? "拉取中..." : isMin ? "拉取全部高频数据" : "拉取日线数据"}
    </button>
  );
}

export function StockPage() {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const [freq, setFreq] = useState<Freq>("d");
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState<{ code: string; name: string }[]>([]);
  const [syncStart, setSyncStart] = useState(dayjs().subtract(7, "day").format("YYYY-MM-DD"));
  const [syncEnd, setSyncEnd] = useState(dayjs().format("YYYY-MM-DD"));
  const [sourceMode, setSourceMode] = useState<"real" | "all">("real");
  const [autoSource, setAutoSource] = useState(true);
  const [autoSynced, setAutoSynced] = useState(false);
  const [showPosModal, setShowPosModal] = useState(false);
  const [posShares, setPosShares] = useState("100");
  const [posCost, setPosCost] = useState("");
  const [posDate, setPosDate] = useState(dayjs().format("YYYY-MM-DD"));
  const [posNotes, setPosNotes] = useState("");

  const watchlistQuery = useQuery({ queryKey: ["watchlist"], queryFn: fetchWatchlist, enabled: !!code });
  const inWatchlist = watchlistQuery.data?.some((w: { stock_code: string }) => w.stock_code === code);

  const posQuery = useQuery({
    queryKey: ["positions", code],
    queryFn: () => fetchPositions(code!),
    enabled: !!code,
  });
  const positions = posQuery.data?.positions || [];
  const totalShares = positions.reduce((s: number, p: { shares: number }) => s + p.shares, 0);
  const avgCost = positions.length > 0 ? positions.reduce((s: number, p: { avg_cost: number; shares: number }) => s + p.avg_cost * p.shares, 0) / totalShares : 0;

  const toggleWatchlist = async () => {
    if (inWatchlist) {
      const item = watchlistQuery.data?.find((w: { stock_code: string }) => w.stock_code === code);
      if (item) { await deleteWatchlist((item as { id: number }).id); watchlistQuery.refetch(); }
    } else {
      await addWatchlist(code!, "");
      watchlistQuery.refetch();
    }
  };

  const handleAddPosition = async () => {
    const shares = parseInt(posShares) || 0;
    const cost = parseFloat(posCost) || p?.latest_price || 0;
    if (shares > 0 && code) {
      await addPosition(code, shares, cost, posDate, posNotes);
      posQuery.refetch();
      setShowPosModal(false);
      setPosShares("100"); setPosCost(""); setPosDate(dayjs().format("YYYY-MM-DD")); setPosNotes("");
    }
  };

  const handleClosePosition = async (id: number) => {
    const closeDate = dayjs().format("YYYY-MM-DD");
    const closePrice = p?.latest_price || 0;
    await closePosition(id, closeDate, closePrice);
    posQuery.refetch();
  };

  const handleDeletePosition = async (id: number) => {
    await deletePosition(id);
    posQuery.refetch();
  };

  const startDate = useMemo(() => {
    if (isMinute(freq)) return syncStart;  // Use sync start date for minute charts
    const ranges: Record<string, string> = { d: "2025-01-01", w: "2024-01-01", m: "2022-01-01" };
    return dayjs(ranges[freq] || "2025-01-01").format("YYYY-MM-DD");
  }, [freq, syncStart]);
  const endDate = dayjs().format("YYYY-MM-DD");

  const profile = useQuery({
    queryKey: ["stock-profile", code],
    queryFn: () => fetchStockProfile(code!),
    enabled: !!code,
  });

  const quotes = useQuery({
    queryKey: ["stock-quotes", code, freq, startDate, sourceMode],
    queryFn: () => fetchStockQuotes(code!, startDate, endDate, freq, sourceMode),
    enabled: !!code,
  });

  // Auto-sync: if any data is stale (>1 day behind), auto-fetch latest
  useEffect(() => {
    if (!code || autoSynced) return;
    const checkAndSync = async () => {
      try {
        const cov = await api.get<Coverage>(`/market/stocks/${code}/minute/coverage`);
        const today = dayjs().format("YYYY-MM-DD");
        const dailyMax = cov.daily?.max_date || "";
        const minuteMax = (cov.minute || []).reduce((max: string, m: { max_date: string | null }) =>
          (m.max_date && m.max_date > max) ? m.max_date : max, "");
        const dataMax = dailyMax > minuteMax ? dailyMax : minuteMax;
        if (dataMax && dataMax < today && dayjs(today).diff(dayjs(dataMax), "day") >= 1) {
          setAutoSynced(true);
          await api.post(`/data/sync/stock/${code}?start_date=${dataMax}&end_date=${today}`);
          await api.post(`/data/sync/stock/${code}/minute?freq=all&start_date=${dataMax}&end_date=${today}`);
          profile.refetch();
          quotes.refetch();
        }
      } catch { /* silent */ }
    };
    checkAndSync();
  }, [code, autoSynced]);

  const searchStocks = async (term: string) => {
    setSearchTerm(term);
    if (term.length < 1) { setSearchResults([]); return; }
    const result = await fetchStocks(1, term);
    setSearchResults(result.items.slice(0, 10));
  };

  const data = quotes.data?.data || [];
  const p = profile.data;

  const ohlc = data.filter((d) => d.open != null && d.close != null).map((d) => [
    d.open, d.close, d.low, d.high,
  ]);
  const dates = data.map((d) => d.date.slice(0, 10));
  const volumes = data.map((d) => d.volume || 0);
  const volColors = data.map((d) => (d.change_pct ?? 0) >= 0 ? "#ef4444" : "#22c55e");

  const ma = (period: number) => {
    const closes = data.map((d) => d.close);
    return closes.map((_, i) => {
      if (i < period - 1) return null;
      const sum = closes.slice(i - period + 1, i + 1).reduce((a, b) => (a ?? 0) + (b ?? 0), 0) as number;
      return (sum / period).toFixed(2);
    });
  };

  const maData = useMemo(() => ({
    ma5: ma(5), ma10: ma(10), ma20: ma(20), ma60: ma(60),
  }), [data.length, data[0]?.close]);

  const isMin = isMinute(freq);
  const klineOption = {
    tooltip: { trigger: "axis", axisPointer: { type: "cross" } },
    legend: { data: isMin ? ["K线"] : ["K线", "MA5", "MA10", "MA20", "MA60"], textStyle: { color: "#9ca3af" }, top: 0 },
    grid: { left: 70, right: 60, top: 40, bottom: 80 },
    xAxis: { type: "category", data: dates, axisLabel: { color: "#9ca3af" }, axisLine: { lineStyle: { color: "#374151" } } },
    yAxis: { type: "value", scale: true, axisLabel: { color: "#9ca3af" }, splitLine: { lineStyle: { color: "#1f2937" } } },
    dataZoom: [
      { type: "inside", start: dates.length > 200 ? 100 * (1 - 200 / dates.length) : 0, end: 100 },
      { type: "slider", start: dates.length > 200 ? 100 * (1 - 200 / dates.length) : 0, end: 100, height: 20, bottom: 40 },
    ],
    series: [
      {
        name: "K线", type: "candlestick", data: ohlc,
        itemStyle: { color: "#ff6b6b", color0: "#4ecdc4", borderColor: "#ff6b6b", borderColor0: "#4ecdc4" },
        markLine: avgCost > 0 ? {
          silent: true, symbol: "none",
          lineStyle: { color: p?.latest_price && p.latest_price >= avgCost ? "#ff6b6b" : "#4ecdc4", type: "dashed", width: 1.5 },
          data: [{ yAxis: avgCost, label: { formatter: `成本 ¥${avgCost.toFixed(2)}`, position: "end", color: "#e2e8f0", fontSize: 11 }}],
        } : undefined,
        markPoint: positions.length > 0 ? {
          symbol: "pin", symbolSize: 36,
          label: { fontSize: 10, fontWeight: "bold" },
          data: [
            ...positions.filter((pos: { close_date: string | null }) => !pos.close_date).map((pos: { avg_cost: number; open_date: string | null }) => {
              // Match open_date to chart xAxis — try exact match first, then date-only match
              const od = pos.open_date || "";
              let idx = dates.indexOf(od);
              if (idx < 0) idx = dates.findIndex((d: string) => d.slice(0, 10) === od.slice(0, 10));
              if (idx < 0) return null;
              return {
                name: "B", xAxis: idx, yAxis: pos.avg_cost,
                symbol: "roundRect", symbolSize: [20, 14],
                itemStyle: { color: "#ff6b6b" },
                label: { formatter: "B", color: "#fff", fontSize: 10, fontWeight: "bold" },
              };
            }).filter(Boolean),
            ...positions.filter((pos: { close_date: string | null }) => !!pos.close_date).map((pos: { close_price: number | null; close_date: string | null }) => {
              const cd = pos.close_date || "";
              let idx = dates.indexOf(cd);
              if (idx < 0) idx = dates.findIndex((d: string) => d.slice(0, 10) === cd.slice(0, 10));
              if (idx < 0) return null;
              return {
                name: "S", xAxis: idx, yAxis: pos.close_price || 0,
                symbol: "roundRect", symbolSize: [20, 14],
                itemStyle: { color: "#4ecdc4" },
                label: { formatter: "S", color: "#fff", fontSize: 10, fontWeight: "bold" },
              };
            }).filter(Boolean),
          ],
        } : undefined,
      },
      ...(isMin ? [] : [
        { name: "MA5", type: "line", data: maData.ma5, smooth: true, symbol: "none", lineStyle: { color: "#f59e0b", width: 1 } },
        { name: "MA10", type: "line", data: maData.ma10, smooth: true, symbol: "none", lineStyle: { color: "#3b82f6", width: 1 } },
        { name: "MA20", type: "line", data: maData.ma20, smooth: true, symbol: "none", lineStyle: { color: "#a855f7", width: 1 } },
        { name: "MA60", type: "line", data: maData.ma60, smooth: true, symbol: "none", lineStyle: { color: "#ec4899", width: 1 } },
      ]),
    ],
  };

  const volumeOption = {
    tooltip: { trigger: "axis" },
    grid: { left: 70, right: 60, top: 5, bottom: 0 },
    xAxis: { type: "category", data: dates, axisLabel: { show: false }, axisLine: { show: false }, axisTick: { show: false } },
    yAxis: { type: "value", axisLabel: { color: "#9ca3af" }, splitLine: { lineStyle: { color: "#1f2937" } } },
    dataZoom: [
      { type: "inside", start: dates.length > 120 ? Math.max(0, 100 * (1 - 120 / dates.length)) : 0, end: 100 },
    ],
    series: [{
      type: "bar", data: volumes.map((v, i) => ({ value: v, itemStyle: { color: volColors[i] } })),
    }],
  };

  return (
    <div className="space-y-6">
      {/* Search bar */}
      <div className="relative">
        <div className="flex items-center gap-3">
          <input
            className="input-field w-64" placeholder="搜索股票代码或名称..."
            value={searchTerm} onChange={(e) => searchStocks(e.target.value)}
          />
          <div className="flex flex-col gap-1">
            <div className="flex gap-1">
              {(["d", "w", "m"] as Freq[]).map((f) => (
                <button key={f} className={`px-2.5 py-1 rounded text-xs ${freq === f ? "bg-rose-400 text-white shadow-sm" : "bg-[#2a3f5f] text-slate-400 hover:bg-[#34507a]"}`}
                  onClick={() => { setFreq(f); setAutoSource(true); setSourceMode("real"); }}>{FREQ_LABELS[f]}</button>
              ))}
            </div>
            <div className="flex gap-1">
              {(["1", "5", "15", "30", "60"] as Freq[]).map((f) => (
                <button key={f} className={`px-2.5 py-1 rounded text-xs ${freq === f ? "bg-rose-400 text-white shadow-sm" : "bg-[#2a3f5f] text-slate-400 hover:bg-[#34507a]"}`}
                  onClick={() => { setFreq(f); setAutoSource(true); setSourceMode("real"); }}>{FREQ_LABELS[f]}</button>
              ))}
            </div>
          </div>
        </div>
        {searchResults.length > 0 && (
          <div className="absolute z-10 mt-1 w-64 bg-gray-800 border border-gray-700 rounded-lg shadow-lg max-h-60 overflow-y-auto">
            {searchResults.map((s) => (
              <button key={s.code}
                className="w-full text-left px-3 py-2 text-sm hover:bg-gray-700 text-gray-300"
                onClick={() => { navigate(`/stock/${s.code}`); setSearchResults([]); setSearchTerm(""); }}
              >
                <span className="font-mono">{s.code}</span>
                <span className="ml-2">{s.name}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Sync bar — always visible */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs text-gray-600">数据同步:</span>
        <input type="date" className="input-field w-32 text-xs" value={syncStart}
          onChange={(e) => setSyncStart(e.target.value)} title="开始日期" />
        <span className="text-xs text-gray-600">~</span>
        <input type="date" className="input-field w-32 text-xs" value={syncEnd}
          onChange={(e) => setSyncEnd(e.target.value)} title="结束日期" />
        <SyncButton code={code!} freq={freq} startDate={syncStart} endDate={syncEnd}
          onSuccess={() => { profile.refetch(); quotes.refetch(); }} />
        <DataCoverage code={code!} freq={freq} source={sourceMode} onToggleSource={setSourceMode} autoSource={autoSource} onAutoDone={() => setAutoSource(false)} />
      </div>

      {/* Stock Header */}
      {p && (
        <div className="flex items-start gap-8">
          <div>
            <h1 className="text-2xl font-bold text-slate-100">{p.name}</h1>
            <span className="text-sm text-slate-500 font-mono">{p.code}</span>
            {p.industry && <span className="ml-3 text-xs text-slate-500">{p.industry}{p.area ? ` · ${p.area}` : ""}</span>}
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-slate-100">{p.latest_price?.toFixed(2)}</span>
            {p.change_pct != null && (
              <span className={`text-lg font-semibold ${p.change_pct >= 0 ? "text-up" : "text-down"}`}>
                {p.change_pct >= 0 ? "+" : ""}{p.change_pct.toFixed(2)}%
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 ml-auto">
            <button onClick={toggleWatchlist} className={`text-lg px-2 py-1 rounded-full transition-colors ${inWatchlist ? "text-amber-400" : "text-slate-600 hover:text-amber-400"}`} title={inWatchlist ? "取消自选" : "加入自选"}>
              {inWatchlist ? "★" : "☆"}
            </button>
            <button onClick={() => { setPosCost(p.latest_price?.toFixed(2) || ""); setShowPosModal(true); }} className="text-sm px-3 py-1 rounded-full bg-teal-400/15 text-teal-400 border border-teal-400/30 hover:bg-teal-400/25 transition-colors font-medium">
              + 持仓
            </button>
            {totalShares > 0 && (
              <span className="text-xs px-2 py-1 rounded-full bg-rose-400/15 text-rose-400 border border-rose-400/30">
                {totalShares}股 @ ¥{avgCost.toFixed(2)}
                {p.latest_price && avgCost > 0 ? (
                  <span className={`ml-1 font-semibold ${p.latest_price >= avgCost ? "text-up" : "text-down"}`}>
                    {p.latest_price >= avgCost ? "+" : ""}{((p.latest_price - avgCost) / avgCost * 100).toFixed(1)}%
                  </span>
                ) : null}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Position Modal */}
      {showPosModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowPosModal(false)}>
          <div className="card w-80 space-y-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-sm font-bold text-slate-200">添加持仓 — {p?.code}</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-400 mb-1">股数</label>
                <input type="number" className="input-field w-full text-sm" value={posShares} onChange={(e) => setPosShares(e.target.value)} />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">成本价</label>
                <input type="number" step="0.01" className="input-field w-full text-sm" value={posCost} onChange={(e) => setPosCost(e.target.value)} />
              </div>
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">开仓日期</label>
              <input type="date" className="input-field w-full text-sm" value={posDate} onChange={(e) => setPosDate(e.target.value)} />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">备注（可选）</label>
              <input className="input-field w-full text-sm" value={posNotes} onChange={(e) => setPosNotes(e.target.value)} placeholder="如：突破买入" />
            </div>
            <div className="flex gap-2 justify-end">
              <button className="btn-secondary text-sm" onClick={() => setShowPosModal(false)}>取消</button>
              <button className="btn-primary text-sm" onClick={handleAddPosition}>确认开仓</button>
            </div>
            {positions.length > 0 && (
              <div className="border-t border-[#2a3f5f] pt-3">
                <p className="text-xs text-slate-500 mb-2">已有持仓：</p>
                {positions.map((pos: { id: number; shares: number; avg_cost: number; open_date: string | null; close_date: string | null; close_price: number | null; notes: string }) => (
                  <div key={pos.id} className="flex items-center justify-between text-xs py-1.5 border-b border-[#2a3f5f]/50 last:border-0">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-slate-300">
                        {pos.shares}股 @ ¥{pos.avg_cost.toFixed(2)}
                        {pos.open_date && <span className="text-slate-600 ml-1">{pos.open_date}</span>}
                        {pos.notes ? <span className="text-slate-500 ml-1">({pos.notes})</span> : ""}
                      </span>
                      {pos.close_date ? (
                        <span className="text-slate-600">已平仓 {pos.close_date} @ ¥{pos.close_price?.toFixed(2)} {
                          pos.close_price && pos.avg_cost ? (
                            <span className={pos.close_price >= pos.avg_cost ? "text-up" : "text-down"}>
                              {pos.close_price >= pos.avg_cost ? "+" : ""}{((pos.close_price - pos.avg_cost) / pos.avg_cost * 100).toFixed(1)}%
                            </span>
                          ) : null
                        }</span>
                      ) : (
                        <span className="text-teal-400">持仓中</span>
                      )}
                    </div>
                    <div className="flex gap-1">
                      {!pos.close_date && (
                        <button className="text-amber-400 hover:text-amber-300 text-xs" onClick={() => handleClosePosition(pos.id)} title="平仓">平仓</button>
                      )}
                      <button className="text-rose-400 hover:text-rose-300 text-xs" onClick={() => handleDeletePosition(pos.id)}>删除</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {profile.isLoading || quotes.isLoading ? <LoadingSpinner /> : null}

      {/* K-line */}
      {ohlc.length > 0 && (
        <section className="card">
          <ReactECharts option={klineOption} style={{ height: 450 }} />
          <ReactECharts option={volumeOption} style={{ height: 120 }} />
        </section>
      )}

      {/* Indicators */}
      {p && (
        <section>
          <h2 className="text-sm font-medium text-gray-400 mb-3">基本面</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <MetricCard label="PE (TTM)" value={p.pe_ratio?.toFixed(2) || "-"} />
            <MetricCard label="PB (MRQ)" value={p.pb_ratio?.toFixed(2) || "-"} />
            <MetricCard label="换手率" value={p.turnover_rate != null ? `${p.turnover_rate.toFixed(2)}%` : "-"} />
            <MetricCard label="成交额" value={p.amount != null ? `${(p.amount / 1e8).toFixed(2)}亿` : "-"} />
            <MetricCard label="成交量" value={p.volume != null ? `${(p.volume / 1e4).toFixed(0)}万手` : "-"} />
            <MetricCard label="上市日期" value={p.list_date || "-"} />
            <MetricCard label="交易所" value={p.exchange === "SH" ? "上海" : p.exchange === "SZ" ? "深圳" : p.exchange || "-"} />
          </div>
        </section>
      )}

      {/* No data state */}
      {!profile.isLoading && (!p || !p.latest_price) && (
        <div className="card text-center py-12 text-gray-500 space-y-4">
          <p>{code ? `股票 ${code} 暂无行情数据，请在顶部设置日期后点击同步按钮` : "搜索股票代码查看详情"}</p>
        </div>
      )}

      {/* No data for current minute frequency */}
      {p && p.latest_price && isMinute(freq) && quotes.data && quotes.data.data.length === 0 && (
        <div className="card text-center py-6 text-gray-500">
          <p>该频率暂无数据，请在顶部同步栏拉取</p>
        </div>
      )}
    </div>
  );
}
