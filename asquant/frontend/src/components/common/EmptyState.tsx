interface EmptyStateProps {
  icon?: string;
  title: string;
  description?: string;
  action?: { label: string; onClick: () => void };
}

export function EmptyState({ icon = "🦊", title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-4">
      <div className="relative">
        <span className="text-5xl fox-wiggle select-none">{icon}</span>
        <div className="absolute -top-1 -right-1 w-2 h-2 bg-amber-400 rounded-full animate-pulse" />
      </div>
      <h3 className="text-lg font-bold text-slate-200">{title}</h3>
      {description && <p className="text-sm text-slate-500 max-w-xs text-center">{description}</p>}
      {action && (
        <button className="btn-primary mt-2" onClick={action.onClick}>
          {action.label}
        </button>
      )}
    </div>
  );
}
