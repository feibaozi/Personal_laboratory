"use client";

import { useState } from "react";
import { fetchApi } from "@/lib/api";

interface DCFResult {
  stock: string;
  code: string;
  method: string;
  assumptions: {
    base_fcf: number;
    growth_rate: number;
    discount_rate: number;
    projection_years: number;
    terminal_growth: number;
  };
  results: {
    pv_fcf: number;
    pv_terminal: number;
    enterprise_value: number;
  };
  note: string;
}

interface DCFProps {
  stockCode: string;
  stockName: string;
}

export default function DCFCalculator({ stockCode, stockName }: DCFProps) {
  const [growthRate, setGrowthRate] = useState(10);
  const [discountRate, setDiscountRate] = useState(8);
  const [years, setYears] = useState(10);
  const [result, setResult] = useState<DCFResult | null>(null);
  const [loading, setLoading] = useState(false);

  const calculate = async () => {
    setLoading(true);
    try {
      const data = await fetchApi<DCFResult>(
        `/api/stocks/search?q=${stockCode}`
      );
      const res = await fetchApi<DCFResult>(
        `/api/research/generate`,
        {
          method: "POST",
          body: JSON.stringify({
            stock_code: stockCode,
            report_type: "quick",
          }),
        }
      );
      setResult(res as unknown as DCFResult);
    } catch {
      setResult(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-surface-1 rounded-xl p-5 border border-surface-3">
      <h3 className="text-sm font-medium text-text-primary mb-4">DCF 估值计算器</h3>

      <div className="grid grid-cols-3 gap-4 mb-4">
        <div>
          <label className="block text-xs text-text-muted mb-1">增长率 (%)</label>
          <input
            type="number"
            value={growthRate}
            onChange={(e) => setGrowthRate(parseFloat(e.target.value) || 0)}
            step={1}
            className="w-full bg-surface-2 border border-surface-3 rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-brand"
          />
        </div>
        <div>
          <label className="block text-xs text-text-muted mb-1">折现率 (%)</label>
          <input
            type="number"
            value={discountRate}
            onChange={(e) => setDiscountRate(parseFloat(e.target.value) || 0)}
            step={0.5}
            className="w-full bg-surface-2 border border-surface-3 rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-brand"
          />
        </div>
        <div>
          <label className="block text-xs text-text-muted mb-1">预测年数</label>
          <input
            type="number"
            value={years}
            onChange={(e) => setYears(parseInt(e.target.value) || 10)}
            min={3}
            max={20}
            className="w-full bg-surface-2 border border-surface-3 rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-brand"
          />
        </div>
      </div>

      <button
        onClick={calculate}
        disabled={loading}
        className="w-full bg-brand hover:bg-brand-hover disabled:opacity-50 text-white py-2.5 rounded-lg text-sm font-medium transition-colors"
      >
        {loading ? "计算中..." : "计算估值"}
      </button>

      {result && result.results && (
        <div className="mt-4 p-4 bg-surface-2 rounded-lg space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-text-muted">FCF 现值</span>
            <span className="text-text-primary">{formatNumber(result.results.pv_fcf)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-text-muted">终值现值</span>
            <span className="text-text-primary">{formatNumber(result.results.pv_terminal)}</span>
          </div>
          <div className="flex justify-between text-sm font-medium border-t border-surface-3 pt-2">
            <span className="text-text-primary">企业价值</span>
            <span className="text-brand">{formatNumber(result.results.enterprise_value)}</span>
          </div>
          {result.note && (
            <p className="text-xs text-text-muted mt-2">{result.note}</p>
          )}
        </div>
      )}
    </div>
  );
}

function formatNumber(num: number): string {
  if (Math.abs(num) >= 1e8) return (num / 1e8).toFixed(2) + " 亿";
  if (Math.abs(num) >= 1e4) return (num / 1e4).toFixed(2) + " 万";
  return num.toFixed(2);
}
