import { useRef, useEffect, useState, useCallback } from 'react';
import type { TryOnItem } from '../../app/board/page';
import type { TryOnConfig } from '../../lib/types';

const W = 600, H = 900;

const RENDER_ORDER = ['template', 'bottom', 'top', 'dress', 'outerwear', 'scarf', 'shoes', 'bag', 'hat', 'accessory'];

const CATEGORY_LABELS: Record<string, string> = {
  top: '上衣', bottom: '下装', outerwear: '外套', dress: '连衣裙',
  shoes: '鞋子', bag: '包', accessory: '配饰', hat: '帽子', scarf: '围巾',
};

interface Props {
  items: TryOnItem[];
  templateId: string;
  onUpdateItem: (index: number, config: TryOnConfig) => void;
  onRemoveItem: (index: number) => void;
  onAIFineTune?: () => void;
}

export function TryOnView({ items, templateId, onUpdateItem, onRemoveItem, onAIFineTune }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const TemplateImgRef = useRef<HTMLImageElement | null>(null);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [garmentImgs, setGarmentImgs] = useState<Map<string, HTMLImageElement>>(new Map());
  const [templateLoaded, setTemplateLoaded] = useState(false);
  const [dragInfo, setDragInfo] = useState<{ index: number; startX: number; startY: number; origX: number; origY: number } | null>(null);

  // Load template PNG image
  useEffect(() => {
    let cancelled = false;
    window.electronAPI.getTemplateData(templateId).then((dataUrl) => {
      if (cancelled || !dataUrl) { setTemplateLoaded(false); return; }
      const img = new Image();
      img.onload = () => {
        if (!cancelled) {
          TemplateImgRef.current = img;
          setTemplateLoaded(true);
        }
      };
      img.src = dataUrl;
    }).catch(() => setTemplateLoaded(false));
    return () => { cancelled = true; };
  }, [templateId]);

  const sortedItems = [...items].sort((a, b) => {
    const aIdx = RENDER_ORDER.indexOf(a.garment.category) ?? 99;
    const bIdx = RENDER_ORDER.indexOf(b.garment.category) ?? 99;
    return aIdx - bIdx;
  });

  // Load garment images
  useEffect(() => {
    const imgMap = new Map<string, HTMLImageElement>();
    for (const item of items) {
      if (!imgMap.has(item.garment.id)) {
        const img = new Image();
        // Load via electronAPI - prefer sticker (transparent) over original
        const imgPath = item.garment.stickerUrl || item.garment.imageUrl;
        window.electronAPI.readImageDataUrl(imgPath).then((dataUrl) => {
          if (dataUrl) {
            img.src = dataUrl;
            imgMap.set(item.garment.id, img);
            setGarmentImgs(new Map(imgMap));
          }
        });
      }
    }
  }, [items.map((i) => i.garment.id).join(',')]);

  const drawBodyOutline = useCallback((ctx: CanvasRenderingContext2D) => {
    const cx = W / 2;
    ctx.strokeStyle = '#D1D5DB';
    ctx.fillStyle = '#F3F4F6';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Head
    ctx.beginPath();
    ctx.arc(cx, 60, 40, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Neck
    ctx.beginPath();
    ctx.moveTo(cx - 10, 100);
    ctx.lineTo(cx + 10, 100);
    ctx.lineTo(cx + 15, 130);
    ctx.lineTo(cx - 15, 130);
    ctx.closePath();
    ctx.fill();

    // Shoulders + torso
    ctx.beginPath();
    ctx.moveTo(cx - 80, 140);
    ctx.lineTo(cx + 80, 140);
    ctx.lineTo(cx + 55, 200);
    ctx.lineTo(cx - 55, 200);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Torso (waist)
    ctx.beginPath();
    ctx.moveTo(cx - 55, 200);
    ctx.lineTo(cx + 55, 200);
    ctx.lineTo(cx + 45, 400);
    ctx.lineTo(cx - 45, 400);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Hips
    ctx.beginPath();
    ctx.moveTo(cx - 45, 400);
    ctx.lineTo(cx + 45, 400);
    ctx.lineTo(cx + 50, 470);
    ctx.lineTo(cx - 50, 470);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Left leg
    ctx.beginPath();
    ctx.moveTo(cx - 25, 470);
    ctx.lineTo(cx - 10, 470);
    ctx.lineTo(cx - 12, 800);
    ctx.lineTo(cx - 28, 800);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Right leg
    ctx.beginPath();
    ctx.moveTo(cx + 10, 470);
    ctx.lineTo(cx + 25, 470);
    ctx.lineTo(cx + 28, 800);
    ctx.lineTo(cx + 12, 800);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Left arm
    ctx.beginPath();
    ctx.moveTo(cx - 80, 140);
    ctx.lineTo(cx - 100, 250);
    ctx.lineTo(cx - 85, 260);
    ctx.lineTo(cx - 65, 150);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Right arm
    ctx.beginPath();
    ctx.moveTo(cx + 80, 140);
    ctx.lineTo(cx + 100, 250);
    ctx.lineTo(cx + 85, 260);
    ctx.lineTo(cx + 65, 150);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Feet
    ctx.fillStyle = '#E5E7EB';
    ctx.fillRect(cx - 35, 800, 22, 25);
    ctx.fillRect(cx + 13, 800, 22, 25);
    ctx.strokeRect(cx - 35, 800, 22, 25);
    ctx.strokeRect(cx + 13, 800, 22, 25);

    // Category hint labels
    ctx.fillStyle = '#9CA3AF';
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'center';

    // Draw dashed guide lines for garment positions
    ctx.setLineDash([5, 8]);
    ctx.strokeStyle = '#E5E7EB';
    ctx.lineWidth = 1;

    // Chest line (top anchor)
    ctx.beginPath();
    ctx.moveTo(cx - 90, 250); ctx.lineTo(cx + 90, 250);
    ctx.stroke();
    ctx.fillText('上衣', cx, 240);

    // Waist line (bottom anchor)
    ctx.beginPath();
    ctx.moveTo(cx - 90, 570); ctx.lineTo(cx + 90, 570);
    ctx.stroke();
    ctx.fillText('下装', cx, 560);

    // Feet line (shoes anchor)
    ctx.beginPath();
    ctx.moveTo(cx - 90, 830); ctx.lineTo(cx + 90, 830);
    ctx.stroke();
    ctx.fillText('鞋子', cx, 820);

    ctx.setLineDash([]);

    // Template info
    ctx.fillStyle = '#D1D5DB';
    ctx.font = '12px sans-serif';
    ctx.fillText(`模板: ${templateId}`, cx, H - 15);
  }, [templateId]);

  // Render
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#F9FAFB';
    ctx.fillRect(0, 0, W, H);

    // Draw template: use PNG if available, else vector outline
    if (templateLoaded && TemplateImgRef.current) {
      ctx.drawImage(TemplateImgRef.current, 0, 0, W, H);
    } else {
      drawBodyOutline(ctx);
    }

    // Draw garments on top
    for (let i = 0; i < sortedItems.length; i++) {
      const item = sortedItems[i];
      const origIdx = items.indexOf(item);
      const img = garmentImgs.get(item.garment.id);
      if (!img || !img.complete) continue;

      const { offsetX, offsetY, scaleX, scaleY } = item.config;
      ctx.save();
      ctx.translate(offsetX, offsetY);
      const iw = img.width * scaleX;
      const ih = img.height * scaleY;
      ctx.globalAlpha = 0.92;
      ctx.drawImage(img, -iw / 2, -ih / 2, iw, ih);

      // Selection highlight
      if (selectedIndex === origIdx) {
        ctx.strokeStyle = '#C8956C';
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 3]);
        ctx.strokeRect(-iw / 2 - 4, -ih / 2 - 4, iw + 8, ih + 8);
        ctx.setLineDash([]);
      }

      ctx.restore();
    }

    // Draw category labels for placed items
    ctx.fillStyle = '#6B7280';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'left';
    let labelY = 15;
    for (const item of sortedItems) {
      ctx.fillText(`${CATEGORY_LABELS[item.garment.category] || item.garment.category}: ${item.garment.name}`, 10, labelY);
      labelY += 16;
    }
  }, [items, sortedItems, selectedIndex, garmentImgs, drawBodyOutline, templateId, templateLoaded]);

  // Mouse handlers for drag
  const getCanvasPos = (e: React.MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = W / rect.width;
    const scaleY = H / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  const findItemAt = (x: number, y: number): number | null => {
    // Check from top (last drawn) to bottom
    for (let i = sortedItems.length - 1; i >= 0; i--) {
      const item = sortedItems[i];
      const img = garmentImgs.get(item.garment.id);
      const iw = img ? img.width * item.config.scaleX : 60;
      const ih = img ? img.height * item.config.scaleY : 80;
      const left = item.config.offsetX - iw / 2;
      const right = item.config.offsetX + iw / 2;
      const top = item.config.offsetY - ih / 2;
      const bottom = item.config.offsetY + ih / 2;

      if (x >= left && x <= right && y >= top && y <= bottom) {
        return items.indexOf(item);
      }
    }
    return null;
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    const { x, y } = getCanvasPos(e);
    const idx = findItemAt(x, y);
    setSelectedIndex(idx);

    if (idx !== null) {
      setDragInfo({
        index: idx,
        startX: x,
        startY: y,
        origX: items[idx].config.offsetX,
        origY: items[idx].config.offsetY,
      });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!dragInfo) return;
    const { x, y } = getCanvasPos(e);
    const dx = x - dragInfo.startX;
    const dy = y - dragInfo.startY;
    onUpdateItem(dragInfo.index, {
      ...items[dragInfo.index].config,
      offsetX: dragInfo.origX + dx,
      offsetY: dragInfo.origY + dy,
    });
  };

  const handleMouseUp = () => {
    setDragInfo(null);
  };

  const handleWheel = (e: React.WheelEvent) => {
    if (selectedIndex === null) return;
    e.preventDefault();
    const item = items[selectedIndex];
    const factor = e.deltaY < 0 ? 1.1 : 0.9;
    onUpdateItem(selectedIndex, {
      ...item.config,
      scaleX: Math.max(0.05, Math.min(1.5, item.config.scaleX * factor)),
      scaleY: Math.max(0.05, Math.min(1.5, item.config.scaleY * factor)),
    });
  };

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-[var(--text-secondary)]">
        <p className="text-lg mb-1">试穿预览</p>
        <p className="text-sm">从右侧点击单品添加到人体模板上</p>
        <p className="text-xs mt-2 text-gray-400">上衣 → 胸部 | 下装 → 腰部 | 鞋子 → 脚部</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <canvas
        ref={canvasRef}
        width={W}
        height={H}
        className="outfit-canvas rounded-xl shadow-sm border border-[var(--border-light)] cursor-crosshair"
        style={{ width: W, height: H }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
      />

      {/* Controls */}
      {selectedIndex !== null && items[selectedIndex] && (
        <div className="flex items-center gap-2 text-sm">
          <span className="font-medium text-[var(--text-secondary)]">
            {items[selectedIndex].garment.name}
          </span>
          <span className="text-xs text-gray-400">
            ({CATEGORY_LABELS[items[selectedIndex].garment.category]})
          </span>
          <button
            onClick={() => {
              const item = items[selectedIndex];
              onUpdateItem(selectedIndex, {
                ...item.config,
                scaleX: item.config.scaleX * 1.15,
                scaleY: item.config.scaleY * 1.15,
              });
            }}
            className="px-2 py-0.5 text-xs border rounded hover:bg-gray-100"
          >放大</button>
          <button
            onClick={() => {
              const item = items[selectedIndex];
              onUpdateItem(selectedIndex, {
                ...item.config,
                scaleX: item.config.scaleX * 0.87,
                scaleY: item.config.scaleY * 0.87,
              });
            }}
            className="px-2 py-0.5 text-xs border rounded hover:bg-gray-100"
          >缩小</button>
          <button
            onClick={() => onRemoveItem(selectedIndex)}
            className="px-2 py-0.5 text-xs border rounded hover:bg-red-50 text-red-500"
          >移除</button>
          <span className="text-xs text-gray-400 ml-2">滚轮缩放 | 拖拽移动</span>
          {onAIFineTune && (
            <button
              onClick={onAIFineTune}
              className="px-2 py-0.5 text-xs rounded border border-purple-200 bg-purple-50 text-purple-600 hover:bg-purple-100"
            >🤖 AI 微调</button>
          )}
        </div>
      )}
    </div>
  );
}
