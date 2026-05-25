import type { Color, ColorHSL } from './types';

export const COLOR_MAP: Record<Color, ColorHSL> = {
  white:      { h: 0,   s: 0,   l: 100 },
  black:      { h: 0,   s: 0,   l: 0   },
  gray:       { h: 0,   s: 0,   l: 50  },
  navy:       { h: 240, s: 50,  l: 25  },
  beige:      { h: 45,  s: 40,  l: 85  },
  red:        { h: 0,   s: 80,  l: 50  },
  pink:       { h: 350, s: 60,  l: 75  },
  orange:     { h: 30,  s: 80,  l: 55  },
  yellow:     { h: 55,  s: 80,  l: 55  },
  green:      { h: 120, s: 50,  l: 40  },
  blue:       { h: 210, s: 60,  l: 50  },
  purple:     { h: 280, s: 40,  l: 40  },
  brown:      { h: 25,  s: 50,  l: 30  },
  khaki:      { h: 40,  s: 30,  l: 60  },
  denim:      { h: 210, s: 30,  l: 55  },
  multicolor: { h: 0,   s: 0,   l: 50  },
};

export function isNeutral(color: Color): boolean {
  return ['white', 'black', 'gray', 'beige', 'navy'].includes(color);
}

export function pairHarmony(a: ColorHSL, b: ColorHSL): number {
  if (a.s === 0 || b.s === 0) return 1.0;
  const hueDiff = Math.abs(a.h - b.h);
  if (hueDiff <= 30) return 0.95;
  if (hueDiff <= 60) return 0.85;
  if (hueDiff >= 150 && hueDiff <= 180) {
    if (a.s > 60 && b.s > 60) return 0.2;
    return 0.5;
  }
  return 0.6;
}

export function colorHarmonyScore(colors: string[]): number {
  if (colors.length <= 1) return 1.0;
  const hslColors = colors
    .map((c) => COLOR_MAP[c as Color])
    .filter(Boolean);
  if (hslColors.length <= 1) return 1.0;

  let total = 0;
  let count = 0;
  for (let i = 0; i < hslColors.length; i++) {
    for (let j = i + 1; j < hslColors.length; j++) {
      total += pairHarmony(hslColors[i], hslColors[j]);
      count++;
    }
  }
  return total / count;
}

export function detectColorConflicts(colors: string[]): string[] {
  const conflicts: string[] = [];
  const brightColors = colors.filter((c) => {
    const hsl = COLOR_MAP[c as Color];
    return hsl && hsl.s > 50;
  });

  if (brightColors.length > 2) {
    conflicts.push('亮色过多（>2种），视觉可能杂乱');
  }
  if (colors.length > 4) {
    conflicts.push('颜色超过4种，建议简化');
  }

  return conflicts;
}
