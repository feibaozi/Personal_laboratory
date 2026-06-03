import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createPaperRun, fetchPaperRuns, generatePaperSignal, executeRebalance, fetchPaperPositions, fetchPaperOrders, fetchPaperEquity, updatePaperRun, deletePaperRun } from "@/api/paper";
import { fetchStrategies } from "@/api/strategy";
import type { Strategy } from "@/types/strategy";
import { LoadingSpinner } from "@/components/common/LoadingSpinner";
import type { PaperTradeRun, PaperSignal, PaperPosition, PaperOrderRecord } from "@/types/backtest";
import ReactECharts from "echarts-for-react";
import dayjs from "dayjs";

type TabKey = "signal" | "position" | "orders" | "equity";

export function PaperTradePage() {
  const queryClient = useQueryClient();
  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>("signal");

  // Create dialog state
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [selectedStrategyId, setSelectedStrategyId] = useState<number | null>(null);
  const [customConfig, setCustomConfig] = useState<Record<string, any>>({
    initial_capital: 1_000_000,
    top_n: 30,
    rebalance_freq: "monthly",
    weighting: "equal",
    position_sizing: "equal",
    factor_names: [],
    factor_weights: [],
    benchmark: "000300",
    transaction_cost: 0.0003,
    slippage: 0.001,
  });

  const { data: runs, isLoading: runsLoading } = useQuery({
    queryKey: ["paper-runs"],
    queryFn: async () => {
      const res = await fetchPaperRuns();
      return res.runs;
    },
    refetchInterval: 30000,
  });

  const { data: strategies } = useQuery({
    queryKey: ["strategies"],
    queryFn: fetchStrategies,
  });

  const [signalResult, setSignalResult] = useState<PaperSignal | null>(null);
  const [signalLoading, setSignalLoading] = useState(false);
  const [positions, setPositions] = useState<PaperPosition[]>([]);
  const [totalValue, setTotalValue] = useState(0);
  const [cash, setCash] = useState(0);
  const [orders, setOrders] = useState<PaperOrderRecord[]>([]);

  const { data: equityData } = useQuery({
    queryKey: ["paper-equity", activeRunId],
    queryFn: () => fetchPaperEquity(activeRunId!),
    enabled: !!activeRunId && activeTab === "equity",
  });

  const createRun = useMutation({
    mutationFn: () => {
      const config = selectedStrategyId && strategies
        ? { ...(strategies.find((s) => s.id === selectedStrategyId)?.config || {}), ...customConfig }
        : customConfig;
      return createPaperRun({ ...config, name: `Paper ${dayjs().format("MM-DD HH:mm")}` });
    },
    onSuccess: (data) => {
      setActiveRunId(data.run_id);
      setShowCreateDialog(false);
      queryClient.invalidateQueries({ queryKey: ["paper-runs"] });
    },
  });

  const genSignal = async () => {
    if (!activeRunId) return;
    setSignalLoading(true);
    try {
      const result = await generatePaperSignal(activeRunId);
      setSignalResult(result);
    } catch {
      setSignalResult(null);
    } finally {
      setSignalLoading(false);
    }
  };

  const doExecute = async () => {
    if (!activeRunId) return;
    await executeRebalance(activeRunId);
    loadPositions();
    loadOrders();
    queryClient.invalidateQueries({ queryKey: ["paper-runs"] });
    queryClient.invalidateQueries({ queryKey: ["paper-equity"] });
  };

  const loadPositions = async () => {
    if (!activeRunId) return;
    const result = await fetchPaperPositions(activeRunId);
    setPositions(result.positions || []);
    setTotalValue(result.total_value);
    setCash(result.cash);
  };

  const loadOrders = async () => {
    if (!activeRunId) return;
    const res = await fetchPaperOrders(activeRunId);
    setOrders(res.orders);
  };

  const handleStatusChange = async (runId: string, newStatus: string) => {
    await updatePaperRun(runId, { status: newStatus });
    queryClient.invalidateQueries({ queryKey: ["paper-runs"] });
  };

  const handleDelete = async (runId: string) => {
    await deletePaperRun(runId);
    if (activeRunId === runId) setActiveRunId(null);
    queryClient.invalidateQueries({ queryKey: ["paper-runs"] });
  };

  const activeRun = runs?.find((r) => r.id === activeRunId);

  // Overview stats
  const totalRuns = runs?.length || 0;
  const activeRuns = runs?.filter((r) => r.status === "active").length || 0;
  const bestReturn = runs?.length ? Math.max(...runs.map((r) => r.total_return)) : 0;
  const totalPortfolioValue = runs?.reduce((sum, r) => sum + (r.current_value || 0), 0) || 0;

  // Equity chart
  const equityItems = equityData?.equity || [];
  const equityOption = equityItems.length > 0 ? {
    tooltip: { trigger: "axis" },
    legend: { data: ["总净值", "现金"], textStyle: { color: "#9ca3af" } },
    grid: { left: 60, right: 20, top: 30, bottom: 30 },
    xAxis: { type: "category", data: equityItems.map((e) => e.date.slice(0, 10)), axisLabel: { color: "#9ca3af" } },
    yAxis: { type: "value", axisLabel: { color: "#9ca3af" } },
    series: [
      { name: "总净值", type: "line", data: equityItems.map((e) => e.total_value), smooth: true, lineStyle: { color: "#3b82f6" }, symbol: "none", areaStyle: { color: "rgba(59,130,246,0.1)" } },
      { name: "现金", type: "line", data: equityItems.map((e) => e.cash), smooth: true, lineStyle: { color: "#f59e0b", type: "dashed" }, symbol: "none" },
    ],
  } : null;

  // Drawdown chart
  const ddData = equityItems.length > 1 ? equityItems.map((_, i) => {
    const peak = Math.max(...equityItems.slice(0, i + 1).map((e) => e.total_value));
    return peak > 0 ? ((equityItems[i].total_value / peak - 1) * 100) : 0;
  }) : [];
  const ddOption = ddData.length > 0 ? {
    tooltip: { trigger: "axis", valueFormatter: (v: number) => `${v.toFixed(2)}%` },
    grid: { left: 50, right: 20, top: 10, bottom: 30 },
    xAxis: { type: "category", data: equityItems.map((e) => e.date.slice(0, 10)), axisLabel: { color: "#9ca3af" } },
    yAxis: { type: "value", axisLabel: { color: "#9ca3af", formatter: "{v}%" } },
    series: [{
      type: "line", data: ddData, areaStyle: { color: "rgba(239,68,68,0.4)" },
      lineStyle: { color: "#ef4444", width: 1 }, symbol: "none",
    }],
  } : null;

  if (runsLoading) return <LoadingSpinner text="加载模拟盘..." />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-100">模拟交易</h1>
        <button className="btn-primary text-sm" onClick={() => setShowCreateDialog(true)}>
          + 创建模拟盘
        </button>
      </div>

      {/* Create Dialog */}
      {showCreateDialog && (
        <section className="card space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium text-gray-300">创建模拟盘</h2>
            <button className="text-xs text-gray-500 hover:text-gray-300" onClick={() => setShowCreateDialog(false)}>取消</button>
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1">选择策略模板</label>
            <select
              className="input-field w-full text-xs"
              value={selectedStrategyId ?? ""}
              onChange={(e) => {
                const id = e.target.value ? Number(e.target.value) : null;
                setSelectedStrategyId(id);
                if (id && strategies) {
                  const s = strategies.find((st) => st.id === id);
                  if (s?.config) {
                    setCustomConfig((prev) => ({ ...prev, ...s.config }));
                  }
                }
              }}
            >
              <option value="">自定义配置</option>
              {strategies?.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.category === "preset" ? "★ " : ""}{s.name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">初始资金</label>
              <input type="number" className="input-field w-full text-xs"
                value={customConfig.initial_capital}
                onChange={(e) => setCustomConfig({ ...customConfig, initial_capital: Number(e.target.value) })} />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">持仓数量</label>
              <input type="number" className="input-field w-full text-xs"
                value={customConfig.top_n}
                onChange={(e) => setCustomConfig({ ...customConfig, top_n: Number(e.target.value) })} />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">调仓频率</label>
              <select className="input-field w-full text-xs"
                value={customConfig.rebalance_freq}
                onChange={(e) => setCustomConfig({ ...customConfig, rebalance_freq: e.target.value })}>
                <option value="monthly">月度</option>
                <option value="weekly">周度</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">权重方式</label>
              <select className="input-field w-full text-xs"
                value={customConfig.weighting}
                onChange={(e) => setCustomConfig({ ...customConfig, weighting: e.target.value })}>
                <option value="equal">等权</option>
                <option value="risk_parity">风险平价</option>
                <option value="mean_variance">均值方差</option>
              </select>
            </div>
          </div>

          <button className="btn-primary text-sm" disabled={createRun.isPending} onClick={() => createRun.mutate()}>
            {createRun.isPending ? "创建中..." : "确认创建"}
          </button>
        </section>
      )}

      {/* Overview Cards */}
      {runs && runs.length > 0 && (
        <div className="grid grid-cols-4 gap-3">
          <div className="card py-3 px-4">
            <div className="text-xs text-gray-500">总模拟盘</div>
            <div className="text-xl font-bold text-gray-200">{totalRuns}</div>
          </div>
          <div className="card py-3 px-4">
            <div className="text-xs text-gray-500">活跃</div>
            <div className="text-xl font-bold text-green-400">{activeRuns}</div>
          </div>
          <div className="card py-3 px-4">
            <div className="text-xs text-gray-500">最佳收益率</div>
            <div className={`text-xl font-bold ${bestReturn >= 0 ? "text-red-400" : "text-green-400"}`}>
              {(bestReturn * 100).toFixed(2)}%
            </div>
          </div>
          <div className="card py-3 px-4">
            <div className="text-xs text-gray-500">总持仓市值</div>
            <div className="text-xl font-bold text-gray-200">{totalPortfolioValue.toLocaleString()}</div>
          </div>
        </div>
      )}

      {runs && runs.length > 0 && (
        <div className="flex gap-2 overflow-x-auto">
          {runs.map((r) => (
            <div key={r.id} className="relative">
              <button
                className={`px-4 py-2 rounded-lg text-sm transition-colors ${
                  activeRunId === r.id ? "bg-blue-600 text-white" : "bg-gray-800 text-gray-400 hover:bg-gray-700"
                }`}
                onClick={() => {
                  setActiveRunId(r.id);
                  setSignalResult(null);
                }}
              >
                <div className="font-medium">{r.name}</div>
                <div className="text-xs mt-0.5">
                  收益率:{" "}
                  <span className={r.total_return >= 0 ? "text-red-400" : "text-green-400"}>
                    {(r.total_return * 100).toFixed(2)}%
                  </span>
                  <span className={`ml-2 px-1.5 py-0.5 rounded text-[10px] ${
                    r.status === "active" ? "bg-green-900 text-green-400" :
                    r.status === "paused" ? "bg-yellow-900 text-yellow-400" :
                    "bg-gray-700 text-gray-400"
                  }`}>{r.status}</span>
                </div>
              </button>
              <button
                className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-600 text-white text-[10px] flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity"
                onClick={(e) => { e.stopPropagation(); handleDelete(r.id); }}
                title="删除"
              >x</button>
            </div>
          ))}
        </div>
      )}

      {!activeRunId && !runs?.length && (
        <div className="card text-center py-12 text-gray-500">暂无模拟盘，点击"创建模拟盘"开始</div>
      )}

      {activeRunId && activeRun && (
        <>
          {/* Status controls */}
          <div className="flex gap-2 items-center">
            {activeRun.status === "active" && (
              <button className="btn-secondary text-xs" onClick={() => handleStatusChange(activeRunId!, "paused")}>暂停</button>
            )}
            {activeRun.status === "paused" && (
              <button className="btn-primary text-xs" onClick={() => handleStatusChange(activeRunId!, "active")}>恢复</button>
            )}
            {activeRun.status !== "closed" && (
              <button className="text-xs text-red-400 hover:text-red-300" onClick={() => handleStatusChange(activeRunId!, "closed")}>关闭</button>
            )}
          </div>

          <div className="flex gap-1 bg-gray-800 rounded-lg p-1 w-fit">
            {(["signal", "position", "orders", "equity"] as const).map((tab) => (
              <button
                key={tab}
                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  activeTab === tab ? "bg-blue-600 text-white shadow" : "text-gray-400 hover:text-gray-200"
                }`}
                onClick={() => {
                  setActiveTab(tab);
                  if (tab === "position") loadPositions();
                  if (tab === "orders") loadOrders();
                }}
              >
                {tab === "signal" ? "信号看板" : tab === "position" ? "持仓监控" : tab === "orders" ? "订单历史" : "净值曲线"}
              </button>
            ))}
          </div>

          {activeTab === "signal" && (
            <section className="card space-y-4">
              <div className="flex items-center gap-3">
                <button className="btn-primary text-sm" onClick={genSignal} disabled={signalLoading}>
                  {signalLoading ? "生成中..." : "生成今日信号"}
                </button>
                {signalResult?.signals && signalResult.signals.length > 0 && (
                  <button className="btn-secondary text-sm" onClick={doExecute}>
                    执行调仓
                  </button>
                )}
                {signalResult?.error && <span className="text-sm text-amber-400">{signalResult.error}</span>}
              </div>

              {signalResult?.signals && signalResult.signals.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-gray-500 border-b border-gray-700">
                        <th className="text-left py-2 px-3">排名</th>
                        <th className="text-left py-2 px-3">代码</th>
                        <th className="text-left py-2 px-3">名称</th>
                        <th className="text-right py-2 px-3">目标权重</th>
                        <th className="text-right py-2 px-3">因子得分</th>
                        <th className="text-right py-2 px-3">收盘价</th>
                      </tr>
                    </thead>
                    <tbody>
                      {signalResult.signals.map((s, i) => (
                        <tr key={s.stock_code} className="border-b border-gray-700/50 hover:bg-gray-800/50">
                          <td className="py-2 px-3 text-gray-500">{i + 1}</td>
                          <td className="py-2 px-3 font-mono text-blue-300">{s.stock_code}</td>
                          <td className="py-2 px-3 text-gray-300">{(s as any).stock_name || ""}</td>
                          <td className="py-2 px-3 text-right">{(s.target_weight * 100).toFixed(2)}%</td>
                          <td className="py-2 px-3 text-right font-mono">{s.factor_score.toFixed(2)}</td>
                          <td className="py-2 px-3 text-right">{s.close.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          )}

          {activeTab === "position" && (
            <section className="card space-y-4">
              <div className="grid grid-cols-3 gap-4 mb-4">
                <div className="bg-gray-900 rounded p-3">
                  <div className="text-gray-500 text-xs">总市值</div>
                  <div className="text-xl font-bold text-gray-200">{totalValue.toLocaleString()}</div>
                </div>
                <div className="bg-gray-900 rounded p-3">
                  <div className="text-gray-500 text-xs">现金</div>
                  <div className="text-xl font-bold text-gray-200">{cash.toLocaleString()}</div>
                </div>
                <div className="bg-gray-900 rounded p-3">
                  <div className="text-gray-500 text-xs">持仓数</div>
                  <div className="text-xl font-bold text-gray-200">{positions.length}</div>
                </div>
              </div>

              {positions.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-gray-500 border-b border-gray-700">
                        <th className="text-left py-2 px-3">代码</th>
                        <th className="text-left py-2 px-3">名称</th>
                        <th className="text-right py-2 px-3">持仓</th>
                        <th className="text-right py-2 px-3">均价</th>
                        <th className="text-right py-2 px-3">市值</th>
                        <th className="text-right py-2 px-3">权重</th>
                        <th className="text-right py-2 px-3">盈亏</th>
                      </tr>
                    </thead>
                    <tbody>
                      {positions.map((p) => (
                        <tr key={p.stock_code} className="border-b border-gray-700/50">
                          <td className="py-2 px-3 font-mono text-blue-300">{p.stock_code}</td>
                          <td className="py-2 px-3 text-gray-300">{(p as any).stock_name || ""}</td>
                          <td className="py-2 px-3 text-right">{p.shares.toLocaleString()}</td>
                          <td className="py-2 px-3 text-right">{p.avg_cost.toFixed(2)}</td>
                          <td className="py-2 px-3 text-right">{p.market_value.toLocaleString()}</td>
                          <td className="py-2 px-3 text-right">{(p.weight * 100).toFixed(1)}%</td>
                          <td className={`py-2 px-3 text-right ${p.unrealized_pnl >= 0 ? "text-red-400" : "text-green-400"}`}>
                            {p.unrealized_pnl.toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-gray-500 text-sm">暂无持仓</p>
              )}
            </section>
          )}

          {activeTab === "orders" && (
            <section className="card">
              {orders.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-gray-500 border-b border-gray-700">
                        <th className="text-left py-2 px-3">日期</th>
                        <th className="text-left py-2 px-3">代码</th>
                        <th className="text-left py-2 px-3">名称</th>
                        <th className="text-left py-2 px-3">方向</th>
                        <th className="text-right py-2 px-3">信号价</th>
                        <th className="text-right py-2 px-3">委托</th>
                        <th className="text-right py-2 px-3">成交价</th>
                        <th className="text-right py-2 px-3">成交</th>
                        <th className="text-center py-2 px-3">状态</th>
                        <th className="text-left py-2 px-3">原因</th>
                      </tr>
                    </thead>
                    <tbody>
                      {orders.map((o) => (
                        <tr key={o.id} className="border-b border-gray-700/50 hover:bg-gray-800/50">
                          <td className="py-2 px-3 text-xs">{o.trade_date}</td>
                          <td className="py-2 px-3 font-mono text-blue-300">{o.stock_code}</td>
                          <td className="py-2 px-3 text-gray-300">{(o as any).stock_name || ""}</td>
                          <td className={`py-2 px-3 ${o.direction === "buy" ? "text-red-400" : "text-green-400"}`}>
                            {o.direction === "buy" ? "买入" : "卖出"}
                          </td>
                          <td className="py-2 px-3 text-right">{o.signal_price?.toFixed(2) || "-"}</td>
                          <td className="py-2 px-3 text-right">{o.order_shares.toLocaleString()}</td>
                          <td className="py-2 px-3 text-right">{o.fill_price?.toFixed(2) || "-"}</td>
                          <td className="py-2 px-3 text-right">{o.fill_shares?.toLocaleString() || "-"}</td>
                          <td className="py-2 px-3 text-center">
                            <span className={`px-2 py-0.5 rounded text-xs ${
                              o.status === "filled" ? "bg-green-900 text-green-400" :
                              o.status === "pending" ? "bg-yellow-900 text-yellow-400" :
                              o.status === "rejected" ? "bg-red-900 text-red-400" :
                              "bg-gray-700 text-gray-400"
                            }`}>{o.status}</span>
                          </td>
                          <td className="py-2 px-3 text-xs text-gray-500">{(o as any).reject_reason || ""}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-gray-500 text-sm">暂无订单</p>
              )}
            </section>
          )}

          {activeTab === "equity" && (
            <section className="card space-y-4">
              {equityItems.length > 0 ? (
                <>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="bg-gray-900 rounded p-3">
                      <div className="text-gray-500 text-xs">最新净值</div>
                      <div className="text-xl font-bold text-gray-200">{equityItems[equityItems.length - 1].total_value.toLocaleString()}</div>
                    </div>
                    <div className="bg-gray-900 rounded p-3">
                      <div className="text-gray-500 text-xs">累计收益</div>
                      <div className={`text-xl font-bold ${activeRun.total_return >= 0 ? "text-red-400" : "text-green-400"}`}>
                        {(activeRun.total_return * 100).toFixed(2)}%
                      </div>
                    </div>
                    <div className="bg-gray-900 rounded p-3">
                      <div className="text-gray-500 text-xs">记录天数</div>
                      <div className="text-xl font-bold text-gray-200">{equityItems.length}</div>
                    </div>
                  </div>
                  {equityOption && <ReactECharts option={equityOption} style={{ height: 300 }} />}
                  {ddOption && (
                    <>
                      <h3 className="text-xs text-gray-500">回撤曲线</h3>
                      <ReactECharts option={ddOption} style={{ height: 180 }} />
                    </>
                  )}
                </>
              ) : (
                <p className="text-gray-500 text-sm">暂无净值数据，执行调仓后将自动记录</p>
              )}
            </section>
          )}
        </>
      )}
    </div>
  );
}
