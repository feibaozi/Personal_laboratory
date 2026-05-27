"use client";

import { useState, useEffect } from "react";
import { fetchApi } from "@/lib/api";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

interface TrendData {
  date: string;
  total: number;
  positive: number;
  negative: number;
  neutral: number;
}

interface StatsData {
  total: number;
  positive: number;
  negative: number;
  neutral: number;
  trend: TrendData[];
}

export default function SentimentTrendChart() {
  const [stats, setStats] = useState<StatsData | null>(null);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const data = await fetchApi<StatsData>("/api/sentiment/stats?days=7");
      setStats(data);
    } catch {
      // ignore
    }
  };

  if (!stats) {
    return (
      <div className="bg-surface-1 rounded-xl p-5 border border-surface-3">
        <h3 className="text-sm text-text-muted mb-4">情绪趋势</h3>
        <div className="h-48 flex items-center justify-center text-text-muted text-sm">
          加载中...
        </div>
      </div>
    );
  }

  return (
    <div className="bg-surface-1 rounded-xl p-5 border border-surface-3">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm text-text-muted">近7日情绪趋势</h3>
        <div className="flex gap-3 text-xs">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-sentiment-positive" />
            利好 {stats.positive}
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-sentiment-negative" />
            利空 {stats.negative}
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-sentiment-neutral" />
            中性 {stats.neutral}
          </span>
        </div>
      </div>

      {stats.trend.length === 0 ? (
        <div className="h-48 flex items-center justify-center text-text-muted text-sm">
          暂无趋势数据
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={stats.trend}>
            <XAxis
              dataKey="date"
              tick={{ fontSize: 11, fill: "#6b6b80" }}
              tickFormatter={(v: string) => v.slice(5)}
            />
            <YAxis tick={{ fontSize: 11, fill: "#6b6b80" }} />
            <Tooltip
              contentStyle={{
                backgroundColor: "#1a1a24",
                border: "1px solid #2c2c3c",
                borderRadius: "8px",
                fontSize: "12px",
              }}
            />
            <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: "11px" }} />
            <Bar dataKey="positive" name="利好" fill="#22c55e" radius={[2, 2, 0, 0]} />
            <Bar dataKey="negative" name="利空" fill="#ef4444" radius={[2, 2, 0, 0]} />
            <Bar dataKey="neutral" name="中性" fill="#eab308" radius={[2, 2, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
