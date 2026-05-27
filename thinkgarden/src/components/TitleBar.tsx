"use client";

export default function TitleBar() {
  const api = typeof window !== "undefined" ? window.electronAPI : null;

  return (
    <div className="drag-region h-9 flex items-center justify-between bg-bg-secondary border-b border-[var(--border-color)] px-3 shrink-0">
      <div className="flex items-center gap-2 no-drag">
        <span className="text-sm font-semibold text-accent-green">🌱</span>
        <span className="text-sm font-medium text-[var(--text-secondary)]">
          ThinkGarden
        </span>
      </div>
      <div className="flex items-center gap-1 no-drag">
        <button
          onClick={() => api?.minimizeWindow()}
          className="w-7 h-7 flex items-center justify-center rounded hover:bg-white/10 text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
        >
          <svg width="10" height="1" viewBox="0 0 10 1" fill="currentColor">
            <rect width="10" height="1" />
          </svg>
        </button>
        <button
          onClick={() => api?.maximizeWindow()}
          className="w-7 h-7 flex items-center justify-center rounded hover:bg-white/10 text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
        >
          <svg width="9" height="9" viewBox="0 0 9 9" fill="none" stroke="currentColor" strokeWidth="1.2">
            <rect x="0.6" y="0.6" width="7.8" height="7.8" />
          </svg>
        </button>
        <button
          onClick={() => api?.closeWindow()}
          className="w-7 h-7 flex items-center justify-center rounded hover:bg-red-500/80 text-[var(--text-muted)] hover:text-white transition-colors"
        >
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.4">
            <line x1="1" y1="1" x2="9" y2="9" />
            <line x1="9" y1="1" x2="1" y2="9" />
          </svg>
        </button>
      </div>
    </div>
  );
}
