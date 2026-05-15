import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import ReactECharts from "echarts-for-react";
import { fetchFactorLibrary, computeFactorIC, computeFactorCorrelation, screenStocks } from "@/api/factor";
import { useFactorStore } from "@/stores/factorStore";
import { LoadingSpinner } from "@/components/common/LoadingSpinner";
import type { FactorDef, ICResult } from "@/types/factor";
import dayjs from "dayjs";

const CATEGORY_LABELS: Record<string, string> = {
  value: "估值", growth: "成长", momentum: "动量",
  quality: "质量", volatility: "波动", size: "规模",
};

export function FactorPage() {
  const { data: factors, isLoading } = useQuery({
    queryKey: ["factor-library"],
    queryFn: fetchFactorLibrary,
  });
  const { selectedFactors, toggleFactor, clearSelection } = useFactorStore();

  const [analysisFactor, setAnalysisFactor] = useState<FactorDef | null>(null);
  const [icResult, setIcResult] = useState<ICResult | null>(null);
  const [icLoading, setIcLoading] = useState(false);
  const [corrMatrix, setCorrMatrix] = useState<number[][] | null>(null);
  const [corrNames, setCorrNames] = useState<string[]>([]);
  const [screenResults, setScreenResults] = useState<{ code: string; name: string; composite_score: number }[]>([]);
  const [screenDate, setScreenDate] = useState(dayjs().format("YYYY-MM-DD"));
  const [screenLoading, setScreenLoading] = useState(false);

  const runIC = async (f: FactorDef) => {
    setAnalysisFactor(f);
    setIcLoading(true);
    try {
      const end = dayjs().format("YYYY-MM-DD");
      const start = dayjs().subtract(1, "year").format("YYYY-MM-DD");
      const result = await computeFactorIC(f.name, start, end, "monthly");
      setIcResult(result);
    } catch { setIcResult(null); }
    finally { setIcLoading(false); }
  };

  const runCorrelation = async () => {
    if (selectedFactors.length < 2) return;
    const names = selectedFactors.map((f) => f.name);
    try {
      const result = await computeFactorCorrelation(names, dayjs().format("YYYY-MM-DD"));
      setCorrMatrix(result.correlation_matrix);
      setCorrNames(result.factor_names);
    } catch { setCorrMatrix(null); }
  };

  const runScreen = async () => {
    if (selectedFactors.length === 0) return;
    setScreenLoading(true);
    try {
      const conditions = selectedFactors.map((f) => ({
        factor_name: f.name, direction: "positive",
      }));
      const result = await screenStocks(conditions, screenDate, 20);
      setScreenResults(result.results);
    } catch { setScreenResults([]); }
    finally { setScreenLoading(false); }
  };

  if (isLoading) return <LoadingSpinner text="加载因子库..." />;

  const grouped: Record<string, FactorDef[]> = {};
  factors?.forEach((f) => {
    const cat = f.category || "other";
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(f);
  });

  const selectedSet = new Set(selectedFactors.map((f) => f.id));

  // IC chart options
  const icOption = icResult ? {
    tooltip: { trigger: "axis" },
    legend: { data: ["Pearson IC", "Spearman IC"], textStyle: { color: "#9ca3af" } },
    grid: { left: 50, right: 20, top: 40, bottom: 30 },
    xAxis: { type: "category", data: icResult.ic_series.map((s) => s.date.slice(0, 10)), axisLabel: { color: "#9ca3af" } },
    yAxis: { type: "value", axisLabel: { color: "#9ca3af" } },
    series: [
      {
        name: "Pearson IC", type: "bar",
        data: icResult.ic_series.map((s) => ({ value: s.ic_pearson,
          itemStyle: { color: s.ic_pearson >= 0 ? "#ef4444" : "#22c55e" } })),
      },
      {
        name: "Spearman IC", type: "line",
        data: icResult.ic_series.map((s) => s.ic_spearman),
        lineStyle: { color: "#3b82f6" }, symbol: "circle", symbolSize: 6,
      },
    ],
  } : null;

  const quantileOption = icResult?.quantile_returns?.length ? {
    tooltip: { trigger: "axis" },
    grid: { left: 50, right: 20, top: 20, bottom: 30 },
    xAxis: { type: "category", data: icResult.quantile_returns.map((q) => `Q${q.quantile}`), axisLabel: { color: "#9ca3af" } },
    yAxis: { type: "value", name: "平均收益%", axisLabel: { color: "#9ca3af", formatter: "{v}%" } },
    series: [{
      type: "bar", data: icResult.quantile_returns.map((q, i) => ({
        value: q.avg_return * 100,
        itemStyle: { color: i === 0 || i === 4 ? "#3b82f6" : "#6b7280" },
      })),
    }],
  } : null;

  const corrOption = corrMatrix ? {
    tooltip: {},
    grid: { left: 100, right: 20, top: 20, bottom: 50 },
    xAxis: { type: "category", data: corrNames, axisLabel: { color: "#9ca3af", rotate: 30 } },
    yAxis: { type: "category", data: corrNames, axisLabel: { color: "#9ca3af" } },
    visualMap: { min: -1, max: 1, inRange: { color: ["#22c55e", "#1f2937", "#ef4444"] } },
    series: [{
      type: "heatmap", data: corrMatrix.flatMap((row, i) =>
        row.map((v, j) => [j, i, v])),
      label: { show: true, formatter: (p: { value: number[] }) => p.value[2].toFixed(2) },
    }],
  } : null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-100">因子研究</h1>
        <button className="btn-secondary text-sm" onClick={clearSelection}>
          清除选择 ({selectedFactors.length})
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Factor Library */}
        <div>
          <h2 className="text-sm font-bold text-slate-400 mb-3 flex items-center gap-2"><span className="w-1 h-4 rounded-full bg-rose-400" />因子库</h2>
          <div className="space-y-3 max-h-[600px] overflow-y-auto">
            {Object.entries(grouped).map(([cat, fList]) => (
              <div key={cat}>
                <h3 className="text-xs text-gray-500 mb-1.5">{CATEGORY_LABELS[cat] || cat}</h3>
                <div className="grid grid-cols-2 gap-1.5">
                  {fList.map((f) => (
                    <button
                      key={f.id}
                      onClick={() => toggleFactor(f)}
                      onDoubleClick={() => runIC(f)}
                      className={`p-2 rounded text-left text-xs transition-colors ${
                        selectedSet.has(f.id)
                          ? "border border-blue-500 bg-blue-600/10 text-blue-300"
                          : "border border-gray-700/50 bg-gray-800/50 text-gray-400 hover:border-gray-600"
                      }`}
                      title="单击选择 | 双击分析"
                    >
                      <div className="font-medium truncate">{f.name}</div>
                      <div className="text-gray-600 text-[10px] truncate">{f.category}</div>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Analysis Panel */}
        <div className="lg:col-span-2 space-y-6">
          {/* IC Analysis */}
          <section className="card">
            <h2 className="text-sm font-bold text-slate-400 mb-3 flex items-center gap-2"><span className="w-1 h-4 rounded-full bg-rose-400" />
              IC 分析 {analysisFactor && `— ${analysisFactor.name}`}
              {icLoading && <span className="ml-2 text-xs text-blue-400">分析中...</span>}
            </h2>
            {icResult ? (
              <div className="space-y-4">
                <div className="grid grid-cols-5 gap-2 text-center text-xs">
                  <div className="bg-gray-900 rounded p-2">
                    <div className="text-gray-500">IC 均值</div>
                    <div className={`text-lg font-bold ${icResult.ic_summary.ic_mean >= 0 ? "text-up" : "text-down"}`}>
                      {icResult.ic_summary.ic_mean?.toFixed(4)}
                    </div>
                  </div>
                  <div className="bg-gray-900 rounded p-2">
                    <div className="text-gray-500">IC 标准差</div>
                    <div className="text-lg font-bold text-gray-200">{icResult.ic_summary.ic_std?.toFixed(4)}</div>
                  </div>
                  <div className="bg-gray-900 rounded p-2">
                    <div className="text-gray-500">ICIR</div>
                    <div className="text-lg font-bold text-blue-400">{icResult.ic_summary.icir?.toFixed(4)}</div>
                  </div>
                  <div className="bg-gray-900 rounded p-2">
                    <div className="text-gray-500">胜率</div>
                    <div className="text-lg font-bold text-gray-200">{((icResult.ic_summary.ic_win_rate || 0) * 100).toFixed(0)}%</div>
                  </div>
                  <div className="bg-gray-900 rounded p-2">
                    <div className="text-gray-500">IC t-stat</div>
                    <div className="text-lg font-bold text-gray-200">{icResult.ic_summary.ic_t_stat?.toFixed(2)}</div>
                  </div>
                </div>
                <ReactECharts option={icOption} style={{ height: 260 }} />
                {quantileOption && (
                  <>
                    <h3 className="text-xs font-medium text-gray-400">分组收益（月均）</h3>
                    <ReactECharts option={quantileOption} style={{ height: 200 }} />
                  </>
                )}
              </div>
            ) : (
              <p className="text-sm text-gray-500">
                {icLoading ? "计算中..." : "双击因子库中的因子开始IC分析"}
              </p>
            )}
          </section>

          {/* Correlation */}
          <section className="card">
            <h2 className="text-sm font-bold text-slate-400 mb-3 flex items-center gap-2"><span className="w-1 h-4 rounded-full bg-rose-400" />
              因子相关性
              <button
                className="ml-3 btn-primary text-xs"
                disabled={selectedFactors.length < 2}
                onClick={runCorrelation}
              >
                计算相关性
              </button>
            </h2>
            {corrMatrix ? (
              <ReactECharts option={corrOption} style={{ height: 280 }} />
            ) : (
              <p className="text-sm text-gray-500">选择2个以上因子后点击计算</p>
            )}
          </section>

          {/* Screening */}
          <section className="card">
            <h2 className="text-sm font-bold text-slate-400 mb-3 flex items-center gap-2"><span className="w-1 h-4 rounded-full bg-rose-400" />
              条件筛选
              <span className="ml-3 space-x-2">
                <input type="date" className="input-field w-36 text-xs" value={screenDate} onChange={(e) => setScreenDate(e.target.value)} />
                <button
                  className="btn-primary text-xs"
                  disabled={screenLoading || selectedFactors.length === 0}
                  onClick={runScreen}
                >
                  {screenLoading ? "筛选中..." : "开始筛选"}
                </button>
              </span>
            </h2>
            {screenResults.length > 0 ? (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-gray-400 border-b border-gray-700">
                    <th className="text-left py-2">排名</th>
                    <th className="text-left py-2">代码</th>
                    <th className="text-left py-2">名称</th>
                    <th className="text-right py-2">综合得分</th>
                  </tr>
                </thead>
                <tbody>
                  {screenResults.map((r, i) => (
                    <tr key={r.code} className="border-b border-gray-700/50">
                      <td className="py-1.5 text-gray-500">{i + 1}</td>
                      <td className="py-1.5 font-mono">{r.code}</td>
                      <td className="py-1.5">{r.name}</td>
                      <td className="py-1.5 text-right font-mono">{r.composite_score}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="text-sm text-gray-500">
                选择至少1个因子，点击"开始筛选"查看排名前20的股票
              </p>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
