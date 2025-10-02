import { parse, converter } from 'culori';

// Robust normalization functions
export function normalizeLinear(value: number, min: number, max: number): number {
  if (max === min) return 0;
  const clamped = Math.max(min, Math.min(max, value));
  return (clamped - min) / (max - min);
}

export function normalizeLog(count: number, typical: number): number {
  // Log-scale normalization for counts
  // typical = value that should map to ~0.5
  return Math.min(1, Math.log(count + 1) / Math.log(typical * 2 + 1));
}

// Color conversion
const toLch = converter('lch');

export function hexToLCH(hex: string): { l: number; c: number; h: number } {
  try {
    const rgb = parse(hex);
    if (!rgb) return { l: 0, c: 0, h: 0 };

    const lch = toLch(rgb);
    return {
      l: lch.l || 0,
      c: lch.c || 0,
      h: lch.h || 0
    };
  } catch {
    return { l: 0, c: 0, h: 0 };
  }
}

// L2 normalization (unit vector)
export function normalizeL2(vector: number[]): number[] {
  const norm = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));

  // Handle zero vector (avoid division by zero)
  if (norm === 0) {
    return vector.map(() => 0);
  }

  return vector.map(val => val / norm);
}

// WCAG contrast calculation
export function calculateContrast(fg: string, bg: string): number {
  const getLuminance = (hex: string): number => {
    try {
      const rgb = parseInt(hex.slice(1), 16);
      const r = ((rgb >> 16) & 0xff) / 255;
      const g = ((rgb >> 8) & 0xff) / 255;
      const b = ((rgb >> 0) & 0xff) / 255;

      const sRGB = [r, g, b].map(c =>
        c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
      );

      return 0.2126 * sRGB[0] + 0.7152 * sRGB[1] + 0.0722 * sRGB[2];
    } catch {
      return 0.5;
    }
  };

  const lum1 = getLuminance(fg);
  const lum2 = getLuminance(bg);
  const lightest = Math.max(lum1, lum2);
  const darkest = Math.min(lum1, lum2);

  return (lightest + 0.05) / (darkest + 0.05);
}
