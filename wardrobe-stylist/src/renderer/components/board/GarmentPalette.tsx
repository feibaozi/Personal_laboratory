import { useState } from 'react';
import { LocalImage } from '../shared/LocalImage';
import type { Garment, GarmentCategory } from '../../lib/types';

const CATEGORIES: { value: GarmentCategory; label: string }[] = [
  { value: 'top', label: '上衣' },
  { value: 'bottom', label: '下装' },
  { value: 'outerwear', label: '外套' },
  { value: 'dress', label: '连衣裙' },
  { value: 'shoes', label: '鞋子' },
  { value: 'accessory', label: '配饰' },
];

interface Props {
  garments: Garment[];
  onAdd: (garment: Garment) => void;
  compact?: boolean;
}

export function GarmentPalette({ garments, onAdd, compact }: Props) {
  const [activeTab, setActiveTab] = useState<GarmentCategory>('top');

  const filtered = garments.filter((g) => g.category === activeTab);

  return (
    <div>
      {/* Category tabs */}
      <div className="flex flex-wrap gap-1 mb-3">
        {CATEGORIES.map(({ value, label }) => (
          <button
            key={value}
            onClick={() => setActiveTab(value)}
            className={`px-2.5 py-1 text-xs rounded-md transition-colors ${
              activeTab === value
                ? 'bg-[var(--accent)] text-white'
                : 'bg-gray-100 text-[var(--text-secondary)] hover:bg-gray-200'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Garment list */}
      {filtered.length === 0 ? (
        <p className="text-xs text-[var(--text-secondary)] py-4 text-center">暂无此类单品</p>
      ) : (
        <div className={`grid gap-2 ${compact ? 'grid-cols-3' : 'grid-cols-2'}`}>
          {filtered.map((g) => (
            <button
              key={g.id}
              onClick={() => onAdd(g)}
              className="text-left group border border-[var(--border-light)] rounded-lg overflow-hidden hover:border-[var(--accent)]/50 hover:shadow-sm transition-all"
            >
              <div className="bg-gray-50" style={{ aspectRatio: '3/4' }}>
                <LocalImage
                  path={g.thumbnailUrl}
                  alt={g.name}
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="p-1.5">
                <p className="text-xs truncate font-medium">{g.name}</p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
