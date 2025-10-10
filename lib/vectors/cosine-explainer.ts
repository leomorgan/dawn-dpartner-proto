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
 * Feature names for the 55D interpretable vector.
 * Must match the order in pipeline/vectors/global-style-vec.ts
 */
export const INTERPRETABLE_FEATURE_NAMES = [
  // Color features (15D)
  'color_primary_count',
  'color_neutral_count',
  'color_palette_entropy',
  'color_contrast_pass_rate',
  'color_dominant_hue',
  'color_saturation_mean',
  'color_lightness_mean',
  'color_button_diversity',
  'color_link_diversity',
  'color_harmony_score',
  'color_coherence',
  'color_foundation_count',
  'color_brand_count',
  'color_brand_saturation',
  'color_neutral_tint',

  // Typography features (11D)
  'typo_size_range',
  'typo_size_count',
  'typo_weight_count',
  'typo_lineheight_count',
  'typo_coherence',
  'typo_hierarchy_depth',
  'typo_weight_contrast',
  'layout_element_scale_variance',
  'layout_vertical_rhythm',
  'layout_grid_regularity',
  'layout_above_fold_density',

  // Spacing features (7D)
  'spacing_scale_length',
  'spacing_median',
  'spacing_consistency',
  'spacing_density_score',
  'spacing_whitespace_ratio',
  'spacing_padding_consistency',
  'spacing_image_text_balance',

  // Shape features (7D)
  'shape_radius_count',
  'shape_radius_median',
  'shape_shadow_count',
  'shape_border_heaviness',
  'shape_shadow_depth',
  'shape_grouping_strength',
  'shape_compositional_complexity',

  // Brand personality features (15D)
  'brand_tone_professional',
  'brand_tone_playful',
  'brand_tone_elegant',
  'brand_tone_bold',
  'brand_tone_minimal',
  'brand_energy_calm',
  'brand_energy_energetic',
  'brand_energy_sophisticated',
  'brand_energy_dynamic',
  'brand_trust_conservative',
  'brand_trust_modern',
  'brand_trust_innovative',
  'brand_trust_experimental',
  'brand_confidence',
  'brand_color_role_distinction',
];

/**
 * Convert technical feature names to human-readable labels
 */
export function humanizeFeatureName(name: string): string {
  const labels: Record<string, string> = {
    // Color
    'color_primary_count': 'Primary Palette Size',
    'color_neutral_count': 'Neutral Palette Size',
    'color_palette_entropy': 'Color Diversity',
    'color_contrast_pass_rate': 'Contrast Compliance',
    'color_dominant_hue': 'Dominant Hue',
    'color_saturation_mean': 'Color Vibrancy',
    'color_lightness_mean': 'Overall Lightness',
    'color_button_diversity': 'Button Color Variety',
    'color_link_diversity': 'Link Color Variety',
    'color_harmony_score': 'Color Harmony',
    'color_coherence': 'Color System Coherence',
    'color_foundation_count': 'Foundation Colors',
    'color_brand_count': 'Brand Colors',
    'color_brand_saturation': 'Brand Color Intensity',
    'color_neutral_tint': 'Neutral Tinting',

    // Typography
    'typo_size_range': 'Type Scale Range',
    'typo_size_count': 'Font Size Steps',
    'typo_weight_count': 'Font Weight Variety',
    'typo_lineheight_count': 'Line Height Steps',
    'typo_coherence': 'Typography Consistency',
    'typo_hierarchy_depth': 'Visual Hierarchy',
    'typo_weight_contrast': 'Weight Contrast',
    'layout_element_scale_variance': 'Element Sizing Variety',
    'layout_vertical_rhythm': 'Vertical Rhythm',
    'layout_grid_regularity': 'Grid Structure',
    'layout_above_fold_density': 'Above-Fold Density',

    // Spacing
    'spacing_scale_length': 'Spacing Scale Steps',
    'spacing_median': 'Spacing Size',
    'spacing_consistency': 'Spacing Consistency',
    'spacing_density_score': 'Visual Density',
    'spacing_whitespace_ratio': 'Whitespace Generosity',
    'spacing_padding_consistency': 'Padding System',
    'spacing_image_text_balance': 'Image/Text Balance',

    // Shape
    'shape_radius_count': 'Border Radius Steps',
    'shape_radius_median': 'Typical Roundness',
    'shape_shadow_count': 'Shadow Variety',
    'shape_border_heaviness': 'Border Weight',
    'shape_shadow_depth': 'Elevation Style',
    'shape_grouping_strength': 'Visual Grouping',
    'shape_compositional_complexity': 'Layout Complexity',

    // Brand
    'brand_tone_professional': 'Professional Tone',
    'brand_tone_playful': 'Playful Tone',
    'brand_tone_elegant': 'Elegant Tone',
    'brand_tone_bold': 'Bold Tone',
    'brand_tone_minimal': 'Minimal Tone',
    'brand_energy_calm': 'Calm Energy',
    'brand_energy_energetic': 'Energetic Feel',
    'brand_energy_sophisticated': 'Sophisticated Feel',
    'brand_energy_dynamic': 'Dynamic Energy',
    'brand_trust_conservative': 'Conservative Trust',
    'brand_trust_modern': 'Modern Trust',
    'brand_trust_innovative': 'Innovative Trust',
    'brand_trust_experimental': 'Experimental Trust',
    'brand_confidence': 'Brand Confidence',
    'brand_color_role_distinction': 'Color Role Clarity',
  };

  return labels[name] || name;
}
