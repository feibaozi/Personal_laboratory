"use client";

import { useState } from "react";
import { PlacementResult as PlacementResultType, NODE_TYPE_CONFIG, NodeType } from "@/lib/types";

interface PlacementResultProps {
  result: PlacementResultType;
  onConfirm: (inboxId: number, nodeId: number | null, adjustments?: any) => Promise<void>;
}

export default function PlacementResult({ result, onConfirm }: PlacementResultProps) {
  const [rejected, setRejected] = useState(false);
  const [acceptedSuggestions, setAcceptedSuggestions] = useState<Set<number>>(new Set());

  const toggleSuggestion = (index: number) => {
    const next = new Set(acceptedSuggestions);
    if (next.has(index)) next.delete(index);
    else next.add(index);
    setAcceptedSuggestions(next);
  };

  const handleConfirm = () => {
    const suggestions = result.relatedSuggestions
      .filter((_, i) => acceptedSuggestions.has(i))
      .map((s) => ({
        title: s.title,
        content: s.content,
        nodeType: s.nodeType,
      }));

    onConfirm(0, result.targetNodeId, {
      title: result.generatedTitle,
      summary: result.generatedSummary,
      tags: result.suggestedTags,
      acceptSuggestions: suggestions,
    });
  };

  if (rejected) return null;

  return (
    <div className="px-3 py-2 bg-bg-tertiary border-b border-[var(--border-color)] animate-slide-up space-y-2">
      <div className="flex items-center justify-between">
        <div className="text-sm font-medium text-[var(--text-primary)]">
          AI 归位建议
        </div>
        <div className="flex items-center gap-1">
          <span className="text-xs text-[var(--text-muted)]">
            置信度: {Math.round(result.confidence * 100)}%
          </span>
        </div>
      </div>

      <div className="flex items-center gap-1.5 text-xs text-[var(--text-secondary)]">
        <span>📍</span>
        <span>{result.targetNodePath.join(" → ")}</span>
      </div>

      <div className="text-sm">
        <span className="text-[var(--text-primary)] font-medium">{result.generatedTitle}</span>
        {result.generatedSummary && (
          <p className="text-xs text-[var(--text-muted)] mt-0.5">{result.generatedSummary}</p>
        )}
      </div>

      {result.suggestedTags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {result.suggestedTags.map((tag) => (
            <span key={tag} className="px-1.5 py-0.5 text-[10px] bg-accent-purple/10 text-accent-purple rounded-full">
              #{tag}
            </span>
          ))}
        </div>
      )}

      {result.relatedSuggestions.length > 0 && (
        <div className="space-y-1">
          <div className="text-xs text-[var(--text-muted)]">💡 相关推荐：</div>
          {result.relatedSuggestions.map((suggestion, index) => {
            const config = NODE_TYPE_CONFIG[suggestion.nodeType as NodeType] || NODE_TYPE_CONFIG.tip;
            return (
              <div
                key={index}
                onClick={() => toggleSuggestion(index)}
                className={`flex items-start gap-2 px-2 py-1.5 rounded cursor-pointer transition-colors ${
                  acceptedSuggestions.has(index)
                    ? "bg-accent-blue/10 border border-accent-blue/30"
                    : "bg-bg-secondary/50 border border-transparent hover:border-[var(--border-color)]"
                }`}
              >
                <span className="text-xs mt-0.5">{acceptedSuggestions.has(index) ? "☑️" : "☐"}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1">
                    <span className="text-xs">{config.icon}</span>
                    <span className="text-xs font-medium text-[var(--text-primary)] truncate">
                      {suggestion.title}
                    </span>
                  </div>
                  <p className="text-[10px] text-[var(--text-muted)] mt-0.5">
                    {suggestion.reason}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="flex items-center gap-2 pt-1">
        <button
          onClick={handleConfirm}
          className="px-3 py-1.5 bg-accent-blue hover:bg-accent-blue/80 text-white text-xs font-medium rounded-lg transition-colors"
        >
          确认归位
        </button>
        <button
          onClick={() => setRejected(true)}
          className="px-3 py-1.5 text-xs text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-white/5 rounded-lg transition-colors"
        >
          暂不归位
        </button>
      </div>
    </div>
  );
}
