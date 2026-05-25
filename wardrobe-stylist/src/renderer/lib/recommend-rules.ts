import type { Garment } from './types';
import { colorHarmonyScore, detectColorConflicts } from './color-theory';

export function filterBySeason(garments: Garment[], season: string): Garment[] {
  return garments.filter((g) => {
    const seasons = JSON.parse(g.seasons) as string[];
    return seasons.includes(season) || seasons.includes('all_season');
  });
}

export function filterByOccasion(garments: Garment[], occasion: string): Garment[] {
  return garments.filter((g) => {
    const occasions = JSON.parse(g.occasions) as string[];
    return occasions.includes(occasion);
  });
}

export function generateCandidateOutfits(
  garments: Garment[],
  context: { occasion: string; season?: string }
): Garment[][] {
  const byCategory: Record<string, Garment[]> = {};
  for (const g of garments) {
    if (!byCategory[g.category]) byCategory[g.category] = [];
    byCategory[g.category].push(g);
  }

  const tops = byCategory['top'] || [];
  const bottoms = byCategory['bottom'] || [];
  const shoes = byCategory['shoes'] || [];
  const outerwears = byCategory['outerwear'] || [];
  const dresses = byCategory['dress'] || [];
  const accessories = byCategory['accessory'] || [];

  const outfits: Garment[][] = [];

  // Standard: top + bottom + shoes
  for (const top of tops.slice(0, 5)) {
    for (const bottom of bottoms.slice(0, 5)) {
      for (const shoe of shoes.slice(0, 3)) {
        const outfit = [top, bottom, shoe];

        // Optionally add outerwear
        if (outerwears.length > 0 && Math.random() > 0.5) {
          outfit.push(outerwears[Math.floor(Math.random() * Math.min(outerwears.length, 3))]);
        }

        // Optionally add accessory
        if (accessories.length > 0 && Math.random() > 0.7) {
          outfit.push(accessories[Math.floor(Math.random() * Math.min(accessories.length, 3))]);
        }

        outfits.push(outfit);
      }
    }
  }

  // Dress-based outfits
  for (const dress of dresses.slice(0, 3)) {
    for (const shoe of shoes.slice(0, 3)) {
      const outfit = [dress, shoe];
      if (outerwears.length > 0 && Math.random() > 0.3) {
        outfit.push(outerwears[Math.floor(Math.random() * Math.min(outerwears.length, 3))]);
      }
      outfits.push(outfit);
    }
  }

  // Shuffle and limit
  return outfits.sort(() => Math.random() - 0.5).slice(0, 10);
}

export function scoreOutfit(
  outfit: Garment[],
  context: { occasion: string; season?: string }
): number {
  const W1 = 0.25, W2 = 0.20, W3 = 0.15, W4 = 0.15, W5 = 0.15, W6 = 0.10;

  // Color harmony
  const allColors = outfit.flatMap((g) => JSON.parse(g.colors) as string[]);
  const colorScore = colorHarmonyScore(allColors);

  // Occasion match
  const occasionMatch = outfit.filter((g) => {
    const occasions = JSON.parse(g.occasions) as string[];
    return occasions.includes(context.occasion);
  }).length / outfit.length;

  // Season match
  let seasonScore = 0.7;
  if (context.season) {
    seasonScore = outfit.filter((g) => {
      const seasons = JSON.parse(g.seasons) as string[];
      return seasons.includes(context.season!) || seasons.includes('all_season');
    }).length / outfit.length;
  }

  // Layer diversity (top+bottom+shoes is ideal)
  const categories = new Set(outfit.map((g) => g.category));
  const layerScore = Math.min(categories.size / 3, 1);

  // Freshness (lower wearCount = higher score)
  const maxWear = Math.max(...outfit.map((g) => g.wearCount), 1);
  const freshnessScore = 1 - (outfit.reduce((sum, g) => sum + g.wearCount, 0) / outfit.length) / (maxWear + 10);

  // Preferred style (placeholder)
  const preferenceScore = 0.5;

  return (
    W1 * colorScore +
    W2 * occasionMatch +
    W3 * seasonScore +
    W4 * layerScore +
    W5 * preferenceScore +
    W6 * freshnessScore
  );
}
