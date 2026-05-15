import { useState, useEffect } from "react";

interface MetricCardProps {
  label: string;
  value: string | number;
  change?: number;
  changeLabel?: string;
  icon?: string;
  accent?: string; // left border color hex
}

export function MetricCard({ label, value, change, changeLabel, icon, accent = "#ff6b6b" }: MetricCardProps) {
  const isUp = change != null && change > 0;
  const isDown = change != null && change < 0;
  const changeClass = isUp ? "text-up" : isDown ? "text-down" : "text-flat";

  const displayValue = typeof value === "number" ? value.toLocaleString() : value;
  const [animate, setAnimate] = useState(false);

  useEffect(() => {
    setAnimate(true);
    const t = setTimeout(() => setAnimate(false), 300);
    return () => clearTimeout(t);
  }, [value]);

  return (
    <div
      className="card flex flex-col gap-1 min-w-[140px] relative overflow-hidden"
      style={{ borderLeft: `3px solid ${accent}` }}
    >
      {/* Corner dot decoration */}
      <div className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full opacity-30" style={{ background: accent }} />

      <div className="flex items-center gap-1.5">
        {icon && <span className="text-sm">{icon}</span>}
        <span className="text-xs text-slate-400 font-medium">{label}</span>
      </div>

      <span className={`text-xl font-extrabold text-slate-100 ${animate ? "number-pop" : ""}`}>
        {displayValue}
      </span>

      {change != null && (
        <span className={`text-sm font-semibold ${changeClass}`}>
          {isUp ? "+" : ""}{change.toFixed(2)}%
          {changeLabel && <span className="text-slate-500 ml-1 font-normal">{changeLabel}</span>}
        </span>
      )}
    </div>
  );
}
