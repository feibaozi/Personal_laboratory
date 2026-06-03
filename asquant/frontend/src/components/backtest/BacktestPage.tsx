import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import ReactECharts from "echarts-for-react";
import dayjs from "dayjs";
import { fetchBacktestRuns, runBacktest, optimizeBacktest, walkForward, cancelBacktest, deleteBacktest, compareBacktests, createProgressSSE } from "@/api/backtest";
import type { BacktestConfig } from "@/types/backtest";
import { fetchFactorLibrary } from "@/api/factor";
import { fetchStrategies, createStrategy } from "@/api/strategy";
import type { Strategy } from "@/types/strategy";
import { useBacktestStore } from "@/stores/backtestStore";
import { LoadingSpinner } from "@/components/common/LoadingSpinner";

const TABS = ["回测", "参数优化", "Walk Forward"] as const;

export function BacktestPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { config, setConfig, toggleFactor, resetConfig } = useBacktestStore();
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [activeTab, setActiveTab] = useState<string>("回测");

  const [optimizeResult, setOptimizeResult] = useState<any>(null);
  const [wfaResult, setWfaResult] = useState<any>(null);
  const [optLoading, setOptLoading] = useState(false);

  const [paramGridText, setParamGridText] = useState(
    '{\n  "top_n": [20, 30, 50],\n  "weighting": ["equal", "risk_parity"]\n}'
  );
  const [wfaTrain, setWfaTrain] = useState(252);
  const [wfaTest, setWfaTest] = useState(63);
  const [wfaAnchored, setWfaAnchored] = useState(false);
  const [wfaMaxTrials, setWfaMaxTrials] = useState(20);
  const [wfaParamGridText, setWfaParamGridText] = useState(
    '{\n  "top_n": [20, 30, 50],\n  "weighting": ["equal", "risk_parity"]\n}'
  );

  // SSE progress tracking
  const [progress, setProgress] = useState<{ percent: number; step: string; message: string } | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  // Compare mode
  const [selectedRuns, setSelectedRuns] = useState<Set<string>>(new Set());
  const [compareResult, setCompareResult] = useState<any>(null);
  const [showCompare, setShowCompare] = useState(false);

  // Strategy management
  const [selectedStrategyId, setSelectedStrategyId] = useState<number | null>(null);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [saveName, setSaveName] = useState("");
  const [saveDesc, setSaveDesc] = useState("");

  const { data: factors } = useQuery({
    queryKey: ["factor-library"],
    queryFn: fetchFactorLibrary,
  });

  const { data: strategiesData } = useQuery({
    queryKey: ["strategies"],
    queryFn: fetchStrategies,
  });

  const saveStrategyMutation = useMutation({
    mutationFn: () => createStrategy({ name: saveName, description: saveDesc || undefined, config: config as any }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["strategies"] });
      setShowSaveDialog(false);
      setSaveName("");
      setSaveDesc("");
    },
  });

  const { data: runsData, isLoading: runsLoading } = useQuery({
    queryKey: ["backtest-runs"],
    queryFn: () => fetchBacktestRuns(1),
  });

  // Cleanup SSE on unmount
  useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, []);

  const runMutation = useMutation({
    mutationFn: () => runBacktest({ ...config, name: config.name || `${config.factor_names.join("+")}_${config.weighting}` }),
    onSuccess: (data) => {
      if (data.status === "done") {
        queryClient.invalidateQueries({ queryKey: ["backtest-runs"] });
        navigate(`/report/${data.run_id}`);
      } else if (data.status === "error") {
        setError(data.error || "Backtest failed");
      } else if (data.status === "running") {
        // Start SSE progress tracking
        setProgress({ percent: 0, step: "回测已提交", message: "" });
        const es = createProgressSSE(data.run_id);
        eventSourceRef.current = es;
        es.onmessage = (e) => {
          try {
            const data = JSON.parse(e.data);
            setProgress({ percent: data.progress * 100, step: data.step || "", message: data.message || "" });
            if (data.status === "done") {
              es.close();
              eventSourceRef.current = null;
              setProgress(null);
              queryClient.invalidateQueries({ queryKey: ["backtest-runs"] });
              navigate(`/report/${data.run_id}`);
            } else if (data.status === "error" || data.status === "cancelled") {
              es.close();
              eventSourceRef.current = null;
              setProgress(null);
              queryClient.invalidateQueries({ queryKey: ["backtest-runs"] });
            }
          } catch { /* ignore parse errors */ }
        };
        es.onerror = () => {
          es.close();
          eventSourceRef.current = null;
          setProgress(null);
        };
      }
    },
    onError: (e: Error) => setError(e.message),
  });

  const runOptimize = async () => {
    setOptLoading(true);
    setError("");
    try {
      let paramGrid: Record<string, any[]>;
      try {
        paramGrid = JSON.parse(paramGridText);
      } catch {
        setError("参数网格 JSON 格式错误");
        setOptLoading(false);
        return;
      }
      const result = await optimizeBacktest({
        ...config, param_grid: paramGrid, max_trials: 30, objective: "sharpe_ratio",
      });
      setOptimizeResult(result);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setOptLoading(false);
    }
  };

  const runWFA = async () => {
    setOptLoading(true);
    setError("");
    try {
      let paramGrid: Record<string, any[]> | undefined;
      try {
        paramGrid = JSON.parse(wfaParamGridText);
      } catch {
        setError("WFA 参数网格 JSON 格式错误");
        setOptLoading(false);
        return;
      }
      const result = await walkForward({
        ...config, train_window: wfaTrain, test_window: wfaTest,
        objective: "sharpe_ratio", param_grid: paramGrid,
        anchored: wfaAnchored, max_trials_per_window: wfaMaxTrials,
      });
      setWfaResult(result);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setOptLoading(false);
    }
  };

  const handleCancel = async (runId: string) => {
    try {
      await cancelBacktest(runId);
      queryClient.invalidateQueries({ queryKey: ["backtest-runs"] });
    } catch (e: any) {
      setError(e.message);
    }
  };

  const handleDelete = async (runId: string) => {
    try {
      await deleteBacktest(runId);
      queryClient.invalidateQueries({ queryKey: ["backtest-runs"] });
      setSelectedRuns((prev) => { const next = new Set(prev); next.delete(runId); return next; });
    } catch (e: any) {
      setError(e.message);
    }
  };

  const handleCompare = async () => {
    if (selectedRuns.size < 2) return;
    try {
      const result = await compareBacktests(Array.from(selectedRuns));
      setCompareResult(result);
      setShowCompare(true);
    } catch (e: any) {
      setError(e.message);
    }
  };

  const toggleRunSelection = (runId: string) => {
    setSelectedRuns((prev) => {
      const next = new Set(prev);
      if (next.has(runId)) next.delete(runId);
      else next.add(runId);
      return next;
    });
  };

  const factorNames = factors?.map((f) => f.name) || [];
  const isIntraday = config.mode === "intraday";

  const heatmapOption = optimizeResult?.results?.length ? {
    tooltip: {},
    grid: { left: 80, right: 20, top: 20, bottom: 40 },
    xAxis: { type: "category", data: optimizeResult.results.map((r: any) => `T${r.trial}`), axisLabel: { fontSize: 10, color: "#9ca3af" } },
    yAxis: { type: "value", name: "Sharpe", axisLabel: { color: "#9ca3af" } },
    visualMap: { min: -1, max: 3, inRange: { color: ["#ef4444", "#1f2937", "#22c55e"] }, show: false },
    series: [{
      type: "scatter",
      data: optimizeResult.results.map((r: any) => [r.trial, r.score]),
      symbolSize: 20,
    }],
  } : null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-100">组合回测</h1>
        <button className="btn-primary" onClick={() => setShowForm(!showForm)}>
          {showForm ? "隐藏表单" : "+ 新建回测"}
        </button>
      </div>

      {/* SSE Progress Bar */}
      {progress && (
        <div className="card">
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                <div className="h-full bg-blue-500 rounded-full transition-all duration-300" style={{ width: `${progress.percent}%` }} />
              </div>
            </div>
            <span className="text-xs text-gray-400 w-12 text-right">{progress.percent.toFixed(0)}%</span>
          </div>
          <p className="text-xs text-gray-500 mt-1">{progress.step} {progress.message && `— ${progress.message}`}</p>
        </div>
      )}

      {showForm && (
        <section className="card space-y-4">
          {/* Tabs */}
          <div className="flex gap-1 border-b border-gray-700 pb-2">
            {TABS.map((t) => (
              <button
                key={t}
                onClick={() => { setActiveTab(t); setError(""); }}
                className={`px-3 py-1.5 text-xs rounded-t transition-colors ${
                  activeTab === t
                    ? "bg-blue-600/20 text-blue-300 border border-blue-500/50"
                    : "text-gray-500 hover:text-gray-300"
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          {/* Strategy Selector */}
          <div className="flex items-end gap-3">
            <div className="flex-1">
              <label className="block text-xs text-gray-500 mb-1">策略模板</label>
              <select
                className="input-field w-full text-xs"
                value={selectedStrategyId ?? ""}
                onChange={(e) => {
                  const id = e.target.value ? Number(e.target.value) : null;
                  setSelectedStrategyId(id);
                  if (id && strategiesData) {
                    const s = strategiesData.find((st) => st.id === id);
                    if (s?.config) {
                      setConfig({ ...config, ...s.config } as any);
                    }
                  }
                }}
              >
                <option value="">自定义配置</option>
                {strategiesData?.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.category === "preset" ? "★ " : ""}{s.name}
                  </option>
                ))}
              </select>
            </div>
            <button
              className="btn-secondary text-xs whitespace-nowrap"
              onClick={() => {
                setSaveName(config.factor_names.join("+") + "_" + config.weighting);
                setShowSaveDialog(true);
              }}
            >
              保存为策略
            </button>
          </div>

          {/* Save Strategy Dialog */}
          {showSaveDialog && (
            <div className="bg-gray-900/80 border border-gray-700 rounded-lg p-4 space-y-3">
              <div className="text-xs text-gray-300 font-medium">保存当前配置为策略</div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">策略名称</label>
                <input className="input-field w-full text-xs" value={saveName} onChange={(e) => setSaveName(e.target.value)} />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">描述 (可选)</label>
                <input className="input-field w-full text-xs" value={saveDesc} onChange={(e) => setSaveDesc(e.target.value)} />
              </div>
              <div className="flex gap-2">
                <button className="btn-primary text-xs" disabled={!saveName || saveStrategyMutation.isPending} onClick={() => saveStrategyMutation.mutate()}>
                  {saveStrategyMutation.isPending ? "保存中..." : "保存"}
                </button>
                <button className="btn-secondary text-xs" onClick={() => setShowSaveDialog(false)}>取消</button>
              </div>
            </div>
          )}

          {/* Mode Selection */}
          <div>
            <label className="block text-xs text-gray-500 mb-1">回测模式</label>
            <div className="flex gap-2">
              <button
                onClick={() => setConfig({ mode: "daily" })}
                className={`px-3 py-1.5 text-xs rounded transition-colors ${
                  !isIntraday ? "bg-blue-600/20 text-blue-300 border border-blue-500/50" : "bg-gray-800 text-gray-400 border border-gray-700"
                }`}
              >
                日频多因子
              </button>
              <button
                onClick={() => setConfig({ mode: "intraday" })}
                className={`px-3 py-1.5 text-xs rounded transition-colors ${
                  isIntraday ? "bg-blue-600/20 text-blue-300 border border-blue-500/50" : "bg-gray-800 text-gray-400 border border-gray-700"
                }`}
              >
                日内策略
              </button>
            </div>
          </div>

          {/* Shared Config */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs text-gray-500 mb-1">日期范围</label>
              <div className="flex gap-2">
                <input type="date" className="input-field flex-1 text-xs"
                  value={config.start_date} onChange={(e) => setConfig({ start_date: e.target.value })} />
                <input type="date" className="input-field flex-1 text-xs"
                  value={config.end_date} onChange={(e) => setConfig({ end_date: e.target.value })} />
              </div>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">基准指数</label>
              <select className="input-field w-full text-xs" value={config.benchmark}
                onChange={(e) => setConfig({ benchmark: e.target.value })}>
                <option value="000300">沪深300</option>
                <option value="000905">中证500</option>
                <option value="000001">上证指数</option>
                <option value="399006">创业板指</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">初始资金</label>
              <input type="number" className="input-field w-full text-xs"
                value={config.initial_capital} onChange={(e) => setConfig({ initial_capital: Number(e.target.value) })} />
            </div>

            {/* Daily mode specific */}
            {!isIntraday && (
              <>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">持仓数量 (Top N)</label>
                  <input type="number" className="input-field w-full text-xs" min={5} max={100}
                    value={config.top_n} onChange={(e) => setConfig({ top_n: Number(e.target.value) })} />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">调仓频率</label>
                  <select className="input-field w-full text-xs" value={config.rebalance_freq}
                    onChange={(e) => setConfig({ rebalance_freq: e.target.value as "monthly" | "weekly" })}>
                    <option value="monthly">月度</option>
                    <option value="weekly">周度</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">权重方式</label>
                  <select className="input-field w-full text-xs" value={config.weighting}
                    onChange={(e) => setConfig({ weighting: e.target.value as BacktestConfig["weighting"] })}>
                    <option value="equal">等权</option>
                    <option value="risk_parity">风险平价</option>
                    <option value="mean_variance">均值方差</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">仓位管理</label>
                  <select className="input-field w-full text-xs" value={config.position_sizing || "equal"}
                    onChange={(e) => setConfig({ position_sizing: e.target.value as BacktestConfig["position_sizing"] })}>
                    <option value="equal">等权</option>
                    <option value="risk_parity">风险平价</option>
                    <option value="kelly">Kelly</option>
                    <option value="volatility_parity">波动率平价</option>
                    <option value="market_cap">市值加权</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">交易成本 (bps)</label>
                  <input type="number" className="input-field w-full text-xs" step={0.0001}
                    value={config.transaction_cost} onChange={(e) => setConfig({ transaction_cost: Number(e.target.value) })} />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">滑点 (bps)</label>
                  <input type="number" className="input-field w-full text-xs" step={0.0001}
                    value={config.slippage} onChange={(e) => setConfig({ slippage: Number(e.target.value) })} />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">最大回撤熔断 (%)</label>
                  <input type="number" className="input-field w-full text-xs" step={0.01} min={0} max={1}
                    value={config.max_drawdown_limit || 0} onChange={(e) => setConfig({ max_drawdown_limit: Number(e.target.value) })} />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">单日亏损减仓 (%)</label>
                  <input type="number" className="input-field w-full text-xs" step={0.01} min={0} max={1}
                    value={config.daily_loss_limit || 0} onChange={(e) => setConfig({ daily_loss_limit: Number(e.target.value) })} />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">波动率目标</label>
                  <input type="number" className="input-field w-full text-xs" step={0.01} min={0} max={1}
                    value={config.volatility_target || 0} onChange={(e) => setConfig({ volatility_target: Number(e.target.value) })} />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">最小日成交额 (万)</label>
                  <input type="number" className="input-field w-full text-xs" step={100} min={0}
                    value={Math.round((config.min_daily_amount || 5_000_000) / 10000)} onChange={(e) => setConfig({ min_daily_amount: Number(e.target.value) * 10000 })} />
                </div>
              </>
            )}

            {/* Intraday mode specific */}
            {isIntraday && (
              <>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">策略类型</label>
                  <select className="input-field w-full text-xs" value={config.strategy || "intraday_momentum"}
                    onChange={(e) => setConfig({ strategy: e.target.value as BacktestConfig["strategy"] })}>
                    <option value="intraday_momentum">动量策略</option>
                    <option value="mean_reversion">均值回归</option>
                    <option value="breakout">突破策略</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">分钟频率</label>
                  <select className="input-field w-full text-xs" value={config.freq || "5"}
                    onChange={(e) => setConfig({ freq: e.target.value })}>
                    <option value="1">1分钟</option>
                    <option value="5">5分钟</option>
                    <option value="15">15分钟</option>
                    <option value="30">30分钟</option>
                    <option value="60">60分钟</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">回看窗口</label>
                  <input type="number" className="input-field w-full text-xs" min={5} max={120}
                    value={config.lookback || 20} onChange={(e) => setConfig({ lookback: Number(e.target.value) })} />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">持仓时长 (分钟)</label>
                  <input type="number" className="input-field w-full text-xs" min={1} max={240}
                    value={config.hold_period || 10} onChange={(e) => setConfig({ hold_period: Number(e.target.value) })} />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">止损 (%)</label>
                  <input type="number" className="input-field w-full text-xs" step={0.005} min={-0.5} max={0}
                    value={config.stop_loss || -0.02} onChange={(e) => setConfig({ stop_loss: Number(e.target.value) })} />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">止盈 (%)</label>
                  <input type="number" className="input-field w-full text-xs" step={0.005} min={0} max={0.5}
                    value={config.take_profit || 0.03} onChange={(e) => setConfig({ take_profit: Number(e.target.value) })} />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">最大持仓数</label>
                  <input type="number" className="input-field w-full text-xs" min={1} max={20}
                    value={config.max_positions || 5} onChange={(e) => setConfig({ max_positions: Number(e.target.value) })} />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">单仓位比例</label>
                  <input type="number" className="input-field w-full text-xs" step={0.05} min={0.05} max={1}
                    value={config.position_size || 0.2} onChange={(e) => setConfig({ position_size: Number(e.target.value) })} />
                </div>
                <div className="flex items-end">
                  <label className="flex items-center gap-2 cursor-pointer pb-2">
                    <input type="checkbox" className="w-4 h-4 rounded" checked={config.force_close_eod !== false}
                      onChange={(e) => setConfig({ force_close_eod: e.target.checked })} />
                    <span className="text-xs text-gray-400">收盘强制平仓</span>
                  </label>
                </div>
              </>
            )}
          </div>

          {/* Factor Selection (daily mode only) */}
          {!isIntraday && (
            <div>
              <label className="block text-xs text-gray-500 mb-1">
                因子选择 (已选 {config.factor_names.length} 个)
              </label>
              <div className="flex flex-wrap gap-1.5 max-h-[120px] overflow-y-auto">
                {factorNames.map((name) => (
                  <button
                    key={name}
                    onClick={() => toggleFactor(name)}
                    className={`px-2 py-1 rounded text-xs transition-colors ${
                      config.factor_names.includes(name)
                        ? "bg-blue-600/20 text-blue-300 border border-blue-500/50"
                        : "bg-gray-800 text-gray-400 border border-gray-700 hover:border-gray-600"
                    }`}
                  >
                    {name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Tab-specific controls */}
          {activeTab === "参数优化" && (
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">参数网格 (JSON)</label>
                <textarea
                  className="input-field w-full text-xs font-mono h-24"
                  value={paramGridText}
                  onChange={(e) => setParamGridText(e.target.value)}
                />
              </div>
              {optimizeResult && (
                <div className="space-y-3">
                  <div className="bg-blue-600/10 border border-blue-500/30 rounded p-3">
                    <div className="text-xs text-blue-300">最优参数 (Sharpe: {optimizeResult.best?.score})</div>
                    <pre className="text-xs text-gray-300 mt-1">{JSON.stringify(optimizeResult.best?.params, null, 2)}</pre>
                  </div>
                  {heatmapOption && <ReactECharts option={heatmapOption} style={{ height: 200 }} />}
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-gray-500 border-b border-gray-700">
                          <th className="text-left py-1">序号</th>
                          <th className="text-left py-1">参数</th>
                          <th className="text-right py-1">Sharpe</th>
                          <th className="text-right py-1">年化收益</th>
                          <th className="text-right py-1">最大回撤</th>
                        </tr>
                      </thead>
                      <tbody>
                        {optimizeResult.results?.slice(0, 15).map((r: any) => (
                          <tr key={r.trial} className="border-b border-gray-700/50">
                            <td className="py-1">{r.trial}</td>
                            <td className="py-1 font-mono text-[10px]">{JSON.stringify(r.params)}</td>
                            <td className="py-1 text-right">{r.score}</td>
                            <td className="py-1 text-right">{(r.metrics.annual_return * 100).toFixed(2)}%</td>
                            <td className="py-1 text-right text-red-400">{(r.metrics.max_drawdown * 100).toFixed(2)}%</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === "Walk Forward" && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">训练窗口 (天)</label>
                  <input type="number" className="input-field w-full text-xs" value={wfaTrain}
                    onChange={(e) => setWfaTrain(Number(e.target.value))} />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">测试窗口 (天)</label>
                  <input type="number" className="input-field w-full text-xs" value={wfaTest}
                    onChange={(e) => setWfaTest(Number(e.target.value))} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">每窗口最大试验数</label>
                  <input type="number" className="input-field w-full text-xs" value={wfaMaxTrials} min={5} max={100}
                    onChange={(e) => setWfaMaxTrials(Number(e.target.value))} />
                </div>
                <div className="flex items-end">
                  <label className="flex items-center gap-2 cursor-pointer pb-2">
                    <input type="checkbox" className="w-4 h-4 rounded" checked={wfaAnchored}
                      onChange={(e) => setWfaAnchored(e.target.checked)} />
                    <span className="text-xs text-gray-400">Anchored 模式 (训练期从起始固定)</span>
                  </label>
                </div>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">参数网格 (JSON)</label>
                <textarea
                  className="input-field w-full text-xs font-mono h-24"
                  value={wfaParamGridText}
                  onChange={(e) => setWfaParamGridText(e.target.value)}
                />
              </div>
              {wfaResult?.results && (
                <div className="space-y-3">
                  <div className="grid grid-cols-4 gap-2 text-center text-xs">
                    <div className="bg-gray-900 rounded p-2">
                      <div className="text-gray-500">窗口数</div>
                      <div className="text-lg font-bold text-gray-200">{wfaResult.n_windows}</div>
                    </div>
                    <div className="bg-gray-900 rounded p-2">
                      <div className="text-gray-500">平均测试 Sharpe</div>
                      <div className={`text-lg font-bold ${wfaResult.summary.avg_test_sharpe >= 0 ? "text-green-400" : "text-red-400"}`}>
                        {wfaResult.summary.avg_test_sharpe?.toFixed(3)}
                      </div>
                    </div>
                    <div className="bg-gray-900 rounded p-2">
                      <div className="text-gray-500">Overfit Ratio</div>
                      <div className={`text-lg font-bold ${
                        (wfaResult.summary.overfit_ratio ?? 0) > 0.5 ? "text-green-400" :
                        (wfaResult.summary.overfit_ratio ?? 0) > 0 ? "text-yellow-400" : "text-red-400"
                      }`}>
                        {(wfaResult.summary.overfit_ratio ?? 0).toFixed(3)}
                      </div>
                    </div>
                    <div className="bg-gray-900 rounded p-2">
                      <div className="text-gray-500">正 Sharpe 窗口</div>
                      <div className="text-lg font-bold text-green-400">{wfaResult.summary.positive_windows}/{wfaResult.n_windows}</div>
                    </div>
                  </div>

                  {wfaResult.summary.param_stability && Object.keys(wfaResult.summary.param_stability).length > 0 && (
                    <div className="bg-gray-900 rounded p-3">
                      <div className="text-xs text-amber-300 mb-2">参数稳定性分析</div>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                        {Object.entries(wfaResult.summary.param_stability).map(([param, info]: [string, any]) => (
                          <div key={param} className="text-xs">
                            <span className="text-gray-400">{param}:</span>{" "}
                            <span className={info.consistency >= 0.6 ? "text-green-400" : info.consistency >= 0.3 ? "text-yellow-400" : "text-red-400"}>
                              一致性 {(info.consistency * 100).toFixed(0)}%
                            </span>
                            <span className="text-gray-500 ml-1">最常选 {JSON.stringify(info.most_common)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-gray-500 border-b border-gray-700">
                          <th className="text-left py-1">训练期</th>
                          <th className="text-left py-1">测试期</th>
                          <th className="text-left py-1">最优参数</th>
                          <th className="text-right py-1">训练 Sharpe</th>
                          <th className="text-right py-1">测试 Sharpe</th>
                          <th className="text-right py-1">测试收益</th>
                          <th className="text-right py-1">测试回撤</th>
                        </tr>
                      </thead>
                      <tbody>
                        {wfaResult.results.map((w: any, idx: number) => (
                          <tr key={idx} className="border-b border-gray-700/50">
                            <td className="py-1 text-[10px]">{w.train_period}</td>
                            <td className="py-1 text-[10px]">{w.test_period}</td>
                            <td className="py-1 text-[10px] font-mono text-blue-300">{w.best_params ? JSON.stringify(w.best_params) : "-"}</td>
                            <td className="py-1 text-right">{w.train_sharpe?.toFixed(3) ?? "-"}</td>
                            <td className={`py-1 text-right ${w.test_sharpe >= 0 ? "text-green-400" : "text-red-400"}`}>{w.test_sharpe?.toFixed(3) ?? "-"}</td>
                            <td className="py-1 text-right">{(w.test_return * 100).toFixed(2)}%</td>
                            <td className="py-1 text-right text-red-400">{(w.test_drawdown * 100).toFixed(2)}%</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {error && <p className="text-sm text-red-400">{error}</p>}

          <div className="flex gap-3">
            {activeTab === "回测" && (
              <button className="btn-primary" disabled={runMutation.isPending || (!isIntraday && config.factor_names.length === 0)}
                onClick={() => { setError(""); runMutation.mutate(); }}>
                {runMutation.isPending ? "运行中..." : "运行回测"}
              </button>
            )}
            {activeTab === "参数优化" && (
              <button className="btn-primary" disabled={optLoading || config.factor_names.length === 0}
                onClick={runOptimize}>
                {optLoading ? "优化中..." : "开始优化"}
              </button>
            )}
            {activeTab === "Walk Forward" && (
              <button className="btn-primary" disabled={optLoading || config.factor_names.length === 0}
                onClick={runWFA}>
                {optLoading ? "分析中..." : "开始 WFA"}
              </button>
            )}
            <button className="btn-secondary text-sm" onClick={resetConfig}>重置配置</button>
          </div>
        </section>
      )}

      {/* Compare Modal */}
      {showCompare && compareResult && (
        <section className="card">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold text-slate-400 flex items-center gap-2"><span className="w-1 h-4 rounded-full bg-amber-400" />回测对比</h2>
            <button className="text-xs text-gray-500 hover:text-gray-300" onClick={() => setShowCompare(false)}>关闭</button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-gray-500 border-b border-gray-700">
                  <th className="text-left py-1 px-2">名称</th>
                  <th className="text-right py-1 px-2">累计收益</th>
                  <th className="text-right py-1 px-2">年化收益</th>
                  <th className="text-right py-1 px-2">Sharpe</th>
                  <th className="text-right py-1 px-2">最大回撤</th>
                  <th className="text-right py-1 px-2">Alpha</th>
                  <th className="text-right py-1 px-2">胜率</th>
                </tr>
              </thead>
              <tbody>
                {compareResult.runs?.map((r: any) => (
                  <tr key={r.id} className="border-b border-gray-700/50">
                    <td className="py-1.5 px-2 text-gray-200">{r.name}</td>
                    <td className="text-right py-1.5 px-2">{((r.summary?.total_return ?? 0) * 100).toFixed(2)}%</td>
                    <td className="text-right py-1.5 px-2">{((r.summary?.annual_return ?? 0) * 100).toFixed(2)}%</td>
                    <td className="text-right py-1.5 px-2">{(r.summary?.sharpe ?? 0).toFixed(2)}</td>
                    <td className="text-right py-1.5 px-2 text-red-400">{((r.summary?.max_drawdown ?? 0) * 100).toFixed(2)}%</td>
                    <td className="text-right py-1.5 px-2">{((r.summary?.alpha ?? 0) * 100).toFixed(2)}%</td>
                    <td className="text-right py-1.5 px-2">{((r.summary?.win_rate ?? 0) * 100).toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Run History */}
      <section className="card">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold text-slate-400 flex items-center gap-2"><span className="w-1 h-4 rounded-full bg-amber-400" />回测历史</h2>
          {selectedRuns.size >= 2 && (
            <button className="btn-primary text-xs" onClick={handleCompare}>
              对比 ({selectedRuns.size})
            </button>
          )}
        </div>
        {runsLoading ? <LoadingSpinner /> :
          runsData?.runs && runsData.runs.length > 0 ? (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-400 border-b border-gray-700">
                  <th className="py-2 px-2 w-8"></th>
                  <th className="text-left py-2 px-2">名称</th>
                  <th className="text-left py-2 px-2">区间</th>
                  <th className="text-left py-2 px-2">状态</th>
                  <th className="text-left py-2 px-2">时间</th>
                  <th className="text-right py-2 px-2">操作</th>
                </tr>
              </thead>
              <tbody>
                {runsData.runs.map((run) => (
                  <tr key={run.id} className="border-b border-gray-700/50 hover:bg-gray-800/50">
                    <td className="py-2 px-2">
                      <input type="checkbox" className="w-3.5 h-3.5 rounded"
                        checked={selectedRuns.has(run.id)}
                        onChange={() => toggleRunSelection(run.id)} />
                    </td>
                    <td className="py-2 px-2 cursor-pointer" onClick={() => navigate(`/report/${run.id}`)}>{run.name}</td>
                    <td className="py-2 px-2 text-gray-400 text-xs">{run.start_date} ~ {run.end_date}</td>
                    <td className="py-2 px-2">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        run.status === "done" ? "bg-green-600/20 text-green-400" :
                        run.status === "running" ? "bg-blue-600/20 text-blue-400" :
                        run.status === "error" ? "bg-red-600/20 text-red-400" :
                        "bg-gray-700 text-gray-400"
                      }`}>{run.status}</span>
                    </td>
                    <td className="py-2 px-2 text-gray-500 text-xs">
                      {run.started_at ? dayjs(run.started_at).format("MM-DD HH:mm") : "-"}
                    </td>
                    <td className="py-2 px-2 text-right space-x-2">
                      <button className="text-xs text-blue-400 hover:text-blue-300" onClick={() => navigate(`/report/${run.id}`)}>查看</button>
                      {run.status === "running" && (
                        <button className="text-xs text-yellow-400 hover:text-yellow-300" onClick={() => handleCancel(run.id)}>取消</button>
                      )}
                      <button className="text-xs text-red-400 hover:text-red-300" onClick={() => handleDelete(run.id)}>删除</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
        ) : (
          <p className="text-sm text-gray-500">暂无回测记录，点击"新建回测"开始</p>
        )}
      </section>
    </div>
  );
}
