import { useNavigate, useLocation } from "react-router-dom";
import { useUIStore } from "@/stores/uiStore";

const NAV_ITEMS = [
  { path: "/", label: "仪表盘", icon: "📊" },
  { path: "/factor", label: "因子研究", icon: "🔬" },
  { path: "/backtest", label: "组合回测", icon: "🎯" },
  { path: "/data", label: "数据管理", icon: "📦" },
];

export function Sidebar() {
  const collapsed = useUIStore((s) => s.sidebarCollapsed);
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <aside className={`flex flex-col shrink-0 bg-slate-900 border-r border-[#2a3f5f] transition-all duration-300 ${collapsed ? "w-16" : "w-56"}`}>
      <div className="h-14 flex items-center gap-3 px-4 border-b border-[#2a3f5f] shrink-0">
        <span className="text-2xl fox-wiggle cursor-pointer select-none">🦊</span>
        {!collapsed && (
          <div className="flex flex-col leading-tight">
            <span className="font-bold text-base text-slate-100 tracking-tight">好奇量化</span>
            <span className="text-[10px] text-slate-500">有温度的量化实验室</span>
          </div>
        )}
      </div>

      <nav className="flex-1 py-4 space-y-1 px-2">
        {NAV_ITEMS.map((item) => {
          const active = location.pathname === item.path || (item.path !== "/" && location.pathname.startsWith(item.path));
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={`w-full flex items-center gap-3 py-3 rounded-xl transition-all duration-200 ${
                active
                  ? "bg-rose-400/15 text-rose-400 border border-rose-400/30 shadow-sm"
                  : "text-slate-400 hover:text-slate-200 hover:bg-[#1e2d4a]"
              } ${collapsed ? "justify-center px-0" : "px-4"}`}
              title={collapsed ? item.label : undefined}
            >
              <span className="text-lg flex-shrink-0">{item.icon}</span>
              {!collapsed && <span className="font-medium text-sm">{item.label}</span>}
            </button>
          );
        })}
      </nav>

      <div className="p-3 border-t border-[#2a3f5f] flex justify-center">
        <span className={`text-xs text-slate-600 fox-wiggle select-none ${collapsed ? "text-lg" : ""}`}>
          {collapsed ? "🦊" : "🦊 好奇的小狐狸"}
        </span>
      </div>
    </aside>
  );
}
