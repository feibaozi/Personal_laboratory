"use client";

import { useEffect } from "react";
import { useAppStore } from "@/store";
import WatchListCard from "@/components/dashboard/WatchListCard";
import AlertFeed from "@/components/dashboard/AlertFeed";
import PortfolioSnapshot from "@/components/dashboard/PortfolioSnapshot";

export default function DashboardPage() {
  const pythonOnline = useAppStore((s) => s.pythonOnline);
  const watchlist = useAppStore((s) => s.watchlist);
  const fetchWatchlist = useAppStore((s) => s.fetchWatchlist);

  useEffect(() => {
    fetchWatchlist();
  }, [fetchWatchlist]);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-text-primary">驾驶舱</h2>
        <div className="flex items-center gap-2 text-sm text-text-muted">
          <span
            className={`w-2 h-2 rounded-full ${
              pythonOnline ? "bg-sentiment-positive" : "bg-sentiment-negative"
            }`}
          />
          {pythonOnline ? "后端已连接" : "后端未连接"}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-surface-1 rounded-xl p-5 border border-surface-3">
          <h3 className="text-sm text-text-muted mb-2">关注列表</h3>
          <p className="text-3xl font-bold text-text-primary">
            {watchlist.length}
          </p>
          <p className="text-xs text-text-muted mt-1">只标的</p>
        </div>

        <div className="bg-surface-1 rounded-xl p-5 border border-surface-3">
          <h3 className="text-sm text-text-muted mb-2">今日预警</h3>
          <p className="text-3xl font-bold text-sentiment-neutral">0</p>
          <p className="text-xs text-text-muted mt-1">待处理</p>
        </div>

        <div className="bg-surface-1 rounded-xl p-5 border border-surface-3">
          <h3 className="text-sm text-text-muted mb-2">AI 报告</h3>
          <p className="text-3xl font-bold text-brand">0</p>
          <p className="text-xs text-text-muted mt-1">已生成</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <AlertFeed />
        <PortfolioSnapshot />
      </div>

      <WatchListCard />
    </div>
  );
}
