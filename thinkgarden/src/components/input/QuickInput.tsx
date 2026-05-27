"use client";

import { useState, useEffect } from "react";
import { useAI } from "@/hooks/useAI";
import { useFramework } from "@/hooks/useFramework";
import PlacementResult from "../ai/PlacementResult";

export default function QuickInput() {
  const [content, setContent] = useState("");
  const [tags, setTags] = useState("");
  const [source, setSource] = useState("");
  const [clipboardCapture, setClipboardCapture] = useState<string | null>(null);
  const { analyzing, result, error, submitNote, confirmPlacement } = useAI();
  const { loadFramework } = useFramework();
  const api = typeof window !== "undefined" ? window.electronAPI : null;

  useEffect(() => {
    if (!api?.onClipboardCapture) return;
    api.onClipboardCapture((text: string) => {
      setClipboardCapture(text);
      setTimeout(() => setClipboardCapture(null), 15000);
    });
    return () => { api.removeClipboardCapture?.(); };
  }, [api]);

  const handleSubmit = async () => {
    if (!content.trim()) return;
    const tagList = tags.trim() ? tags.split(",").map((t) => t.trim()) : undefined;
    await submitNote(content.trim(), tagList, source.trim() || undefined);
    setContent("");
    setTags("");
    setSource("");
  };

  const handleConfirm = async (inboxId: number, nodeId: number | null, adjustments?: any) => {
    await confirmPlacement(inboxId, nodeId, adjustments);
    loadFramework();
  };

  const handleAcceptClipboard = () => {
    if (clipboardCapture) {
      setContent(clipboardCapture);
      setClipboardCapture(null);
    }
  };

  return (
    <div className="shrink-0 border-t border-[var(--border-color)] bg-bg-secondary">
      {clipboardCapture && (
        <div className="px-3 py-2 bg-accent-orange/5 border-b border-accent-orange/20 flex items-center gap-2 animate-slide-up">
          <span className="text-xs text-accent-orange">📋 检测到剪贴板内容</span>
          <button
            onClick={handleAcceptClipboard}
            className="text-[10px] px-2 py-0.5 bg-accent-blue/10 text-accent-blue rounded hover:bg-accent-blue/20 transition-colors"
          >
            填入输入框
          </button>
          <button
            onClick={() => setClipboardCapture(null)}
            className="text-[10px] px-2 py-0.5 text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
          >
            忽略
          </button>
        </div>
      )}

      {analyzing && (
        <div className="px-3 py-2 flex items-center gap-2 text-sm text-accent-blue">
          <div className="animate-spin w-4 h-4 border-2 border-accent-blue border-t-transparent rounded-full" />
          AI 正在分析你的笔记...
        </div>
      )}

      {error && (
        <div className="px-3 py-2 text-sm text-accent-red bg-accent-red/5">
          ⚠️ {error}
        </div>
      )}

      {result && (
        <PlacementResult result={result} onConfirm={handleConfirm} />
      )}

      <div className="p-3 space-y-2">
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                handleSubmit();
              }
            }}
            placeholder="写下你的经验心得... (Ctrl+Enter 提交)"
            className="flex-1 h-9 px-3 text-sm bg-bg-tertiary border border-[var(--border-color)] rounded-lg text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-accent-blue/50 transition-colors"
          />
          <button
            onClick={handleSubmit}
            disabled={!content.trim() || analyzing}
            className="h-9 px-4 bg-accent-blue hover:bg-accent-blue/80 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
          >
            提交
          </button>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            placeholder="标签 (逗号分隔)"
            className="w-48 h-7 px-2 text-xs bg-bg-tertiary border border-[var(--border-color)] rounded text-[var(--text-secondary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-accent-blue/50 transition-colors"
          />
          <input
            type="text"
            value={source}
            onChange={(e) => setSource(e.target.value)}
            placeholder="来源 (项目名)"
            className="w-36 h-7 px-2 text-xs bg-bg-tertiary border border-[var(--border-color)] rounded text-[var(--text-secondary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-accent-blue/50 transition-colors"
          />
        </div>
      </div>
    </div>
  );
}
