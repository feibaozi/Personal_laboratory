"use client";

import { useState, useEffect, useCallback } from "react";
import { useSearch } from "@/hooks/useSearch";
import { useTags } from "@/hooks/useTags";
import { NODE_TYPE_CONFIG, NodeType, SearchResult } from "@/lib/types";
import FrameworkWizard from "./framework/FrameworkWizard";

interface SidebarProps {
  onSearchResultClick?: (nodeId: number) => void;
  onTagClick?: (tagName: string) => void;
  onOpenSettings?: () => void;
  onFrameworkChange?: () => void;
  onFrameworkCreated?: (frameworkId: number) => void;
}

export default function Sidebar({ onSearchResultClick, onTagClick, onOpenSettings, onFrameworkChange, onFrameworkCreated }: SidebarProps) {
  const { query, setQuery, results, searching } = useSearch();
  const { tags } = useTags();
  const [showResults, setShowResults] = useState(false);
  const [frameworks, setFrameworks] = useState<any[]>([]);
  const [currentFwId, setCurrentFwId] = useState<number>(1);
  const [showNewFramework, setShowNewFramework] = useState(false);
  const [showSnapshots, setShowSnapshots] = useState(false);
  const [snapshots, setSnapshots] = useState<any[]>([]);
  const [showExport, setShowExport] = useState(false);

  const api = typeof window !== "undefined" ? window.electronAPI : null;

  const loadFrameworks = useCallback(async () => {
    if (!api) return;
    const fwList = await api.dbGetFrameworks();
    setFrameworks(fwList || []);
    const curId = await api.dbGetCurrentFramework();
    setCurrentFwId(curId || 1);
  }, [api]);

  const loadSnapshots = useCallback(async () => {
    if (!api) return;
    const snapList = await api.dbGetSnapshots();
    setSnapshots(snapList || []);
  }, [api]);

  useEffect(() => {
    loadFrameworks();
  }, [loadFrameworks]);

  const handleSwitchFramework = async (id: number) => {
    if (!api) return;
    await api.dbSetCurrentFramework(id);
    setCurrentFwId(id);
    onFrameworkChange?.();
  };

  const handleDeleteFramework = async (id: number) => {
    if (!api) return;
    const result = await api.dbDeleteFramework(id);
    if (result?.error) {
      alert(result.error);
    } else {
      loadFrameworks();
      if (id === currentFwId) {
        onFrameworkChange?.();
      }
    }
  };

  const handleCreateSnapshot = async () => {
    if (!api) return;
    const name = `快照 ${new Date().toLocaleString("zh-CN")}`;
    await api.dbCreateSnapshot(name);
    loadSnapshots();
  };

  const handleRestoreSnapshot = async (id: number) => {
    if (!api || !confirm("恢复快照将覆盖当前框架数据，确定继续？")) return;
    await api.dbRestoreSnapshot(id);
    onFrameworkChange?.();
    setShowSnapshots(false);
  };

  const handleExport = async (format: "mermaid" | "markdown") => {
    if (!api) return;
    let content: string;
    let filename: string;
    if (format === "mermaid") {
      content = await api.dbExportFrameworkMermaid();
      filename = "framework.mmd";
    } else {
      content = await api.dbExportFrameworkMarkdown();
      filename = "framework.md";
    }
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    setShowExport(false);
  };

  return (
    <aside className="w-56 shrink-0 bg-bg-secondary border-r border-[var(--border-color)] flex flex-col overflow-hidden">
      <div className="p-3">
        <div className="relative">
          <input
            type="text"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setShowResults(!!e.target.value.trim()); }}
            onFocus={() => query.trim() && setShowResults(true)}
            placeholder="搜索..."
            className="w-full h-8 px-3 pl-8 text-sm bg-bg-tertiary border border-[var(--border-color)] rounded-md text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-accent-blue/50 transition-colors"
          />
          <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          {query && (
            <button onClick={() => { setQuery(""); setShowResults(false); }} className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-primary)]">✕</button>
          )}
        </div>
      </div>

      {showResults ? (
        <div className="flex-1 overflow-y-auto px-3 pb-2">
          {searching ? (
            <div className="text-xs text-[var(--text-muted)] py-2">搜索中...</div>
          ) : results.length > 0 ? (
            <div className="space-y-1">
              <div className="text-xs text-[var(--text-muted)] mb-1">找到 {results.length} 条结果</div>
              {results.map((r: SearchResult) => {
                const config = NODE_TYPE_CONFIG[r.nodeType as NodeType] || NODE_TYPE_CONFIG.step;
                return (
                  <div key={r.nodeId} onClick={() => onSearchResultClick?.(r.nodeId)} className="px-2 py-1.5 rounded hover:bg-white/5 cursor-pointer transition-colors">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs">{config.icon}</span>
                      <span className="text-sm text-[var(--text-primary)] truncate">{r.title}</span>
                    </div>
                    <div className="text-[10px] text-[var(--text-muted)] ml-5 truncate">{r.path.join(" → ")}</div>
                  </div>
                );
              })}
            </div>
          ) : query.trim() ? (
            <div className="text-xs text-[var(--text-muted)] py-2">未找到匹配结果</div>
          ) : null}
        </div>
      ) : (
        <>
          <div className="px-3 py-2">
            <h3 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-2">框架</h3>
            <div className="space-y-0.5">
              {frameworks.map((fw) => (
                <div
                  key={fw.id}
                  onClick={() => handleSwitchFramework(fw.id)}
                  className={`flex items-center justify-between text-sm px-2 py-1 rounded cursor-pointer transition-colors ${
                    fw.id === currentFwId ? "bg-accent-blue/10 text-accent-blue" : "text-[var(--text-secondary)] hover:bg-white/5"
                  }`}
                >
                  <span className="truncate">{fw.icon} {fw.name}</span>
                  {fw.id !== 1 && (
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDeleteFramework(fw.id); }}
                      className="text-[var(--text-muted)] hover:text-accent-red text-xs shrink-0 ml-1"
                    >✕</button>
                  )}
                </div>
              ))}
              {showNewFramework ? (
                <FrameworkWizard
                  onClose={() => setShowNewFramework(false)}
                  onConfirm={async (name: string, frameworkData: any) => {
                    if (!api) return;
                    const fwId = await api.dbCreateFramework(name);
                    await api.dbSetCurrentFramework(fwId);

                    async function insertFrameworkNodes(node: any, parentId: number | null) {
                      const newId = await api!.dbAddNode(parentId, node.title, node.content || "", node.node_type || "category");
                      if (node.children) {
                        for (const child of node.children) {
                          await insertFrameworkNodes(child, newId);
                        }
                      }
                    }
                    await insertFrameworkNodes(frameworkData, null);

                    setShowNewFramework(false);
                    loadFrameworks();
                    onFrameworkCreated?.(fwId);
                  }}
                />
              ) : (
                <button
                  onClick={() => setShowNewFramework(true)}
                  className="w-full text-left text-xs text-[var(--text-muted)] px-2 py-1 rounded hover:bg-white/5 hover:text-accent-blue transition-colors"
                >+ 新建框架</button>
              )}
            </div>
          </div>

          <div className="px-3 py-2 flex-1 overflow-y-auto">
            <h3 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-2">标签</h3>
            {tags.length > 0 ? (
              <div className="space-y-0.5">
                {tags.map((tag) => (
                  <div key={tag.id} onClick={() => onTagClick?.(tag.name)} className="text-sm text-[var(--text-secondary)] px-2 py-1 rounded hover:bg-white/5 cursor-pointer transition-colors">#{tag.name}</div>
                ))}
              </div>
            ) : (
              <div className="text-xs text-[var(--text-muted)]">暂无标签</div>
            )}
          </div>

          <div className="px-3 py-2 border-t border-[var(--border-color)] space-y-0.5">
            <button
              onClick={() => { loadSnapshots(); setShowSnapshots(!showSnapshots); }}
              className="w-full text-left text-sm text-[var(--text-muted)] px-2 py-1 rounded hover:bg-white/5 hover:text-[var(--text-secondary)] cursor-pointer transition-colors"
            >📸 快照</button>
            {showSnapshots && (
              <div className="space-y-1 ml-2">
                <button onClick={handleCreateSnapshot} className="text-xs text-accent-blue hover:text-accent-blue/80 px-2 py-0.5">+ 创建快照</button>
                {snapshots.map((s) => (
                  <div key={s.id} className="flex items-center justify-between text-xs text-[var(--text-muted)] px-2 py-0.5">
                    <span className="truncate">{s.name}</span>
                    <button onClick={() => handleRestoreSnapshot(s.id)} className="text-accent-blue hover:text-accent-blue/80 shrink-0 ml-1">恢复</button>
                  </div>
                ))}
              </div>
            )}

            <button
              onClick={() => setShowExport(!showExport)}
              className="w-full text-left text-sm text-[var(--text-muted)] px-2 py-1 rounded hover:bg-white/5 hover:text-[var(--text-secondary)] cursor-pointer transition-colors"
            >📤 导出</button>
            {showExport && (
              <div className="space-y-0.5 ml-2">
                <button onClick={() => handleExport("markdown")} className="text-xs text-[var(--text-secondary)] hover:text-accent-blue px-2 py-0.5 block">Markdown</button>
                <button onClick={() => handleExport("mermaid")} className="text-xs text-[var(--text-secondary)] hover:text-accent-blue px-2 py-0.5 block">Mermaid 流程图</button>
              </div>
            )}

            <button
              onClick={onOpenSettings}
              className="w-full text-left text-sm text-[var(--text-muted)] px-2 py-1 rounded hover:bg-white/5 hover:text-[var(--text-secondary)] cursor-pointer transition-colors"
            >⚙️ 设置</button>
          </div>
        </>
      )}
    </aside>
  );
}
