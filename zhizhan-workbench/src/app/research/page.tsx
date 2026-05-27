"use client";

import { useState } from "react";
import StockSearch from "@/components/research/StockSearch";
import AIReportViewer from "@/components/research/AIReportViewer";
import DCFCalculator from "@/components/research/DCFCalculator";
import WatchListCard from "@/components/dashboard/WatchListCard";
import { fetchApi } from "@/lib/api";
import { useAppStore } from "@/store";

interface ReportResult {
  id: number;
  stock_code: string;
  stock_name: string;
  report_type: string;
  title: string;
  content_markdown: string;
  model_used: string;
  created_at: string;
}

export default function ResearchPage() {
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState("");
  const [report, setReport] = useState<ReportResult | null>(null);
  const [selectedStock, setSelectedStock] = useState<{
    code: string;
    name: string;
  } | null>(null);
  const watchlist = useAppStore((s) => s.watchlist);

  const generateReport = async (stockCode: string, stockName: string) => {
    setSelectedStock({ code: stockCode, name: stockName });
    setGenerating(true);
    setProgress("正在采集财务数据...");
    setReport(null);

    try {
      setProgress("正在采集财务数据...");
      await fetchApi(`/api/research/collect-financials?stock_code=${stockCode}`, {
        method: "POST",
      }).catch(() => {});

      setProgress("正在索引历史数据...");
      await fetchApi(`/api/research/index-rag?stock_code=${stockCode}`, {
        method: "POST",
      }).catch(() => {});

      setProgress("正在生成 AI 研究报告...");
      const result = await fetchApi<ReportResult>("/api/research/generate", {
        method: "POST",
        body: JSON.stringify({
          stock_code: stockCode,
          report_type: "deep_research",
        }),
      });

      setReport(result);
      setProgress("");
    } catch (err) {
      setProgress("报告生成失败，请检查 LLM API 配置");
    } finally {
      setGenerating(false);
    }
  };

  const generateQuick = async (stockCode: string, stockName: string) => {
    setSelectedStock({ code: stockCode, name: stockName });
    setGenerating(true);
    setProgress("正在生成快速分析...");
    setReport(null);

    try {
      const result = await fetchApi<ReportResult>("/api/research/generate", {
        method: "POST",
        body: JSON.stringify({
          stock_code: stockCode,
          report_type: "quick",
        }),
      });
      setReport(result);
      setProgress("");
    } catch {
      setProgress("快速分析失败，请检查 LLM API 配置");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <h2 className="text-2xl font-bold text-text-primary">研究台</h2>

      <div className="bg-surface-1 rounded-xl p-5 border border-surface-3">
        <h3 className="text-sm text-text-muted mb-4">搜索标的</h3>
        <StockSearch />
      </div>

      {watchlist.length > 0 && (
        <div className="bg-surface-1 rounded-xl p-5 border border-surface-3">
          <h3 className="text-sm text-text-muted mb-4">关注列表 — 快速操作</h3>
          <div className="flex flex-wrap gap-2">
            {watchlist
              .filter((s) => s.watchStatus !== "closed")
              .map((stock) => (
                <div
                  key={stock.id}
                  className="flex items-center gap-2 bg-surface-2 rounded-lg px-3 py-2"
                >
                  <span className="text-sm text-text-primary">{stock.name}</span>
                  <span className="text-xs text-text-muted">{stock.code}</span>
                  <button
                    onClick={() => generateQuick(stock.code, stock.name)}
                    disabled={generating}
                    className="text-xs text-brand hover:underline disabled:opacity-50"
                  >
                    快速分析
                  </button>
                  <button
                    onClick={() => generateReport(stock.code, stock.name)}
                    disabled={generating}
                    className="text-xs bg-brand/15 text-brand hover:bg-brand/25 px-2 py-0.5 rounded disabled:opacity-50"
                  >
                    深度报告
                  </button>
                </div>
              ))}
          </div>
        </div>
      )}

      {generating && (
        <div className="bg-surface-1 rounded-xl p-5 border border-surface-3">
          <div className="flex items-center gap-3">
            <div className="w-5 h-5 border-2 border-brand border-t-transparent rounded-full animate-spin" />
            <span className="text-sm text-text-secondary">{progress}</span>
          </div>
        </div>
      )}

      {report && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-text-primary">
              {report.title}
            </h3>
            <div className="flex items-center gap-2 text-xs text-text-muted">
              <span>{report.model_used}</span>
              <span>·</span>
              <span>{report.created_at?.slice(0, 10)}</span>
            </div>
          </div>

          <div className="bg-surface-1 rounded-xl p-6 border border-surface-3">
            <AIReportViewer content={report.content_markdown} />
          </div>

          {selectedStock && (
            <DCFCalculator
              stockCode={selectedStock.code}
              stockName={selectedStock.name}
            />
          )}
        </div>
      )}
    </div>
  );
}
