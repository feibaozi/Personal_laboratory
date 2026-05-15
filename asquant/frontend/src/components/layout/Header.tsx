import { useUIStore } from "@/stores/uiStore";
import { useMarketStatus } from "@/hooks/usePolling";

export function Header() {
  const marketOpen = useMarketStatus();
  const toggleSidebar = useUIStore((s) => s.toggleSidebar);

  return (
    <header className="flex items-center justify-between h-14 px-6 bg-slate-900 border-b border-[#2a3f5f] shrink-0">
      <button onClick={toggleSidebar} className="text-slate-400 hover:text-slate-200 text-xl transition-colors">
        ☰
      </button>
      <div className="flex items-center gap-4">
        <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
          marketOpen ? "bg-teal-400/15 text-teal-400 border border-teal-400/30" : "bg-slate-700/50 text-slate-500"
        }`}>
          <span className="text-base">{marketOpen ? "🦊" : "😴"}</span>
          {marketOpen ? "交易中" : "已收盘"}
        </span>
      </div>
    </header>
  );
}
