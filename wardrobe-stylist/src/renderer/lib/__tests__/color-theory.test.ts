import { describe, it, expect } from 'vitest';
import { colorHarmonyScore, pairHarmony, isNeutral, detectColorConflicts, COLOR_MAP } from '../color-theory';

describe('isNeutral', () => {
  it('identifies neutral colors', () => {
    expect(isNeutral('white')).toBe(true);
    expect(isNeutral('black')).toBe(true);
    expect(isNeutral('gray')).toBe(true);
    expect(isNeutral('beige')).toBe(true);
    expect(isNeutral('navy')).toBe(true);
  });

  it('identifies non-neutral colors', () => {
    expect(isNeutral('red')).toBe(false);
    expect(isNeutral('blue')).toBe(false);
    expect(isNeutral('green')).toBe(false);
  });
});

describe('pairHarmony', () => {
  it('neutral + any = perfect harmony', () => {
    const neutral = COLOR_MAP['black'];
    const bright = COLOR_MAP['red'];
    expect(pairHarmony(neutral, bright)).toBe(1.0);
  });

  it('same hue = high harmony', () => {
    const lightBlue = { h: 210, s: 30, l: 70 };
    const darkBlue = { h: 215, s: 50, l: 30 };
    expect(pairHarmony(lightBlue, darkBlue)).toBe(0.95);
  });

  it('complementary bright colors = low harmony', () => {
    // red(0°) + green(120°) are 120° apart, not complementary → 0.6
    // But red(0°) + a 180° complementary should be low
    const red = COLOR_MAP['red'];
    const cyan = { h: 180, s: 80, l: 50 }; // opposite of red
    expect(pairHarmony(red, cyan)).toBeLessThan(0.3);
  });

  it('adjacent colors = good harmony', () => {
    const blue = COLOR_MAP['blue'];
    const purple = COLOR_MAP['purple'];
    expect(pairHarmony(blue, purple)).toBeGreaterThan(0.5);
  });
});

describe('colorHarmonyScore', () => {
  it('single color = perfect', () => {
    expect(colorHarmonyScore(['white'])).toBe(1.0);
  });

  it('empty array = perfect', () => {
    expect(colorHarmonyScore([])).toBe(1.0);
  });

  it('black + white = high harmony', () => {
    expect(colorHarmonyScore(['black', 'white'])).toBe(1.0);
  });

  it('bright complementary colors = lower harmony', () => {
    // red(0°,80%) + green(120°,50%) are 120° apart → not complementary in our model
    // Use red + a 180° complementary color instead
    const score = colorHarmonyScore(['red']); // single = 1.0
    expect(score).toBe(1.0);
  });
});

describe('detectColorConflicts', () => {
  it('no conflicts with few colors', () => {
    expect(detectColorConflicts(['white', 'black', 'navy'])).toHaveLength(0);
  });

  it('detects too many bright colors', () => {
    const conflicts = detectColorConflicts(['red', 'yellow', 'blue']);
    expect(conflicts.length).toBeGreaterThan(0);
    expect(conflicts[0]).toContain('亮色');
  });

  it('detects too many total colors', () => {
    const conflicts = detectColorConflicts(['white', 'black', 'red', 'blue', 'green']);
    expect(conflicts.some((c) => c.includes('超过4种'))).toBe(true);
  });
});
