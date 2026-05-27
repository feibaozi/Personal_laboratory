"use client";

import { useAppStore } from "@/store";

export default function PortfolioSnapshot() {
  const watchlist = useAppStore((s) => s.watchlist);

  const focused = watchlist.filter((s) => s.watchStatus === "focused").length;
  const observing = watchlist.filter((s) => s.watchStatus === "observing").length;

  const industries = watchlist.reduce<Record<string, number>>((acc, s) => {
    const ind = s.industry || "未分类";
    acc[ind] = (acc[ind] || 0) + 1;
    return acc;
  }, {});

  const topIndustries = Object.entries(industries)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  return (
    <div className="bg-surface-1 rounded-xl p-5 border border-surface-3">
      <h3 className="text-sm text-text-muted mb-4">组合快览</h3>

      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="text-center">
          <p className="text-2xl font-bold text-sentiment-positive">{focused}</p>
          <p className="text-xs text-text-muted mt-1">重点关注</p>
        </div>
        <div className="text-center">
          <p className="text-2xl font-bold text-sentiment-neutral">{observing}</p>
          <p className="text-xs text-text-muted mt-1">观察中</p>
        </div>
      </div>

      {topIndustries.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-text-muted">行业分布</p>
          {topIndustries.map(([industry, count]) => (
            <div key={industry} className="flex items-center gap-2">
              <span className="text-xs text-text-secondary flex-1 truncate">
                {industry}
              </span>
              <div className="w-20 h-1.5 bg-surface-3 rounded-full overflow-hidden">
                <div
                  className="h-full bg-brand rounded-full"
                  style={{
                    width: `${Math.min((count / watchlist.length) * 100, 100)}%`,
                  }}
                />
              </div>
              <span className="text-xs text-text-muted w-4 text-right">{count}</span>
            </div>
          ))}
        </div>
      )}

      {watchlist.length === 0 && (
        <div className="text-center text-text-muted text-xs py-4">
          添加关注标的查看组合概览
        </div>
      )}
    </div>
  );
}
