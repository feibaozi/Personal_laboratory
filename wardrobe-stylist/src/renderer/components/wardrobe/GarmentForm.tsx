import { useState } from 'react';
import { X } from 'lucide-react';
import { ImageUploader } from '../shared/ImageUploader';
import { ColorPicker } from '../shared/ColorPicker';
import { useWardrobeStore } from '../../stores/wardrobe-store';
import type { GarmentCategory, Color, Season, Occasion, Pattern, Material, Style } from '../../lib/types';

const CATEGORIES: { value: GarmentCategory; label: string }[] = [
  { value: 'top', label: '上衣' }, { value: 'bottom', label: '下装' },
  { value: 'outerwear', label: '外套' }, { value: 'dress', label: '连衣裙' },
  { value: 'shoes', label: '鞋子' }, { value: 'bag', label: '包' },
  { value: 'accessory', label: '配饰' }, { value: 'hat', label: '帽子' },
  { value: 'scarf', label: '围巾' }, { value: 'other', label: '其他' },
];

const OCCASIONS: { value: Occasion; label: string }[] = [
  { value: 'casual', label: '休闲' }, { value: 'work', label: '通勤' },
  { value: 'date', label: '约会' }, { value: 'party', label: '聚会' },
  { value: 'sport', label: '运动' }, { value: 'formal', label: '正式' },
  { value: 'travel', label: '旅行' }, { value: 'home', label: '居家' },
];

const SEASONS: { value: Season; label: string }[] = [
  { value: 'spring', label: '春' }, { value: 'summer', label: '夏' },
  { value: 'autumn', label: '秋' }, { value: 'winter', label: '冬' },
  { value: 'all_season', label: '四季' },
];

const PATTERNS: { value: Pattern; label: string }[] = [
  { value: 'solid', label: '纯色' }, { value: 'stripe', label: '条纹' },
  { value: 'plaid', label: '格子' }, { value: 'floral', label: '碎花' },
  { value: 'graphic', label: '印花' }, { value: 'other', label: '其他' },
];

interface Props {
  onClose: () => void;
}

export function GarmentForm({ onClose }: Props) {
  const addGarment = useWardrobeStore((s) => s.addGarment);

  const [imageUrl, setImageUrl] = useState('');
  const [stickerUrl, setStickerUrl] = useState<string | null>(null);
  const [fit, setFit] = useState<string | null>(null);
  const [garmentLength, setGarmentLength] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [category, setCategory] = useState<GarmentCategory>('top');
  const [colors, setColors] = useState<Color[]>([]);
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [occasions, setOccasions] = useState<Occasion[]>([]);
  const [patterns, setPatterns] = useState<Pattern[]>([]);
  const [style, setStyle] = useState<Style | ''>('');
  const [brand, setBrand] = useState('');
  const [price, setPrice] = useState('');
  const [notes, setNotes] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [aiError, setAiError] = useState('');
  const [saving, setSaving] = useState(false);

  const canSave = imageUrl && name && category && colors.length > 0 && seasons.length > 0 && occasions.length > 0;

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      await addGarment({
        name,
        imageUrl,
        thumbnailUrl: imageUrl,
        stickerUrl,
        fit,
        garmentLength,
        category,
        colors,
        patterns,
        seasons,
        occasions,
        style: style || undefined,
        brand: brand || undefined,
        price: price ? parseFloat(price) : undefined,
        notes: notes || undefined,
      });
      onClose();
    } catch (e) {
      console.error('Failed to save garment:', e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 animate-fade-in">
      <div className="bg-white rounded-2xl shadow-xl w-[720px] max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-light)]">
          <h2 className="text-lg font-semibold">添加单品</h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100">
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 grid grid-cols-2 gap-6">
          {/* Left — Image */}
          <div>
            <label className="block text-sm font-medium mb-2">照片 *</label>
            <ImageUploader
              onImageSelected={(path, sticker) => { setImageUrl(path); setStickerUrl(sticker || null); }}
              preview={imageUrl || null}
            />
            {imageUrl && (
              <button
                type="button"
                onClick={async () => {
                  setAnalyzing(true);
                  setAiError('');
                  try {
                    // Check if AI is configured
                    const status = await window.electronAPI.getAIStatus();
                    if (!status?.enabled) {
                      setAiError('请先在设置中启用 AI 功能并填入 API Key');
                      setAnalyzing(false);
                      return;
                    }
                    const buffer = await window.electronAPI.readImageDataUrl(imageUrl);
                    if (!buffer) { setAiError('无法读取图片'); setAnalyzing(false); return; }
                    const base64 = buffer.split(',')[1];
                    const result = await window.electronAPI.analyzeGarment(base64);
                    if (result) {
                      if (result.name) setName(result.name as string);
                      if (result.category) setCategory(result.category as any);
                      if (result.colors) setColors(result.colors as any[]);
                      if (result.seasons) setSeasons(result.seasons as any[]);
                      if (result.occasions) setOccasions(result.occasions as any[]);
                      if (result.style) setStyle(result.style as any);
                      if (result.pattern) setPatterns([result.pattern as any]);
                      if (result.fit) setFit(result.fit as string);
                      if (result.length) setGarmentLength(result.length as string);
                      setAiError('');
                    } else {
                      setAiError('AI 服务返回为空，请检查 API Key 是否正确');
                    }
                  } catch (e: any) {
                    setAiError(`AI 调用失败: ${e.message || '网络错误'}`);
                  }
                  setAnalyzing(false);
                }}
                disabled={analyzing}
                className="mt-2 w-full flex items-center justify-center gap-1.5 py-2 text-sm rounded-lg border border-purple-200 bg-purple-50 text-purple-600 hover:bg-purple-100 disabled:opacity-50 transition-colors"
              >
                {analyzing ? (
                  <><div className="animate-spin w-4 h-4 border-2 border-purple-400 border-t-transparent rounded-full" /> AI 识别中...</>
                ) : (
                  <>🤖 AI 自动识别</>
                )}
              </button>
            )}
            {aiError && (
              <p className="text-xs text-red-500 mt-1">{aiError}</p>
            )}
          </div>

          {/* Right — Tags */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">名称 *</label>
              <input
                type="text" value={name} onChange={(e) => setName(e.target.value)}
                placeholder="如：白色圆领T恤"
                className="w-full px-3 py-2 text-sm border border-[var(--border-light)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">类别 *</label>
              <select
                value={category} onChange={(e) => setCategory(e.target.value as GarmentCategory)}
                className="w-full px-3 py-2 text-sm border border-[var(--border-light)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30"
              >
                {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">颜色 *</label>
              <ColorPicker selected={colors} onChange={setColors} />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">季节 *</label>
              <div className="flex gap-1.5">
                {SEASONS.map(({ value, label }) => {
                  const active = seasons.includes(value);
                  return (
                    <button
                      key={value} type="button"
                      onClick={() => setSeasons(active ? seasons.filter((s) => s !== value) : [...seasons, value])}
                      className={`px-3 py-1.5 text-xs rounded-md border transition-colors ${
                        active ? 'border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent)]' : 'border-[var(--border-light)] text-[var(--text-secondary)]'
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">场景 *</label>
              <div className="flex flex-wrap gap-1.5">
                {OCCASIONS.map(({ value, label }) => {
                  const active = occasions.includes(value);
                  return (
                    <button
                      key={value} type="button"
                      onClick={() => setOccasions(active ? occasions.filter((o) => o !== value) : [...occasions, value])}
                      className={`px-3 py-1.5 text-xs rounded-md border transition-colors ${
                        active ? 'border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent)]' : 'border-[var(--border-light)] text-[var(--text-secondary)]'
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">图案</label>
              <div className="flex gap-1.5">
                {PATTERNS.map(({ value, label }) => {
                  const active = patterns.includes(value);
                  return (
                    <button
                      key={value} type="button"
                      onClick={() => setPatterns(active ? patterns.filter((p) => p !== value) : [...patterns, value])}
                      className={`px-3 py-1.5 text-xs rounded-md border transition-colors ${
                        active ? 'border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent)]' : 'border-[var(--border-light)] text-[var(--text-secondary)]'
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium mb-1">品牌</label>
                <input
                  type="text" value={brand} onChange={(e) => setBrand(e.target.value)}
                  placeholder="如：优衣库"
                  className="w-full px-3 py-2 text-sm border border-[var(--border-light)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">价格</label>
                <input
                  type="number" value={price} onChange={(e) => setPrice(e.target.value)}
                  placeholder="¥"
                  className="w-full px-3 py-2 text-sm border border-[var(--border-light)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">备注</label>
              <textarea
                value={notes} onChange={(e) => setNotes(e.target.value)}
                placeholder="材质、版型、购买渠道等..."
                rows={2}
                className="w-full px-3 py-2 text-sm border border-[var(--border-light)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30 resize-none"
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-[var(--border-light)]">
          <button onClick={onClose} className="px-4 py-2 text-sm rounded-lg hover:bg-gray-100">
            取消
          </button>
          <button
            onClick={handleSave}
            disabled={!canSave || saving}
            className="px-6 py-2 text-sm rounded-lg bg-[var(--accent)] text-white hover:bg-[var(--accent-light)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {saving ? '保存中...' : '保存'}
          </button>
        </div>
      </div>
    </div>
  );
}
