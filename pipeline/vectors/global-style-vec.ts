/**
 * Global Style Vector Builder
 *
 * Builds a 312D vector consisting of:
 * - 56D interpretable features (colors, typography, spacing, shape, personality)
 * - 256D font embedding (text embedding of font characteristics)
 *
 * Total: 56D + 256D = 312D
 */

import type { DesignTokens, StyleReport } from '../tokens';
import type { ComputedStyleNode } from '../capture';
import { hexToLCH } from './utils';
import { extractLayoutFeatures } from './extractors/layout-features';
import { encodePaletteFeatures, getColorFeatureNames } from './color-encoding-v2';
import { generateFontEmbedding } from './font-embedding';
import { normalizeFeature, l2Normalize as l2NormalizeVec } from './normalization';
import { parse } from 'culori';

export async function buildGlobalStyleVec(
  tokens: DesignTokens,
  report: StyleReport,
  nodes: ComputedStyleNode[],
  viewport: { width: number; height: number }
): Promise<{
  interpretable: Float32Array;
  fontEmbedding: Float32Array;
  combined: Float32Array;
  metadata: {
    featureNames: string[];
    nonZeroCount: number;
    fontDescription: string;
  };
}> {
  const interpretable: number[] = [];
  const featureNames: string[] = [];

  // Extract layout features once
  const layoutFeats = extractLayoutFeatures(nodes, viewport);

  // === 1. COLORS (17D) ===
  // Using CIEDE2000 perceptual distance encoding (color-encoding-v2)
  // - 3D: Brand palette relationships (pairwise distances)
  // - 4D: Semantic color relationships (bg/text/cta distances)
  // - 2D: Background absolute (L, C)
  // - 1D: Text absolute (L)
  // - 4D: Hero brand color absolute (L, C, hue cos/sin)
  // - 3D: CTA color (L, C, distance from hero)
  const colorFeatures = encodePaletteFeatures(tokens);
  interpretable.push(...colorFeatures);
  featureNames.push(...getColorFeatureNames());

  // === 2. COLOR STATISTICS (3D) ===
  // Harmony, saturation mean, and WCAG contrast pass rate
  if (!report.realTokenMetrics?.colorHarmony) {
    throw new Error('Missing required data: report.realTokenMetrics.colorHarmony is undefined');
  }
  const colorHarmony = report.realTokenMetrics.colorHarmony;
  interpretable.push(
    colorHarmony.harmonyScore,
    colorHarmony.saturationRange.avg,
    report.contrastResults.aaPassRate
  );
  featureNames.push('color_harmony', 'color_saturation_mean', 'color_contrast_pass_rate');

  // === 2B. COLOR COVERAGE (3D) ===
  // Percentage of page area using brand colors, accent colors, and foundation colors
  // Coverage can exceed 100% due to overlapping elements (text + background)
  if (!colorHarmony.coverage) {
    throw new Error('Missing required data: colorHarmony.coverage is undefined');
  }
  interpretable.push(
    normalizeFeature(colorHarmony.coverage.brandColorCoveragePercent, 'brand_color_coverage'),
    normalizeFeature(colorHarmony.coverage.accentColorCoveragePercent, 'accent_color_coverage'),
    normalizeFeature(colorHarmony.coverage.foundationColorCoveragePercent, 'foundation_color_coverage')
  );
  featureNames.push('brand_color_coverage', 'accent_color_coverage', 'foundation_color_coverage');

  // === 3. TYPOGRAPHY (14D) ===

  const fontSizes = tokens.typography.fontSizes;
  const fontWeights = tokens.typography.fontWeights;

  if (fontSizes.length === 0) {
    throw new Error('Missing required data: tokens.typography.fontSizes is empty');
  }
  if (fontWeights.length === 0) {
    throw new Error('Missing required data: tokens.typography.fontWeights is empty');
  }

  // Size metrics (3D)
  interpretable.push(
    normalizeFeature(Math.min(...fontSizes), 'font_size_min'),
    normalizeFeature(Math.max(...fontSizes), 'font_size_max'),
    normalizeFeature(Math.max(...fontSizes) - Math.min(...fontSizes), 'font_size_range')
  );
  featureNames.push('font_size_min', 'font_size_max', 'font_size_range');

  // Weight metrics (3D)
  interpretable.push(
    normalizeFeature(Math.min(...fontWeights), 'font_weight_min'),
    normalizeFeature(Math.max(...fontWeights), 'font_weight_max'),
    normalizeFeature(Math.max(...fontWeights) - Math.min(...fontWeights), 'font_weight_contrast')
  );
  featureNames.push('font_weight_min', 'font_weight_max', 'font_weight_contrast');

  // Hierarchy & scale (3D)
  if (!report.realTokenMetrics?.brandCoherence) {
    throw new Error('Missing required data: report.realTokenMetrics.brandCoherence is undefined');
  }

  interpretable.push(
    layoutFeats.typographicHierarchyDepth,
    report.realTokenMetrics.brandCoherence.typographyCoherence,
    layoutFeats.elementScaleVariance
  );
  featureNames.push('typo_hierarchy_depth', 'typo_coherence', 'element_scale_variance');

  // Layout metrics (5D)
  interpretable.push(
    layoutFeats.verticalRhythmConsistency,
    layoutFeats.gridRegularityScore,
    layoutFeats.aboveFoldDensity,
    layoutFeats.compositionalComplexity,
    normalizeFeature(layoutFeats.colorRoleDistinction, 'color_role_distinction')
  );
  featureNames.push(
    'vertical_rhythm', 'grid_regularity', 'above_fold_density',
    'compositional_complexity', 'color_role_distinction'
  );

  // === 4. SPACING (11D) ===
  // Removed duplicates: padding_consistency (duplicate of spacing_consistency)
  // Kept: core spacing metrics, density, borders, shadows

  const spacing = tokens.spacing;
  if (spacing.length === 0) {
    throw new Error('Missing required data: tokens.spacing is empty');
  }

  const sortedSpacing = [...spacing].sort((a, b) => a - b);
  const spacingMedian = sortedSpacing[Math.floor(sortedSpacing.length / 2)];

  // Core spacing (3D)
  interpretable.push(
    normalizeFeature(Math.min(...spacing), 'spacing_min'),
    normalizeFeature(spacingMedian, 'spacing_median'),
    normalizeFeature(Math.max(...spacing), 'spacing_max')
  );
  featureNames.push('spacing_min', 'spacing_median', 'spacing_max');

  // Consistency (1D)
  interpretable.push(
    report.realTokenMetrics.brandCoherence.spacingConsistency
  );
  featureNames.push('spacing_consistency');

  // Density & whitespace (4D)
  interpretable.push(
    layoutFeats.visualDensityScore,
    layoutFeats.whitespaceBreathingRatio,
    normalizeFeature(layoutFeats.imageToTextBalance, 'image_text_balance'),
    normalizeFeature(layoutFeats.gestaltGroupingStrength, 'gestalt_grouping')
  );
  featureNames.push('visual_density', 'whitespace_ratio', 'image_text_balance', 'gestalt_grouping');

  // Border & structure (3D)
  interpretable.push(
    layoutFeats.borderHeaviness,
    layoutFeats.shadowElevationDepth,
    normalizeFeature(tokens.boxShadow.length, 'shadow_count')
  );
  featureNames.push('border_heaviness', 'shadow_depth', 'shadow_count');

  // === 5. SHAPE (6D) ===
  // Removed duplicates: shadow_elevation_depth (duplicate of shadow_depth),
  // shadow_complexity (duplicate of shadow_count), border_heaviness (duplicate),
  // gestalt_grouping_strength (duplicate of gestalt_grouping),
  // compositional_complexity (duplicate from typography)
  // Includes: 3D border radius + 1D palette entropy + 2D personality (brand_confidence, color_coherence)

  const radii = tokens.borderRadius.map(r => parseFloat(r) || 0);
  if (radii.length === 0) {
    throw new Error('Missing required data: tokens.borderRadius is empty');
  }

  const sortedRadii = [...radii].sort((a, b) => a - b);
  const radiusMedian = sortedRadii[Math.floor(sortedRadii.length / 2)];

  // Border radius (3D)
  interpretable.push(
    normalizeFeature(Math.min(...radii), 'radius_min'),
    normalizeFeature(radiusMedian, 'radius_median'),
    normalizeFeature(Math.max(...radii), 'radius_max')
  );
  featureNames.push('radius_min', 'radius_median', 'radius_max');

  // Palette entropy (1D)
  const allColors = [...tokens.colors.primary, ...tokens.colors.neutral];
  const paletteEntropy = calculatePaletteEntropy(allColors);
  interpretable.push(paletteEntropy);
  featureNames.push('palette_entropy');

  // Personality features (2D - empirical metrics, non-categorical)
  if (!report.brandPersonality?.confidence) {
    throw new Error('Missing required data: report.brandPersonality.confidence');
  }
  if (!report.realTokenMetrics?.brandCoherence) {
    throw new Error('Missing required data: report.realTokenMetrics.brandCoherence');
  }
  interpretable.push(
    report.brandPersonality.confidence,
    report.realTokenMetrics.brandCoherence.colorHarmony
  );
  featureNames.push('brand_confidence', 'color_coherence');

  // === 6. BRAND COHERENCE (2D) ===
  // Overall coherence and design system maturity
  if (!report.designSystemAnalysis?.consistency?.overall) {
    throw new Error('Missing required data: report.designSystemAnalysis.consistency.overall');
  }

  interpretable.push(
    report.realTokenMetrics.brandCoherence.overallCoherence,
    report.designSystemAnalysis.consistency.overall
  );
  featureNames.push('overall_coherence', 'design_system_maturity');

  // === Verify interpretable length ===
  // 17D colors + 3D color stats + 3D color coverage + 14D typography + 11D spacing + 6D shape + 2D coherence = 56D
  if (interpretable.length !== 56) {
    throw new Error(`Interpretable vector must be 56D, got ${interpretable.length}D. Feature breakdown:
      - Colors: 17D
      - Color stats: 3D
      - Color coverage: 3D
      - Typography: 14D
      - Spacing: 11D
      - Shape: 6D (radius 3D + palette_entropy 1D + personality 2D)
      - Coherence: 2D
      Total: 56D`);
  }

  // === 7. FONT EMBEDDING (256D) ===

  const { embedding: fontEmbedding, description: fontDescription } = await generateFontEmbedding(tokens);

  if (fontEmbedding.length !== 256) {
    throw new Error(`Font embedding must be 256D, got ${fontEmbedding.length}D`);
  }

  // === Combine ===
  const combinedRaw = new Float32Array(312); // 56D interpretable + 256D font = 312D
  combinedRaw.set(interpretable, 0);
  combinedRaw.set(fontEmbedding, interpretable.length);

  if (combinedRaw.length !== 312) {
    throw new Error(`Combined vector must be 312D, got ${combinedRaw.length}D`);
  }

  // L2 normalize the combined vector for cosine similarity
  const combined = l2NormalizeVec(Array.from(combinedRaw));

  // === Metadata ===
  const nonZeroCount = interpretable.filter(x => x !== 0).length;

  return {
    interpretable: Float32Array.from(interpretable),
    fontEmbedding,
    combined,
    metadata: {
      featureNames,
      nonZeroCount,
      fontDescription
    }
  };
}

/**
 * Calculate Shannon entropy of color hue distribution
 * Used to measure color palette diversity
 */
function calculatePaletteEntropy(colors: string[]): number {
  if (colors.length === 0) return 0;

  const hues: number[] = [];
  for (const colorHex of colors) {
    const parsed = parse(colorHex);
    if (!parsed) continue;
    const lch = hexToLCH(colorHex);
    hues.push(lch.h);
  }

  if (hues.length === 0) return 0;

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
