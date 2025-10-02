/**
 * Color analysis utilities using CIELAB and LCH color spaces
 * Uses culori for color parsing and conversions
 */

import { parse, converter, differenceEuclidean, type Lch } from 'culori';

// Converter from any color to LCH (Lightness, Chroma, Hue)
const toLch = converter('lch');

/**
 * Parse a CSS color string to LCH color space
 * LCH is perceptually uniform and good for measuring color differences
 *
 * @param cssColor CSS color string (hex, rgb, named, etc.)
 * @returns LCH color object or null if parsing fails
 *
 * @example
 * parseColor('#ff0000'); // { mode: 'lch', l: 53.24, c: 104.55, h: 40 }
 * parseColor('rgb(255, 0, 0)'); // same as above
 * parseColor('transparent'); // null
 */
export function parseColor(cssColor: string): Lch | null {
  if (!cssColor || cssColor === 'transparent' || cssColor === 'none') {
    return null;
  }

  try {
    const rgb = parse(cssColor);
    if (!rgb) return null;

    const lch = toLch(rgb);
    if (!lch) return null;

    return lch as Lch;
  } catch {
    return null;
  }
}

/**
 * Calculate perceptual color difference using ΔE (Delta E)
 * Uses Euclidean distance in LCH space as a simplified ΔE metric
 * (For production, consider ΔE2000 for better perceptual accuracy)
 *
 * Scale:
 * - ΔE < 1: Not perceptible by human eyes
 * - ΔE 1-2: Perceptible through close observation
 * - ΔE 2-10: Perceptible at a glance
 * - ΔE 11-49: Colors are more similar than opposite
 * - ΔE > 50: Completely different colors
 *
 * @param color1 First LCH color
 * @param color2 Second LCH color
 * @returns ΔE value (0-100+ range)
 *
 * @example
 * const red = parseColor('#ff0000');
 * const blue = parseColor('#0000ff');
 * calculateDeltaE(red, blue); // ~52 (very different)
 */
export function calculateDeltaE(color1: Lch, color2: Lch): number {
  if (!color1 || !color2) return 0;

  // Use culori's Euclidean distance in LCH space
  // This is a simplified ΔE metric that's fast and perceptually reasonable
  const distance = differenceEuclidean('lch')(color1, color2);

  // Scale to 0-100 range (Euclidean in LCH typically ranges 0-1.5)
  return (distance || 0) * 100;
}

/**
 * Extract chroma (saturation) from LCH color
 * Chroma range: 0 (gray) to ~130+ (highly saturated)
 *
 * @param color LCH color object
 * @returns Chroma value (0-130+)
 *
 * @example
 * const red = parseColor('#ff0000');
 * getChroma(red); // ~104.55 (highly saturated)
 *
 * const gray = parseColor('#808080');
 * getChroma(gray); // ~0 (desaturated)
 */
export function getChroma(color: Lch): number {
  if (!color) return 0;
  return color.c || 0;
}

/**
 * Get lightness from LCH color
 * Lightness range: 0 (black) to 100 (white)
 *
 * @param color LCH color object
 * @returns Lightness value (0-100)
 */
export function getLightness(color: Lch): number {
  if (!color) return 50; // Default to mid-gray
  return color.l || 50;
}

/**
 * Get hue from LCH color
 * Hue range: 0-360 (circular)
 *
 * @param color LCH color object
 * @returns Hue value in degrees (0-360)
 */
export function getHue(color: Lch): number {
  if (!color) return 0;
  return color.h || 0;
}
