"use client";

import { useState, useEffect } from "react";
import { fetchApi } from "@/lib/api";
import AIReportViewer from "@/components/research/AIReportViewer";

interface ReportItem {
  id: number;
  stock_name: string;
  report_type: string;
  title: string;
  model_used: string;
  created_at: string | null;
}

interface ReportDetail {
  id: number;
  stock_name: string;
  title: string;
  content_markdown: string;
  model_used: string;
  created_at: string | null;
}

export default function ReportsPage() {
  const [reports, setReports] = useState<ReportItem[]>([]);
  const [selectedReport, setSelectedReport] = useState<ReportDetail | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadReports();
  }, []);

  const loadReports = async () => {
    try {
      const data = await fetchApi<ReportItem[]>("/api/research/reports");
      setReports(data);
    } catch {
      setReports([]);
    }
  };

  const viewReport = async (id: number) => {
    setLoading(true);
    try {
      const data = await fetchApi<ReportDetail>(`/api/research/reports/${id}`);
      setSelectedReport(data);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  const typeLabel: Record<string, string> = {
    deep_research: "深度研究",
    quick: "快速分析",
  };

  if (selectedReport) {
    return (
      <div className="p-6 space-y-4">
        <button
          onClick={() => setSelectedReport(null)}
          className="text-sm text-brand hover:underline flex items-center gap-1"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          返回报告列表
        </button>

        <div className="flex items-center gap-3 text-sm text-text-muted">
          <span>{selectedReport.stock_name}</span>
          <span>·</span>
          <span>{selectedReport.model_used}</span>
          <span>·</span>
          <span>{selectedReport.created_at?.slice(0, 10)}</span>
        </div>

        <AIReportViewer content={selectedReport.content_markdown} />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <h2 className="text-2xl font-bold text-text-primary">AI 研究报告</h2>

      {reports.length === 0 ? (
        <div className="bg-surface-1 rounded-xl p-8 border border-surface-3">
          <div className="flex flex-col items-center justify-center text-text-muted">
            <svg className="w-12 h-12 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p className="text-sm">暂无报告</p>
            <p className="text-xs mt-1">前往研究台生成 AI 报告</p>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {reports.map((report) => (
            <div
              key={report.id}
              className="bg-surface-1 rounded-xl p-4 border border-surface-3 hover:bg-surface-2 transition-colors cursor-pointer"
              onClick={() => viewReport(report.id)}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-text-primary">{report.title}</p>
                  <div className="flex items-center gap-2 mt-1 text-xs text-text-muted">
                    <span>{report.stock_name}</span>
                    <span>·</span>
                    <span className="px-1.5 py-0.5 bg-surface-3 rounded">
                      {typeLabel[report.report_type] || report.report_type}
                    </span>
                    <span>·</span>
                    <span>{report.model_used}</span>
                  </div>
                </div>
                <div className="text-xs text-text-muted">
                  {report.created_at?.slice(0, 10)}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
