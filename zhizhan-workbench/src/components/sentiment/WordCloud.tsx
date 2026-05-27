"use client";

import { useState, useEffect } from "react";
import { fetchApi } from "@/lib/api";

interface KeywordItem {
  keyword: string;
  count: number;
}

export default function WordCloud() {
  const [keywords, setKeywords] = useState<KeywordItem[]>([]);

  useEffect(() => {
    loadKeywords();
  }, []);

  const loadKeywords = async () => {
    try {
      const data = await fetchApi<KeywordItem[]>("/api/sentiment/keywords?limit=30");
      setKeywords(data);
    } catch {
      setKeywords([]);
    }
  };

  if (keywords.length === 0) {
    return (
      <div className="bg-surface-1 rounded-xl p-5 border border-surface-3">
        <h3 className="text-sm text-text-muted mb-4">关键词云</h3>
        <div className="h-48 flex items-center justify-center text-text-muted text-sm">
          暂无关键词数据
        </div>
      </div>
    );
  }

  const maxCount = Math.max(...keywords.map((k) => k.count), 1);

  const getColor = (ratio: number) => {
    if (ratio > 0.7) return "text-sentiment-negative";
    if (ratio > 0.4) return "text-sentiment-neutral";
    return "text-sentiment-positive";
  };

  const getSize = (ratio: number) => {
    if (ratio > 0.7) return "text-lg font-bold";
    if (ratio > 0.4) return "text-base font-medium";
    return "text-sm";
  };

  return (
    <div className="bg-surface-1 rounded-xl p-5 border border-surface-3">
      <h3 className="text-sm text-text-muted mb-4">关键词云</h3>
      <div className="flex flex-wrap gap-2 justify-center py-2">
        {keywords.map((kw) => {
          const ratio = kw.count / maxCount;
          return (
            <span
              key={kw.keyword}
              className={`${getSize(ratio)} ${getColor(ratio)} opacity-80 hover:opacity-100 transition-opacity cursor-default`}
            >
              {kw.keyword}
            </span>
          );
        })}
      </div>
    </div>
  );
}
