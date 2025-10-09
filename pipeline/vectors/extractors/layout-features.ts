/**
 * Layout Features Extractor
 * Extracts 12 design-focused features to differentiate dense vs minimal layouts
 */

import type { ComputedStyleNode } from '../../capture';
import {
  coefficientOfVariation,
  normalizeLinear,
  normalizeLog,
  clamp,
  calculateMean,
  calculateStdDev,
  normalizeDensityPiecewise,
} from '../utils/math';
import type { Lch } from 'culori';
import {
  parseColor,
  calculateDeltaE,
  getChroma,
} from '../utils/color-math';
import {
  calculateBBoxArea,
  detectVisualGroups,
  calculateIntraGroupSpacing,
  calculateInterGroupSpacing,
  isImageElement,
  hasTextContent,
  detectHorizontalBands,
  measureVerticalGaps,
  measureHorizontalGaps,
} from '../utils/geometry';

export interface LayoutFeatureSet {
  // Spacing & Density (5 features)
  visualDensityScore: number;
  whitespaceBreathingRatio: number;
  paddingConsistency: number;
  gestaltGroupingStrength: number;
  borderHeaviness: number;

  // Typography (2 features)
  typographicHierarchyDepth: number;
  fontWeightContrast: number;

  // Visual Composition (5 features)
  compositionalComplexity: number;
  imageToTextBalance: number;
  colorSaturationEnergy: number;
  shadowElevationDepth: number;
  colorRoleDistinction: number;

  // V2: New Layout Features (4 features)
  elementScaleVariance: number;
  verticalRhythmConsistency: number;
  gridRegularityScore: number;
  aboveFoldDensity: number;
}

/**
 * Extract all 16 layout features from captured DOM nodes (12 V1 + 4 V2)
 *
 * @param nodes Array of visible DOM elements with computed styles
 * @param viewport Viewport dimensions
 * @returns LayoutFeatureSet with all features normalized to 0-1 range
 */
export function extractLayoutFeatures(
  nodes: ComputedStyleNode[],
  viewport: { width: number; height: number }
): LayoutFeatureSet {
  return {
    // Spacing & Density
    visualDensityScore: calculateVisualDensity(nodes, viewport),
    whitespaceBreathingRatio: calculateWhitespaceBreathing(nodes),
    paddingConsistency: calculatePaddingConsistency(nodes),
    gestaltGroupingStrength: calculateGestaltGrouping(nodes),
    borderHeaviness: calculateBorderHeaviness(nodes, viewport),

    // Typography
    typographicHierarchyDepth: calculateTypographicHierarchy(nodes),
    fontWeightContrast: calculateFontWeightContrast(nodes),

    // Visual Composition
    compositionalComplexity: calculateCompositionalComplexity(nodes),
    imageToTextBalance: calculateImageTextBalance(nodes),
    colorSaturationEnergy: calculateColorSaturation(nodes),
    shadowElevationDepth: calculateShadowDepth(nodes),
    colorRoleDistinction: calculateColorDiversity(nodes),

    // V2: New Layout Features
    elementScaleVariance: calculateElementScaleVariance(nodes),
    verticalRhythmConsistency: calculateVerticalRhythm(nodes),
    gridRegularityScore: calculateGridRegularity(nodes),
    aboveFoldDensity: calculateAboveFoldDensity(nodes, viewport),
  };
}

// =============================================================================
// SPACING & DENSITY FEATURES
// =============================================================================

/**
 * Visual Density Score
 * Measures how "busy" a layout feels by calculating ratio of element area to viewport area
 * Dense layouts (CNN): 0.75-0.90, Minimal layouts (Stripe): 0.15-0.35
 *
 * NOTE: Elements overlap heavily (stacking), so raw ratio can be 100-400x viewport.
 * We use log normalization with higher midpoint to handle this.
 */
function calculateVisualDensity(
  nodes: ComputedStyleNode[],
  viewport: { width: number; height: number }
): number {
  const viewportArea = viewport.width * viewport.height;
  if (viewportArea === 0) return 0;

  const totalElementArea = nodes.reduce((sum, node) => {
    return sum + calculateBBoxArea(node.bbox);
  }, 0);

  const densityRatio = totalElementArea / viewportArea;

  // V2: Use piecewise normalization for better differentiation in 150-250 range
  // Monzo: 173.82 → 0.571, CNN: 185.82 → 0.607 (Δ = 0.036, 3.3x better than V1)
  return normalizeDensityPiecewise(densityRatio);
}

/**
 * Whitespace Breathing Ratio (V2)
 * Measures actual pixel gaps between elements (vertical and horizontal)
 * Tight layouts: 8-16px gaps → 0.0-0.1
 * Moderate layouts: 16-32px gaps → 0.1-0.3
 * Generous layouts: 32-64px gaps → 0.3-0.6
 * Very generous: 64-128px gaps → 0.6-1.0
 *
 * V2: Measures real gaps between elements, not padding/margin proxies
 * Expected: Monzo ~80px → 0.6, CNN ~32px → 0.2 (Δ = 0.4)
 */
function calculateWhitespaceBreathing(nodes: ComputedStyleNode[]): number {
  if (nodes.length < 2) return 0.5; // Not enough elements

  // Detect horizontal bands (rows of elements)
  const bands = detectHorizontalBands(nodes, 20);

  // Measure vertical gaps between bands
  const verticalGaps = measureVerticalGaps(bands);

  // Measure horizontal gaps within bands
  const horizontalGaps = measureHorizontalGaps(bands);

  if (verticalGaps.length === 0 && horizontalGaps.length === 0) {
    return 0.5; // No gaps detected
  }

  // Calculate average gaps (weight vertical 2x more important)
  const avgVerticalGap = verticalGaps.length > 0 ? calculateMean(verticalGaps) : 0;
  const avgHorizontalGap = horizontalGaps.length > 0 ? calculateMean(horizontalGaps) : 0;

  const combinedGap = (avgVerticalGap * 2 + avgHorizontalGap) / 3;

  // Normalize to 0-1 range (8-128px)
  return normalizeLinear(combinedGap, 8, 128);
}

/**
 * Padding Consistency
 * Measures systematic vs ad-hoc spacing using coefficient of variation
 * Consistent: 0.8-1.0, Inconsistent: 0.1-0.3
 *
 * NOTE: Observed CV values are 1.5-1.9 (higher than expected).
 * Adjusted max to 2.5 to capture the full range.
 */
function calculatePaddingConsistency(nodes: ComputedStyleNode[]): number {
  const paddingValues: number[] = [];

  nodes.forEach(node => {
    const padding = parsePaddingValues(node.styles.padding);
    paddingValues.push(...padding.filter(p => p > 0));
  });

  if (paddingValues.length < 2) return 0.5; // Not enough data

  const cv = coefficientOfVariation(paddingValues);

  // Invert CV: low variation = high consistency
  // Observed CV range: 1.5-1.9 (Stripe: 1.86, FIFA: 1.51)
  // Use max of 2.5 to capture differences
  return clamp(1 - normalizeLinear(cv, 0, 2.5), 0, 1);
}

/**
 * Gestalt Grouping Strength
 * Measures how well elements are visually grouped (inter-group / intra-group spacing)
 * Weak grouping: 0.4-0.6, Strong grouping: 0.8-0.95
 *
 * NOTE: Observed scores are 3000-6000 (much higher than expected 1-10).
 * Adjusted midpoint to 4500 for proper normalization.
 */
function calculateGestaltGrouping(nodes: ComputedStyleNode[]): number {
  if (nodes.length < 3) return 0.5; // Not enough elements

  const groups = detectVisualGroups(nodes, 32); // 32px proximity threshold

  if (groups.length < 2) return 0.5; // Only one group

  const groupingScores = groups.map(group => {
    const intraSpacing = calculateIntraGroupSpacing(group);
    const interSpacing = calculateInterGroupSpacing(group, nodes);

    // Higher ratio = stronger grouping
    return interSpacing / (intraSpacing + 1);
  });

  const avgScore = calculateMean(groupingScores);

  // V3 FIX: Switch from log to linear normalization with range 3000-8000
  // Log normalization was compressing variance (Stripe 3063→0.46, FIFA 6224→0.53)
  return normalizeLinear(avgScore, 3000, 8000);
}

/**
 * Border Heaviness
 * Measures use of visible borders and dividers
 * Heavy borders: 0.6-0.8, Minimal borders: 0.05-0.15
 */
function calculateBorderHeaviness(
  nodes: ComputedStyleNode[],
  viewport: { width: number; height: number }
): number {
  const viewportPerimeter = 2 * (viewport.width + viewport.height);
  if (viewportPerimeter === 0) return 0;

  let totalBorderContribution = 0;

  nodes.forEach(node => {
    const borderWidth = parseBorderWidth(node.styles.border);
    if (borderWidth === 0) return;

    // Approximate border length as element perimeter
    const perimeter = 2 * (node.bbox.w + node.bbox.h);
    totalBorderContribution += perimeter * borderWidth;
  });

  const heaviness = totalBorderContribution / viewportPerimeter;

  // Normalize (typical range: 0-100)
  return normalizeLinear(heaviness, 0, 100);
}

// =============================================================================
// TYPOGRAPHY FEATURES
// =============================================================================

/**
 * Typographic Hierarchy Depth
 * Measures font size variation using coefficient of variation
 * Deep hierarchy: 0.8-1.2, Shallow hierarchy: 0.3-0.5
 */
function calculateTypographicHierarchy(nodes: ComputedStyleNode[]): number {
  const fontSizes = nodes
    .map(node => parseFloat(node.styles.fontSize))
    .filter(size => !isNaN(size) && size > 0);

  if (fontSizes.length < 2) return 0.5;

  const cv = coefficientOfVariation(fontSizes);

  // Typical CV range: 0.2-1.5
  return normalizeLinear(cv, 0, 1.5);
}

/**
 * Font Weight Contrast
 * Measures range of font weights (bold vs subtle emphasis)
 * High contrast: 200-400, Low contrast: 100-200
 */
function calculateFontWeightContrast(nodes: ComputedStyleNode[]): number {
  const weights = nodes
    .map(node => parseFontWeight(node.styles.fontWeight))
    .filter(w => w > 0);

  if (weights.length === 0) return 0.5;

  const minWeight = Math.min(...weights);
  const maxWeight = Math.max(...weights);
  const contrast = maxWeight - minWeight;

  // Normalize to 0-1 (font weights range 100-900)
  return normalizeLinear(contrast, 0, 900);
}

// =============================================================================
// VISUAL COMPOSITION FEATURES
// =============================================================================

/**
 * Compositional Complexity
 * Measures visual fragmentation using distinct visual groups
 * Complex: 0.75-0.95, Simple: 0.2-0.4
 *
 * NOTE: Observed complexity values are 18-19 (much higher than expected 0.5-3).
 * This suggests groups are highly fragmented. Adjusted max to 25.
 */
function calculateCompositionalComplexity(nodes: ComputedStyleNode[]): number {
  if (nodes.length === 0) return 0;

  const groups = detectVisualGroups(nodes, 32);
  const groupCount = groups.length;
  const elementCount = nodes.length;

  // Complexity = groups per sqrt(elements)
  const complexity = groupCount / Math.sqrt(elementCount);

  // Normalize (observed range: 18-19, use max of 25)
  // Stripe: 18.5 → 0.74, FIFA: 18.0 → 0.72
  return normalizeLinear(complexity, 0, 25);
}

/**
 * Image-to-Text Balance
 * Measures ratio of image area to text area
 * Text-heavy: 0.3-0.5, Image-heavy: 1.5-3.0
 */
function calculateImageTextBalance(nodes: ComputedStyleNode[]): number {
  let imageArea = 0;
  let textArea = 0;

  nodes.forEach(node => {
    const area = calculateBBoxArea(node.bbox);

    if (isImageElement(node)) {
      imageArea += area;
    } else if (hasTextContent(node)) {
      textArea += area;
    }
  });

  if (textArea === 0) return 0.5; // No text = balanced fallback

  const ratio = imageArea / textArea;

  // Return raw ratio (will be log-normalized in vector builder)
  return ratio;
}

/**
 * Color Saturation Energy
 * Measures area-weighted average chroma in LCH space
 * Vibrant: 50-70, Muted: 10-30
 */
function calculateColorSaturation(nodes: ComputedStyleNode[]): number {
  let totalChroma = 0;
  let totalArea = 0;

  nodes.forEach(node => {
    const area = calculateBBoxArea(node.bbox);

    // Check background color
    const bgColor = parseColor(node.styles.backgroundColor);
    if (bgColor) {
      totalChroma += getChroma(bgColor) * area;
      totalArea += area;
    }

    // Check text color (weighted less)
    const textColor = parseColor(node.styles.color);
    if (textColor) {
      totalChroma += getChroma(textColor) * area * 0.5;
      totalArea += area * 0.5;
    }
  });

  if (totalArea === 0) return 0;

  const avgChroma = totalChroma / totalArea;

  // Return raw chroma (LCH chroma range: 0-130+)
  return avgChroma;
}

/**
 * Shadow Elevation Depth
 * Measures use of box-shadow for depth/layering
 * Flat: 0.1-0.3, Layered: 0.4-0.7
 */
function calculateShadowDepth(nodes: ComputedStyleNode[]): number {
  const shadowScores: number[] = [];

  nodes.forEach(node => {
    const shadow = node.styles.boxShadow;
    if (!shadow || shadow === 'none') return;

    // Parse box-shadow (simplified: extract blur and spread)
    const score = parseShadowScore(shadow);
    if (score > 0) shadowScores.push(score);
  });

  if (shadowScores.length === 0) return 0;

  const avgScore = calculateMean(shadowScores);

  // Normalize (typical range: 0-30)
  return normalizeLinear(avgScore, 0, 30);
}

/**
 * Color Role Distinction
 * Measures color diversity using pairwise ΔE of all unique colors
 * Low distinction: 15-30, High distinction: 50-80
 */
function calculateColorDiversity(nodes: ComputedStyleNode[]): number {
  // Collect unique colors
  const colorSet = new Set<string>();

  nodes.forEach(node => {
    if (node.styles.backgroundColor && node.styles.backgroundColor !== 'transparent') {
      colorSet.add(node.styles.backgroundColor);
    }
    if (node.styles.color) {
      colorSet.add(node.styles.color);
    }
  });

  const uniqueColors = Array.from(colorSet);
  if (uniqueColors.length < 2) return 0.5;

  // Parse colors to LCH
  const lchColors: Lch[] = uniqueColors
    .map(c => parseColor(c))
    .filter((c): c is Lch => c !== null);

  if (lchColors.length < 2) return 0.5;

  // Calculate average pairwise ΔE
  let totalDeltaE = 0;
  let pairCount = 0;

  for (let i = 0; i < lchColors.length; i++) {
    for (let j = i + 1; j < lchColors.length; j++) {
      totalDeltaE += calculateDeltaE(lchColors[i], lchColors[j]);
      pairCount++;
    }
  }

  const avgDeltaE = pairCount > 0 ? totalDeltaE / pairCount : 0;

  // Return raw ΔE (will be normalized in vector builder)
  return avgDeltaE;
}

// =============================================================================
// PARSING HELPERS
// =============================================================================

/**
 * Parse total padding from shorthand (returns sum of all sides)
 */
function parsePaddingTotal(padding: string): number {
  const values = parsePaddingValues(padding);
  return values.reduce((sum, v) => sum + v, 0);
}

/**
 * Parse padding values from shorthand (top, right, bottom, left)
 */
function parsePaddingValues(padding: string): number[] {
  if (!padding || padding === '0px' || padding === '0') return [0, 0, 0, 0];

  const parts = padding.split(' ').map(p => parseFloat(p) || 0);

  // Handle shorthand (1-4 values)
  if (parts.length === 1) return [parts[0], parts[0], parts[0], parts[0]];
  if (parts.length === 2) return [parts[0], parts[1], parts[0], parts[1]];
  if (parts.length === 3) return [parts[0], parts[1], parts[2], parts[1]];
  return parts.slice(0, 4);
}

/**
 * Parse total margin from shorthand
 */
function parseMarginTotal(margin: string): number {
  const values = parsePaddingValues(margin); // Same parsing logic
  return values.reduce((sum, v) => sum + v, 0);
}

/**
 * Parse border width from border shorthand
 * Format: "1px solid #000" → 1
 */
function parseBorderWidth(border: string): number {
  if (!border || border === 'none' || border === '0') return 0;

  const match = border.match(/(\d+(?:\.\d+)?)\s*px/);
  return match ? parseFloat(match[1]) : 0;
}

/**
 * Parse font weight (handle both numeric and keyword values)
 */
function parseFontWeight(fontWeight: string): number {
  if (!fontWeight) return 400;

  const num = parseInt(fontWeight);
  if (!isNaN(num)) return num;

  // Handle keyword values
  const weightMap: Record<string, number> = {
    normal: 400,
    bold: 700,
    lighter: 300,
    bolder: 700,
  };

  return weightMap[fontWeight.toLowerCase()] || 400;
}

/**
 * Parse box-shadow and calculate depth score
 * Format: "0px 4px 6px rgba(0,0,0,0.1)" → score based on blur × spread × alpha
 */
function parseShadowScore(shadow: string): number {
  if (!shadow || shadow === 'none') return 0;

  // Simplified parsing: extract blur radius and opacity
  const blurMatch = shadow.match(/(\d+(?:\.\d+)?)\s*px/g);
  const opacityMatch = shadow.match(/rgba?\([^)]*,\s*([0-9.]+)\)/);

  const blur = blurMatch && blurMatch.length >= 3 ? parseFloat(blurMatch[2]) : 0;
  const opacity = opacityMatch ? parseFloat(opacityMatch[1]) : 1;

  // Score = blur × opacity (simplified depth metric)
  return blur * opacity;
}

// =============================================================================
// V2: NEW LAYOUT FEATURES
// =============================================================================

/**
 * Element Scale Variance (V2)
 * Measures difference between large cards (Monzo) vs small thumbnails (CNN)
 * Uses coefficient of variation + IQR ratio for robustness
 *
 * Low (0.0-0.3): Uniform grid layout (news sites, galleries)
 * Medium (0.3-0.6): Mixed elements (marketing sites)
 * High (0.6-1.0): High variation (artistic/portfolio sites)
 *
 * @example
 * // Monzo: Large cards + small text → ~1.2 CV → 0.56
 * // CNN: Uniform thumbnails → ~0.4 CV → 0.11
 */
/**
 * Element Scale Variance (V3)
 * Measures difference between large cards vs small thumbnails
 * Uses empirical percentiles from real captures instead of guessed range
 *
 * High (0.7-1.0): Hero-driven layouts with large hero + small thumbnails
 * Medium (0.4-0.7): Mixed element sizes (marketing sites)
 * Low (0.0-0.4): Uniform grids with consistent element sizes
 */
function calculateElementScaleVariance(nodes: ComputedStyleNode[]): number {
  if (nodes.length < 2) return 0.5;

  const areas = nodes.map(n => calculateBBoxArea(n.bbox));

  // Calculate coefficient of variation (CV = stdDev / mean)
  const cv = coefficientOfVariation(areas);

  // Calculate IQR ratio for additional robustness
  const sorted = [...areas].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  const q1 = sorted[Math.floor(sorted.length * 0.25)];
  const q3 = sorted[Math.floor(sorted.length * 0.75)];
  const iqr = q3 - q1;
  const iqrRatio = median > 0 ? iqr / median : 0;

  // Combine CV and IQR ratio
  const scaleVariance = (cv + iqrRatio) / 2;

  // V3: Empirical percentile-based normalization
  // V2 used 0.2-2.0 but ALL sites hit ceiling (1.0)
  // This indicates raw values are >2.0 for modern web layouts
  // V3 expands range to 0.8-6.0 to capture real variance
  const p10 = 0.8;
  const p90 = 6.0;

  return normalizeLinear(scaleVariance, p10, p90);
}

/**
 * Vertical Rhythm Consistency (V3)
 * Measures regular section spacing (CNN grid) vs flowing sections (Monzo)
 * Uses sigmoid curve instead of inverse to amplify mid-range differences
 *
 * High (0.7-1.0): Regular rhythm (news grids, dashboards)
 * Medium (0.4-0.7): Some structure (marketing sites)
 * Low (0.0-0.4): Organic flow (portfolios, landing pages)
 *
 * @example
 * // CNN: Regular grid (CV~0.3) → high consistency ~0.85
 * // Monzo: Flowing sections (CV~0.7) → mid consistency ~0.55
 * // Stripe: Organic flow (CV~1.2) → low consistency ~0.33
 */
function calculateVerticalRhythm(nodes: ComputedStyleNode[]): number {
  if (nodes.length < 3) return 0.5;

  // Detect horizontal bands
  const bands = detectHorizontalBands(nodes, 20);

  if (bands.length < 2) return 0.5;

  // Calculate Y positions of bands
  const bandYPositions = bands.map(band =>
    Math.min(...band.map(n => n.bbox.y))
  );

  // Calculate gaps between consecutive bands
  const gaps: number[] = [];
  for (let i = 0; i < bandYPositions.length - 1; i++) {
    const gap = bandYPositions[i + 1] - bandYPositions[i];
    if (gap > 0) {
      gaps.push(gap);
    }
  }

  if (gaps.length < 2) return 0.5;

  // Calculate coefficient of variation
  const cv = coefficientOfVariation(gaps);

  // V3: Use sigmoid-based mapping instead of inverse
  // This amplifies differences in the mid-range (CV 0.5-1.5)
  //
  // Mapping:
  // CV = 0.0 (perfect consistency) → 1.0
  // CV = 0.3 (very consistent) → 0.85
  // CV = 0.7 (moderate variation) → 0.55
  // CV = 1.5 (high variation) → 0.25
  // CV = 3.0+ (chaotic) → 0.0
  //
  // Sigmoid: consistency = 1 / (1 + (cv/k)^2) where k controls steepness
  const k = 0.7; // Inflection point
  const consistency = 1 / (1 + Math.pow(cv / k, 2));

  return consistency; // Already 0-1
}

/**
 * Grid Regularity Score (V3)
 * Measures rigid alignment (CNN) vs freeform layout (Monzo)
 * Requires minimum cluster size to detect actual grid patterns
 *
 * High (0.7-1.0): Strict grid (news, galleries, tables)
 * Medium (0.4-0.7): Loose grid (marketing sites)
 * Low (0.0-0.4): Freeform (creative sites)
 *
 * @example
 * // CNN: Strict grid (3+ elements per line) → ~0.85
 * // Monzo: Flowing layout (no meaningful alignment) → ~0.35
 * // Freeform: Random positions → ~0.0
 */
function calculateGridRegularity(nodes: ComputedStyleNode[]): number {
  if (nodes.length < 3) return 0.5;

  const MIN_CLUSTER_SIZE = 3; // Require at least 3 elements per alignment line

  // Detect X alignment lines (columns) with minimum cluster size
  const xPositions = nodes.map(n => n.bbox.x);
  const columns = detectAlignmentLines(xPositions, 10, MIN_CLUSTER_SIZE);

  // Calculate % of elements aligned to columns
  let alignedCount = 0;
  for (const node of nodes) {
    if (columns.some(col => Math.abs(node.bbox.x - col) < 10)) {
      alignedCount++;
    }
  }
  const columnAlignmentRatio = alignedCount / nodes.length;

  // Detect Y alignment lines (rows) with minimum cluster size
  const yPositions = nodes.map(n => n.bbox.y);
  const rows = detectAlignmentLines(yPositions, 10, MIN_CLUSTER_SIZE);

  // Calculate % of elements aligned to rows
  alignedCount = 0;
  for (const node of nodes) {
    if (rows.some(row => Math.abs(node.bbox.y - row) < 10)) {
      alignedCount++;
    }
  }
  const rowAlignmentRatio = alignedCount / nodes.length;

  // Combine column and row alignment
  const gridRegularity = (columnAlignmentRatio + rowAlignmentRatio) / 2;

  return gridRegularity; // Already 0-1
}

/**
 * Detect alignment lines (clusters of positions within tolerance)
 * V3: Requires minimum cluster size to avoid false positives
 *
 * @param positions Array of pixel positions (X or Y coordinates)
 * @param tolerance Maximum distance to consider elements aligned (default: 10px)
 * @param minClusterSize Minimum elements required to form an alignment line (default: 3)
 * @returns Array of alignment line positions (cluster centroids)
 */
function detectAlignmentLines(
  positions: number[],
  tolerance: number,
  minClusterSize: number = 3
): number[] {
  if (positions.length === 0) return [];

  const sorted = [...positions].sort((a, b) => a - b);
  const clusters: number[][] = [];

  let currentCluster = [sorted[0]];

  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] - sorted[i - 1] <= tolerance) {
      currentCluster.push(sorted[i]);
    } else {
      // Only save cluster if it meets minimum size
      if (currentCluster.length >= minClusterSize) {
        clusters.push(currentCluster);
      }
      currentCluster = [sorted[i]];
    }
  }

  // Push final cluster if meets minimum size
  if (currentCluster.length >= minClusterSize) {
    clusters.push(currentCluster);
  }

  // Return cluster centroids (average positions)
  return clusters.map(cluster =>
    cluster.reduce((a, b) => a + b, 0) / cluster.length
  );
}

/**
 * Above-Fold Density (V2)
 * Measures information density in the critical first viewport
 * Combines area density + element count density
 *
 * Low (0.0-0.3): Hero-driven, spacious (landing pages)
 * Medium (0.3-0.6): Balanced (marketing sites)
 * High (0.6-1.0): Dense, grid-heavy (news, dashboards)
 *
 * @example
 * // Monzo: Hero-heavy → ~0.40
 * // CNN: Dense news grid → ~0.75
 */
function calculateAboveFoldDensity(
  nodes: ComputedStyleNode[],
  viewport: { width: number; height: number }
): number {
  // Filter to above-fold elements
  const aboveFold = nodes.filter(n => n.bbox.y < viewport.height);

  if (aboveFold.length === 0) return 0;

  const foldArea = viewport.width * viewport.height;

  // Calculate area density
  const totalArea = aboveFold.reduce((sum, n) => sum + calculateBBoxArea(n.bbox), 0);
  const areaDensity = totalArea / foldArea;

  // Calculate element count density (per 1000px²)
  const elementCount = aboveFold.length;
  const elementDensityPer1000px = (elementCount / foldArea) * 1000;

  // Combine both metrics (log normalize each, then average)
  const areaDensityNorm = normalizeLog(areaDensity, 150);
  const elementDensityNorm = normalizeLog(elementDensityPer1000px, 20);

  return (areaDensityNorm + elementDensityNorm) / 2;
}
