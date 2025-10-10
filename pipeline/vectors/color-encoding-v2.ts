/**
 * Color Encoding v2 - CIEDE2000 Perceptual Distance Encoding
 *
 * This module encodes color palettes using perceptual relationships (CIEDE2000)
 * instead of absolute positions. This makes the encoding order-invariant and
 * more semantically meaningful.
 *
 * Key improvements over v1:
 * - Uses CIEDE2000 for perceptual color distances (not Euclidean LCH)
 * - Order-invariant brand palette encoding (doesn't depend on brandColors[0] order)
 * - Separates relational features (palette cohesion) from absolute features (semantic colors)
 * - Handles light/dark mode correctly by encoding semantic colors absolutely
 *
 * Output: 17 dimensions
 * - 3D: Brand palette relationships (pairwise distances)
 * - 4D: Semantic color relationships (bg/text/cta distances)
 * - 2D: Background absolute position (L, C)
 * - 1D: Text absolute position (L)
 * - 4D: Hero brand color absolute (L, C, hue cos/sin)
 * - 3D: CTA color (L, C, distance from hero)
 *
 * @module color-encoding-v2
 */

import type { DesignTokens } from '../tokens';
import {
  parseColor,
  calculateDeltaE2000,
  getChroma,
  getLightness,
  getHue,
  type Lch,
} from './utils/color-math';
import { normalizeLinear, calculateMean } from './utils/math';

/**
 * Encode color palette features using perceptual distances
 *
 * Returns 17 normalized features [0, 1]:
 * - [0-2]: Brand palette cohesion (avg/min/max pairwise CIEDE2000)
 * - [3-6]: Semantic relationships (bg-text, cta-bg, cta-text, hero-bg)
 * - [7-8]: Background absolute (L, C)
 * - [9]: Text absolute lightness
 * - [10-13]: Hero color absolute (L, C, hue_cos, hue_sin)
 * - [14-16]: CTA color (L, C, distance from hero)
 *
 * @param tokens Design tokens from style extraction
 * @returns 17D feature vector
 *
 * @example
 * const tokens = await extractDesignTokens(capture);
 * const colorFeatures = encodePaletteFeatures(tokens);
 * // colorFeatures.length === 17
 * // All values in [0, 1] range
 */
export function encodePaletteFeatures(tokens: DesignTokens): number[] {
  // Build brand palette (vibrant + muted brand colors)
  const brandPalette = buildBrandPalette(tokens);

  // Parse semantic colors
  const bg = parseColor(tokens.colors.semantic.background);
  const text = parseColor(tokens.colors.semantic.text);
  const cta = parseColor(tokens.colors.semantic.cta);

  // Identify hero color (most saturated brand color - order invariant)
  const hero = findHeroColor(brandPalette);

  // === Brand Palette Relationships (3D) ===
  const paletteDistances = calculatePairwiseDistances(brandPalette);
  const avgDistance = normalizeLinear(calculateMean(paletteDistances), 0, 50);
  const minDistance = normalizeLinear(Math.min(...paletteDistances, 30), 0, 30);
  const maxDistance = normalizeLinear(Math.max(...paletteDistances, 0), 0, 80);

  // === Semantic Color Relationships (4D) ===
  const bgTextDist = normalizeLinear(
    bg && text ? calculateDeltaE2000(bg, text) : 50,
    0,
    100
  );
  const ctaBgDist = normalizeLinear(
    cta && bg ? calculateDeltaE2000(cta, bg) : 40,
    0,
    80
  );
  const ctaTextDist = normalizeLinear(
    cta && text ? calculateDeltaE2000(cta, text) : 50,
    0,
    100
  );
  const heroBgDist = normalizeLinear(
    hero && bg ? calculateDeltaE2000(hero, bg) : 40,
    0,
    80
  );

  // === Background Absolute Position (2D) ===
  const bgL = normalizeLinear(bg ? getLightness(bg) : 100, 0, 100);
  const bgC = normalizeLinear(bg ? getChroma(bg) : 0, 0, 30); // Backgrounds usually low chroma

  // === Text Absolute Position (1D) ===
  const textL = normalizeLinear(text ? getLightness(text) : 0, 0, 100);

  // === Hero Brand Color Absolute (4D) ===
  const heroL = normalizeLinear(hero ? getLightness(hero) : 50, 0, 100);
  const heroC = normalizeLinear(hero ? getChroma(hero) : 75, 0, 150);
  const heroHue = hero ? getHue(hero) : 0;
  const heroHueRad = (heroHue * Math.PI) / 180;
  const heroHueCos = Math.cos(heroHueRad); // Already -1 to 1
  const heroHueSin = Math.sin(heroHueRad); // Already -1 to 1

  // === CTA Color (3D) ===
  const ctaL = normalizeLinear(cta ? getLightness(cta) : 50, 0, 100);
  const ctaC = normalizeLinear(cta ? getChroma(cta) : 75, 0, 150);
  const ctaHeroDist = normalizeLinear(
    cta && hero ? calculateDeltaE2000(cta, hero) : 10,
    0,
    50
  );

  return [
    // Brand palette relationships (3D)
    avgDistance, // Dim 0: Average pairwise distance (palette cohesion)
    minDistance, // Dim 1: Minimum pairwise distance (tightest colors)
    maxDistance, // Dim 2: Maximum pairwise distance (furthest colors)

    // Semantic relationships (4D)
    bgTextDist, // Dim 3: Background-text contrast
    ctaBgDist, // Dim 4: CTA-background contrast
    ctaTextDist, // Dim 5: CTA-text contrast
    heroBgDist, // Dim 6: Hero-background relationship

    // Background absolute (2D)
    bgL, // Dim 7: Background lightness
    bgC, // Dim 8: Background chroma (tint amount)

    // Text absolute (1D)
    textL, // Dim 9: Text lightness

    // Hero brand color absolute (4D)
    heroL, // Dim 10: Hero lightness
    heroC, // Dim 11: Hero chroma (saturation)
    heroHueCos, // Dim 12: Hero hue cosine (circular encoding)
    heroHueSin, // Dim 13: Hero hue sine (circular encoding)

    // CTA color (3D)
    ctaL, // Dim 14: CTA lightness
    ctaC, // Dim 15: CTA chroma
    ctaHeroDist, // Dim 16: CTA-hero relationship
  ];
}

/**
 * Build brand palette from tokens
 * Prioritizes vibrant brand colors, then muted accents, limited to 5 colors
 *
 * @param tokens Design tokens
 * @returns Array of up to 5 brand colors
 */
function buildBrandPalette(tokens: DesignTokens): string[] {
  const palette: string[] = [];

  // Add brand colors (chroma > 50)
  palette.push(...tokens.colors.brandColors);

  // Add accent colors (chroma 20-50)
  palette.push(...tokens.colors.accentColors);

  // Fallback to primary colors if needed
  if (palette.length === 0) {
    palette.push(...tokens.colors.primary);
  }

  // Limit to 5 colors
  return palette.slice(0, 5);
}

/**
 * Find the hero color (most saturated brand color)
 * This is order-invariant - always returns the highest chroma color
 *
 * @param brandPalette Array of hex color strings
 * @returns LCH color object of hero color, or null if palette is empty
 */
function findHeroColor(brandPalette: string[]): Lch | null {
  if (brandPalette.length === 0) return null;

  let maxChroma = -1;
  let heroColor: Lch | null = null;

  for (const hex of brandPalette) {
    const color = parseColor(hex);
    if (!color) continue;

    const chroma = getChroma(color);
    if (chroma > maxChroma) {
      maxChroma = chroma;
      heroColor = color;
    }
  }

  return heroColor;
}

/**
 * Calculate all pairwise CIEDE2000 distances in a color palette
 *
 * @param palette Array of hex color strings
 * @returns Array of pairwise distances (empty if < 2 colors)
 *
 * @example
 * const distances = calculatePairwiseDistances(['#ff0000', '#00ff00', '#0000ff']);
 * // Returns [deltaE(red, green), deltaE(red, blue), deltaE(green, blue)]
 */
function calculatePairwiseDistances(palette: string[]): number[] {
  if (palette.length < 2) return [0]; // Avoid empty array

  const distances: number[] = [];
  const parsed = palette.map(parseColor).filter((c): c is Lch => c !== null);

  for (let i = 0; i < parsed.length; i++) {
    for (let j = i + 1; j < parsed.length; j++) {
      const dist = calculateDeltaE2000(parsed[i], parsed[j]);
      distances.push(dist);
    }
  }

  return distances.length > 0 ? distances : [0];
}

/**
 * Get feature names for the 17D color encoding
 * Useful for debugging and explainability
 */
export function getColorFeatureNames(): string[] {
  return [
    // Brand palette relationships (3D)
    'color_palette_avg_distance',
    'color_palette_min_distance',
    'color_palette_max_distance',

    // Semantic relationships (4D)
    'color_bg_text_distance',
    'color_cta_bg_distance',
    'color_cta_text_distance',
    'color_hero_bg_distance',

    // Background absolute (2D)
    'color_bg_lightness',
    'color_bg_chroma',

    // Text absolute (1D)
    'color_text_lightness',

    // Hero brand color absolute (4D)
    'color_hero_lightness',
    'color_hero_chroma',
    'color_hero_hue_cos',
    'color_hero_hue_sin',

    // CTA color (3D)
    'color_cta_lightness',
    'color_cta_chroma',
    'color_cta_hero_distance',
  ];
}
