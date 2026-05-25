import type { Garment } from '../../lib/types';
import { LocalImage } from '../shared/LocalImage';

const CATEGORY_LABELS: Record<string, string> = {
  top: '上衣', bottom: '下装', outerwear: '外套', dress: '连衣裙',
  shoes: '鞋子', bag: '包', accessory: '配饰', hat: '帽子', scarf: '围巾', other: '其他',
};

interface Props {
  garment: Garment;
  onClick: () => void;
}

export function GarmentCard({ garment, onClick }: Props) {
  return (
    <div
      className="group bg-white rounded-xl border border-[var(--border-light)] overflow-hidden cursor-pointer hover:shadow-md transition-all hover:-translate-y-0.5"
      onClick={onClick}
      style={{ boxShadow: 'var(--card-shadow)' }}
    >
      <div className="relative bg-gray-50" style={{ aspectRatio: '3/4' }}>
        <LocalImage
          path={garment.thumbnailUrl}
          alt={garment.name}
          className="w-full h-full object-cover"
        />
        {garment.favorite && (
          <div className="absolute top-2 right-2 text-xs px-1.5 py-0.5 rounded bg-white/80 text-rose-500">
            ★
          </div>
        )}
      </div>

      <div className="p-3">
        <h3 className="text-sm font-medium truncate">{garment.name}</h3>
        <div className="flex items-center gap-2 mt-1">
          <span className="text-xs px-1.5 py-0.5 rounded bg-gray-100 text-[var(--text-secondary)]">
            {CATEGORY_LABELS[garment.category] || garment.category}
          </span>
          {garment.wearCount > 0 && (
            <span className="text-xs text-[var(--text-secondary)]">
              穿{garment.wearCount}次
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
