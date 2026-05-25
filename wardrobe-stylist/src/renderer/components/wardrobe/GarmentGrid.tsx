import { useWardrobeStore } from '../../stores/wardrobe-store';
import { GarmentCard } from './GarmentCard';
import { Shirt } from 'lucide-react';

export function GarmentGrid() {
  const garments = useWardrobeStore((s) => s.garments);
  const filteredGarments = useWardrobeStore((s) => s.filteredGarments);
  const setSelectedGarment = useWardrobeStore((s) => s.setSelectedGarment);
  const filters = useWardrobeStore((s) => s.filters);

  const display = filteredGarments();

  if (garments.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-[var(--text-secondary)]">
        <Shirt size={48} className="mb-4 text-gray-300" />
        <p className="text-lg font-medium mb-1">还没有单品</p>
        <p className="text-sm">点击 "+ 添加单品" 开始建立你的数字衣橱</p>
      </div>
    );
  }

  if (display.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-[var(--text-secondary)]">
        <p className="text-sm">没有匹配的筛选结果</p>
      </div>
    );
  }

  return (
    <div className="grid gap-4" style={{
      gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
    }}>
      {display.map((g) => (
        <GarmentCard
          key={g.id}
          garment={g}
          onClick={() => setSelectedGarment(g)}
        />
      ))}
    </div>
  );
}
