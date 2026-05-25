import { NavLink } from 'react-router-dom';
import {
  Shirt, Sparkles, Palette, Calendar, Briefcase, ShoppingBag, Settings,
} from 'lucide-react';

const navItems = [
  { to: '/', icon: Sparkles, label: '首页' },
  { to: '/wardrobe', icon: Shirt, label: '衣橱' },
  { to: '/stylist', icon: Sparkles, label: '推荐' },
  { to: '/board', icon: Palette, label: '画板' },
  { to: '/calendar', icon: Calendar, label: '日历' },
  { to: '/packing', icon: Briefcase, label: '打包' },
  { to: '/shopping', icon: ShoppingBag, label: '购物' },
];

export function Sidebar() {
  return (
    <aside className="w-56 h-full flex flex-col border-r border-[var(--border-light)] bg-white">
      {/* Logo */}
      <div className="h-16 flex items-center px-5 border-b border-[var(--border-light)]">
        <h1 className="text-lg font-semibold tracking-tight">
          <span className="text-[var(--accent)]">Wardrobe</span> Stylist
        </h1>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 px-3 space-y-1">
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-[var(--accent)]/10 text-[var(--accent)]'
                  : 'text-[var(--text-secondary)] hover:bg-gray-100 hover:text-[var(--text-primary)]'
              }`
            }
          >
            <Icon size={18} />
            {label}
          </NavLink>
        ))}
      </nav>

      {/* Settings at bottom */}
      <div className="p-3 border-t border-[var(--border-light)]">
        <NavLink
          to="/settings"
          className={({ isActive }) =>
            `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
              isActive
                ? 'bg-[var(--accent)]/10 text-[var(--accent)]'
                : 'text-[var(--text-secondary)] hover:bg-gray-100 hover:text-[var(--text-primary)]'
            }`
          }
        >
          <Settings size={18} />
          设置
        </NavLink>
      </div>
    </aside>
  );
}
