import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/api/client";
import { fetchStocks, fetchWatchlist, addWatchlist, deleteWatchlist } from "@/api/market";
import { LoadingSpinner } from "@/components/common/LoadingSpinner";
import { useState } from "react";

export function DataManagementPage() {
  const queryClient = useQueryClient();
  const [syncStartDate, setSyncStartDate] = useState("");
  const [syncEndDate, setSyncEndDate] = useState("");
  const [watchlistCode, setWatchlistCode] = useState("");
  const [watchlistNotes, setWatchlistNotes] = useState("");

  const syncStatus = useQuery({
    queryKey: ["sync-status"],
    queryFn: () => api.get<{ data_types: { type: string; last_sync: string; status: string; record_count: number }[] }>("/data/sync/status"),
  });

  const syncMutation = useMutation({
    mutationFn: (params: { data_types?: string; start_date?: string; end_date?: string }) =>
      api.post<Record<string, unknown>>("/data/sync", params),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sync-status"] });
    },
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

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-100">数据管理</h1>

      {/* Sync Controls */}
      <section className="card">
        <h2 className="text-sm font-medium text-gray-400 mb-3">数据同步</h2>
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="block text-xs text-gray-500 mb-1">数据类型</label>
            <select
              className="input-field"
              defaultValue="stock_list"
              id="syncDataType"
            >
              <option value="stock_list">股票列表</option>
              <option value="indices">指数行情</option>
              <option value="sectors">板块数据</option>
              <option value="stock_list,indices">股票+指数</option>
            </select>
          </div>
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
            disabled={syncMutation.isPending}
            onClick={() => {
              const dt = (document.getElementById("syncDataType") as HTMLSelectElement)?.value || "stock_list";
              syncMutation.mutate({ data_types: dt, start_date: syncStartDate || undefined, end_date: syncEndDate || undefined });
            }}
          >
            {syncMutation.isPending ? "同步中..." : "开始同步"}
          </button>
        </div>
        {syncMutation.data && (
          <pre className="mt-4 p-3 bg-gray-900 rounded text-xs text-gray-300 overflow-auto max-h-48">
            {JSON.stringify(syncMutation.data, null, 2)}
          </pre>
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
