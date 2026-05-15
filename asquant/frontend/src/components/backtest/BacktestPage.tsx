import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import ReactECharts from "echarts-for-react";
import dayjs from "dayjs";
import { fetchBacktestRuns, runBacktest } from "@/api/backtest";
import type { BacktestConfig } from "@/types/backtest";
import { fetchFactorLibrary } from "@/api/factor";
import { useBacktestStore } from "@/stores/backtestStore";
import { LoadingSpinner } from "@/components/common/LoadingSpinner";

export function BacktestPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { config, setConfig, toggleFactor, resetConfig } = useBacktestStore();
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);

  const { data: factors } = useQuery({
    queryKey: ["factor-library"],
    queryFn: fetchFactorLibrary,
  });

  const { data: runsData, isLoading: runsLoading } = useQuery({
    queryKey: ["backtest-runs"],
    queryFn: () => fetchBacktestRuns(1),
  });

  const runMutation = useMutation({
    mutationFn: () => runBacktest({ ...config, name: config.name || `${config.factor_names.join("+")}_${config.weighting}` }),
    onSuccess: (data) => {
      if (data.status === "done") {
        queryClient.invalidateQueries({ queryKey: ["backtest-runs"] });
        navigate(`/report/${data.run_id}`);
      } else if (data.status === "error") {
        setError(data.error || "Backtest failed");
      }
    },
    onError: (e: Error) => setError(e.message),
  });

  const factorNames = factors?.map((f) => f.name) || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-100">组合回测</h1>
        <button className="btn-primary" onClick={() => setShowForm(!showForm)}>
          {showForm ? "隐藏表单" : "+ 新建回测"}
        </button>
      </div>

      {/* Config Form */}
      {showForm && (
        <section className="card space-y-4">
          <h2 className="text-sm font-medium text-gray-400">回测配置</h2>
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
              <label className="block text-xs text-gray-500 mb-1">交易成本 (bps)</label>
              <input type="number" className="input-field w-full text-xs" step={0.0001}
                value={config.transaction_cost} onChange={(e) => setConfig({ transaction_cost: Number(e.target.value) })} />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">滑点 (bps)</label>
              <input type="number" className="input-field w-full text-xs" step={0.0001}
                value={config.slippage} onChange={(e) => setConfig({ slippage: Number(e.target.value) })} />
            </div>
          </div>

          {/* Factor Selection */}
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

          {error && <p className="text-sm text-red-400">{error}</p>}

          <div className="flex gap-3">
            <button className="btn-primary" disabled={runMutation.isPending || config.factor_names.length === 0}
              onClick={() => { setError(""); runMutation.mutate(); }}>
              {runMutation.isPending ? "运行中..." : "运行回测"}
            </button>
            <button className="btn-secondary text-sm" onClick={resetConfig}>重置配置</button>
          </div>
        </section>
      )}

      {/* Run History */}
      <section className="card">
        <h2 className="text-sm font-bold text-slate-400 mb-3 flex items-center gap-2"><span className="w-1 h-4 rounded-full bg-amber-400" />回测历史</h2>
        {runsLoading ? <LoadingSpinner /> :
          runsData?.runs && runsData.runs.length > 0 ? (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-400 border-b border-gray-700">
                  <th className="text-left py-2 px-2">名称</th>
                  <th className="text-left py-2 px-2">区间</th>
                  <th className="text-left py-2 px-2">状态</th>
                  <th className="text-left py-2 px-2">时间</th>
                  <th className="text-right py-2 px-2">操作</th>
                </tr>
              </thead>
              <tbody>
                {runsData.runs.map((run) => (
                  <tr key={run.id} className="border-b border-gray-700/50 hover:bg-gray-800/50 cursor-pointer"
                    onClick={() => navigate(`/report/${run.id}`)}>
                    <td className="py-2 px-2">{run.name}</td>
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
                    <td className="py-2 px-2 text-right">
                      <button className="text-xs text-blue-400 hover:text-blue-300" onClick={(e) => {
                        e.stopPropagation(); navigate(`/report/${run.id}`);
                      }}>查看报告</button>
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
