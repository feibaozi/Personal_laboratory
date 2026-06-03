import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import ReactECharts from "echarts-for-react";
import { fetchFactorLibrary, runICAnalysis, runDecileAnalysis, screenStocks, fetchFactorCorrelationMatrix, fetchLatestTradeDate, runBatchICAnalysis, findRedundantFactors } from "@/api/factor";
import type { BatchICResult } from "@/api/factor";
import { useFactorStore } from "@/stores/factorStore";
import { LoadingSpinner } from "@/components/common/LoadingSpinner";
import { FactorKnowledge } from "@/components/factor/FactorKnowledge";
import type { FactorDef, ICAnalysis, DecileAnalysis } from "@/types/factor";
import dayjs from "dayjs";

const CATEGORY_LABELS: Record<string, string> = {
  value: "估值", growth: "成长", momentum: "动量",
  quality: "质量", volatility: "波动率", size: "规模",
  microstructure: "微结构", technical: "技术指标",
  short_term: "短期反转", trend: "趋势突破", risk: "风险尾部", sentiment: "情绪资金",
};

export function FactorPage() {
  const { data: factors, isLoading } = useQuery({
    queryKey: ["factor-library"],
    queryFn: fetchFactorLibrary,
  });
  const { selectedFactors, toggleFactor, clearSelection } = useFactorStore();

  const [analysisFactor, setAnalysisFactor] = useState<FactorDef | null>(null);
  const [icResult, setIcResult] = useState<ICAnalysis | null>(null);
  const [decileResult, setDecileResult] = useState<DecileAnalysis | null>(null);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [corrMatrix, setCorrMatrix] = useState<number[][] | null>(null);
  const [corrNames, setCorrNames] = useState<string[]>([]);
  const [screenResults, setScreenResults] = useState<{ code: string; name: string; composite_score: number }[]>([]);
  const [screenDate, setScreenDate] = useState("");
  const [screenLoading, setScreenLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"analysis" | "knowledge" | "ranking">("analysis");
  const [batchICResults, setBatchICResults] = useState<BatchICResult[]>([]);
  const [batchLoading, setBatchLoading] = useState(false);
  const [redundantFactors, setRedundantFactors] = useState<{ factor_a: string; factor_b: string; correlation: number; abs_correlation: number }[]>([]);

  const { data: latestDate } = useQuery({
    queryKey: ["latest-trade-date"],
    queryFn: fetchLatestTradeDate,
  });

  const effectiveDate = screenDate || latestDate || dayjs().format("YYYY-MM-DD");

  const runAnalysis = async (f: FactorDef) => {
    setAnalysisFactor(f);
    setAnalysisLoading(true);
    setIcResult(null);
    setDecileResult(null);
    try {
      const end = dayjs().format("YYYY-MM-DD");
      const start = dayjs().subtract(1, "year").format("YYYY-MM-DD");
      const [ic, decile] = await Promise.all([
        runICAnalysis(f.name, start, end),
        runDecileAnalysis(f.name, start, end),
      ]);
      setIcResult(ic);
      setDecileResult(decile);
    } catch {
      setIcResult(null);
      setDecileResult(null);
    } finally {
      setAnalysisLoading(false);
    }
  };

  const runCorrelation = async () => {
    if (selectedFactors.length < 2) return;
    const names = selectedFactors.map((f) => f.name);
    try {
      const result = await fetchFactorCorrelationMatrix(names, effectiveDate);
      console.log("Correlation result:", result);
      if (result.matrix && result.matrix.length > 0 && result.factor_names && result.factor_names.length > 0) {
        setCorrMatrix(result.matrix);
        setCorrNames(result.factor_names);
      } else {
        setCorrMatrix(null);
        setCorrNames([]);
        console.warn("Correlation matrix is empty");
      }
    } catch (e) {
      console.error("Correlation error:", e);
      setCorrMatrix(null);
      setCorrNames([]);
    }
  };

  const runScreen = async () => {
    if (selectedFactors.length === 0) return;
    setScreenLoading(true);
    try {
      const conditions = selectedFactors.map((f) => ({
        factor_name: f.name, direction: "positive",
      }));
      const result = await screenStocks(conditions, effectiveDate, 20);
      setScreenResults(result.results);
    } catch { setScreenResults([]); }
    finally { setScreenLoading(false); }
  };

  const runBatchIC = async () => {
    setBatchLoading(true);
    try {
      const end = dayjs().format("YYYY-MM-DD");
      const start = dayjs().subtract(1, "year").format("YYYY-MM-DD");
      const results = await runBatchICAnalysis(start, end);
      setBatchICResults(results);
    } catch { setBatchICResults([]); }
    finally { setBatchLoading(false); }
  };

  const runRedundantCheck = async () => {
    try {
      const result = await findRedundantFactors(effectiveDate);
      setRedundantFactors(result.redundant || []);
    } catch { setRedundantFactors([]); }
  };

  if (activeTab === "analysis" && isLoading) return <LoadingSpinner text="加载因子库..." />;

  const grouped: Record<string, FactorDef[]> = {};
  factors?.forEach((f) => {
    const cat = f.category || "other";
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(f);
  });

  const selectedSet = new Set(selectedFactors.map((f) => f.id));

  const icOption = icResult ? {
    tooltip: { trigger: "axis" },
    legend: { data: ["IC", "IC均值"], textStyle: { color: "#9ca3af" } },
    grid: { left: 50, right: 20, top: 40, bottom: 30 },
    xAxis: { type: "category", data: icResult.ic_series.map((s) => s.date.slice(0, 10)), axisLabel: { color: "#9ca3af" } },
    yAxis: { type: "value", axisLabel: { color: "#9ca3af" } },
    series: [
      {
        name: "IC", type: "bar",
        data: icResult.ic_series.map((s) => ({
          value: s.ic,
          itemStyle: { color: s.ic >= 0 ? "#ef4444" : "#22c55e" },
        })),
      },
      {
        name: "IC均值", type: "line",
        data: icResult.ic_series.map(() => icResult.ic_mean),
        lineStyle: { color: "#f59e0b", type: "dashed" }, symbol: "none",
      },
    ],
  } : null;

  const decileOption = decileResult && decileResult.groups.length > 0 ? {
    tooltip: { trigger: "axis", valueFormatter: (v: number) => `${(v * 100).toFixed(2)}%` },
    grid: { left: 50, right: 20, top: 20, bottom: 30 },
    xAxis: { type: "category", data: decileResult.groups.map((g) => `G${g.group}`), axisLabel: { color: "#9ca3af" } },
    yAxis: { type: "value", name: "累计收益%", axisLabel: { color: "#9ca3af", formatter: "{v}%" } },
    series: [{
      type: "bar",
      data: decileResult.groups.map((g) => ({
        value: g.cum_return * 100,
        itemStyle: { color: g.cum_return >= 0 ? "#ef4444" : "#22c55e" },
      })),
    }],
  } : null;

  const corrColor = (v: number) => {
    if (typeof v !== "number" || isNaN(v)) return "rgb(31,41,55)";
    const clamped = Math.max(-1, Math.min(1, v));
    if (clamped <= 0) {
      const t = clamped + 1;
      const r = Math.round(34 + (31 - 34) * t);
      const g = Math.round(197 + (41 - 197) * t);
      const b = Math.round(94 + (55 - 94) * t);
      return `rgb(${r},${g},${b})`;
    } else {
      const r = Math.round(31 + (239 - 31) * clamped);
      const g = Math.round(41 + (68 - 41) * clamped);
      const b = Math.round(55 + (68 - 55) * clamped);
      return `rgb(${r},${g},${b})`;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-bold text-gray-100">因子研究</h1>
          <div className="flex gap-1 bg-gray-800 rounded-lg p-1">
            <button
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                activeTab === "analysis" ? "bg-blue-600 text-white shadow" : "text-gray-400 hover:text-gray-200"
              }`}
              onClick={() => setActiveTab("analysis")}
            >
              因子分析
            </button>
            <button
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                activeTab === "knowledge" ? "bg-blue-600 text-white shadow" : "text-gray-400 hover:text-gray-200"
              }`}
              onClick={() => setActiveTab("knowledge")}
            >
              知识解读
            </button>
            <button
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                activeTab === "ranking" ? "bg-blue-600 text-white shadow" : "text-gray-400 hover:text-gray-200"
              }`}
              onClick={() => setActiveTab("ranking")}
            >
              IC 排行
            </button>
          </div>
        </div>
        {activeTab === "analysis" && (
          <button className="btn-secondary text-sm" onClick={clearSelection}>
            清除选择 ({selectedFactors.length})
          </button>
        )}
      </div>

      {activeTab === "knowledge" ? (
        <FactorKnowledge />
      ) : activeTab === "ranking" ? (
        <div className="space-y-6">
          <div className="flex items-center gap-3">
            <button className="btn-primary text-sm" onClick={runBatchIC} disabled={batchLoading}>
              {batchLoading ? "批量计算中..." : "批量 IC 验证（近1年）"}
            </button>
            <button className="btn-secondary text-sm" onClick={runRedundantCheck}>
              冗余因子检测
            </button>
          </div>

          {batchICResults.length > 0 && (
            <section className="card">
              <h2 className="text-sm font-bold text-slate-400 mb-3 flex items-center gap-2">
                <span className="w-1 h-4 rounded-full bg-rose-400" />IC 排行榜（按 |ICIR| 排序）
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-gray-500 border-b border-gray-700">
                      <th className="text-left py-2 px-2">排名</th>
                      <th className="text-left py-2 px-2">因子</th>
                      <th className="text-left py-2 px-2">类别</th>
                      <th className="text-right py-2 px-2">IC均值</th>
                      <th className="text-right py-2 px-2">ICIR</th>
                      <th className="text-right py-2 px-2">IC胜率</th>
                      <th className="text-right py-2 px-2">t值</th>
                      <th className="text-right py-2 px-2">期数</th>
                    </tr>
                  </thead>
                  <tbody>
                    {batchICResults.map((r, i) => (
                      <tr key={r.factor_name} className="border-b border-gray-700/50 hover:bg-gray-800/50">
                        <td className="py-1.5 px-2 text-gray-500">{i + 1}</td>
                        <td className="py-1.5 px-2 text-blue-300 font-mono">{r.factor_name}</td>
                        <td className="py-1.5 px-2 text-gray-400">{CATEGORY_LABELS[r.category] || r.category}</td>
                        <td className={`py-1.5 px-2 text-right ${r.ic_mean >= 0 ? "text-red-400" : "text-green-400"}`}>{r.ic_mean.toFixed(4)}</td>
                        <td className={`py-1.5 px-2 text-right font-bold ${Math.abs(r.icir) >= 0.5 ? "text-blue-400" : Math.abs(r.icir) >= 0.2 ? "text-yellow-400" : "text-gray-400"}`}>{r.icir.toFixed(3)}</td>
                        <td className="py-1.5 px-2 text-right text-gray-300">{(r.ic_win_rate * 100).toFixed(0)}%</td>
                        <td className="py-1.5 px-2 text-right text-gray-300">{r.ic_t_stat.toFixed(2)}</td>
                        <td className="py-1.5 px-2 text-right text-gray-500">{r.n_periods}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {redundantFactors.length > 0 && (
            <section className="card">
              <h2 className="text-sm font-bold text-slate-400 mb-3 flex items-center gap-2">
                <span className="w-1 h-4 rounded-full bg-amber-400" />高相关因子对（|r| ≥ 0.8）
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-gray-500 border-b border-gray-700">
                      <th className="text-left py-2 px-2">因子 A</th>
                      <th className="text-left py-2 px-2">因子 B</th>
                      <th className="text-right py-2 px-2">相关系数</th>
                      <th className="text-right py-2 px-2">|r|</th>
                    </tr>
                  </thead>
                  <tbody>
                    {redundantFactors.map((r, i) => (
                      <tr key={i} className="border-b border-gray-700/50">
                        <td className="py-1.5 px-2 text-blue-300 font-mono">{r.factor_a}</td>
                        <td className="py-1.5 px-2 text-blue-300 font-mono">{r.factor_b}</td>
                        <td className={`py-1.5 px-2 text-right ${r.correlation >= 0 ? "text-red-400" : "text-green-400"}`}>{r.correlation.toFixed(4)}</td>
                        <td className="py-1.5 px-2 text-right text-amber-400">{r.abs_correlation.toFixed(4)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Factor Library */}
        <div>
          <h2 className="text-sm font-bold text-slate-400 mb-3 flex items-center gap-2">
            <span className="w-1 h-4 rounded-full bg-rose-400" />因子库
          </h2>
          <div className="space-y-3 max-h-[600px] overflow-y-auto">
            {Object.entries(grouped).map(([cat, fList]) => (
              <div key={cat}>
                <h3 className="text-xs text-gray-500 mb-1.5">{CATEGORY_LABELS[cat] || cat}</h3>
                <div className="grid grid-cols-2 gap-1.5">
                  {fList.map((f) => (
                    <button
                      key={f.id}
                      onClick={() => toggleFactor(f)}
                      onDoubleClick={() => runAnalysis(f)}
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
            <h2 className="text-sm font-bold text-slate-400 mb-3 flex items-center gap-2">
              <span className="w-1 h-4 rounded-full bg-rose-400" />
              IC 分析 {analysisFactor && <span className="text-gray-300">— {analysisFactor.name}</span>}
              {analysisLoading && <span className="ml-2 text-xs text-blue-400 animate-pulse">分析中...</span>}
            </h2>
            {icResult && icResult.ic_series && icResult.ic_series.length > 0 ? (
              <div className="space-y-4">
                <div className="grid grid-cols-5 gap-2 text-center text-xs">
                  <div className="bg-gray-900 rounded p-2">
                    <div className="text-gray-500">IC 均值</div>
                    <div className={`text-lg font-bold ${icResult.ic_mean >= 0 ? "text-red-400" : "text-green-400"}`}>
                      {icResult.ic_mean.toFixed(4)}
                    </div>
                  </div>
                  <div className="bg-gray-900 rounded p-2">
                    <div className="text-gray-500">IC 标准差</div>
                    <div className="text-lg font-bold text-gray-200">{icResult.ic_std.toFixed(4)}</div>
                  </div>
                  <div className="bg-gray-900 rounded p-2">
                    <div className="text-gray-500">ICIR</div>
                    <div className={`text-lg font-bold ${icResult.icir >= 0 ? "text-blue-400" : "text-red-400"}`}>
                      {icResult.icir.toFixed(3)}
                    </div>
                  </div>
                  <div className="bg-gray-900 rounded p-2">
                    <div className="text-gray-500">IC 胜率</div>
                    <div className="text-lg font-bold text-gray-200">{(icResult.ic_win_rate * 100).toFixed(0)}%</div>
                  </div>
                  <div className="bg-gray-900 rounded p-2">
                    <div className="text-gray-500">IC t值</div>
                    <div className="text-lg font-bold text-gray-200">{icResult.ic_t_stat.toFixed(2)}</div>
                  </div>
                </div>
                <ReactECharts option={icOption} style={{ height: 260 }} />
              </div>
            ) : (
              <p className="text-sm text-gray-500">
                {analysisLoading ? "计算中..." : icResult ? "该因子暂无足够数据进行分析" : "双击因子库中的因子开始 IC + 分层分析"}
              </p>
            )}
          </section>

          {/* Decile Backtest */}
          <section className="card">
            <h2 className="text-sm font-bold text-slate-400 mb-3 flex items-center gap-2">
              <span className="w-1 h-4 rounded-full bg-amber-400" />
              分层收益（{decileResult?.n_groups || 10}分组）
            </h2>
            {decileResult && decileResult.groups && decileResult.groups.length > 0 && decileResult.groups.some(g => g.n_signals > 0) ? (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <div className="text-xs text-gray-400 mb-1">多空组合</div>
                    <div className="grid grid-cols-3 gap-2 text-center text-xs">
                      <div className="bg-gray-900 rounded p-2">
                        <div className="text-gray-500">累计收益</div>
                        <div className={`text-base font-bold ${decileResult.long_short.cum_return >= 0 ? "text-red-400" : "text-green-400"}`}>
                          {(decileResult.long_short.cum_return * 100).toFixed(2)}%
                        </div>
                      </div>
                      <div className="bg-gray-900 rounded p-2">
                        <div className="text-gray-500">年化波动</div>
                        <div className="text-base font-bold text-gray-200">
                          {(decileResult.long_short.volatility * 100).toFixed(2)}%
                        </div>
                      </div>
                      <div className="bg-gray-900 rounded p-2">
                        <div className="text-gray-500">Sharpe</div>
                        <div className="text-base font-bold text-blue-400">
                          {decileResult.long_short.sharpe.toFixed(2)}
                        </div>
                      </div>
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-400 mb-1">分组详情</div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="text-gray-500 border-b border-gray-700">
                            <th className="text-left py-1">分组</th>
                            <th className="text-right py-1">累计收益</th>
                            <th className="text-right py-1">Sharpe</th>
                          </tr>
                        </thead>
                        <tbody>
                          {decileResult.groups.slice().reverse().map((g) => (
                            <tr key={g.group} className="border-b border-gray-700/50">
                              <td className="py-1 font-mono">G{g.group}</td>
                              <td className={`py-1 text-right ${g.cum_return >= 0 ? "text-red-400" : "text-green-400"}`}>
                                {(g.cum_return * 100).toFixed(2)}%
                              </td>
                              <td className="py-1 text-right text-gray-300">{g.sharpe.toFixed(2)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
                <ReactECharts option={decileOption} style={{ height: 220 }} />
              </div>
            ) : (
              <p className="text-sm text-gray-500">该因子暂无足够数据用于分层分析</p>
            )}
          </section>

          {/* Correlation */}
          <section className="card">
            <h2 className="text-sm font-bold text-slate-400 mb-3 flex items-center gap-2">
              <span className="w-1 h-4 rounded-full bg-rose-400" />
              因子相关性
              <button
                className="ml-3 btn-primary text-xs"
                disabled={selectedFactors.length < 2}
                onClick={runCorrelation}
              >
                计算相关性
              </button>
            </h2>
            {corrMatrix && Array.isArray(corrMatrix) && corrMatrix.length > 0 && corrNames.length > 0 ? (
              <div className="overflow-x-auto">
                <div className="text-xs text-gray-500 mb-2 flex items-center gap-3">
                  <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded" style={{ background: "rgb(34,197,94)" }} /> 负相关</span>
                  <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded" style={{ background: "rgb(31,41,55)" }} /> 无相关</span>
                  <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded" style={{ background: "rgb(239,68,68)" }} /> 正相关</span>
                </div>
                <table className="text-xs" style={{ borderCollapse: "collapse" }}>
                  <thead>
                    <tr>
                      <th className="p-1 text-gray-500" />
                      {corrNames.map((n: string) => (
                        <th key={n} className="p-1 text-gray-400 font-medium" style={{ writingMode: "vertical-rl", transform: "rotate(180deg)", maxWidth: 28 }}>{n}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {corrMatrix.map((row: number[], i: number) => (
                      <tr key={i}>
                        <td className="p-1 text-gray-400 text-right pr-2 whitespace-nowrap">{corrNames[i]}</td>
                        {Array.isArray(row) && row.map((v: number, j: number) => (
                          <td key={j} className="p-1 text-center font-mono" style={{ background: corrColor(v), minWidth: 36, border: "1px solid rgba(0,0,0,0.2)" }}>
                            <span style={{ color: Math.abs(v) > 0.5 ? "#fff" : "#9ca3af" }}>{typeof v === "number" ? v.toFixed(2) : v}</span>
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-gray-500">选择2个以上因子后点击计算</p>
            )}
          </section>

          {/* Screening */}
          <section className="card">
            <h2 className="text-sm font-bold text-slate-400 mb-3 flex items-center gap-2">
              <span className="w-1 h-4 rounded-full bg-rose-400" />
              条件筛选
              <span className="ml-3 space-x-2">
                <input type="date" className="input-field w-36 text-xs" value={screenDate || latestDate || ""} placeholder={latestDate || "选择日期"} onChange={(e) => setScreenDate(e.target.value)} />
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
        )}
    </div>
  );
}