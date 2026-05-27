'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const NAV_ITEMS = [
  { href: '/knowledge', label: '知识库', icon: '📚' },
  { href: '/cards', label: '话题卡片', icon: '🃏' },
  { href: '/chat', label: '模拟面试', icon: '💬' },
  { href: '/settings', label: '设置', icon: '⚙️' },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-56 h-screen bg-zinc-900 border-r border-zinc-800 flex flex-col fixed left-0 top-0">
      <div className="p-5 border-b border-zinc-800">
        <h1 className="text-lg font-bold text-white tracking-tight">
          Interview Coach
        </h1>
        <p className="text-xs text-zinc-500 mt-0.5">个人求职智能助手</p>
      </div>

      <nav className="flex-1 p-3 space-y-1">
        {NAV_ITEMS.map((item) => {
          const isActive = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                isActive
                  ? 'bg-zinc-800 text-white font-medium'
                  : 'text-zinc-400 hover:text-white hover:bg-zinc-800/50'
              }`}
            >
              <span className="text-base">{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-zinc-800">
        <p className="text-xs text-zinc-600">Powered by DeepSeek</p>
      </div>
    </aside>
  );
}
