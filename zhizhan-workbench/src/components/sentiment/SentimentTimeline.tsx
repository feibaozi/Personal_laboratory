"use client";

import { useState, useEffect } from "react";
import { fetchApi } from "@/lib/api";

interface SentimentEventItem {
  id: number;
  stock_name: string;
  source: string;
  title: string;
  sentiment: string;
  sentiment_score: number;
  impact_score: number;
  published_at: string | null;
}

export default function SentimentTimeline() {
  const [events, setEvents] = useState<SentimentEventItem[]>([]);
  const [filter, setFilter] = useState<string>("all");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadEvents();
  }, [filter]);

  const loadEvents = async () => {
    setLoading(true);
    try {
      const params = filter !== "all" ? `&sentiment=${filter}` : "";
      const data = await fetchApi<SentimentEventItem[]>(
        `/api/sentiment/events?limit=30${params}`
      );
      setEvents(data);
    } catch {
      setEvents([]);
    } finally {
      setLoading(false);
    }
  };

  const sentimentConfig: Record<string, { label: string; color: string; bg: string }> = {
    positive: { label: "利好", color: "text-sentiment-positive", bg: "bg-sentiment-positive/15" },
    negative: { label: "利空", color: "text-sentiment-negative", bg: "bg-sentiment-negative/15" },
    neutral: { label: "中性", color: "text-sentiment-neutral", bg: "bg-sentiment-neutral/15" },
  };

  return (
    <div className="bg-surface-1 rounded-xl border border-surface-3 overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3 border-b border-surface-3">
        <h3 className="text-sm font-medium text-text-primary">舆情信息流</h3>
        <div className="flex gap-1">
          {["all", "positive", "negative", "neutral"].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-2 py-1 rounded text-xs transition-colors ${
                filter === f
                  ? "bg-brand/15 text-brand"
                  : "text-text-muted hover:text-text-secondary"
              }`}
            >
              {f === "all" ? "全部" : sentimentConfig[f]?.label || f}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="px-5 py-8 text-center text-text-muted text-sm">加载中...</div>
      ) : events.length === 0 ? (
        <div className="px-5 py-8 text-center text-text-muted text-sm">
          暂无舆情数据，点击上方「采集」按钮获取新闻
        </div>
      ) : (
        <div className="divide-y divide-surface-3 max-h-96 overflow-y-auto">
          {events.map((event) => {
            const cfg = sentimentConfig[event.sentiment] || sentimentConfig.neutral;
            return (
              <div
                key={event.id}
                className="px-5 py-3 hover:bg-surface-2 transition-colors"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-text-primary leading-snug line-clamp-2">
                      {event.title}
                    </p>
                    <div className="flex items-center gap-2 mt-1.5">
                      {event.stock_name && (
                        <span className="text-xs text-brand">{event.stock_name}</span>
                      )}
                      <span className="text-xs text-text-muted">{event.source}</span>
                      {event.published_at && (
                        <span className="text-xs text-text-muted">
                          {event.published_at.slice(0, 16)}
                        </span>
                      )}
                    </div>
                  </div>
                  <span
                    className={`shrink-0 text-xs px-2 py-0.5 rounded ${cfg.bg} ${cfg.color}`}
                  >
                    {cfg.label}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
