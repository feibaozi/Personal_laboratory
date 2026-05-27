"use client";

import { useState, useEffect, useCallback } from "react";
import { fetchApi } from "@/lib/api";

interface AlertItem {
  id: number;
  stock_name: string;
  alert_type: string;
  severity: string;
  title: string;
  description: string;
  is_read: boolean;
  created_at: string | null;
}

export default function AlertsPage() {
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [filter, setFilter] = useState<"all" | "high" | "medium" | "low">("all");
  const [loading, setLoading] = useState(false);

  const loadAlerts = useCallback(async () => {
    setLoading(true);
    try {
      const params = filter !== "all" ? `&severity=${filter}` : "";
      const data = await fetchApi<AlertItem[]>(`/api/alerts/?limit=50${params}`);
      setAlerts(data);
    } catch {
      setAlerts([]);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    loadAlerts();
  }, [loadAlerts]);

  const markRead = async (id: number) => {
    try {
      await fetchApi(`/api/alerts/${id}/read`, { method: "PUT" });
      setAlerts((prev) =>
        prev.map((a) => (a.id === id ? { ...a, is_read: true } : a))
      );
    } catch {
      // ignore
    }
  };

  const dismiss = async (id: number) => {
    try {
      await fetchApi(`/api/alerts/${id}/dismiss`, { method: "PUT" });
      setAlerts((prev) => prev.filter((a) => a.id !== id));
    } catch {
      // ignore
    }
  };

  const runChecks = async () => {
    try {
      await fetchApi("/api/alerts/run-checks", { method: "POST" });
      loadAlerts();
    } catch {
      // ignore
    }
  };

  const severityConfig: Record<string, { label: string; color: string; bg: string }> = {
    high: { label: "高", color: "text-sentiment-negative", bg: "bg-sentiment-negative/15" },
    medium: { label: "中", color: "text-sentiment-neutral", bg: "bg-sentiment-neutral/15" },
    low: { label: "低", color: "text-text-muted", bg: "bg-surface-3" },
  };

  const typeLabel: Record<string, string> = {
    financial: "财务",
    sentiment: "舆情",
    correlation: "关联",
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-text-primary">预警中心</h2>
        <div className="flex gap-2">
          <button
            onClick={runChecks}
            className="bg-brand hover:bg-brand-hover text-white px-4 py-2 rounded-lg text-sm transition-colors"
          >
            运行检查
          </button>
        </div>
      </div>

      <div className="flex gap-2">
        {(["all", "high", "medium", "low"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
              filter === f
                ? "bg-brand/15 text-brand"
                : "bg-surface-2 text-text-secondary hover:bg-surface-3"
            }`}
          >
            {f === "all" ? "全部" : severityConfig[f]?.label || f}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="bg-surface-1 rounded-xl p-8 border border-surface-3 text-center text-text-muted text-sm">
          加载中...
        </div>
      ) : alerts.length === 0 ? (
        <div className="bg-surface-1 rounded-xl p-8 border border-surface-3">
          <div className="flex flex-col items-center justify-center text-text-muted">
            <svg
              className="w-12 h-12 mb-3"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              strokeWidth={1}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
              />
            </svg>
            <p className="text-sm">暂无预警</p>
            <p className="text-xs mt-1">点击「运行检查」触发预警扫描</p>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {alerts.map((alert) => {
            const sev = severityConfig[alert.severity] || severityConfig.low;
            return (
              <div
                key={alert.id}
                className={`bg-surface-1 rounded-xl p-4 border border-surface-3 transition-colors ${
                  !alert.is_read ? "border-l-2 border-l-brand" : ""
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-xs px-2 py-0.5 rounded ${sev.bg} ${sev.color}`}>
                        {sev.label}
                      </span>
                      <span className="text-xs px-2 py-0.5 rounded bg-surface-3 text-text-muted">
                        {typeLabel[alert.alert_type] || alert.alert_type}
                      </span>
                      {alert.stock_name && (
                        <span className="text-xs text-brand">{alert.stock_name}</span>
                      )}
                    </div>
                    <p className="text-sm font-medium text-text-primary">{alert.title}</p>
                    {alert.description && (
                      <p className="text-xs text-text-secondary mt-1">{alert.description}</p>
                    )}
                  </div>
                  <div className="flex gap-2 shrink-0">
                    {!alert.is_read && (
                      <button
                        onClick={() => markRead(alert.id)}
                        className="text-xs text-brand hover:underline"
                      >
                        已读
                      </button>
                    )}
                    <button
                      onClick={() => dismiss(alert.id)}
                      className="text-xs text-text-muted hover:text-sentiment-negative"
                    >
                      忽略
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
