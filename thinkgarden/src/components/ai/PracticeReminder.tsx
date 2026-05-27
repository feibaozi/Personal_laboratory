"use client";

import { useState } from "react";
import { NODE_TYPE_CONFIG, NodeType } from "@/lib/types";

interface PracticeReminderProps {
  reminder: {
    warnings: { nodePath: string[]; nodeId: number; title: string; content: string; nodeType: string }[];
    principles: { nodePath: string[]; nodeId: number; title: string; content: string }[];
    tips: { nodePath: string[]; nodeId: number; title: string; content: string }[];
    advice: string;
  };
  onClose: () => void;
  onNavigateToNode: (nodeId: number) => void;
}

export default function PracticeReminderPanel({ reminder, onClose, onNavigateToNode }: PracticeReminderProps) {
  return (
    <div className="absolute right-0 top-0 bottom-0 w-96 bg-bg-secondary border-l border-[var(--border-color)] flex flex-col animate-slide-up z-20">
      <div className="flex items-center justify-between p-4 border-b border-[var(--border-color)]">
        <h3 className="text-sm font-semibold text-[var(--text-primary)]">🔔 实践提醒</h3>
        <button
          onClick={onClose}
          className="w-6 h-6 flex items-center justify-center rounded hover:bg-white/10 text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
        >
          ✕
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {reminder.advice && (
          <div className="bg-accent-blue/5 border border-accent-blue/20 rounded-lg p-3 text-xs text-accent-blue">
            💡 {reminder.advice}
          </div>
        )}

        {reminder.warnings.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-xs font-semibold text-accent-red uppercase tracking-wider">⚠️ 注意避坑</h4>
            {reminder.warnings.map((w, i) => (
              <div
                key={i}
                onClick={() => onNavigateToNode(w.nodeId)}
                className="bg-accent-red/5 border border-accent-red/20 rounded-lg p-3 cursor-pointer hover:bg-accent-red/10 transition-colors"
              >
                <div className="text-xs font-medium text-[var(--text-primary)]">{w.title}</div>
                {w.content && <p className="text-[10px] text-[var(--text-muted)] mt-1">{w.content}</p>}
                <div className="text-[10px] text-[var(--text-muted)] mt-1">📍 {w.nodePath.join(" → ")}</div>
              </div>
            ))}
          </div>
        )}

        {reminder.principles.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-xs font-semibold text-accent-purple uppercase tracking-wider">💡 核心原则</h4>
            {reminder.principles.map((p, i) => (
              <div
                key={i}
                onClick={() => onNavigateToNode(p.nodeId)}
                className="bg-accent-purple/5 border border-accent-purple/20 rounded-lg p-3 cursor-pointer hover:bg-accent-purple/10 transition-colors"
              >
                <div className="text-xs font-medium text-[var(--text-primary)]">{p.title}</div>
                {p.content && <p className="text-[10px] text-[var(--text-muted)] mt-1">{p.content}</p>}
                <div className="text-[10px] text-[var(--text-muted)] mt-1">📍 {p.nodePath.join(" → ")}</div>
              </div>
            ))}
          </div>
        )}

        {reminder.tips.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-xs font-semibold text-accent-yellow uppercase tracking-wider">✨ 实用技巧</h4>
            {reminder.tips.map((t, i) => (
              <div
                key={i}
                onClick={() => onNavigateToNode(t.nodeId)}
                className="bg-accent-yellow/5 border border-accent-yellow/20 rounded-lg p-3 cursor-pointer hover:bg-accent-yellow/10 transition-colors"
              >
                <div className="text-xs font-medium text-[var(--text-primary)]">{t.title}</div>
                {t.content && <p className="text-[10px] text-[var(--text-muted)] mt-1">{t.content}</p>}
                <div className="text-[10px] text-[var(--text-muted)] mt-1">📍 {t.nodePath.join(" → ")}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
