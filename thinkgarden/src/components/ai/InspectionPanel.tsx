"use client";

import { useState } from "react";
import { InspectionResult, InspectionIssue, InspectionSuggestion } from "@/lib/types";

interface InspectionPanelProps {
  result: InspectionResult;
  onClose: () => void;
  onSuggestionAction: (suggestion: InspectionSuggestion) => void;
}

const SEVERITY_CONFIG = {
  high: { label: "严重", color: "text-accent-red", bg: "bg-accent-red/10", icon: "🔴" },
  medium: { label: "中等", color: "text-accent-yellow", bg: "bg-accent-yellow/10", icon: "🟡" },
  low: { label: "轻微", color: "text-accent-green", bg: "bg-accent-green/10", icon: "🟢" },
};

const ISSUE_TYPE_LABELS: Record<string, string> = {
  empty_branch: "空洞分支",
  no_user_notes: "缺少个人经验",
  deep_nesting: "层级过深",
  orphan: "孤立节点",
  similar_nodes: "相似节点",
};

const ACTION_LABELS: Record<string, string> = {
  add_note: "📝 补充笔记",
  merge_nodes: "🔗 合并节点",
  restructure: "🔄 调整结构",
  add_category: "📁 新增分类",
  fill_gap: "✨ 填补空白",
};

export default function InspectionPanel({ result, onClose, onSuggestionAction }: InspectionPanelProps) {
  const [activeTab, setActiveTab] = useState<"overview" | "issues" | "suggestions">("overview");

  const scoreColor =
    result.healthScore >= 80
      ? "text-accent-green"
      : result.healthScore >= 50
      ? "text-accent-yellow"
      : "text-accent-red";

  return (
    <div className="absolute right-0 top-0 bottom-0 w-96 bg-bg-secondary border-l border-[var(--border-color)] flex flex-col animate-slide-up z-20">
      <div className="flex items-center justify-between p-4 border-b border-[var(--border-color)]">
        <h3 className="text-sm font-semibold text-[var(--text-primary)]">🔍 框架巡检报告</h3>
        <button
          onClick={onClose}
          className="w-6 h-6 flex items-center justify-center rounded hover:bg-white/10 text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
        >
          ✕
        </button>
      </div>

      <div className="flex border-b border-[var(--border-color)]">
        {(["overview", "issues", "suggestions"] as const).map((tab) => {
          const labels = { overview: "概览", issues: `问题 (${result.issues.length})`, suggestions: `建议 (${result.suggestions.length})` };
          return (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-2 text-xs font-medium transition-colors ${
                activeTab === tab
                  ? "text-accent-blue border-b-2 border-accent-blue"
                  : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
              }`}
            >
              {labels[tab]}
            </button>
          );
        })}
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {activeTab === "overview" && (
          <>
            <div className="text-center py-4">
              <div className={`text-5xl font-bold ${scoreColor}`}>
                {result.healthScore}
              </div>
              <div className="text-xs text-[var(--text-muted)] mt-1">健康评分</div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="bg-bg-tertiary rounded-lg p-3 text-center">
                <div className="text-lg font-semibold text-[var(--text-primary)]">{result.totalNodes}</div>
                <div className="text-[10px] text-[var(--text-muted)]">总节点</div>
              </div>
              <div className="bg-bg-tertiary rounded-lg p-3 text-center">
                <div className="text-lg font-semibold text-accent-orange">{result.userNoteCount}</div>
                <div className="text-[10px] text-[var(--text-muted)]">个人笔记</div>
              </div>
              <div className="bg-bg-tertiary rounded-lg p-3 text-center">
                <div className="text-lg font-semibold text-accent-blue">{result.aiNodeCount}</div>
                <div className="text-[10px] text-[var(--text-muted)]">AI 节点</div>
              </div>
            </div>

            {result.userNoteCount === 0 && (
              <div className="bg-accent-yellow/10 border border-accent-yellow/20 rounded-lg p-3 text-xs text-accent-yellow">
                💡 你的框架还没有个人笔记！尝试在开发过程中记录你的经验心得，让框架变成你自己的方法论。
              </div>
            )}

            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-[var(--text-muted)] uppercase">快速统计</h4>
              <div className="text-xs text-[var(--text-secondary)] space-y-1">
                <div>个人笔记占比: {result.totalNodes > 0 ? Math.round((result.userNoteCount / result.totalNodes) * 100) : 0}%</div>
                <div>问题数量: {result.issues.length} (严重 {result.issues.filter(i => i.severity === "high").length})</div>
                <div>优化建议: {result.suggestions.length} 条</div>
              </div>
            </div>
          </>
        )}

        {activeTab === "issues" && (
          <div className="space-y-2">
            {result.issues.length === 0 ? (
              <div className="text-center py-8 text-sm text-[var(--text-muted)]">
                🎉 没有发现问题！
              </div>
            ) : (
              result.issues.map((issue, index) => {
                const sevConfig = SEVERITY_CONFIG[issue.severity];
                return (
                  <div key={index} className={`${sevConfig.bg} rounded-lg p-3`}>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs">{sevConfig.icon}</span>
                      <span className={`text-xs font-medium ${sevConfig.color}`}>
                        {ISSUE_TYPE_LABELS[issue.type] || issue.type}
                      </span>
                    </div>
                    <p className="text-xs text-[var(--text-secondary)]">{issue.description}</p>
                    {issue.nodePath.length > 0 && (
                      <div className="text-[10px] text-[var(--text-muted)] mt-1">
                        📍 {issue.nodePath.join(" → ")}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}

        {activeTab === "suggestions" && (
          <div className="space-y-2">
            {result.suggestions.length === 0 ? (
              <div className="text-center py-8 text-sm text-[var(--text-muted)]">
                ✨ 暂无优化建议
              </div>
            ) : (
              result.suggestions.map((suggestion, index) => {
                const priConfig = SEVERITY_CONFIG[suggestion.priority === "high" ? "high" : suggestion.priority === "medium" ? "medium" : "low"];
                return (
                  <div key={index} className="bg-bg-tertiary rounded-lg p-3">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs">{ACTION_LABELS[suggestion.action] || suggestion.action}</span>
                        <span className={`text-[10px] ${priConfig.color}`}>{priConfig.label}</span>
                      </div>
                      <button
                        onClick={() => onSuggestionAction(suggestion)}
                        className="text-[10px] px-2 py-0.5 bg-accent-blue/10 text-accent-blue rounded hover:bg-accent-blue/20 transition-colors"
                      >
                        执行
                      </button>
                    </div>
                    <div className="text-xs font-medium text-[var(--text-primary)]">{suggestion.title}</div>
                    <p className="text-[10px] text-[var(--text-muted)] mt-0.5">{suggestion.description}</p>
                    {suggestion.targetNodePath.length > 0 && (
                      <div className="text-[10px] text-[var(--text-muted)] mt-1">
                        📍 {suggestion.targetNodePath.join(" → ")}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>
    </div>
  );
}
