import { useState, useEffect, useMemo } from 'react';
import { ShoppingBag, AlertCircle } from 'lucide-react';
import { useWardrobeStore } from '../../stores/wardrobe-store';
import { colorHarmonyScore } from '../../lib/color-theory';
import type { Color, GarmentCategory } from '../../lib/types';

const ESSENTIAL_CATEGORIES: { category: GarmentCategory; label: string; min: number }[] = [
  { category: 'top', label: '上衣', min: 3 },
  { category: 'bottom', label: '下装', min: 2 },
  { category: 'shoes', label: '鞋子', min: 2 },
  { category: 'outerwear', label: '外套', min: 1 },
  { category: 'accessory', label: '配饰', min: 1 },
];

const BASE_COLORS: Color[] = ['white', 'black', 'gray', 'navy', 'beige'];

export function ShoppingPage() {
  const garments = useWardrobeStore((s) => s.garments);
  const loadGarments = useWardrobeStore((s) => s.loadGarments);

  useEffect(() => { if (garments.length === 0) loadGarments(); }, []);

  const analysis = useMemo(() => {
    const gaps: { category: string; message: string; severity: 'high' | 'medium' | 'low' }[] = [];

    // Category gaps
    for (const ec of ESSENTIAL_CATEGORIES) {
      const count = garments.filter((g) => g.category === ec.category && g.status === 'active').length;
      if (count < ec.min) {
        gaps.push({
          category: ec.label,
          message: `缺少${ec.label}（当前 ${count} 件，建议至少 ${ec.min} 件）`,
          severity: count === 0 ? 'high' : 'medium',
        });
      }
    }

    // Color gaps
    const allColors = new Set<string>();
    for (const g of garments) {
      try {
        const colors = JSON.parse(g.colors) as string[];
        colors.forEach((c) => allColors.add(c));
      } catch {}
    }

    const missingBaseColors = BASE_COLORS.filter((c) => !allColors.has(c));
    if (missingBaseColors.length > 0) {
      gaps.push({
        category: '颜色',
        message: `缺少基础色: ${missingBaseColors.join('、')}（基础色百搭，建议至少拥有一件）`,
        severity: 'medium',
      });
    }

    // Check for idle garments (haven't worn in a while)
    const idleGarments = garments.filter((g) => g.status === 'active' && g.wearCount === 0);
    if (idleGarments.length > 0) {
      gaps.push({
        category: '利用率',
        message: `${idleGarments.length} 件单品从未穿过（${idleGarments.map((g) => g.name).slice(0, 3).join('、')}${idleGarments.length > 3 ? '等' : ''}），建议尝试搭配或考虑淘汰`,
        severity: 'low',
      });
    }

    return gaps;
  }, [garments]);

  return (
    <div className="p-8 animate-fade-in max-w-3xl">
      <h1 className="text-2xl font-bold mb-2">购物助手</h1>
      <p className="text-sm text-[var(--text-secondary)] mb-8">分析你的衣橱，发现缺口，理性消费</p>

      {garments.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-[var(--text-secondary)]">
          <ShoppingBag size={48} className="mb-4 text-gray-300" />
          <p className="text-lg font-medium mb-1">衣橱为空</p>
          <p className="text-sm">先添加一些衣服再来分析吧</p>
        </div>
      ) : analysis.length === 0 ? (
        <div className="bg-green-50 rounded-xl p-8 text-center">
          <p className="text-green-700 font-medium text-lg mb-1">衣橱状态良好</p>
          <p className="text-green-600 text-sm">各类别单品数量充足，暂时没有明显的缺口</p>
        </div>
      ) : (
        <div className="space-y-3">
          {analysis.map((gap, i) => (
            <div
              key={i}
              className={`flex items-start gap-3 p-4 rounded-xl border ${
                gap.severity === 'high' ? 'bg-red-50 border-red-100'
                  : gap.severity === 'medium' ? 'bg-amber-50 border-amber-100'
                  : 'bg-blue-50 border-blue-100'
              }`}
            >
              <AlertCircle size={18} className={
                gap.severity === 'high' ? 'text-red-500' : gap.severity === 'medium' ? 'text-amber-500' : 'text-blue-500'
              } />
              <div>
                <p className="text-sm font-medium">{gap.category}</p>
                <p className="text-xs text-[var(--text-secondary)] mt-0.5">{gap.message}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Stats */}
      {garments.length > 0 && (
        <div className="mt-8 grid grid-cols-3 gap-4">
          <div className="bg-white rounded-xl border border-[var(--border-light)] p-4 text-center">
            <p className="text-2xl font-bold">{garments.length}</p>
            <p className="text-xs text-[var(--text-secondary)] mt-1">单品总数</p>
          </div>
          <div className="bg-white rounded-xl border border-[var(--border-light)] p-4 text-center">
            <p className="text-2xl font-bold">
              {garments.filter((g) => g.wearCount > 0).length}
            </p>
            <p className="text-xs text-[var(--text-secondary)] mt-1">已穿着单品</p>
          </div>
          <div className="bg-white rounded-xl border border-[var(--border-light)] p-4 text-center">
            <p className="text-2xl font-bold">
              ¥{garments.reduce((sum, g) => sum + (g.price || 0), 0).toFixed(0)}
            </p>
            <p className="text-xs text-[var(--text-secondary)] mt-1">衣橱总价值</p>
          </div>
        </div>
      )}
    </div>
  );
}
