/**
 * Extracts raw (unnormalized) interpretable vector values from tokens and report.
 * This allows us to show human-readable values alongside normalized vectors
 * without storing duplicate data in the database.
 */

import { INTERPRETABLE_FEATURE_NAMES } from './cosine-explainer';

export interface RawValueExtractionResult {
  raw: number[];
  units: string[];  // Human-readable units (e.g., "colors", "px", "%", "score")
  labels: string[];  // Human-readable labels
}

/**
 * Extract raw values for all 55 interpretable features from tokens/report JSON
 */
export function extractRawInterpretableValues(
  tokens: any,
  report: any
): RawValueExtractionResult {
  const raw: number[] = [];
  const units: string[] = [];
  const labels: string[] = [];

  // We follow the EXACT same order as global-style-vec.ts

  // === Color Features (15D) ===

  // 0: color_primary_count
  raw.push(tokens.colors.primary.length);
  units.push('colors');
  labels.push('Primary Colors');

  // 1: color_neutral_count
  raw.push(tokens.colors.neutral.length);
  units.push('colors');
  labels.push('Neutral Colors');

  // 2: color_palette_entropy
  // NOTE: The stored value is already normalized (0-1). We need to recalculate the raw entropy.
  const rawEntropy = calculateRawPaletteEntropy([...tokens.colors.primary, ...tokens.colors.neutral]);
  raw.push(rawEntropy);
  units.push('bits');
  labels.push('Palette Entropy');

  // 3: color_contrast_pass_rate
  raw.push(report.contrastResults.aaPassRate);
  units.push('%');
  labels.push('Contrast Pass Rate');

  // 4: color_dominant_hue
  raw.push(report.realTokenMetrics?.colorHarmony?.dominantHue ?? 0);
  units.push('°');
  labels.push('Dominant Hue');

  // 5: color_saturation_mean
  raw.push(report.realTokenMetrics?.colorHarmony?.saturationRange?.avg ?? 0.5);
  units.push('%');
  labels.push('Saturation Mean');

  // 6: color_lightness_mean
  raw.push(report.realTokenMetrics?.colorHarmony?.lightnessRange?.avg ?? 0.5);
  units.push('%');
  labels.push('Lightness Mean');

  // 7: color_button_diversity
  raw.push(tokens.colors.contextual.buttons.length);
  units.push('colors');
  labels.push('Button Colors');

  // 8: color_link_diversity
  raw.push(tokens.colors.contextual.links.length);
  units.push('colors');
  labels.push('Link Colors');

  // 9: color_harmony_score
  raw.push(report.realTokenMetrics?.colorHarmony?.harmonyScore ?? 0.5);
  units.push('score');
  labels.push('Color Harmony');

  // 10: color_coherence
  raw.push(report.realTokenMetrics?.brandCoherence?.colorHarmony ?? 0.5);
  units.push('score');
  labels.push('Color Coherence');

  // 11: color_foundation_count
  raw.push(tokens.colors.foundation.length);
  units.push('colors');
  labels.push('Foundation Colors');

  // 12: color_brand_count
  raw.push(tokens.colors.brandColors.length);
  units.push('colors');
  labels.push('Brand Colors');

  // 13: color_brand_saturation
  raw.push(report.realTokenMetrics?.colorHarmony?.brandColorSaturation ?? 0.5);
  units.push('%');
  labels.push('Brand Saturation');

  // 14: color_neutral_tint
  raw.push(report.realTokenMetrics?.colorHarmony?.neutralTint ?? 0);
  units.push('%');
  labels.push('Neutral Tint');

  // === Typography Features (11D) ===

  // 15: typo_size_range
  const fontSizeRange = tokens.typography.fontSizes.length > 0
    ? Math.max(...tokens.typography.fontSizes) - Math.min(...tokens.typography.fontSizes)
    : 0;
  raw.push(fontSizeRange);
  units.push('px');
  labels.push('Font Size Range');

  // 16: typo_size_count
  raw.push(tokens.typography.fontSizes.length);
  units.push('sizes');
  labels.push('Font Size Count');

  // 17: typo_weight_count
  raw.push(tokens.typography.fontWeights.length);
  units.push('weights');
  labels.push('Font Weight Count');

  // 18: typo_lineheight_count
  raw.push(tokens.typography.lineHeights.length);
  units.push('heights');
  labels.push('Line Height Count');

  // 19: typo_coherence
  raw.push(report.realTokenMetrics?.brandCoherence?.typographyCoherence ?? 0.5);
  units.push('score');
  labels.push('Typography Coherence');

  // 20-25: Layout features from report.layoutFeatures (stored in style_report.json)
  // Note: These come from extractLayoutFeatures() but are saved to the report
  const layoutFeats = report.layoutFeatures || {};

  // 20: typo_hierarchy_depth
  raw.push(layoutFeats.typographicHierarchyDepth ?? 0);
  units.push('cv');
  labels.push('Hierarchy Depth');

  // 21: typo_weight_contrast
  raw.push(layoutFeats.fontWeightContrast ?? 0);
  units.push('score');
  labels.push('Weight Contrast');

  // 22: layout_element_scale_variance
  raw.push(layoutFeats.elementScaleVariance ?? 0);
  units.push('variance');
  labels.push('Element Scale Variance');

  // 23: layout_vertical_rhythm
  raw.push(layoutFeats.verticalRhythmConsistency ?? 0);
  units.push('score');
  labels.push('Vertical Rhythm');

  // 24: layout_grid_regularity
  raw.push(layoutFeats.gridRegularityScore ?? 0);
  units.push('score');
  labels.push('Grid Regularity');

  // 25: layout_above_fold_density
  raw.push(layoutFeats.aboveFoldDensity ?? 0);
  units.push('density');
  labels.push('Above Fold Density');

  // === Spacing Features (7D) ===

  // 26: spacing_scale_length
  raw.push(tokens.spacing.length);
  units.push('steps');
  labels.push('Spacing Scale Length');

  // 27: spacing_median
  const spacingMedian = tokens.spacing.length > 0
    ? tokens.spacing[Math.floor(tokens.spacing.length / 2)]
    : 0;
  raw.push(spacingMedian);
  units.push('px');
  labels.push('Spacing Median');

  // 28: spacing_consistency
  raw.push(report.realTokenMetrics?.brandCoherence?.spacingConsistency ?? 0.5);
  units.push('score');
  labels.push('Spacing Consistency');

  // 29: spacing_density_score
  raw.push(layoutFeats.visualDensityScore ?? 0);
  units.push('density');
  labels.push('Visual Density');

  // 30: spacing_whitespace_ratio
  raw.push(layoutFeats.whitespaceBreathingRatio ?? 0);
  units.push('ratio');
  labels.push('Whitespace Ratio');

  // 31: spacing_padding_consistency
  raw.push(layoutFeats.paddingConsistency ?? 0);
  units.push('score');
  labels.push('Padding Consistency');

  // 32: spacing_image_text_balance
  raw.push(layoutFeats.imageToTextBalance ?? 1.0);
  units.push('ratio');
  labels.push('Image/Text Balance');

  // === Shape Features (7D) ===

  // 33: shape_radius_count
  raw.push(tokens.borderRadius.length);
  units.push('radii');
  labels.push('Radius Count');

  // 34: shape_radius_median
  const radiusMedian = tokens.borderRadius.length > 0
    ? parseFloat(tokens.borderRadius[Math.floor(tokens.borderRadius.length / 2)])
    : 0;
  raw.push(radiusMedian);
  units.push('px');
  labels.push('Radius Median');

  // 35: shape_shadow_count
  raw.push(tokens.boxShadow.length);
  units.push('shadows');
  labels.push('Shadow Count');

  // 36: shape_border_heaviness
  raw.push(layoutFeats.borderHeaviness ?? 0);
  units.push('score');
  labels.push('Border Heaviness');

  // 37: shape_shadow_depth
  raw.push(layoutFeats.shadowElevationDepth ?? 0);
  units.push('score');
  labels.push('Shadow Depth');

  // 38: shape_grouping_strength
  raw.push(layoutFeats.gestaltGroupingStrength ?? 0);
  units.push('score');
  labels.push('Grouping Strength');

  // 39: shape_compositional_complexity
  raw.push(layoutFeats.compositionalComplexity ?? 0);
  units.push('complexity');
  labels.push('Compositional Complexity');

  // === Brand Personality Features (15D) ===
  // These are one-hot encoded, so raw values don't make sense
  // We'll use the categorical values instead

  if (report.brandPersonality) {
    // 40-44: Tone (5D one-hot) - show the selected tone value
    const tones = ['professional', 'playful', 'elegant', 'bold', 'minimal'];
    const selectedTone = tones.indexOf(report.brandPersonality.tone);
    for (let i = 0; i < 5; i++) {
      raw.push(i === selectedTone ? 1 : 0);
      units.push('binary');
      labels.push(`Tone: ${tones[i]}`);
    }

    // 45-48: Energy (4D one-hot)
    const energies = ['calm', 'energetic', 'sophisticated', 'dynamic'];
    const selectedEnergy = energies.indexOf(report.brandPersonality.energy);
    for (let i = 0; i < 4; i++) {
      raw.push(i === selectedEnergy ? 1 : 0);
      units.push('binary');
      labels.push(`Energy: ${energies[i]}`);
    }

    // 49-52: Trust (4D one-hot)
    const trusts = ['conservative', 'modern', 'innovative', 'experimental'];
    const selectedTrust = trusts.indexOf(report.brandPersonality.trustLevel);
    for (let i = 0; i < 4; i++) {
      raw.push(i === selectedTrust ? 1 : 0);
      units.push('binary');
      labels.push(`Trust: ${trusts[i]}`);
    }

    // 53: brand_confidence
    raw.push(report.brandPersonality.confidence);
    units.push('score');
    labels.push('Brand Confidence');

    // 54: brand_color_role_distinction
    raw.push(layoutFeats.colorRoleDistinction ?? 0);
    units.push('ΔE');
    labels.push('Color Role Distinction');
  } else {
    // Fallback: all zeros for 15 brand features
    for (let i = 0; i < 15; i++) {
      raw.push(0);
      units.push('missing');
      labels.push(`Brand Missing ${i + 1}`);
    }
  }

  // Verify length
  if (raw.length !== 55) {
    throw new Error(`Raw vector must be 55D, got ${raw.length}D`);
  }

  return { raw, units, labels };
}

/**
 * Smart number formatting - shows only necessary precision
 */
function formatSmartPrecision(value: number, maxDecimals: number = 3): string {
  // If it's effectively zero, return "0"
  if (Math.abs(value) < 1e-10) {
    return '0';
  }

  // If it's an integer, return as integer
  if (Number.isInteger(value)) {
    return value.toString();
  }

  // For very small numbers (< 0.01), use up to maxDecimals to capture significant digits
  if (Math.abs(value) < 0.01) {
    // Find first significant digit
    const str = value.toFixed(maxDecimals + 3);
    // Trim trailing zeros
    return parseFloat(str).toString();
  }

  // For normal numbers, use maxDecimals but trim trailing zeros
  const str = value.toFixed(maxDecimals);
  return parseFloat(str).toString();
}

/**
 * Format a raw value with its unit for display
 */
export function formatRawValue(value: number, unit: string): string {
  // Discrete counts - always integers
  if (unit === 'colors' || unit === 'sizes' || unit === 'weights' ||
      unit === 'heights' || unit === 'radii' || unit === 'shadows' ||
      unit === 'steps') {
    return `${Math.round(value)}`;
  }

  // Percentages - check if already in 0-100 range or 0-1 range
  if (unit === '%') {
    // If value is > 1, it's already a percentage
    if (value > 1) {
      return `${formatSmartPrecision(value, 1)}%`;
    }
    // Otherwise it's a 0-1 ratio that needs conversion
    return `${formatSmartPrecision(value * 100, 1)}%`;
  }

  // Angles
  if (unit === '°') {
    return `${formatSmartPrecision(value, 0)}°`;
  }

  // Pixel values
  if (unit === 'px') {
    return `${formatSmartPrecision(value, 0)}px`;
  }

  // Scores, ratios, entropy - use smart precision
  if (unit === 'score' || unit === 'ratio' || unit === 'entropy' ||
      unit === 'cv' || unit === 'variance' || unit === 'density' ||
      unit === 'complexity') {
    return formatSmartPrecision(value, 3);
  }

  // Bits (entropy)
  if (unit === 'bits') {
    return `${formatSmartPrecision(value, 2)} bits`;
  }

  // Binary flags
  if (unit === 'binary') {
    return value === 1 ? 'Yes' : 'No';
  }

  // Missing data
  if (unit === 'missing') {
    return 'N/A';
  }

  // Delta E color difference
  if (unit === 'ΔE') {
    return `ΔE ${formatSmartPrecision(value, 1)}`;
  }

  // Default: smart precision
  return formatSmartPrecision(value, 2);
}

/**
 * Calculate raw Shannon entropy (in bits) for a color palette.
 * This matches the calculation in global-style-vec.ts but returns the unnormalized value.
 */
function calculateRawPaletteEntropy(colors: string[]): number {
  if (colors.length === 0) return 0;

  // Simple hex to hue conversion (we don't need culori for this)
  const hexToHue = (hex: string): number => {
    const r = parseInt(hex.slice(1, 3), 16) / 255;
    const g = parseInt(hex.slice(3, 5), 16) / 255;
    const b = parseInt(hex.slice(5, 7), 16) / 255;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const delta = max - min;

    if (delta === 0) return 0;

    let h = 0;
    if (max === r) {
      h = ((g - b) / delta) % 6;
    } else if (max === g) {
      h = (b - r) / delta + 2;
    } else {
      h = (r - g) / delta + 4;
    }

    h = h * 60;
    if (h < 0) h += 360;

    return h;
  };

  const hues = colors.map(hexToHue);

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

  // Return RAW entropy in bits (not normalized)
  return entropy;
}
