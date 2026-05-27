"use client";

import { useState } from "react";
import { ConversationSummary, ConversationInsight, NODE_TYPE_CONFIG, NodeType } from "@/lib/types";

interface ConversationSummaryProps {
  summary: ConversationSummary;
  onClose: () => void;
  onAddInsight: (insight: ConversationInsight) => void;
  onAddAll: () => void;
}

export default function ConversationSummaryPanel({ summary, onClose, onAddInsight, onAddAll }: ConversationSummaryProps) {
  const [addedIndices, setAddedIndices] = useState<Set<number>>(new Set());

  const handleAdd = (insight: ConversationInsight, index: number) => {
    onAddInsight(insight);
    setAddedIndices((prev) => new Set(prev).add(index));
  };

  return (
    <div className="absolute right-0 top-0 bottom-0 w-96 bg-bg-secondary border-l border-[var(--border-color)] flex flex-col animate-slide-up z-20">
      <div className="flex items-center justify-between p-4 border-b border-[var(--border-color)]">
        <h3 className="text-sm font-semibold text-[var(--text-primary)]">💬 对话摘要</h3>
        <button
          onClick={onClose}
          className="w-6 h-6 flex items-center justify-center rounded hover:bg-white/10 text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
        >
          ✕
        </button>
      </div>

      <div className="p-4 border-b border-[var(--border-color)]">
        <div className="text-sm font-medium text-[var(--text-primary)] mb-1">
          主题: {summary.overallTheme}
        </div>
        {summary.projectContext && (
          <div className="text-xs text-[var(--text-muted)]">
            项目: {summary.projectContext}
          </div>
        )}
        <div className="text-xs text-[var(--text-muted)] mt-1">
          提取到 {summary.keyInsights.length} 条关键经验
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {summary.keyInsights.map((insight, index) => {
          const config = NODE_TYPE_CONFIG[insight.suggestedNodeType as NodeType] || NODE_TYPE_CONFIG.user_note;
          const isAdded = addedIndices.has(index);

          return (
            <div
              key={index}
              className={`rounded-lg p-3 border transition-colors ${
                isAdded
                  ? "bg-accent-green/5 border-accent-green/20"
                  : "bg-bg-tertiary border-[var(--border-color)]"
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs">{config.icon}</span>
                  <span className="text-xs font-medium text-[var(--text-primary)]">
                    {insight.title}
                  </span>
                </div>
                <button
                  onClick={() => handleAdd(insight, index)}
                  disabled={isAdded}
                  className={`text-[10px] px-2 py-0.5 rounded transition-colors ${
                    isAdded
                      ? "bg-accent-green/10 text-accent-green cursor-default"
                      : "bg-accent-blue/10 text-accent-blue hover:bg-accent-blue/20"
                  }`}
                >
                  {isAdded ? "✓ 已添加" : "加入框架"}
                </button>
              </div>

              <p className="text-xs text-[var(--text-secondary)]">{insight.content}</p>

              <div className="flex items-center gap-2 mt-2">
                {insight.suggestedParentPath.length > 0 && (
                  <span className="text-[10px] text-[var(--text-muted)]">
                    📍 {insight.suggestedParentPath.join(" → ")}
                  </span>
                )}
              </div>

              {insight.suggestedTags.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1.5">
                  {insight.suggestedTags.map((tag) => (
                    <span key={tag} className="px-1.5 py-0.5 text-[10px] bg-accent-purple/10 text-accent-purple rounded-full">
                      #{tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="p-3 border-t border-[var(--border-color)]">
        <button
          onClick={onAddAll}
          className="w-full py-2 bg-accent-blue hover:bg-accent-blue/80 text-white text-xs font-medium rounded-lg transition-colors"
        >
          一键添加全部 ({summary.keyInsights.length})
        </button>
      </div>
    </div>
  );
}
