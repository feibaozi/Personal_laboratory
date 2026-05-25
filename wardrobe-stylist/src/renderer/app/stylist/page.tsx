import { useEffect, useState, useMemo } from 'react';
import { Sparkles, Shuffle, Wand2 } from 'lucide-react';
import { useWardrobeStore } from '../../stores/wardrobe-store';
import { LocalImage } from '../../components/shared/LocalImage';
import type { Garment, Occasion } from '../../lib/types';
import { colorHarmonyScore, detectColorConflicts } from '../../lib/color-theory';
import { generateCandidateOutfits, scoreOutfit } from '../../lib/recommend-rules';

const OCCASIONS: { value: Occasion; label: string; icon: string }[] = [
  { value: 'casual', label: '休闲', icon: '👕' },
  { value: 'work', label: '通勤', icon: '💼' },
  { value: 'date', label: '约会', icon: '💝' },
  { value: 'party', label: '聚会', icon: '🎉' },
  { value: 'sport', label: '运动', icon: '🏃' },
  { value: 'formal', label: '正式', icon: '🤵' },
  { value: 'travel', label: '旅行', icon: '✈️' },
  { value: 'home', label: '居家', icon: '🏠' },
];

export function StylistPage() {
  const garments = useWardrobeStore((s) => s.garments);
  const loadGarments = useWardrobeStore((s) => s.loadGarments);

  const [occasion, setOccasion] = useState<Occasion>('casual');
  const [recommendations, setRecommendations] = useState<{ outfit: Garment[]; score: number; reason: string }[]>([]);
  const [aiRecommending, setAiRecommending] = useState(false);

  useEffect(() => {
    if (garments.length === 0) loadGarments();
  }, []);

  // Generate recommendations when garments or occasion changes
  useEffect(() => {
    if (garments.length < 3) return;

    const activeGarments = garments.filter((g) => {
      const gOccasions = JSON.parse(g.occasions) as string[];
      return g.status === 'active' && gOccasions.includes(occasion);
    });

    if (activeGarments.length < 3) {
      setRecommendations([]);
      return;
    }

    const candidates = generateCandidateOutfits(activeGarments, { occasion });
    const scored = candidates
      .map((outfit) => ({
        outfit,
        score: scoreOutfit(outfit, { occasion }),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);

    setRecommendations(scored.map((s) => ({
      outfit: s.outfit,
      score: s.score,
      reason: getReason(s.outfit, s.score),
    })));
  }, [garments, occasion]);

  const handleAIRecommend = async () => {
    setAiRecommending(true);
    try {
      const activeGarments = garments.filter((g) => g.status === 'active')
        .filter((g) => {
          const gOccasions = JSON.parse(g.occasions) as string[];
          return gOccasions.includes(occasion);
        });

      if (activeGarments.length < 3) { setAiRecommending(false); return; }

      const result = await window.electronAPI.getRecommendations({
        garments: activeGarments.map((g) => ({
          id: g.id,
          name: g.name,
          category: g.category,
          colors: JSON.parse(g.colors),
          style: g.style,
          seasons: JSON.parse(g.seasons),
          occasions: JSON.parse(g.occasions),
        })),
        occasion,
      });

      if (result?.outfits) {
        const newRecs = result.outfits.map((r: any) => ({
          outfit: r.garmentIds.map((id: string) => activeGarments.find((g) => g.id === id)).filter(Boolean) as Garment[],
          score: r.score || 4.0,
          reason: r.reason || '',
        }));
        if (newRecs.length > 0) setRecommendations(newRecs);
      }
    } catch (e) { console.error('AI recommend failed:', e); }
    setAiRecommending(false);
  };

  const regenerate = () => {
    // Force re-render by triggering the effect again
    setRecommendations([]);
    // The effect will re-run because we use a key trick
    setTimeout(() => {
      const activeGarments = garments.filter((g) => {
        const gOccasions = JSON.parse(g.occasions) as string[];
        return g.status === 'active' && gOccasions.includes(occasion);
      });
      const candidates = generateCandidateOutfits(activeGarments, { occasion });
      const scored = candidates
        .map((outfit) => ({ outfit, score: scoreOutfit(outfit, { occasion }) }))
        .sort((a, b) => b.score - a.score)
        .slice(0, 5);
      setRecommendations(scored.map((s) => ({
        outfit: s.outfit, score: s.score,
        reason: getReason(s.outfit, s.score),
      })));
    }, 0);
  };

  if (garments.length < 3) {
    return (
      <div className="p-8 animate-fade-in">
        <h1 className="text-2xl font-bold mb-4">搭配推荐</h1>
        <div className="flex flex-col items-center justify-center py-20 text-[var(--text-secondary)]">
          <Sparkles size={48} className="mb-4 text-gray-300" />
          <p className="text-lg font-medium mb-1">需要更多单品</p>
          <p className="text-sm">至少添加 3 件不同类别的单品才能获得推荐</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 animate-fade-in">
      <h1 className="text-2xl font-bold mb-2">搭配推荐</h1>
      <p className="text-sm text-[var(--text-secondary)] mb-6">选择场景，获得智能搭配建议</p>

      {/* Scene selector */}
      <div className="flex gap-2 mb-8">
        {OCCASIONS.map(({ value, label, icon }) => (
          <button
            key={value}
            onClick={() => setOccasion(value)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              occasion === value
                ? 'bg-[var(--accent)] text-white'
                : 'bg-white border border-[var(--border-light)] text-[var(--text-secondary)] hover:border-[var(--accent)]/50'
            }`}
          >
            <span>{icon}</span> {label}
          </button>
        ))}
      </div>

      {/* Recommendations */}
      {recommendations.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-[var(--text-secondary)]">
          <p className="text-sm">当前场景没有足够的单品，请添加更多</p>
        </div>
      ) : (
        <div className="space-y-4">
          {recommendations.map((rec, i) => (
            <div key={i} className="bg-white rounded-xl border border-[var(--border-light)] p-5 hover:shadow-md transition-shadow">
              <div className="flex items-center gap-4 mb-3">
                <span className="text-sm font-bold text-[var(--accent)]">#{i + 1}</span>
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <span key={s} className={`text-sm ${s <= Math.round(rec.score * 5) ? 'text-amber-400' : 'text-gray-200'}`}>★</span>
                  ))}
                </div>
                <span className="text-xs text-[var(--text-secondary)]">{(rec.score * 100).toFixed(0)} 分</span>
              </div>

              <div className="flex gap-3 mb-3">
                {rec.outfit.map((g) => (
                  <div key={g.id} className="w-20 h-28 bg-gray-50 rounded-lg overflow-hidden border border-[var(--border-light)]">
                    <LocalImage
                      path={g.thumbnailUrl}
                      alt={g.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                ))}
              </div>

              <p className="text-sm text-[var(--text-secondary)]">💡 {rec.reason}</p>
            </div>
          ))}

          <div className="flex justify-center gap-3 pt-4">
            <button
              onClick={regenerate}
              className="flex items-center gap-2 px-5 py-2 text-sm rounded-lg border border-[var(--border-light)] hover:bg-gray-50 transition-colors"
            >
              <Shuffle size={16} /> 换一批
            </button>
            <button
              onClick={handleAIRecommend}
              disabled={aiRecommending}
              className="flex items-center gap-2 px-5 py-2 text-sm rounded-lg bg-[var(--accent)] text-white hover:bg-[var(--accent-light)] disabled:opacity-50 transition-colors"
            >
              {aiRecommending ? (
                <><div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" /> AI 思考中...</>
              ) : (
                <><Wand2 size={16} /> AI 推荐</>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function getReason(outfit: Garment[], score: number): string {
  const colors = outfit.flatMap((g) => JSON.parse(g.colors) as string[]);
  const conflicts = detectColorConflicts(colors);

  if (score > 0.8) return '配色和谐，场景适配度高，是一套出色的搭配';
  if (score > 0.6) return '整体协调，日常穿搭的不错选择';
  if (score > 0.4) return '基础穿搭，可以考虑添加配饰提升层次感';
  return '搭配组合可用，但建议调整颜色搭配';
}
