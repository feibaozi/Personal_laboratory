"use client";

import { useState } from "react";
import SentimentTimeline from "@/components/sentiment/SentimentTimeline";
import SentimentTrendChart from "@/components/sentiment/SentimentTrendChart";
import WordCloud from "@/components/sentiment/WordCloud";
import { fetchApi } from "@/lib/api";

export default function SentimentPage() {
  const [collecting, setCollecting] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);

  const handleCollect = async () => {
    setCollecting(true);
    try {
      await fetchApi("/api/sentiment/collect", { method: "POST" });
    } catch {
      // ignore
    } finally {
      setCollecting(false);
    }
  };

  const handleAnalyze = async () => {
    setAnalyzing(true);
    try {
      await fetchApi("/api/sentiment/analyze", { method: "POST" });
    } catch {
      // ignore
    } finally {
      setAnalyzing(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-text-primary">舆情监控</h2>
        <div className="flex gap-2">
          <button
            onClick={handleCollect}
            disabled={collecting}
            className="bg-surface-2 text-text-secondary hover:bg-surface-3 disabled:opacity-50 px-4 py-2 rounded-lg text-sm transition-colors"
          >
            {collecting ? "采集中..." : "采集新闻"}
          </button>
          <button
            onClick={handleAnalyze}
            disabled={analyzing}
            className="bg-brand hover:bg-brand-hover disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm transition-colors"
          >
            {analyzing ? "分析中..." : "分析舆情"}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <SentimentTimeline />
        <SentimentTrendChart />
      </div>

      <WordCloud />
    </div>
  );
}
