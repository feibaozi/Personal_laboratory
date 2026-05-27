"use client";

import { useState } from "react";
import { useAppStore } from "@/store";
import { fetchApi } from "@/lib/api";
import type { Stock } from "@/lib/types";

interface SearchResult {
  code: string;
  name: string;
  market: string;
  price: number;
  change_pct: number;
}

export default function StockSearch() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const addToWatchlist = useAppStore((s) => s.addToWatchlist);
  const fetchWatchlist = useAppStore((s) => s.fetchWatchlist);

  const handleSearch = async () => {
    if (!query.trim()) return;
    setLoading(true);
    try {
      const data = await fetchApi<SearchResult[]>(
        `/api/stocks/search?q=${encodeURIComponent(query.trim())}`
      );
      setResults(data);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async (item: SearchResult) => {
    try {
      await addToWatchlist({
        code: item.code,
        name: item.name,
        market: item.market,
        industry: "",
        watchStatus: "observing",
        notes: "",
      });
      await fetchWatchlist();
    } catch {
      // stock may already exist
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-3">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          placeholder="输入股票代码或名称，如 600519 或 贵州茅台"
          className="flex-1 bg-surface-2 border border-surface-3 rounded-lg px-4 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-brand"
        />
        <button
          onClick={handleSearch}
          disabled={loading}
          className="bg-brand hover:bg-brand-hover disabled:opacity-50 text-white px-5 py-2.5 rounded-lg text-sm font-medium transition-colors"
        >
          {loading ? "搜索中..." : "搜索"}
        </button>
      </div>

      {results.length > 0 && (
        <div className="bg-surface-1 rounded-xl border border-surface-3 divide-y divide-surface-3">
          {results.map((item) => (
            <div
              key={item.code}
              className="flex items-center justify-between px-5 py-3 hover:bg-surface-2 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div>
                  <span className="text-sm font-medium text-text-primary">
                    {item.name}
                  </span>
                  <span className="text-xs text-text-muted ml-2">
                    {item.code}
                  </span>
                  <span className="text-xs text-text-muted ml-1">
                    {item.market}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-4">
                {item.price > 0 && (
                  <div className="text-right">
                    <div className="text-sm text-text-primary">
                      {item.price.toFixed(2)}
                    </div>
                    <div
                      className={`text-xs ${
                        item.change_pct > 0
                          ? "text-sentiment-positive"
                          : item.change_pct < 0
                            ? "text-sentiment-negative"
                            : "text-text-muted"
                      }`}
                    >
                      {item.change_pct > 0 ? "+" : ""}
                      {item.change_pct.toFixed(2)}%
                    </div>
                  </div>
                )}
                <button
                  onClick={() => handleAdd(item)}
                  className="bg-brand/15 text-brand hover:bg-brand/25 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                >
                  + 关注
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
