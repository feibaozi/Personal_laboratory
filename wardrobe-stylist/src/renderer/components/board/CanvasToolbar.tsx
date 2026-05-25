import { useState } from 'react';
import { Save, Download, Trash2 } from 'lucide-react';
import { useOutfitStore } from '../../stores/outfit-store';
import type { BoardItem } from '../../app/board/page';
import type { TryOnItem } from '../../app/board/page';

interface Props {
  boardItems: BoardItem[];
  tryOnItems: TryOnItem[];
}

export function CanvasToolbar({ boardItems, tryOnItems }: Props) {
  const saveOutfit = useOutfitStore((s) => s.saveOutfit);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [outfitName, setOutfitName] = useState('');

  const handleSave = async () => {
    if (!outfitName.trim()) return;
    try {
      await saveOutfit({
        name: outfitName,
        garments: boardItems.map((item) => ({
          garmentId: item.garment.id,
          layer: item.zIndex,
          position: { x: item.x, y: item.y, width: item.width, height: item.height, zIndex: item.zIndex },
        })),
      });
      setShowSaveDialog(false);
      setOutfitName('');
    } catch (e) {
      console.error('Failed to save outfit:', e);
    }
  };

  const handleExport = async () => {
    try {
      const html2canvas = (await import('html2canvas')).default;
      // Try to find the visible canvas (try-on mode) or board area (board mode)
      const target = document.querySelector('.outfit-canvas') as HTMLElement
        || document.querySelector('[class*="relative bg-white rounded-xl"]') as HTMLElement;
      if (!target) { alert('未找到可导出的画板内容'); return; }
      const dataUrl = (await html2canvas(target, { useCORS: true, allowTaint: true })).toDataURL('image/png');
      const link = document.createElement('a');
      link.download = `outfit-${Date.now()}.png`;
      link.href = dataUrl;
      link.click();
    } catch (e) {
      console.error('Export failed:', e);
      alert('导出失败，请重试');
    }
  };

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => setShowSaveDialog(true)}
        disabled={boardItems.length === 0 && tryOnItems.length === 0}
        className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-[var(--accent)] text-white rounded-lg hover:bg-[var(--accent-light)] disabled:opacity-50 transition-colors"
      >
        <Save size={15} /> 保存搭配
      </button>
      <button
        onClick={handleExport}
        disabled={boardItems.length === 0 && tryOnItems.length === 0}
        className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-[var(--border-light)] rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors"
      >
        <Download size={15} /> 导出图片
      </button>

      {/* Save dialog */}
      {showSaveDialog && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-80 shadow-xl">
            <h3 className="text-lg font-semibold mb-4">保存搭配</h3>
            <input
              type="text"
              value={outfitName}
              onChange={(e) => setOutfitName(e.target.value)}
              placeholder="搭配名称..."
              className="w-full px-3 py-2 text-sm border border-[var(--border-light)] rounded-lg mb-4 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30"
              autoFocus
            />
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowSaveDialog(false)} className="px-4 py-2 text-sm rounded-lg hover:bg-gray-100">取消</button>
              <button onClick={handleSave} className="px-4 py-2 text-sm rounded-lg bg-[var(--accent)] text-white hover:bg-[var(--accent-light)]">保存</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
