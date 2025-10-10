/**
 * Cosine Similarity Explainer
 *
 * Explains which features are driving similarity/difference between two vectors.
 * Uses per-dimension contributions after L2 normalization.
 */

export interface ExplainerItem {
  index: number;
  featureName: string;
  contribution: number;      // u_i * v_i after L2-normalization (for top features)
  rawDifference?: number;    // |u_i - v_i| before normalization (for bottom features)
  weightGlobal: number;      // contribution / cosine (signed)
  weightRelative: number;    // contribution as % of sum of top-k contributions
}

const EPS = 1e-12;

function l2norm(x: number[]): number {
  return Math.sqrt(x.reduce((s, xi) => s + xi * xi, 0));
}

function normalize(x: number[]): number[] {
  const n = l2norm(x);
  if (n < EPS) throw new Error("Cannot normalize zero vector");
  return x.map((xi) => xi / n);
}

export function explainCosineSimple(
  u: number[],
  v: number[],
  featureNames: string[],
  k = 3
): {
  cosine: number;
  top: ExplainerItem[];
  bottom: ExplainerItem[];
} {
  if (u.length !== v.length) throw new Error("Vectors must match in length");
  if (featureNames.length !== u.length) throw new Error("Feature names must match vector length");

  const uh = normalize(u);
  const vh = normalize(v);

  const contrib = uh.map((ui, i) => ui * vh[i]);
  const cosine = contrib.reduce((s, c) => s + c, 0);
  const denom = Math.abs(cosine) < EPS ? EPS : cosine;

  const rows: ExplainerItem[] = contrib.map((c, i) => ({
    index: i,
    featureName: featureNames[i],
    contribution: c,
    rawDifference: Math.abs(u[i] - v[i]), // Raw difference before normalization
    weightGlobal: c / denom,
    weightRelative: 0, // Will be calculated after selecting top-k
  }));

  // Top features: highest positive contributions (most similar)
  // These features contribute most to the overall cosine similarity
  const top = [...rows].sort((a, b) => b.contribution - a.contribution).slice(0, k);

  // Bottom features: LARGEST raw differences (most different in original space)
  // These features have the most different values between the two sites
  const bottom = [...rows].sort((a, b) => (b.rawDifference || 0) - (a.rawDifference || 0)).slice(0, k);

  // Set weights as absolute values (NOT normalized)
  top.forEach(item => {
    item.weightRelative = item.contribution; // absolute contribution to cosine similarity
  });

  bottom.forEach(item => {
    item.weightRelative = item.rawDifference || 0; // absolute raw difference
  });

  return { cosine, top, bottom };
}

/**
 * Feature names for the 53D interpretable vector.
 * Must match the order in pipeline/vectors/global-style-vec.ts
 */
export const INTERPRETABLE_FEATURE_NAMES = [
  // === 1. COLORS (17D) ===
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

  // === 2. COLOR STATISTICS (3D) ===
  'color_harmony',
  'color_saturation_mean',
  'color_contrast_pass_rate',

  // === 3. TYPOGRAPHY (14D) ===
  // Font size (3D)
  'font_size_min', 'font_size_max', 'font_size_range',
  // Font weight (3D)
  'font_weight_min', 'font_weight_max', 'font_weight_contrast',
  // Typography hierarchy (3D)
  'typo_hierarchy_depth', 'typo_coherence', 'element_scale_variance',
  // Layout metrics (5D)
  'vertical_rhythm', 'grid_regularity', 'above_fold_density', 'compositional_complexity', 'color_role_distinction',

  // === 4. SPACING (11D) ===
  // Core spacing (3D)
  'spacing_min', 'spacing_median', 'spacing_max',
  // Spacing consistency (1D)
  'spacing_consistency',
  // Visual density (4D)
  'visual_density', 'whitespace_ratio', 'image_text_balance', 'gestalt_grouping',
  // Structure (3D)
  'border_heaviness', 'shadow_depth', 'shadow_count',

  // === 5. SHAPE (6D) ===
  // Border radius (3D)
  'radius_min', 'radius_median', 'radius_max',
  // Diversity & personality (3D)
  'palette_entropy', 'brand_confidence', 'color_coherence',

  // === 6. BRAND COHERENCE (2D) ===
  'overall_coherence', 'design_system_maturity',
];

/**
 * Convert technical feature names to human-readable labels
 */
export function humanizeFeatureName(name: string): string {
  const labels: Record<string, string> = {
    // === COLORS (17D) ===
    // Brand palette relationships (3D)
    'color_palette_avg_distance': 'Brand Palette Avg Distance',
    'color_palette_min_distance': 'Brand Palette Min Distance',
    'color_palette_max_distance': 'Brand Palette Max Distance',
    // Semantic relationships (4D)
    'color_bg_text_distance': 'Background-Text Distance',
    'color_cta_bg_distance': 'CTA-Background Distance',
    'color_cta_text_distance': 'CTA-Text Distance',
    'color_hero_bg_distance': 'Hero-Background Distance',
    // Background absolute (2D)
    'color_bg_lightness': 'Background Lightness',
    'color_bg_chroma': 'Background Chroma',
    // Text absolute (1D)
    'color_text_lightness': 'Text Lightness',
    // Hero brand color absolute (4D)
    'color_hero_lightness': 'Hero Color Lightness',
    'color_hero_chroma': 'Hero Color Chroma',
    'color_hero_hue_cos': 'Hero Hue (cos)',
    'color_hero_hue_sin': 'Hero Hue (sin)',
    // CTA color (3D)
    'color_cta_lightness': 'CTA Lightness',
    'color_cta_chroma': 'CTA Chroma',
    'color_cta_hero_distance': 'CTA-Hero Distance',

    // === COLOR STATISTICS (3D) ===
    'color_harmony': 'Color Harmony',
    'color_saturation_mean': 'Average Saturation',
    'color_contrast_pass_rate': 'Contrast Pass Rate',

    // === TYPOGRAPHY (14D) ===
    // Font size (3D)
    'font_size_min': 'Minimum Font Size',
    'font_size_max': 'Maximum Font Size',
    'font_size_range': 'Font Size Range',
    // Font weight (3D)
    'font_weight_min': 'Minimum Font Weight',
    'font_weight_max': 'Maximum Font Weight',
    'font_weight_contrast': 'Font Weight Contrast',
    // Typography hierarchy (3D)
    'typo_hierarchy_depth': 'Typography Hierarchy Depth',
    'typo_coherence': 'Typography Coherence',
    'element_scale_variance': 'Element Scale Variance',
    // Layout metrics (5D)
    'vertical_rhythm': 'Vertical Rhythm',
    'grid_regularity': 'Grid Regularity',
    'above_fold_density': 'Above-Fold Density',
    'compositional_complexity': 'Compositional Complexity',
    'color_role_distinction': 'Color Role Distinction',

    // === SPACING (11D) ===
    // Core spacing (3D)
    'spacing_min': 'Minimum Spacing',
    'spacing_median': 'Median Spacing',
    'spacing_max': 'Maximum Spacing',
    // Spacing consistency (1D)
    'spacing_consistency': 'Spacing Consistency',
    // Visual density (4D)
    'visual_density': 'Visual Density',
    'whitespace_ratio': 'Whitespace Ratio',
    'image_text_balance': 'Image/Text Balance',
    'gestalt_grouping': 'Gestalt Grouping',
    // Structure (3D)
    'border_heaviness': 'Border Heaviness',
    'shadow_depth': 'Shadow Depth',
    'shadow_count': 'Shadow Count',

    // === SHAPE (6D) ===
    // Border radius (3D)
    'radius_min': 'Minimum Border Radius',
    'radius_median': 'Median Border Radius',
    'radius_max': 'Maximum Border Radius',
    // Diversity & personality (3D)
    'palette_entropy': 'Palette Entropy',
    'brand_confidence': 'Brand Confidence',
    'color_coherence': 'Color Coherence',

    // === BRAND COHERENCE (2D) ===
    'overall_coherence': 'Overall Coherence',
    'design_system_maturity': 'Design System Maturity',
  };

  return labels[name] || name;
}
