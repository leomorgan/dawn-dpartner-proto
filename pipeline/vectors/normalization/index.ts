/**
 * Centralized Normalization Module
 *
 * Single source of truth for all feature normalization in the vector pipeline.
 * Uses FIXED min-max bounds (not population statistics) - works for one-by-one ingestion.
 *
 * Strategies:
 * - minmax: Direct min-max scaling to [0, 1]
 * - log-minmax: Log transform first (for skewed distributions), then min-max scale
 * - absolute: Theoretical bounds (e.g., LCH lightness 0-100, already normalized features)
 * - circular: Hue angles (already encoded as cos/sin pairs, no normalization needed)
 */

import normalizationBounds from './normalization-bounds.json';

interface FeatureBounds {
  strategy: 'minmax' | 'log-minmax' | 'absolute' | 'circular';
  min: number;
  max: number;
  note?: string;
}

/**
 * Normalize a single feature value using fixed min-max bounds
 *
 * @param value Raw feature value
 * @param featureName Name of feature (must exist in normalization-bounds.json)
 * @returns Normalized value in [0, 1] range
 */
export function normalizeFeature(value: number, featureName: string): number {
  const bounds = (normalizationBounds.features as Record<string, FeatureBounds>)[featureName];

  if (!bounds) {
    throw new Error(`No normalization bounds for feature: ${featureName}. Add to normalization-bounds.json.`);
  }

  // Handle zero range (all values identical)
  if (bounds.min === bounds.max) {
    return 0.5; // Return midpoint to avoid division by zero
  }

  switch (bounds.strategy) {
    case 'minmax':
      // Direct min-max scaling to [0, 1]
      return clamp((value - bounds.min) / (bounds.max - bounds.min), 0, 1);

    case 'log-minmax':
      // Log transform first (for skewed distributions), then min-max scale
      // Add 1 to handle zero values: log(0+1) = 0
      const logged = Math.log(value + 1);
      const logMin = Math.log(bounds.min + 1);
      const logMax = Math.log(bounds.max + 1);
      return clamp((logged - logMin) / (logMax - logMin), 0, 1);

    case 'absolute':
      // Theoretical bounds (e.g., LCH lightness 0-100) or already normalized [0,1]
      // Many layout features are already in [0, 1], so this is a passthrough with safety clamp
      return clamp((value - bounds.min) / (bounds.max - bounds.min), 0, 1);

    case 'circular':
      throw new Error('Circular features (hue angles) should already be encoded as cos/sin pairs. Use normalizeCircular() if needed.');

    default:
      throw new Error(`Unknown normalization strategy: ${(bounds as any).strategy}`);
  }
}

/**
 * Clamp value to [min, max] range
 */
function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Normalize circular features (hue angles)
 * Returns [cos, sin] pair (already in [-1, 1] range)
 *
 * Note: This is provided for completeness, but hue angles should be
 * encoded as cos/sin at extraction time (see color-encoding-v2.ts)
 *
 * @param degrees Hue angle in degrees [0, 360]
 * @returns [cos, sin] pair
 */
export function normalizeCircular(degrees: number): [number, number] {
  const rad = (degrees * Math.PI) / 180;
  return [Math.cos(rad), Math.sin(rad)];
}

/**
 * L2 normalize a vector to unit length
 *
 * Essential for cosine similarity to work correctly.
 * All vectors must be L2 normalized before storage/comparison.
 *
 * @param vector Array of normalized features
 * @returns Unit-length vector (L2 norm = 1.0)
 */
export function l2Normalize(vector: number[]): Float32Array {
  const norm = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0));

  if (norm === 0 || !isFinite(norm)) {
    // Avoid division by zero - return original vector
    console.warn('L2 normalization: zero or infinite norm detected, returning original vector');
    return Float32Array.from(vector);
  }

  return Float32Array.from(vector.map(v => v / norm));
}

/**
 * Get feature names in order for a given vector type
 * Useful for debugging and feature importance analysis
 */
export function getFeatureNames(vectorType: 'global' | 'cta'): string[] {
  if (vectorType === 'global') {
    // These must match the order in global-style-vec.ts
    return [
      // Colors (17D) - from color-encoding-v2
      'color_palette_avg_distance',
      'color_palette_min_distance',
      'color_palette_max_distance',
      'color_bg_text_distance',
      'color_cta_bg_distance',
      'color_cta_text_distance',
      'color_hero_bg_distance',
      'color_bg_lightness',
      'color_bg_chroma',
      'color_text_lightness',
      'color_hero_lightness',
      'color_hero_chroma',
      'color_hero_hue_cos',
      'color_hero_hue_sin',
      'color_cta_lightness',
      'color_cta_chroma',
      'color_cta_hero_distance',

      // Color Stats (3D)
      'color_harmony',
      'color_saturation_mean',
      'color_contrast_pass_rate',

      // Typography (14D)
      'font_size_min',
      'font_size_max',
      'font_size_range',
      'font_weight_min',
      'font_weight_max',
      'font_weight_contrast',
      'typo_hierarchy_depth',
      'typo_coherence',
      'element_scale_variance',
      'vertical_rhythm',
      'grid_regularity',
      'above_fold_density',
      'compositional_complexity',
      'color_role_distinction',

      // Spacing (11D)
      'spacing_min',
      'spacing_median',
      'spacing_max',
      'spacing_consistency',
      'visual_density',
      'whitespace_ratio',
      'image_text_balance',
      'gestalt_grouping',
      'border_heaviness',
      'shadow_depth',
      'shadow_count',

      // Shape (6D)
      'radius_min',
      'radius_median',
      'radius_max',
      'palette_entropy',
      'brand_confidence',
      'color_coherence',
    ];
  } else if (vectorType === 'cta') {
    // CTA vector features (26D)
    return [
      'cta_bg_lightness',
      'cta_bg_chroma',
      'cta_bg_hue_cos',
      'cta_bg_hue_sin',
      'cta_text_lightness',
      'cta_text_chroma',
      'cta_text_hue_cos',
      'cta_text_hue_sin',
      'cta_contrast',
      'cta_border_radius',
      'cta_padding_x',
      'cta_padding_y',
      'cta_font_size',
      'cta_font_weight',
      'cta_shadow',
      'cta_prominence_score',
      'cta_avg_size',
      'cta_avg_position',
      'cta_count',
      'cta_hover_bg_shift',
      'cta_hover_text_shift',
      'cta_hover_opacity',
      'cta_hover_transform',
      'cta_hover_shadow',
      'cta_type_primary',
      'cta_type_secondary',
    ];
  }

  throw new Error(`Unknown vector type: ${vectorType}`);
}

/**
 * Validate that all required feature bounds are defined
 * Call this at startup to catch configuration errors early
 */
export function validateBounds(vectorType: 'global' | 'cta'): void {
  const featureNames = getFeatureNames(vectorType);
  const missingBounds: string[] = [];

  for (const name of featureNames) {
    if (!(normalizationBounds.features as Record<string, unknown>)[name]) {
      missingBounds.push(name);
    }
  }

  if (missingBounds.length > 0) {
    throw new Error(
      `Missing normalization bounds for ${missingBounds.length} features in ${vectorType} vector:\n` +
      missingBounds.map(name => `  - ${name}`).join('\n') +
      `\n\nAdd these to pipeline/vectors/normalization/normalization-bounds.json`
    );
  }

  console.log(`✅ Normalization bounds validated for ${vectorType} vector (${featureNames.length} features)`);
}
