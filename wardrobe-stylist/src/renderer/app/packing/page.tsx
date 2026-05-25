import { useState, useEffect } from 'react';
import { Briefcase, Plus, X, Check } from 'lucide-react';
import { useWardrobeStore } from '../../stores/wardrobe-store';
import { LocalImage } from '../../components/shared/LocalImage';
import type { Garment, Season } from '../../lib/types';

const SEASONS: { value: Season; label: string }[] = [
  { value: 'spring', label: '春' }, { value: 'summer', label: '夏' },
  { value: 'autumn', label: '秋' }, { value: 'winter', label: '冬' },
];

export function PackingPage() {
  const garments = useWardrobeStore((s) => s.garments);
  const loadGarments = useWardrobeStore((s) => s.loadGarments);

  const [destination, setDestination] = useState('');
  const [days, setDays] = useState(3);
  const [season, setSeason] = useState<Season>('spring');
  const [packingList, setPackingList] = useState<Garment[]>([]);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [showAddPanel, setShowAddPanel] = useState(false);

  useEffect(() => { if (garments.length === 0) loadGarments(); }, []);

  const generate = () => {
    const active = garments.filter((g) => g.status === 'active');
    const byCategory: Record<string, Garment[]> = {};
    for (const g of active) {
      const seasons = JSON.parse(g.seasons) as string[];
      if (!seasons.includes(season) && !seasons.includes('all_season')) continue;
      if (!byCategory[g.category]) byCategory[g.category] = [];
      byCategory[g.category].push(g);
    }

    // Sort by most worn (prioritize favorites)
    const sortByUse = (arr: Garment[]) => [...arr].sort((a, b) => b.wearCount - a.wearCount);

    const selected: Garment[] = [];
    const tops = sortByUse(byCategory['top'] || []);
    const bottoms = sortByUse(byCategory['bottom'] || []);
    const shoes = sortByUse(byCategory['shoes'] || []);
    const outers = sortByUse(byCategory['outerwear'] || []);
    const dresses = sortByUse(byCategory['dress'] || []);
    const accessories = sortByUse(byCategory['accessory'] || []);

    // Tops: 1 per day, but at least 2
    for (let i = 0; i < Math.min(days, tops.length); i++) selected.push(tops[i]);

    // Bottoms: 1 per 2 days
    const bottomCount = Math.max(1, Math.ceil(days / 2));
    for (let i = 0; i < Math.min(bottomCount, bottoms.length); i++) selected.push(bottoms[i]);

    // Shoes: 1-2 pairs
    for (let i = 0; i < Math.min(2, shoes.length); i++) selected.push(shoes[i]);

    // Outerwear: 1
    if (outers.length > 0) selected.push(outers[0]);

    // Dresses: 1 if available
    if (dresses.length > 0) selected.push(dresses[0]);

    // Accessories: 1-2
    for (let i = 0; i < Math.min(2, accessories.length); i++) selected.push(accessories[i]);

    setPackingList(selected);
    setChecked(new Set());
  };

  const toggleCheck = (id: string) => {
    setChecked((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const addGarment = (g: Garment) => {
    if (!packingList.find((p) => p.id === g.id)) {
      setPackingList((prev) => [...prev, g]);
    }
  };

  const removeGarment = (id: string) => {
    setPackingList((prev) => prev.filter((g) => g.id !== id));
    setChecked((prev) => { const n = new Set(prev); n.delete(id); return n; });
  };

  const byCategory = (list: Garment[]) => {
    const map: Record<string, Garment[]> = {};
    for (const g of list) {
      if (!map[g.category]) map[g.category] = [];
      map[g.category].push(g);
    }
    return map;
  };

  const packed = packingList.filter((g) => checked.has(g.id)).length;

  return (
    <div className="p-8 animate-fade-in h-full flex flex-col">
      <h1 className="text-2xl font-bold mb-6">旅行打包</h1>

      {/* Input */}
      <div className="flex items-end gap-4 mb-8 bg-white rounded-xl border border-[var(--border-light)] p-5">
        <div>
          <label className="block text-sm font-medium mb-1">目的地</label>
          <input
            type="text" value={destination} onChange={(e) => setDestination(e.target.value)}
            placeholder="如：三亚"
            className="px-3 py-2 text-sm border border-[var(--border-light)] rounded-lg w-40 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">天数</label>
          <input
            type="number" min={1} max={30} value={days} onChange={(e) => setDays(Number(e.target.value))}
            className="px-3 py-2 text-sm border border-[var(--border-light)] rounded-lg w-20 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">季节</label>
          <div className="flex gap-1">
            {SEASONS.map(({ value, label }) => (
              <button
                key={value}
                onClick={() => setSeason(value)}
                className={`px-3 py-2 text-xs rounded-lg border transition-colors ${
                  season === value ? 'border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent)]' : 'border-[var(--border-light)] text-[var(--text-secondary)]'
                }`}
              >{label}</button>
            ))}
          </div>
        </div>
        <button
          onClick={generate}
          disabled={garments.length === 0}
          className="px-5 py-2 text-sm bg-[var(--accent)] text-white rounded-lg hover:bg-[var(--accent-light)] disabled:opacity-50 transition-colors"
        >
          生成打包方案
        </button>
      </div>

      {packingList.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-[var(--text-secondary)]">
          <Briefcase size={48} className="mb-4 text-gray-300" />
          <p className="text-lg font-medium mb-1">旅行打包助手</p>
          <p className="text-sm">输入目的地和天数，自动生成打包方案</p>
        </div>
      ) : (
        <>
          {/* Progress */}
          <div className="mb-4 flex items-center gap-3">
            <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-green-500 rounded-full transition-all"
                style={{ width: `${(packed / packingList.length) * 100}%` }}
              />
            </div>
            <span className="text-sm text-[var(--text-secondary)]">
              {packed}/{packingList.length} 已打包
            </span>
            <button
              onClick={() => setShowAddPanel(!showAddPanel)}
              className="flex items-center gap-1 px-3 py-1.5 text-sm border border-[var(--border-light)] rounded-lg hover:bg-gray-50"
            >
              <Plus size={14} /> 添加
            </button>
          </div>

          <div className="flex gap-6 flex-1 overflow-hidden">
            {/* Packing list by category */}
            <div className="flex-1 overflow-y-auto space-y-4">
              {Object.entries(byCategory(packingList)).map(([cat, items]) => (
                <div key={cat}>
                  <h3 className="text-xs font-semibold text-[var(--text-secondary)] uppercase mb-2">{cat}</h3>
                  <div className="space-y-1.5">
                    {items.map((g) => (
                      <div
                        key={g.id}
                        className={`flex items-center gap-3 p-2.5 rounded-lg cursor-pointer transition-colors ${
                          checked.has(g.id) ? 'bg-green-50 line-through opacity-60' : 'hover:bg-gray-50'
                        }`}
                        onClick={() => toggleCheck(g.id)}
                      >
                        <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 ${
                          checked.has(g.id) ? 'bg-green-500 border-green-500' : 'border-gray-300'
                        }`}>
                          {checked.has(g.id) && <Check size={12} className="text-white" />}
                        </div>
                        <div className="w-10 h-14 rounded overflow-hidden bg-gray-50 flex-shrink-0">
                          <LocalImage path={g.thumbnailUrl} alt="" className="w-full h-full object-cover" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{g.name}</p>
                        </div>
                        <button
                          onClick={(e) => { e.stopPropagation(); removeGarment(g.id); }}
                          className="p-1 rounded hover:bg-red-50 text-gray-400 hover:text-red-500"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Add panel */}
            {showAddPanel && (
              <div className="w-72 border-l border-[var(--border-light)] pl-4 overflow-y-auto">
                <h3 className="text-sm font-semibold mb-3 sticky top-0 bg-[var(--warm-bg)] py-1">从衣橱添加</h3>
                <div className="space-y-1">
                  {garments.filter((g) => g.status === 'active').map((g) => (
                    <button
                      key={g.id}
                      onClick={() => addGarment(g)}
                      disabled={packingList.some((p) => p.id === g.id)}
                      className="w-full flex items-center gap-2 p-2 rounded-lg text-left text-sm hover:bg-gray-50 disabled:opacity-30 transition-colors"
                    >
                      <div className="w-8 h-10 rounded overflow-hidden bg-gray-50 flex-shrink-0">
                        <LocalImage path={g.thumbnailUrl} alt="" className="w-full h-full object-cover" />
                      </div>
                      <span className="truncate">{g.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
