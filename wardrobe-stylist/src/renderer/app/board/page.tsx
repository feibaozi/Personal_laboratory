import { useEffect, useState } from 'react';
import { useWardrobeStore } from '../../stores/wardrobe-store';
import { useUIStore } from '../../stores/ui-store';
import { OutfitCanvas } from '../../components/board/OutfitCanvas';
import { GarmentPalette } from '../../components/board/GarmentPalette';
import { TryOnView } from '../../components/board/TryOnView';
import { BodyTemplatePicker } from '../../components/board/BodyTemplatePicker';
import { CanvasToolbar } from '../../components/board/CanvasToolbar';
import type { Garment, TryOnConfig } from '../../lib/types';
import { LayoutGrid, Shirt, Wand2 } from 'lucide-react';

const RENDER_ORDER = ['template', 'bottom', 'top', 'dress', 'outerwear', 'scarf', 'shoes', 'bag', 'hat', 'accessory'];

export interface BoardItem {
  garment: Garment;
  x: number;
  y: number;
  width: number;
  height: number;
  zIndex: number;
}

export interface TryOnItem {
  garment: Garment;
  config: TryOnConfig;
}

export function BoardPage() {
  const garments = useWardrobeStore((s) => s.garments);
  const loadGarments = useWardrobeStore((s) => s.loadGarments);
  const tryOnMode = useUIStore((s) => s.tryOnMode);
  const setTryOnMode = useUIStore((s) => s.setTryOnMode);

  const [boardItems, setBoardItems] = useState<BoardItem[]>([]);
  const [tryOnItems, setTryOnItems] = useState<TryOnItem[]>([]);
  const [templateId, setTemplateId] = useState('male-standard');

  useEffect(() => {
    if (garments.length === 0) loadGarments();
  }, []);

  const handleAddToBoard = (garment: Garment) => {
    setBoardItems((prev) => [
      ...prev,
      {
        garment,
        x: 50 + prev.length * 30,
        y: 50 + prev.length * 30,
        width: 120,
        height: 160,
        zIndex: prev.length,
      },
    ]);
  };

  const handleRemoveFromBoard = (index: number) => {
    setBoardItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleUpdateBoardItem = (index: number, updates: Partial<BoardItem>) => {
    setBoardItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, ...updates } : item))
    );
  };

  // Anchor points with AI fit adjustment
  const getAnchor = (garment: Garment) => {
    const anchors: Record<string, { x: number; y: number; scale: number }> = {
      top:        { x: 300, y: 250, scale: 0.35 },
      bottom:     { x: 300, y: 570, scale: 0.32 },
      outerwear:  { x: 300, y: 230, scale: 0.42 },
      dress:      { x: 300, y: 450, scale: 0.45 },
      shoes:      { x: 300, y: 830, scale: 0.10 },
      hat:        { x: 300, y: 55,  scale: 0.14 },
      bag:        { x: 440, y: 460, scale: 0.12 },
      accessory:  { x: 300, y: 350, scale: 0.08 },
      scarf:      { x: 300, y: 160, scale: 0.20 },
    };
    let a = anchors[garment.category] || { x: 300, y: 400, scale: 0.3 };

    // AI fit adjustments
    if (garment.fit === 'oversized') { a = { ...a, scale: a.scale * 1.18 }; }
    if (garment.fit === 'slim')      { a = { ...a, scale: a.scale * 0.90 }; }
    if (garment.fit === 'loose')     { a = { ...a, scale: a.scale * 1.06 }; }
    if (garment.garmentLength === 'long')   { a = { ...a, y: a.y + 15, scale: a.scale * 1.08 }; }
    if (garment.garmentLength === 'cropped') { a = { ...a, y: a.y - 15, scale: a.scale * 0.88 }; }

    return a;
  };

  const [aiTuning, setAiTuning] = useState(false);
  const [aiTuneMsg, setAiTuneMsg] = useState('');

  const handleAIFineTune = async () => {
    if (tryOnItems.length === 0) return;
    setAiTuning(true);
    setAiTuneMsg('');
    try {
      const canvas = document.querySelector('.outfit-canvas') as HTMLCanvasElement;
      if (!canvas) { setAiTuneMsg('未找到画布'); setAiTuning(false); return; }
      const dataUrl = canvas.toDataURL('image/png');
      const base64 = dataUrl.split(',')[1];
      const result = await window.electronAPI.analyzeGarment(base64);
      if (result?.comment) setAiTuneMsg(result.comment);
      else setAiTuneMsg('AI 已分析，请手动微调位置和大小');
    } catch (e: any) { setAiTuneMsg(`失败: ${e.message}`); }
    setAiTuning(false);
  };

  const handleAddToTryOn = (garment: Garment) => {
    const anchor = getAnchor(garment);
    const sameCat = tryOnItems.filter((i) => i.garment.category === garment.category).length;
    const offsetX = sameCat * 10;
    const offsetY = sameCat * 10;

    setTryOnItems((prev) => [
      ...prev,
      {
        garment,
        config: {
          garmentId: garment.id,
          offsetX: anchor.x + offsetX,
          offsetY: anchor.y + offsetY,
          scaleX: anchor.scale,
          scaleY: anchor.scale,
          zIndex: RENDER_ORDER.indexOf(garment.category) + prev.length,
          rotation: 0,
        },
      },
    ]);
  };

  return (
    <div className="h-full flex flex-col animate-fade-in">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-[var(--border-light)] bg-white">
        <h1 className="text-lg font-semibold">搭配画板</h1>
        <div className="flex items-center gap-3">
          {/* Mode toggle */}
          <div className="flex bg-gray-100 rounded-lg p-0.5">
            <button
              onClick={() => setTryOnMode(false)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md transition-colors ${
                !tryOnMode ? 'bg-white shadow-sm text-[var(--text-primary)]' : 'text-[var(--text-secondary)]'
              }`}
            >
              <LayoutGrid size={15} /> 画板模式
            </button>
            <button
              onClick={() => setTryOnMode(true)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md transition-colors ${
                tryOnMode ? 'bg-white shadow-sm text-[var(--text-primary)]' : 'text-[var(--text-secondary)]'
              }`}
            >
              <Shirt size={15} /> 试穿模式
            </button>
          </div>
          <CanvasToolbar boardItems={boardItems} tryOnItems={tryOnItems} />
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Canvas area */}
        <div className="flex-1 bg-gray-50 flex items-center justify-center p-6">
          {tryOnMode ? (
            <div className="flex flex-col items-center gap-2">
              <TryOnView
                items={tryOnItems}
                templateId={templateId}
                onUpdateItem={(index, config) =>
                  setTryOnItems((prev) =>
                    prev.map((item, i) => (i === index ? { ...item, config } : item))
                  )
                }
                onRemoveItem={(index) =>
                  setTryOnItems((prev) => prev.filter((_, i) => i !== index))
                }
                onAIFineTune={handleAIFineTune}
              />
              {aiTuneMsg && (
                <div className="p-3 bg-purple-50 border border-purple-200 rounded-lg text-xs text-purple-700 max-w-[600px]">
                  {aiTuneMsg}
                </div>
              )}
            </div>
          ) : (
            <OutfitCanvas
              items={boardItems}
              onUpdateItem={handleUpdateBoardItem}
              onRemoveItem={handleRemoveFromBoard}
            />
          )}
        </div>

        {/* Right panel */}
        <div className="w-72 border-l border-[var(--border-light)] bg-white overflow-y-auto p-4">
          {tryOnMode ? (
            <>
              <BodyTemplatePicker selected={templateId} onSelect={setTemplateId} />
              <div className="mt-4">
                <h3 className="text-sm font-semibold mb-2">添加单品</h3>
                <GarmentPalette
                  garments={garments}
                  onAdd={handleAddToTryOn}
                  compact
                />
              </div>
            </>
          ) : (
            <>
              <h3 className="text-sm font-semibold mb-3">单品选择区</h3>
              <GarmentPalette
                garments={garments}
                onAdd={handleAddToBoard}
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
