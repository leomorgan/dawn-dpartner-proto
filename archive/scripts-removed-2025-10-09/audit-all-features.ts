#!/usr/bin/env tsx

import { query } from '../lib/db/client';

async function main() {
  console.log('🔍 Auditing All 55 Style Vector Features (reduced from 64D → 58D → 55D)\n');

  const result = await query(`
    SELECT source_url, interpretable_vec
    FROM style_profiles
    ORDER BY source_url
  `);

  const parseVec = (str: string): number[] =>
    str.slice(1, -1).split(',').map(Number);

  const vectors = result.rows.map(r => ({
    url: r.source_url,
    vec: parseVec(r.interpretable_vec)
  }));

  // Feature names (from global-style-vec.ts)
  const featureNames = [
    // Color (15D) - removed color_background_variation
    'color_primary_count', 'color_neutral_count', 'color_palette_entropy', 'color_contrast_pass_rate',
    'color_dominant_hue', 'color_saturation_mean', 'color_lightness_mean', 'color_button_diversity',
    'color_link_diversity', 'color_harmony_score', 'color_coherence',
    'color_foundation_count', 'color_brand_count', 'color_brand_saturation', 'color_neutral_tint',

    // Typography (11D) - removed typo_family_count
    'typo_size_range', 'typo_size_count', 'typo_weight_count',
    'typo_lineheight_count', 'typo_coherence', 'typo_hierarchy_depth', 'typo_weight_contrast',
    'layout_element_scale_variance', 'layout_vertical_rhythm', 'layout_grid_regularity', 'layout_above_fold_density',

    // Spacing (7D)
    'spacing_scale_length', 'spacing_median', 'spacing_consistency', 'spacing_density_score',
    'spacing_whitespace_ratio', 'spacing_padding_consistency', 'spacing_image_text_balance',

    // Shape (7D)
    'shape_radius_count', 'shape_radius_median', 'shape_shadow_count', 'shape_border_heaviness',
    'shape_shadow_depth', 'shape_grouping_strength', 'shape_compositional_complexity',

    // Brand Personality (15D) - removed brand_color_saturation_energy
    'brand_tone_professional', 'brand_tone_playful', 'brand_tone_elegant', 'brand_tone_bold', 'brand_tone_minimal',
    'brand_energy_calm', 'brand_energy_energetic', 'brand_energy_sophisticated', 'brand_energy_dynamic',
    'brand_trust_conservative', 'brand_trust_modern', 'brand_trust_innovative', 'brand_trust_experimental',
    'brand_confidence', 'brand_color_role_distinction',
  ];

  interface FeatureAudit {
    index: number;
    name: string;
    values: number[];
    min: number;
    max: number;
    mean: number;
    variance: number;
    uniqueCount: number;
    status: 'DEAD' | 'LOW_VARIANCE' | 'MEDIUM_VARIANCE' | 'GOOD';
    issue?: string;
  }

  const audits: FeatureAudit[] = [];

  const numFeatures = vectors[0]?.vec.length || 55;
  for (let i = 0; i < numFeatures; i++) {
    const values = vectors.map(v => v.vec[i]);
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
    const min = Math.min(...values);
    const max = Math.max(...values);
    const uniqueValues = new Set(values.map(v => Math.round(v * 1000) / 1000));
    const uniqueCount = uniqueValues.size;

    let status: 'DEAD' | 'LOW_VARIANCE' | 'MEDIUM_VARIANCE' | 'GOOD';
    let issue: string | undefined;

    // Classify feature
    if (variance < 0.001) {
      status = 'DEAD';
      if (max === 0) {
        issue = 'All zeros';
      } else if (uniqueCount === 1) {
        issue = `All identical (${max.toFixed(3)})`;
      } else {
        issue = `Near-identical (variance: ${variance.toFixed(6)})`;
      }
    } else if (variance < 0.01) {
      status = 'LOW_VARIANCE';
      issue = `Low variance (${variance.toFixed(4)})`;
    } else if (variance < 0.05) {
      status = 'MEDIUM_VARIANCE';
    } else {
      status = 'GOOD';
    }

    audits.push({
      index: i,
      name: featureNames[i],
      values,
      min,
      max,
      mean,
      variance,
      uniqueCount,
      status,
      issue,
    });
  }

  // Summary by status
  const dead = audits.filter(a => a.status === 'DEAD');
  const lowVar = audits.filter(a => a.status === 'LOW_VARIANCE');
  const medVar = audits.filter(a => a.status === 'MEDIUM_VARIANCE');
  const good = audits.filter(a => a.status === 'GOOD');

  console.log('═'.repeat(100));
  console.log('SUMMARY');
  console.log('═'.repeat(100));
  console.log(`DEAD (variance < 0.001):         ${dead.length}/${numFeatures} (${(dead.length/numFeatures*100).toFixed(1)}%)`);
  console.log(`LOW_VARIANCE (0.001-0.01):       ${lowVar.length}/${numFeatures} (${(lowVar.length/numFeatures*100).toFixed(1)}%)`);
  console.log(`MEDIUM_VARIANCE (0.01-0.05):     ${medVar.length}/${numFeatures} (${(medVar.length/numFeatures*100).toFixed(1)}%)`);
  console.log(`GOOD (variance > 0.05):          ${good.length}/${numFeatures} (${(good.length/numFeatures*100).toFixed(1)}%)`);
  console.log('');

  // Print dead features
  if (dead.length > 0) {
    console.log('═'.repeat(100));
    console.log('❌ DEAD FEATURES (variance < 0.001)');
    console.log('═'.repeat(100));
    console.log('');

    for (const audit of dead) {
      console.log(`[${audit.index}] ${audit.name}`);
      console.log(`  Issue: ${audit.issue}`);
      console.log(`  Values: [${audit.values.map(v => v.toFixed(3)).join(', ')}]`);
      console.log(`  Variance: ${audit.variance.toFixed(6)}`);
      console.log('');
    }
  }

  // Print low variance features
  if (lowVar.length > 0) {
    console.log('═'.repeat(100));
    console.log('⚠️  LOW VARIANCE FEATURES (0.001 < variance < 0.01)');
    console.log('═'.repeat(100));
    console.log('');

    for (const audit of lowVar) {
      console.log(`[${audit.index}] ${audit.name}`);
      console.log(`  Variance: ${audit.variance.toFixed(4)}`);
      console.log(`  Range: ${audit.min.toFixed(3)} - ${audit.max.toFixed(3)} (span: ${(audit.max - audit.min).toFixed(3)})`);
      console.log(`  Unique values: ${audit.uniqueCount}/11`);
      console.log(`  Values: [${audit.values.map(v => v.toFixed(3)).join(', ')}]`);
      console.log('');
    }
  }

  // Print medium variance features
  if (medVar.length > 0) {
    console.log('═'.repeat(100));
    console.log('🔶 MEDIUM VARIANCE FEATURES (0.01 < variance < 0.05)');
    console.log('═'.repeat(100));
    console.log('');

    for (const audit of medVar) {
      console.log(`[${audit.index}] ${audit.name}`);
      console.log(`  Variance: ${audit.variance.toFixed(4)}`);
      console.log(`  Range: ${audit.min.toFixed(3)} - ${audit.max.toFixed(3)} (span: ${(audit.max - audit.min).toFixed(3)})`);
      console.log('');
    }
  }

  // Print good features
  if (good.length > 0) {
    console.log('═'.repeat(100));
    console.log('✅ GOOD FEATURES (variance > 0.05)');
    console.log('═'.repeat(100));
    console.log('');

    for (const audit of good) {
      console.log(`[${audit.index}] ${audit.name}`);
      console.log(`  Variance: ${audit.variance.toFixed(4)}`);
      console.log(`  Range: ${audit.min.toFixed(3)} - ${audit.max.toFixed(3)} (span: ${(audit.max - audit.min).toFixed(3)})`);
      console.log('');
    }
  }

  process.exit(0);
}

main().catch(console.error);
