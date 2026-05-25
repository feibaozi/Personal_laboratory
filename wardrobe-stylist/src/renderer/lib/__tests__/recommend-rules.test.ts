import { describe, it, expect } from 'vitest';
import { filterBySeason, filterByOccasion, scoreOutfit } from '../recommend-rules';
import type { Garment } from '../types';

// Use any to allow passing raw arrays for colors/seasons/occasions
const mockGarment = (overrides: Record<string, any> = {}): Garment => ({
  id: overrides.id || 'test-1',
  name: 'Test Garment',
  imageUrl: '/test.jpg',
  thumbnailUrl: '/test.jpg',
  stickerUrl: null,
  category: overrides.category || 'top',
  subcategory: null,
  colors: JSON.stringify(overrides.colors || ['white']),
  patterns: null,
  materials: null,
  seasons: JSON.stringify(overrides.seasons || ['spring']),
  occasions: JSON.stringify(overrides.occasions || ['casual']),
  style: null,
  fit: null,
  garmentLength: null,
  brand: null,
  purchaseDate: null,
  price: null,
  status: 'active',
  favorite: false,
  notes: null,
  wearCount: overrides.wearCount ?? 0,
  lastWornDate: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
});

describe('filterBySeason', () => {
  it('filters by matching season', () => {
    const garments = [
      mockGarment({ id: '1', seasons: ['spring', 'summer'] }),
      mockGarment({ id: '2', seasons: ['winter'] }),
      mockGarment({ id: '3', seasons: ['all_season'] }),
    ];
    const result = filterBySeason(garments, 'spring');
    expect(result).toHaveLength(2);
    expect(result.map((g) => g.id)).toContain('1');
    expect(result.map((g) => g.id)).toContain('3');
  });

  it('returns empty when no match', () => {
    const result = filterBySeason([mockGarment({ seasons: ['winter'] })], 'summer');
    expect(result).toHaveLength(0);
  });
});

describe('filterByOccasion', () => {
  it('filters by matching occasion', () => {
    const garments = [
      mockGarment({ id: '1', occasions: ['casual', 'work'] }),
      mockGarment({ id: '2', occasions: ['formal'] }),
    ];
    const result = filterByOccasion(garments, 'work');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('1');
  });
});

describe('scoreOutfit', () => {
  it('high score for well-matched outfit', () => {
    const outfit = [
      mockGarment({ id: '1', category: 'top', colors: ['white'], occasions: ['casual'] }),
      mockGarment({ id: '2', category: 'bottom', colors: ['navy'], occasions: ['casual'] }),
      mockGarment({ id: '3', category: 'shoes', colors: ['white'], occasions: ['casual'] }),
    ];
    const score = scoreOutfit(outfit, { occasion: 'casual' });
    expect(score).toBeGreaterThan(0.5);
  });

  it('lower score for color-clashing outfit vs harmonious one', () => {
    const clashingOutfit = [
      mockGarment({ id: '1', category: 'top', colors: ['red'], occasions: ['casual'] }),
      mockGarment({ id: '2', category: 'bottom', colors: ['green'], occasions: ['casual'] }),
      mockGarment({ id: '3', category: 'shoes', colors: ['purple'], occasions: ['casual'] }),
    ];
    const harmoniousOutfit = [
      mockGarment({ id: '1', category: 'top', colors: ['white'], occasions: ['casual'] }),
      mockGarment({ id: '2', category: 'bottom', colors: ['navy'], occasions: ['casual'] }),
      mockGarment({ id: '3', category: 'shoes', colors: ['black'], occasions: ['casual'] }),
    ];
    expect(scoreOutfit(harmoniousOutfit, { occasion: 'casual' }))
      .toBeGreaterThan(scoreOutfit(clashingOutfit, { occasion: 'casual' }));
  });

  it('higher freshness for less-worn items', () => {
    const freshOutfit = [
      mockGarment({ id: '1', category: 'top', wearCount: 0 }),
      mockGarment({ id: '2', category: 'bottom', wearCount: 0 }),
      mockGarment({ id: '3', category: 'shoes', wearCount: 0 }),
    ];
    const wornOutfit = [
      mockGarment({ id: '4', category: 'top', wearCount: 50 }),
      mockGarment({ id: '5', category: 'bottom', wearCount: 50 }),
      mockGarment({ id: '6', category: 'shoes', wearCount: 50 }),
    ];
    expect(scoreOutfit(freshOutfit, { occasion: 'casual' }))
      .toBeGreaterThan(scoreOutfit(wornOutfit, { occasion: 'casual' }));
  });
});
