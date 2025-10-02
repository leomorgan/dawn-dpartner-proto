import type { DesignTokens, StyleReport } from '../tokens';
import { normalizeLinear, normalizeLog, hexToLCH } from './utils';

/**
 * Builds a 192D global style vector:
 * - 64D interpretable: normalized token statistics
 * - 128D visual: zero-padded for MVP (future: CLIP embeddings)
 */
export function buildGlobalStyleVec(
  tokens: DesignTokens,
  report: StyleReport
): {
  interpretable: Float32Array;
  visual: Float32Array;
  combined: Float32Array;
  metadata: { featureNames: string[]; nonZeroCount: number };
} {
  const interpretable: number[] = [];
  const featureNames: string[] = [];

  // === Color Features (16D) ===

  // KEEP: Primary color count (log-normalized) - backward compat
  featureNames.push('color_primary_count');
  interpretable.push(normalizeLog(tokens.colors.primary.length, 5));

  // KEEP: Neutral color count (log-normalized) - backward compat
  featureNames.push('color_neutral_count');
  interpretable.push(normalizeLog(tokens.colors.neutral.length, 5));

  // Palette entropy (already 0-1)
  const paletteEntropy = calculatePaletteEntropy(
    [...tokens.colors.primary, ...tokens.colors.neutral]
  );
  featureNames.push('color_palette_entropy');
  interpretable.push(paletteEntropy);

  // Contrast pass rate (already 0-1)
  featureNames.push('color_contrast_pass_rate');
  interpretable.push(report.contrastResults.aaPassRate);

  // Dominant hue (circular normalize 0-360 → 0-1) - ROBUST NULL HANDLING
  const dominantHue = report.realTokenMetrics?.colorHarmony?.dominantHue ?? 0;
  featureNames.push('color_dominant_hue');
  interpretable.push(normalizeLinear(dominantHue, 0, 360));

  // Saturation mean (already 0-1) - ROBUST NULL HANDLING
  const satMean = report.realTokenMetrics?.colorHarmony?.saturationRange?.avg ?? 0.5;
  featureNames.push('color_saturation_mean');
  interpretable.push(satMean);

  // Lightness mean (already 0-1) - ROBUST NULL HANDLING
  const lightMean = report.realTokenMetrics?.colorHarmony?.lightnessRange?.avg ?? 0.5;
  featureNames.push('color_lightness_mean');
  interpretable.push(lightMean);

  // Button color diversity (log-normalized)
  featureNames.push('color_button_diversity');
  interpretable.push(normalizeLog(tokens.colors.contextual.buttons.length, 3));

  // Link color diversity (log-normalized)
  featureNames.push('color_link_diversity');
  interpretable.push(normalizeLog(tokens.colors.contextual.links.length, 3));

  // Background variation (log-normalized)
  featureNames.push('color_background_variation');
  interpretable.push(normalizeLog(tokens.colors.contextual.backgrounds.length, 4));

  // Harmony score (already 0-1) - ROBUST NULL HANDLING
  const harmonyScore = report.realTokenMetrics?.colorHarmony?.harmonyScore ?? 0.5;
  featureNames.push('color_harmony_score');
  interpretable.push(harmonyScore);

  // Color coherence (already 0-1) - ROBUST NULL HANDLING
  const colorCoherence = report.realTokenMetrics?.brandCoherence?.colorHarmony ?? 0.5;
  featureNames.push('color_coherence');
  interpretable.push(colorCoherence);

  // === NEW: Use reserved slots for tier metrics ===
  // Foundation color count (replaces color_reserved_1)
  featureNames.push('color_foundation_count');
  interpretable.push(normalizeLog(tokens.colors.foundation.length, 5));

  // Brand color count (replaces color_reserved_2)
  featureNames.push('color_brand_count');
  interpretable.push(normalizeLog(tokens.colors.brandColors.length, 3));

  // Brand color saturation (replaces color_reserved_3)
  const brandSat = report.realTokenMetrics?.colorHarmony?.brandColorSaturation ?? 0.5;
  featureNames.push('color_brand_saturation');
  interpretable.push(brandSat);

  // Neutral tint (replaces color_reserved_4)
  const neutralTint = report.realTokenMetrics?.colorHarmony?.neutralTint ?? 0;
  featureNames.push('color_neutral_tint');
  interpretable.push(neutralTint);

  // === Typography Features (16D) ===

  // Font family count (log-normalized, typical 1-2)
  featureNames.push('typo_family_count');
  interpretable.push(normalizeLog(tokens.typography.fontFamilies.length, 2));

  // Font size range (robust normalize, typical 10-40px)
  const fontSizeRange = tokens.typography.fontSizes.length > 0
    ? Math.max(...tokens.typography.fontSizes) - Math.min(...tokens.typography.fontSizes)
    : 0;
  featureNames.push('typo_size_range');
  interpretable.push(normalizeLinear(fontSizeRange, 0, 50));

  // Font size count (log-normalized, typical 5-10)
  featureNames.push('typo_size_count');
  interpretable.push(normalizeLog(tokens.typography.fontSizes.length, 7));

  // Font weight count (log-normalized, typical 2-4)
  featureNames.push('typo_weight_count');
  interpretable.push(normalizeLog(tokens.typography.fontWeights.length, 3));

  // Line height count (log-normalized, typical 2-4)
  featureNames.push('typo_lineheight_count');
  interpretable.push(normalizeLog(tokens.typography.lineHeights.length, 3));

  // Typography coherence (already 0-1)
  const typoCoherence = report.realTokenMetrics?.brandCoherence?.typographyCoherence ?? 0.5;
  featureNames.push('typo_coherence');
  interpretable.push(typoCoherence);

  // Reserved (10D)
  for (let i = 0; i < 10; i++) {
    featureNames.push(`typo_reserved_${i + 1}`);
    interpretable.push(0);
  }

  // === Spacing Features (8D) ===

  // Spacing scale length (log-normalized)
  featureNames.push('spacing_scale_length');
  interpretable.push(normalizeLog(tokens.spacing.length, 6));

  // Spacing median (linear normalize, typical 0-48px)
  const spacingMedian = tokens.spacing.length > 0
    ? tokens.spacing[Math.floor(tokens.spacing.length / 2)]
    : 0;
  featureNames.push('spacing_median');
  interpretable.push(normalizeLinear(spacingMedian, 0, 48));

  // Spacing consistency (already 0-1)
  const spacingConsistency = report.realTokenMetrics?.brandCoherence?.spacingConsistency ?? 0.5;
  featureNames.push('spacing_consistency');
  interpretable.push(spacingConsistency);

  // Reserved (5D)
  for (let i = 0; i < 5; i++) {
    featureNames.push(`spacing_reserved_${i + 1}`);
    interpretable.push(0);
  }

  // === Shape Features (8D) ===

  // Border radius count (log-normalized)
  featureNames.push('shape_radius_count');
  interpretable.push(normalizeLog(tokens.borderRadius.length, 3));

  // Border radius median (linear normalize, typical 0-32px)
  const radiusMedian = tokens.borderRadius.length > 0
    ? parseFloat(tokens.borderRadius[Math.floor(tokens.borderRadius.length / 2)])
    : 0;
  featureNames.push('shape_radius_median');
  interpretable.push(normalizeLinear(radiusMedian, 0, 32));

  // Shadow count (log-normalized)
  featureNames.push('shape_shadow_count');
  interpretable.push(normalizeLog(tokens.boxShadow.length, 3));

  // Reserved (5D)
  for (let i = 0; i < 5; i++) {
    featureNames.push(`shape_reserved_${i + 1}`);
    interpretable.push(0);
  }

  // === Brand Personality Features (16D) ===

  if (report.brandPersonality) {
    // Tone (5D one-hot)
    const toneMap: Record<string, number> = {
      professional: 0, playful: 1, elegant: 2, bold: 3, minimal: 4, luxury: 2, friendly: 1
    };
    const toneOneHot = Array(5).fill(0);
    toneOneHot[toneMap[report.brandPersonality.tone] || 0] = 1;
    featureNames.push('brand_tone_professional', 'brand_tone_playful', 'brand_tone_elegant', 'brand_tone_bold', 'brand_tone_minimal');
    interpretable.push(...toneOneHot);

    // Energy (4D one-hot)
    const energyMap: Record<string, number> = {
      calm: 0, energetic: 1, sophisticated: 2, dynamic: 3
    };
    const energyOneHot = Array(4).fill(0);
    energyOneHot[energyMap[report.brandPersonality.energy] || 0] = 1;
    featureNames.push('brand_energy_calm', 'brand_energy_energetic', 'brand_energy_sophisticated', 'brand_energy_dynamic');
    interpretable.push(...energyOneHot);

    // Trust level (4D one-hot)
    const trustMap: Record<string, number> = {
      conservative: 0, modern: 1, innovative: 2, experimental: 3
    };
    const trustOneHot = Array(4).fill(0);
    trustOneHot[trustMap[report.brandPersonality.trustLevel] || 1] = 1;
    featureNames.push('brand_trust_conservative', 'brand_trust_modern', 'brand_trust_innovative', 'brand_trust_experimental');
    interpretable.push(...trustOneHot);

    // Confidence (1D, already 0-1)
    featureNames.push('brand_confidence');
    interpretable.push(report.brandPersonality.confidence);

    // Reserved (2D)
    featureNames.push('brand_reserved_1', 'brand_reserved_2');
    interpretable.push(0, 0);
  } else {
    // Fallback: all zeros
    for (let i = 0; i < 16; i++) {
      featureNames.push(`brand_missing_${i + 1}`);
      interpretable.push(0);
    }
  }

  // === Verify Length ===
  if (interpretable.length !== 64) {
    throw new Error(`Interpretable vector must be 64D, got ${interpretable.length}D`);
  }

  // === Visual Features (128D) - Zero-padded for MVP ===
  const visual = Array(128).fill(0);

  // === Combine ===
  const combined = [...interpretable, ...visual];

  // === Metadata ===
  const nonZeroCount = interpretable.filter(x => x !== 0).length;

  return {
    interpretable: Float32Array.from(interpretable),
    visual: Float32Array.from(visual),
    combined: Float32Array.from(combined),
    metadata: {
      featureNames,
      nonZeroCount
    }
  };
}

function calculatePaletteEntropy(colors: string[]): number {
  // Shannon entropy of color hue distribution
  if (colors.length === 0) return 0;

  const hues = colors.map(c => {
    const lch = hexToLCH(c);
    return lch.h;
  });

  // Bin into 12 buckets (30° each)
  const bins = Array(12).fill(0);
  hues.forEach(h => {
    const binIndex = Math.floor(h / 30) % 12;
    bins[binIndex]++;
  });

  const total = hues.length;
  let entropy = 0;
  bins.forEach(count => {
    if (count > 0) {
      const p = count / total;
      entropy -= p * Math.log2(p);
    }
  });

  return entropy / Math.log2(12); // Normalize to 0-1
}
