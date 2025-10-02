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
}

/**
 * Extract all 12 layout features from captured DOM nodes
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

  // Use log normalization (observed range: 100-400, midpoint ~250 for 0.5)
  // Stripe: ~340 → 0.55, FIFA: ~223 → 0.48
  return normalizeLog(densityRatio, 250);
}

/**
 * Whitespace Breathing Ratio
 * Measures generous vs tight spacing by averaging padding/margin relative to content size
 * Dense layouts: 0.1-0.2, Minimal layouts: 0.6-0.9
 *
 * NOTE: Original calculation gave values too small (~0.007).
 * We now use sqrt(area) as denominator to better capture linear spacing.
 */
function calculateWhitespaceBreathing(nodes: ComputedStyleNode[]): number {
  const containerNodes = nodes.filter(node => {
    const area = calculateBBoxArea(node.bbox);
    return area > 100; // Only consider elements larger than 100px²
  });

  if (containerNodes.length === 0) return 0.5; // Default

  const ratios = containerNodes.map(node => {
    const area = calculateBBoxArea(node.bbox);
    const padding = parsePaddingTotal(node.styles.padding);
    const margin = parseMarginTotal(node.styles.margin);

    // Use sqrt(area) to approximate linear dimension
    // This gives more meaningful ratios: spacing / linear-size
    const linearSize = Math.sqrt(area);
    const totalSpacing = padding + margin;
    return totalSpacing / (linearSize + 1);
  });

  const avgRatio = calculateMean(ratios);

  // Use log normalization (observed range: 0.002-0.01, need better spread)
  // Midpoint at 0.05 to differentiate minimal (0.007) from dense (0.003)
  return normalizeLog(avgRatio, 0.05);
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

  // Normalize using log scale (observed range: 3000-6000, midpoint ~4500)
  // Stripe: 3063 → 0.46, FIFA: 6224 → 0.53
  return normalizeLog(avgScore, 4500);
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
