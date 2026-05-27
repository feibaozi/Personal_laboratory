"use client";

import { useState, useEffect, useCallback } from "react";
import { useAppStore } from "@/store";
import { fetchApi } from "@/lib/api";
import type { Stock } from "@/lib/types";

export default function WatchListCard() {
  const watchlist = useAppStore((s) => s.watchlist);
  const fetchWatchlist = useAppStore((s) => s.fetchWatchlist);
  const removeFromWatchlist = useAppStore((s) => s.removeFromWatchlist);
  const [filter, setFilter] = useState<"all" | "focused" | "observing">("all");

  useEffect(() => {
    fetchWatchlist();
  }, [fetchWatchlist]);

  const filtered =
    filter === "all"
      ? watchlist
      : watchlist.filter((s) => s.watchStatus === filter);

  const statusLabel: Record<string, string> = {
    focused: "重点关注",
    observing: "观察中",
    closed: "已清仓",
  };

  const statusColor: Record<string, string> = {
    focused: "text-sentiment-positive",
    observing: "text-sentiment-neutral",
    closed: "text-text-muted",
  };

  return (
    <div className="bg-surface-1 rounded-xl border border-surface-3 overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3 border-b border-surface-3">
        <h3 className="text-sm font-medium text-text-primary">关注列表</h3>
        <div className="flex gap-1">
          {(["all", "focused", "observing"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-2 py-1 rounded text-xs transition-colors ${
                filter === f
                  ? "bg-brand/15 text-brand"
                  : "text-text-muted hover:text-text-secondary"
              }`}
            >
              {f === "all" ? "全部" : statusLabel[f]}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="px-5 py-8 text-center text-text-muted text-sm">
          暂无关注标的，前往研究台搜索添加
        </div>
      ) : (
        <div className="divide-y divide-surface-3 max-h-80 overflow-y-auto">
          {filtered.map((stock) => (
            <div
              key={stock.id}
              className="flex items-center justify-between px-5 py-3 hover:bg-surface-2 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div>
                  <span className="text-sm font-medium text-text-primary">
                    {stock.name}
                  </span>
                  <span className="text-xs text-text-muted ml-2">
                    {stock.code}
                  </span>
                </div>
                {stock.industry && (
                  <span className="text-xs px-1.5 py-0.5 bg-surface-3 rounded text-text-muted">
                    {stock.industry}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3">
                <span
                  className={`text-xs ${statusColor[stock.watchStatus] || "text-text-muted"}`}
                >
                  {statusLabel[stock.watchStatus] || stock.watchStatus}
                </span>
                <button
                  onClick={() => removeFromWatchlist(stock.code)}
                  className="text-text-muted hover:text-sentiment-negative transition-colors"
                  title="移除关注"
                >
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    strokeWidth={1.5}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
