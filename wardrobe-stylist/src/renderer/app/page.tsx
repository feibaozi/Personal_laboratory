import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Shirt, Sparkles, Palette, Calendar } from 'lucide-react';

interface GarmentStats {
  total: number;
  byCategory: Record<string, number>;
}

export function Dashboard() {
  const [stats, setStats] = useState<GarmentStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const s = await window.electronAPI.getGarmentStats();
        setStats(s);
      } catch (e) {
        console.error('Failed to load stats:', e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? '早上好' : hour < 18 ? '下午好' : '晚上好';

  const quickActions = [
    { to: '/wardrobe', icon: Shirt, label: '添加单品', color: 'bg-blue-50 text-blue-600' },
    { to: '/stylist', icon: Sparkles, label: '搭配推荐', color: 'bg-amber-50 text-amber-600' },
    { to: '/board', icon: Palette, label: '搭配画板', color: 'bg-purple-50 text-purple-600' },
    { to: '/calendar', icon: Calendar, label: '记录今天', color: 'bg-green-50 text-green-600' },
  ];

  return (
    <div className="p-8 max-w-5xl mx-auto animate-fade-in">
      {/* Greeting */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold">{greeting}，hexi！</h1>
        <p className="text-[var(--text-secondary)] mt-1">
          {new Date().toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })}
        </p>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        {quickActions.map(({ to, icon: Icon, label, color }) => (
          <Link
            key={to}
            to={to}
            className={`flex flex-col items-center gap-2 p-4 rounded-xl ${color} hover:opacity-80 transition-opacity`}
          >
            <Icon size={24} />
            <span className="text-sm font-medium">{label}</span>
          </Link>
        ))}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-6">
        <div className="bg-white rounded-xl p-6 shadow-sm border border-[var(--border-light)]">
          <h2 className="text-sm font-semibold text-[var(--text-secondary)] uppercase tracking-wide mb-4">
            衣橱概览
          </h2>
          {loading ? (
            <div className="animate-pulse space-y-2">
              <div className="h-4 bg-gray-100 rounded w-1/2" />
              <div className="h-4 bg-gray-100 rounded w-3/4" />
            </div>
          ) : stats ? (
            <div>
              <p className="text-3xl font-bold mb-3">{stats.total} <span className="text-sm font-normal text-[var(--text-secondary)]">件单品</span></p>
              <div className="space-y-1.5">
                {Object.entries(stats.byCategory).map(([cat, count]) => (
                  <div key={cat} className="flex justify-between text-sm">
                    <span className="text-[var(--text-secondary)]">{cat}</span>
                    <span className="font-medium">{count} 件</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-sm text-[var(--text-secondary)]">还没有添加单品</p>
          )}
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm border border-[var(--border-light)]">
          <h2 className="text-sm font-semibold text-[var(--text-secondary)] uppercase tracking-wide mb-4">
            今日推荐
          </h2>
          <div className="flex flex-col items-center justify-center h-32 text-center">
            <Sparkles size={28} className="text-[var(--accent)] mb-2" />
            <p className="text-sm text-[var(--text-secondary)] mb-3">添加至少 3 件单品后<br />即可获得今日穿搭推荐</p>
            <Link
              to="/stylist"
              className="text-sm px-4 py-2 bg-[var(--accent)] text-white rounded-lg hover:bg-[var(--accent-light)] transition-colors"
            >
              去推荐
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
