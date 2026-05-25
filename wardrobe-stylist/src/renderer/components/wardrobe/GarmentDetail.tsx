import { useState } from 'react';
import { X, Edit2, Trash2, Heart } from 'lucide-react';
import { useWardrobeStore } from '../../stores/wardrobe-store';
import { LocalImage } from '../shared/LocalImage';
import type { Garment } from '../../lib/types';

const CATEGORY_LABELS: Record<string, string> = {
  top: '上衣', bottom: '下装', outerwear: '外套', dress: '连衣裙',
  shoes: '鞋子', bag: '包', accessory: '配饰', hat: '帽子', scarf: '围巾', other: '其他',
};

interface Props {
  garment: Garment;
  onClose: () => void;
}

export function GarmentDetail({ garment, onClose }: Props) {
  const updateGarment = useWardrobeStore((s) => s.updateGarment);
  const deleteGarment = useWardrobeStore((s) => s.deleteGarment);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(garment.name);
  const [notes, setNotes] = useState(garment.notes || '');
  const [confirmDelete, setConfirmDelete] = useState(false);

  const colors = JSON.parse(garment.colors) as string[];
  const seasons = JSON.parse(garment.seasons) as string[];
  const occasions = JSON.parse(garment.occasions) as string[];

  const handleDelete = async () => {
    await deleteGarment(garment.id);
    onClose();
  };

  const handleSave = async () => {
    await updateGarment(garment.id, { name, notes });
    setEditing(false);
  };

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 animate-fade-in">
      <div className="bg-white rounded-2xl shadow-xl w-[560px] max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-light)]">
          <h2 className="text-lg font-semibold">
            {editing ? (
              <input
                type="text" value={name} onChange={(e) => setName(e.target.value)}
                className="px-2 py-1 border border-[var(--border-light)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30"
              />
            ) : (
              garment.name
            )}
          </h2>
          <div className="flex items-center gap-1">
            <button
              onClick={() => editing ? handleSave() : setEditing(true)}
              className="p-1.5 rounded-lg hover:bg-gray-100 text-[var(--text-secondary)]"
            >
              <Edit2 size={16} />
            </button>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100">
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Image */}
        <div className="bg-gray-50" style={{ aspectRatio: '3/4' }}>
          <LocalImage
            path={garment.imageUrl}
            alt={garment.name}
            className="w-full h-full object-contain"
          />
        </div>

        {/* Details */}
        <div className="p-6 space-y-3">
          <div className="flex flex-wrap gap-2">
            <span className="text-xs px-2 py-1 rounded-md bg-[var(--accent)]/10 text-[var(--accent)] font-medium">
              {CATEGORY_LABELS[garment.category] || garment.category}
            </span>
            {colors.map((c) => (
              <span key={c} className="text-xs px-2 py-1 rounded-md bg-gray-100 text-[var(--text-secondary)]">{c}</span>
            ))}
            {seasons.map((s) => (
              <span key={s} className="text-xs px-2 py-1 rounded-md bg-blue-50 text-blue-600">{s}</span>
            ))}
          </div>

          <div className="flex flex-wrap gap-2">
            {occasions.map((o) => (
              <span key={o} className="text-xs px-2 py-1 rounded-md bg-green-50 text-green-600">{o}</span>
            ))}
          </div>

          {garment.brand && (
            <p className="text-sm text-[var(--text-secondary)]">品牌：{garment.brand}</p>
          )}
          {garment.price && (
            <p className="text-sm text-[var(--text-secondary)]">价格：¥{garment.price}</p>
          )}
          {garment.wearCount > 0 && (
            <p className="text-sm text-[var(--text-secondary)]">穿着次数：{garment.wearCount} 次</p>
          )}

          {editing ? (
            <textarea
              value={notes} onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-[var(--border-light)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30 resize-none"
              rows={2}
              placeholder="备注..."
            />
          ) : garment.notes ? (
            <p className="text-sm text-[var(--text-secondary)]">{garment.notes}</p>
          ) : null}
        </div>

        {/* Footer */}
        <div className="flex justify-between px-6 py-4 border-t border-[var(--border-light)]">
          <button
            onClick={() => updateGarment(garment.id, { favorite: !garment.favorite })}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg transition-colors ${
              garment.favorite ? 'text-rose-500 bg-rose-50' : 'text-[var(--text-secondary)] hover:bg-gray-100'
            }`}
          >
            <Heart size={16} fill={garment.favorite ? 'currentColor' : 'none'} />
            {garment.favorite ? '已收藏' : '收藏'}
          </button>

          {confirmDelete ? (
            <div className="flex items-center gap-2">
              <span className="text-sm text-red-500">确认删除？</span>
              <button onClick={handleDelete} className="px-3 py-1.5 text-sm bg-red-500 text-white rounded-lg">确认</button>
              <button onClick={() => setConfirmDelete(false)} className="px-3 py-1.5 text-sm rounded-lg hover:bg-gray-100">取消</button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmDelete(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-red-500 hover:bg-red-50 rounded-lg transition-colors"
            >
              <Trash2 size={16} />
              删除
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
