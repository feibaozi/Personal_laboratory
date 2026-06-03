import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/api/client";
import { fetchWatchlist, addWatchlist, deleteWatchlist } from "@/api/market";
import { LoadingSpinner } from "@/components/common/LoadingSpinner";
import { useState, useEffect, useRef } from "react";

const SYNC_TYPES = [
  { key: "stock_list", label: "股票列表" },
  { key: "daily_quotes", label: "日线行情" },
  { key: "indices", label: "指数行情" },
  { key: "sectors", label: "板块数据" },
  { key: "north_bound", label: "北向资金" },
  { key: "market_breadth", label: "市场广度" },
  { key: "stock_info", label: "股票信息" },
  { key: "financial_reports", label: "财务报表" },
];

type CoverageItem = {
  type: string;
  label: string;
  min_date: string | null;
  max_date: string | null;
  trading_days: number;
  stock_count: number;
};

export function DataManagementPage() {
  const queryClient = useQueryClient();
  const [syncStartDate, setSyncStartDate] = useState("");
  const [syncEndDate, setSyncEndDate] = useState("");
  const [selectedTypes, setSelectedTypes] = useState<string[]>(["daily_quotes", "indices"]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState<{ step: string; progress: number; message?: string } | null>(null);
  const [singleCode, setSingleCode] = useState("");
  const [singleStart, setSingleStart] = useState("2024-01-01");
  const [singleEnd, setSingleEnd] = useState(new Date().toISOString().slice(0, 10));
  const [singleResult, setSingleResult] = useState<{ status: string; rows_synced?: number; detail?: string } | null>(null);
  const [watchlistCode, setWatchlistCode] = useState("");
  const [watchlistNotes, setWatchlistNotes] = useState("");
  const esRef = useRef<EventSource | null>(null);

  const syncStatus = useQuery({
    queryKey: ["sync-status"],
    queryFn: () => api.get<{ data_types: { type: string; last_sync: string; status: string; record_count: number }[] }>("/data/sync/status"),
  });

  const coverageQuery = useQuery({
    queryKey: ["data-coverage"],
    queryFn: () => api.get<{ coverage: CoverageItem[] }>("/data/coverage"),
  });

  const syncMutation = useMutation({
    mutationFn: (params: { data_types?: string; start_date?: string; end_date?: string }) =>
      api.post<Record<string, unknown>>("/data/sync", params),
  });

  const watchlistQuery = useQuery({
    queryKey: ["watchlist"],
    queryFn: fetchWatchlist,
  });

  const addMutation = useMutation({
    mutationFn: (params: { code: string; notes?: string }) =>
      addWatchlist(params.code, params.notes),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["watchlist"] });
      setWatchlistCode("");
      setWatchlistNotes("");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteWatchlist(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["watchlist"] }),
  });

  const singleStockMutation = useMutation({
    mutationFn: (params: { code: string; start_date: string; end_date: string }) =>
      api.post<{ status: string; rows_synced?: number; detail?: string }>(`/data/sync/stock/${params.code}?start_date=${params.start_date}&end_date=${params.end_date}`),
    onSuccess: (data) => {
      setSingleResult(data);
      queryClient.invalidateQueries({ queryKey: ["data-coverage"] });
    },
  });

  // SSE progress tracking
  const startSyncWithProgress = () => {
    const types = selectedTypes.length > 0 ? selectedTypes.join(",") : undefined;
    syncMutation.mutate({ data_types: types, start_date: syncStartDate || undefined, end_date: syncEndDate || undefined });
    setIsSyncing(true);
    setSyncProgress(null);

    const es = new EventSource("/api/v1/data/sync/progress");
    esRef.current = es;
    es.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        setSyncProgress({ step: data.step || "", progress: data.progress || 0, message: data.message });
        if (data.message === "done") {
          es.close();
          esRef.current = null;
          setIsSyncing(false);
          setSyncProgress(null);
          queryClient.invalidateQueries({ queryKey: ["sync-status"] });
          queryClient.invalidateQueries({ queryKey: ["data-coverage"] });
        }
      } catch { /* ignore parse errors */ }
    };
    es.onerror = () => {
      es.close();
      esRef.current = null;
      setIsSyncing(false);
    };
  };

  // Cleanup SSE on unmount
  useEffect(() => {
    return () => {
      if (esRef.current) {
        esRef.current.close();
        esRef.current = null;
      }
    };
  }, []);

  const toggleType = (key: string) => {
    setSelectedTypes((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  const selectAll = () => setSelectedTypes(SYNC_TYPES.map((t) => t.key));
  const deselectAll = () => setSelectedTypes([]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-100">数据管理</h1>

      {/* Sync Controls */}
      <section className="card">
        <h2 className="text-sm font-medium text-gray-400 mb-3">数据同步</h2>

        {/* Type selection - checkboxes */}
        <div className="mb-3">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs text-gray-500">选择同步类型:</span>
            <button className="text-xs text-blue-400 hover:text-blue-300" onClick={selectAll}>全选</button>
            <span className="text-xs text-gray-600">|</span>
            <button className="text-xs text-gray-400 hover:text-gray-300" onClick={deselectAll}>清空</button>
          </div>
          <div className="flex flex-wrap gap-2">
            {SYNC_TYPES.map((t) => (
              <label key={t.key} className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  className="rounded border-gray-600 bg-gray-800 text-blue-500 focus:ring-blue-500/30"
                  checked={selectedTypes.includes(t.key)}
                  onChange={() => toggleType(t.key)}
                />
                <span className="text-xs text-gray-300">{t.label}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Date range + sync button */}
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="block text-xs text-gray-500 mb-1">开始日期</label>
            <input type="date" className="input-field" value={syncStartDate} onChange={(e) => setSyncStartDate(e.target.value)} />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">结束日期</label>
            <input type="date" className="input-field" value={syncEndDate} onChange={(e) => setSyncEndDate(e.target.value)} />
          </div>
          <button
            className="btn-primary"
            disabled={isSyncing || selectedTypes.length === 0}
            onClick={startSyncWithProgress}
          >
            {isSyncing ? "同步中..." : "开始同步"}
          </button>
          {isSyncing && (
            <button
              className="text-xs text-red-400 hover:text-red-300"
              onClick={() => {
                if (esRef.current) { esRef.current.close(); esRef.current = null; }
                setIsSyncing(false);
                setSyncProgress(null);
              }}
            >
              关闭进度
            </button>
          )}
        </div>

        {/* SSE Progress bar */}
        {syncProgress && (
          <div className="mt-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-gray-400">{syncProgress.step}</span>
              <span className="text-xs text-blue-400">{(syncProgress.progress * 100).toFixed(0)}%</span>
            </div>
            <div className="w-full h-2 bg-gray-800 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{
                  width: `${syncProgress.progress * 100}%`,
                  background: "linear-gradient(90deg, #3b82f6, #8b5cf6)",
                }}
              />
            </div>
          </div>
        )}

        {syncMutation.data && !isSyncing && (
          <pre className="mt-4 p-3 bg-gray-900 rounded text-xs text-gray-300 overflow-auto max-h-48">
            {JSON.stringify(syncMutation.data, null, 2)}
          </pre>
        )}
      </section>

      {/* Single Stock Sync */}
      <section className="card">
        <h2 className="text-sm font-medium text-gray-400 mb-3">单股票同步</h2>
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="block text-xs text-gray-500 mb-1">股票代码</label>
            <input
              className="input-field w-28"
              placeholder="如 000001"
              value={singleCode}
              onChange={(e) => setSingleCode(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">开始日期</label>
            <input type="date" className="input-field" value={singleStart} onChange={(e) => setSingleStart(e.target.value)} />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">结束日期</label>
            <input type="date" className="input-field" value={singleEnd} onChange={(e) => setSingleEnd(e.target.value)} />
          </div>
          <button
            className="btn-primary"
            disabled={singleStockMutation.isPending || !singleCode}
            onClick={() => singleStockMutation.mutate({ code: singleCode, start_date: singleStart, end_date: singleEnd })}
          >
            {singleStockMutation.isPending ? "同步中..." : "同步"}
          </button>
        </div>
        {singleResult && (
          <div className={`mt-3 text-xs px-3 py-2 rounded ${
            singleResult.status === "done" ? "bg-green-600/15 text-green-400" : "bg-red-600/15 text-red-400"
          }`}>
            {singleResult.status === "done"
              ? `同步完成: ${singleResult.rows_synced} 条数据`
              : `同步失败: ${singleResult.detail || "未知错误"}`}
          </div>
        )}
      </section>

      {/* Sync Status */}
      <section className="card">
        <h2 className="text-sm font-medium text-gray-400 mb-3">同步状态</h2>
        {syncStatus.isLoading ? (
          <LoadingSpinner />
        ) : syncStatus.data?.data_types && syncStatus.data.data_types.length > 0 ? (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-400 border-b border-gray-700">
                <th className="text-left py-2">数据类型</th>
                <th className="text-left py-2">最后同步</th>
                <th className="text-left py-2">状态</th>
                <th className="text-right py-2">数据量</th>
              </tr>
            </thead>
            <tbody>
              {syncStatus.data.data_types.map((t) => (
                <tr key={t.type} className="border-b border-gray-700/50">
                  <td className="py-2">{t.type}</td>
                  <td className="py-2 text-gray-400">{t.last_sync || "-"}</td>
                  <td className="py-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      t.status === "success" ? "bg-green-600/20 text-green-400" : "bg-red-600/20 text-red-400"
                    }`}>{t.status}</span>
                  </td>
                  <td className="py-2 text-right">{t.record_count.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="text-sm text-gray-500">暂无同步记录，请先同步数据</p>
        )}
      </section>

      {/* Data Coverage */}
      <section className="card">
        <h2 className="text-sm font-medium text-gray-400 mb-3">数据覆盖范围</h2>
        {coverageQuery.isLoading ? (
          <LoadingSpinner />
        ) : coverageQuery.data?.coverage && coverageQuery.data.coverage.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {coverageQuery.data.coverage.map((c) => (
              <div key={c.type} className="flex items-center gap-3 p-3 rounded bg-gray-900/50 border border-gray-700/30">
                <div className="flex-1 min-w-0">
                  <span className="text-sm text-gray-200 font-medium">{c.label}</span>
                  {c.min_date && c.max_date ? (
                    <div className="text-xs text-gray-400 mt-0.5">
                      {c.min_date} ~ {c.max_date}
                      {c.trading_days > 0 && <span className="ml-2 text-gray-500">({c.trading_days}天)</span>}
                    </div>
                  ) : (
                    <div className="text-xs text-gray-500 mt-0.5">无日期范围</div>
                  )}
                </div>
                {c.stock_count > 0 && (
                  <span className="text-xs px-2 py-1 rounded bg-blue-600/15 text-blue-400 border border-blue-500/20">
                    {c.stock_count.toLocaleString()} 只
                  </span>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-500">暂无数据覆盖信息</p>
        )}
      </section>

      {/* Watchlist Management */}
      <section className="card">
        <h2 className="text-sm font-medium text-gray-400 mb-3">自选股管理</h2>
        <div className="flex flex-wrap gap-2 mb-4">
          <input
            className="input-field w-28"
            placeholder="股票代码"
            value={watchlistCode}
            onChange={(e) => setWatchlistCode(e.target.value)}
          />
          <input
            className="input-field flex-1 min-w-[120px]"
            placeholder="备注（可选）"
            value={watchlistNotes}
            onChange={(e) => setWatchlistNotes(e.target.value)}
          />
          <button
            className="btn-primary"
            disabled={addMutation.isPending || !watchlistCode}
            onClick={() => addMutation.mutate({ code: watchlistCode, notes: watchlistNotes || undefined })}
          >
            添加
          </button>
        </div>
        {watchlistQuery.data && watchlistQuery.data.length > 0 ? (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-400 border-b border-gray-700">
                <th className="text-left py-2">代码</th>
                <th className="text-left py-2">备注</th>
                <th className="text-left py-2">添加时间</th>
                <th className="text-right py-2">操作</th>
              </tr>
            </thead>
            <tbody>
              {watchlistQuery.data.map((w) => (
                <tr key={w.id} className="border-b border-gray-700/50">
                  <td className="py-2 font-mono">{w.stock_code}</td>
                  <td className="py-2 text-gray-400">{w.notes || "-"}</td>
                  <td className="py-2 text-gray-400">{w.added_at?.slice(0, 10) || "-"}</td>
                  <td className="py-2 text-right">
                    <button
                      className="text-xs text-red-400 hover:text-red-300"
                      onClick={() => deleteMutation.mutate(w.id)}
                    >
                      删除
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="text-sm text-gray-500">暂无自选股</p>
        )}
      </section>
    </div>
  );
}
