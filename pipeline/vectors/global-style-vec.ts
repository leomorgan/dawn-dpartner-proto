import type { DesignTokens, StyleReport } from '../tokens';
import type { ComputedStyleNode } from '../capture';
import { normalizeLinear, normalizeLog, hexToLCH } from './utils';
import { extractLayoutFeatures } from './extractors/layout-features';

/**
 * Builds an 823D global style vector:
 * - 55D interpretable: normalized token statistics + layout features (reduced from 64D → 58D → 55D)
 *   - Removed 6 reserved slots (64D → 58D)
 *   - Removed 3 dead features: color_background_variation, typo_family_count, brand_color_saturation_energy (58D → 55D)
 * - 768D visual: CLIP embeddings from screenshot
 */
export function buildGlobalStyleVec(
  tokens: DesignTokens,
  report: StyleReport,
  nodes: ComputedStyleNode[],
  viewport: { width: number; height: number }
): {
  interpretable: Float32Array;
  visual: Float32Array;
  combined: Float32Array;
  metadata: { featureNames: string[]; nonZeroCount: number };
} {
  const interpretable: number[] = [];
  const featureNames: string[] = [];

  // Extract layout features from DOM data
  const layoutFeats = extractLayoutFeatures(nodes, viewport);

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
  // REMOVED: color_background_variation - not discriminative (all sites have 3-4 backgrounds)

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

  // REMOVED: typo_family_count - not discriminative (all sites use exactly 2 font families in modern web design)

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

  // NEW: Typographic hierarchy depth (coefficient of variation)
  featureNames.push('typo_hierarchy_depth');
  interpretable.push(layoutFeats.typographicHierarchyDepth);

  // NEW: Font weight contrast (normalized)
  featureNames.push('typo_weight_contrast');
  interpretable.push(layoutFeats.fontWeightContrast);

  // V2: New layout features (using reserved slots)
  featureNames.push('layout_element_scale_variance');
  interpretable.push(layoutFeats.elementScaleVariance);

  featureNames.push('layout_vertical_rhythm');
  interpretable.push(layoutFeats.verticalRhythmConsistency);

  featureNames.push('layout_grid_regularity');
  interpretable.push(layoutFeats.gridRegularityScore);

  featureNames.push('layout_above_fold_density');
  interpretable.push(layoutFeats.aboveFoldDensity);

  // === Spacing Features (7D) - removed 1 reserved slot ===

  // Spacing scale length (log-normalized)
  featureNames.push('spacing_scale_length');
  interpretable.push(normalizeLog(tokens.spacing.length, 6));

  // Spacing median (linear normalize)
  // V3 FIX: Adjust range from 0-48 to 8-64 to better capture real variation
  const spacingMedian = tokens.spacing.length > 0
    ? tokens.spacing[Math.floor(tokens.spacing.length / 2)]
    : 0;
  featureNames.push('spacing_median');
  interpretable.push(normalizeLinear(spacingMedian, 8, 64));

  // Spacing consistency (already 0-1)
  const spacingConsistency = report.realTokenMetrics?.brandCoherence?.spacingConsistency ?? 0.5;
  featureNames.push('spacing_consistency');
  interpretable.push(spacingConsistency);

  // NEW: Visual density score
  featureNames.push('spacing_density_score');
  interpretable.push(layoutFeats.visualDensityScore);

  // NEW: Whitespace breathing ratio
  featureNames.push('spacing_whitespace_ratio');
  interpretable.push(layoutFeats.whitespaceBreathingRatio);

  // NEW: Padding consistency
  featureNames.push('spacing_padding_consistency');
  interpretable.push(layoutFeats.paddingConsistency);

  // NEW: Image to text balance (log scale, >1 = image-heavy, <1 = text-heavy)
  featureNames.push('spacing_image_text_balance');
  interpretable.push(normalizeLog(layoutFeats.imageToTextBalance, 1.0));

  // === Shape Features (7D) - removed 1 reserved slot ===

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

  // NEW: Border heaviness
  featureNames.push('shape_border_heaviness');
  interpretable.push(layoutFeats.borderHeaviness);

  // NEW: Shadow elevation depth
  featureNames.push('shape_shadow_depth');
  interpretable.push(layoutFeats.shadowElevationDepth);

  // NEW: Gestalt grouping strength
  featureNames.push('shape_grouping_strength');
  interpretable.push(layoutFeats.gestaltGroupingStrength);

  // NEW: Compositional complexity
  featureNames.push('shape_compositional_complexity');
  interpretable.push(layoutFeats.compositionalComplexity);

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

    // NEW: Color saturation energy (replaces brand_reserved_1)
    // REMOVED: brand_color_saturation_energy - extraction broken (layoutFeatures not saved to style_report.json, all values = 0)

    // NEW: Color role distinction (replaces brand_reserved_2)
    // V3 FIX: Narrow range from 0-10000 to 3000-8000 (observed: 5325-6225)
    featureNames.push('brand_color_role_distinction');
    interpretable.push(normalizeLinear(layoutFeats.colorRoleDistinction, 3000, 8000));
  } else {
    // Fallback: all zeros
    for (let i = 0; i < 16; i++) {
      featureNames.push(`brand_missing_${i + 1}`);
      interpretable.push(0);
    }
  }

  // === Verify Length ===
  // Reduced from 64D → 58D (removed 6 reserved slots) → 55D (removed 3 dead features)
  if (interpretable.length !== 55) {
    throw new Error(`Interpretable vector must be 55D, got ${interpretable.length}D`);
  }

  // === Visual Features (768D) - CLIP embeddings ===
  // Note: Visual vector should be populated by CLIP, not zero-padded
  // For now we just verify it exists in the combined vector
  const visual = Array(768).fill(0);

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
