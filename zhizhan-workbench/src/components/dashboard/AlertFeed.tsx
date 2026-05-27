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

export default function AlertFeed() {
  const [alerts, setAlerts] = useState<AlertItem[]>([]);

  const loadAlerts = useCallback(async () => {
    try {
      const data = await fetchApi<AlertItem[]>("/api/alerts/?limit=5");
      setAlerts(data);
    } catch {
      setAlerts([]);
    }
  }, []);

  useEffect(() => {
    loadAlerts();
    const interval = setInterval(loadAlerts, 60000);
    return () => clearInterval(interval);
  }, [loadAlerts]);

  const severityDot: Record<string, string> = {
    high: "bg-sentiment-negative",
    medium: "bg-sentiment-neutral",
    low: "bg-text-muted",
  };

  const typeLabel: Record<string, string> = {
    financial: "财务",
    sentiment: "舆情",
    correlation: "关联",
  };

  const markRead = async (id: number) => {
    try {
      await fetchApi(`/api/alerts/${id}/read`, { method: "PUT" });
      setAlerts((prev) => prev.filter((a) => a.id !== id));
    } catch {
      // ignore
    }
  };

  if (alerts.length === 0) {
    return (
      <div className="bg-surface-1 rounded-xl p-5 border border-surface-3">
        <h3 className="text-sm text-text-muted mb-4">预警信号流</h3>
        <div className="h-32 flex items-center justify-center text-text-muted text-sm">
          暂无预警信号
        </div>
      </div>
    );
  }

  return (
    <div className="bg-surface-1 rounded-xl border border-surface-3 overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3 border-b border-surface-3">
        <h3 className="text-sm font-medium text-text-primary">预警信号流</h3>
        <span className="text-xs text-text-muted">{alerts.length} 条</span>
      </div>
      <div className="divide-y divide-surface-3">
        {alerts.map((alert) => (
          <div
            key={alert.id}
            className="px-5 py-3 hover:bg-surface-2 transition-colors cursor-pointer"
            onClick={() => markRead(alert.id)}
          >
            <div className="flex items-start gap-3">
              <span
                className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${
                  severityDot[alert.severity] || severityDot.low
                }`}
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  {alert.stock_name && (
                    <span className="text-xs text-brand">{alert.stock_name}</span>
                  )}
                  <span className="text-xs px-1.5 py-0.5 bg-surface-3 rounded text-text-muted">
                    {typeLabel[alert.alert_type] || alert.alert_type}
                  </span>
                </div>
                <p className="text-sm text-text-primary line-clamp-1">
                  {alert.title}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
