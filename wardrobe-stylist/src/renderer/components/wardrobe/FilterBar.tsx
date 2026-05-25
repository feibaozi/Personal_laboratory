import { useWardrobeStore } from '../../stores/wardrobe-store';
import type { GarmentCategory, Season } from '../../lib/types';

const CATEGORIES: { value: GarmentCategory | 'all'; label: string }[] = [
  { value: 'all', label: '全部' },
  { value: 'top', label: '上衣' },
  { value: 'bottom', label: '下装' },
  { value: 'outerwear', label: '外套' },
  { value: 'dress', label: '连衣裙' },
  { value: 'shoes', label: '鞋子' },
  { value: 'accessory', label: '配饰' },
];

const SEASONS: { value: Season; label: string }[] = [
  { value: 'spring', label: '春' },
  { value: 'summer', label: '夏' },
  { value: 'autumn', label: '秋' },
  { value: 'winter', label: '冬' },
];

export function FilterBar() {
  const filters = useWardrobeStore((s) => s.filters);
  const setFilters = useWardrobeStore((s) => s.setFilters);

  return (
    <div className="flex flex-wrap items-center gap-3">
      {/* Category tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
        {CATEGORIES.map(({ value, label }) => {
          const isActive = (value === 'all' && !filters.category) || filters.category === value;
          return (
            <button
              key={value}
              onClick={() => setFilters({ category: value === 'all' ? null : value })}
              className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                isActive ? 'bg-white text-[var(--text-primary)] shadow-sm' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>

      {/* Season toggles */}
      <div className="flex gap-1">
        {SEASONS.map(({ value, label }) => {
          const isActive = filters.seasons.includes(value);
          return (
            <button
              key={value}
              onClick={() => {
                const next = isActive
                  ? filters.seasons.filter((s) => s !== value)
                  : [...filters.seasons, value];
                setFilters({ seasons: next });
              }}
              className={`px-2.5 py-1 text-xs rounded-md border transition-colors ${
                isActive ? 'border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent)]' : 'border-[var(--border-light)] text-[var(--text-secondary)] hover:border-gray-400'
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>

      {/* Search */}
      <input
        type="text"
        placeholder="搜索名称或品牌..."
        value={filters.search}
        onChange={(e) => setFilters({ search: e.target.value })}
        className="ml-auto px-3 py-1.5 text-sm border border-[var(--border-light)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30 w-48"
      />
    </div>
  );
}
