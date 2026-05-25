"use client";

import type { MoodSession } from "@/lib/types";

interface HistoryPanelProps {
  history: MoodSession[];
  onSelect: (session: MoodSession) => void;
  onDelete: (id: string) => void;
}

export default function HistoryPanel({
  history,
  onSelect,
  onDelete,
}: HistoryPanelProps) {
  if (history.length === 0) {
    return (
      <div className="text-white/20 text-sm text-center py-8">
        还没有情绪记录，试试告诉 AI 你的感受吧
      </div>
    );
  }

  return (
    <div className="animate-slide-up w-full max-w-xl">
      <p className="text-white/30 text-xs mb-3 tracking-wider uppercase">
        历史情绪
      </p>
      <div className="flex flex-wrap gap-2">
        {history.map((session) => (
          <div
            key={session.id}
            className="group relative"
          >
            <button
              onClick={() => onSelect(session)}
              className="px-4 py-2 rounded-full text-sm glass glass-hover
                         transition-all duration-300 hover:scale-105
                         flex items-center gap-2"
            >
              <span
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: session.analysis.color_palette.accent }}
              />
              <span className="text-white/70">
                {session.analysis.mood_cn}
              </span>
              <span className="text-white/25 text-xs">
                {session.userInput.length > 12
                  ? session.userInput.slice(0, 12) + "..."
                  : session.userInput}
              </span>
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete(session.id);
              }}
              className="absolute -top-1 -right-1 w-5 h-5 rounded-full
                         bg-red-400/80 text-white text-[10px]
                         opacity-0 group-hover:opacity-100 transition-opacity
                         flex items-center justify-center hover:bg-red-500"
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}