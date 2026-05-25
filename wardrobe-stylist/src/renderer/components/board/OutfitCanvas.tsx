import { useState } from 'react';
import type { BoardItem } from '../../app/board/page';
import { LocalImage } from '../shared/LocalImage';
import { X, ArrowUp, ArrowDown } from 'lucide-react';

interface Props {
  items: BoardItem[];
  onUpdateItem: (index: number, updates: Partial<BoardItem>) => void;
  onRemoveItem: (index: number) => void;
}

export function OutfitCanvas({ items, onUpdateItem, onRemoveItem }: Props) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  if (items.length === 0) {
    return (
      <div className="w-full h-full flex items-center justify-center text-[var(--text-secondary)]">
        <div className="text-center">
          <p className="text-lg mb-1">画板为空</p>
          <p className="text-sm">从右侧拖拽或点击单品添加到画板</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="relative bg-white rounded-xl shadow-sm border border-[var(--border-light)]"
      style={{ width: 800, height: 600 }}
    >
      {items.map((item, i) => (
        <div
          key={`${item.garment.id}-${i}`}
          className={`absolute cursor-move group rounded-lg overflow-hidden border-2 transition-shadow ${
            selectedIndex === i ? 'border-[var(--accent)] shadow-lg z-50' : 'border-transparent hover:border-gray-300'
          }`}
          style={{
            left: item.x,
            top: item.y,
            width: item.width,
            height: item.height,
            zIndex: item.zIndex,
          }}
          onClick={(e) => {
            e.stopPropagation();
            setSelectedIndex(i);
          }}
          onMouseDown={(e) => {
            const startX = e.clientX;
            const startY = e.clientY;
            const origX = item.x;
            const origY = item.y;

            const onMove = (ev: MouseEvent) => {
              onUpdateItem(i, {
                x: origX + ev.clientX - startX,
                y: origY + ev.clientY - startY,
              });
            };
            const onUp = () => {
              document.removeEventListener('mousemove', onMove);
              document.removeEventListener('mouseup', onUp);
            };
            document.addEventListener('mousemove', onMove);
            document.addEventListener('mouseup', onUp);
          }}
        >
          <LocalImage
            path={item.garment.thumbnailUrl}
            alt={item.garment.name}
            className="w-full h-full object-cover pointer-events-none"
          />

          {/* Controls */}
          {selectedIndex === i && (
            <div className="absolute top-1 right-1 flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={(e) => { e.stopPropagation(); onUpdateItem(i, { zIndex: item.zIndex + 1 }); }}
                className="w-6 h-6 bg-white/90 rounded flex items-center justify-center hover:bg-white shadow-sm"
              >
                <ArrowUp size={12} />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); onUpdateItem(i, { zIndex: Math.max(0, item.zIndex - 1) }); }}
                className="w-6 h-6 bg-white/90 rounded flex items-center justify-center hover:bg-white shadow-sm"
              >
                <ArrowDown size={12} />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); onRemoveItem(i); }}
                className="w-6 h-6 bg-white/90 rounded flex items-center justify-center hover:bg-red-50 text-red-500 shadow-sm"
              >
                <X size={12} />
              </button>
            </div>
          )}

          {/* Resize handles */}
          {selectedIndex === i && (
            <>
              <div
                className="absolute -bottom-1 -right-1 w-4 h-4 bg-[var(--accent)] rounded-full cursor-se-resize"
                onMouseDown={(e) => {
                  e.stopPropagation();
                  const startX = e.clientX;
                  const startY = e.clientY;
                  const origW = item.width;
                  const origH = item.height;
                  const onMove = (ev: MouseEvent) => {
                    onUpdateItem(i, {
                      width: Math.max(60, origW + ev.clientX - startX),
                      height: Math.max(80, origH + ev.clientY - startY),
                    });
                  };
                  const onUp = () => {
                    document.removeEventListener('mousemove', onMove);
                    document.removeEventListener('mouseup', onUp);
                  };
                  document.addEventListener('mousemove', onMove);
                  document.addEventListener('mouseup', onUp);
                }}
              />
            </>
          )}
        </div>
      ))}
    </div>
  );
}
