import { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { useWardrobeStore } from '../../stores/wardrobe-store';
import { FilterBar } from '../../components/wardrobe/FilterBar';
import { GarmentGrid } from '../../components/wardrobe/GarmentGrid';
import { GarmentForm } from '../../components/wardrobe/GarmentForm';
import { GarmentDetail } from '../../components/wardrobe/GarmentDetail';

export function WardrobePage() {
  const loadGarments = useWardrobeStore((s) => s.loadGarments);
  const garments = useWardrobeStore((s) => s.garments);
  const selectedGarment = useWardrobeStore((s) => s.selectedGarment);
  const setSelectedGarment = useWardrobeStore((s) => s.setSelectedGarment);
  const loading = useWardrobeStore((s) => s.loading);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    loadGarments();
  }, []);

  return (
    <div className="p-8 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">我的衣橱</h1>
          <p className="text-sm text-[var(--text-secondary)] mt-1">共 {garments.length} 件单品</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-4 py-2 bg-[var(--accent)] text-white rounded-lg hover:bg-[var(--accent-light)] transition-colors text-sm font-medium"
        >
          <Plus size={18} />
          添加单品
        </button>
      </div>

      {/* Filters */}
      <div className="mb-6">
        <FilterBar />
      </div>

      {/* Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin w-8 h-8 border-2 border-[var(--accent)] border-t-transparent rounded-full" />
        </div>
      ) : (
        <GarmentGrid />
      )}

      {/* Modals */}
      {showForm && <GarmentForm onClose={() => setShowForm(false)} />}
      {selectedGarment && (
        <GarmentDetail
          garment={selectedGarment}
          onClose={() => setSelectedGarment(null)}
        />
      )}
    </div>
  );
}
