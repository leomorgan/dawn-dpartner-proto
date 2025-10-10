#!/usr/bin/env tsx

import { query } from '../lib/db/client';

async function main() {
  console.log('🔍 Deep Dive: Monzo vs CNN Comparison\n');
  console.log('═'.repeat(100));

  // Fetch vectors
  const result = await query(`
    SELECT source_url, interpretable_vec
    FROM style_profiles
    WHERE source_url IN ('https://monzo.com', 'https://cnn.com')
    ORDER BY source_url
  `);

  if (result.rows.length !== 2) {
    console.error('❌ Could not find both Monzo and CNN in database');
    process.exit(1);
  }

  const parseVec = (str: string): number[] =>
    str.slice(1, -1).split(',').map(Number);

  const cnn = { url: result.rows[0].source_url, vec: parseVec(result.rows[0].interpretable_vec) };
  const monzo = { url: result.rows[1].source_url, vec: parseVec(result.rows[1].interpretable_vec) };

  console.log(`\n📦 Loaded vectors:`);
  console.log(`  - ${cnn.url}: 64D interpretable`);
  console.log(`  - ${monzo.url}: 64D interpretable`);
  console.log('');

  // Feature names (from global-style-vec.ts)
  const featureNames = [
    // Color (16D)
    'color_primary_count', 'color_neutral_count', 'color_palette_entropy', 'color_contrast_pass_rate',
    'color_dominant_hue', 'color_saturation_mean', 'color_lightness_mean', 'color_button_diversity',
    'color_link_diversity', 'color_background_variation', 'color_harmony_score', 'color_coherence',
    'color_foundation_count', 'color_brand_count', 'color_brand_saturation', 'color_neutral_tint',

    // Typography (16D)
    'typo_family_count', 'typo_size_range', 'typo_size_count', 'typo_weight_count',
    'typo_lineheight_count', 'typo_coherence', 'typo_hierarchy_depth', 'typo_weight_contrast',
    'layout_element_scale_variance', 'layout_vertical_rhythm', 'layout_grid_regularity', 'layout_above_fold_density',
    'typo_reserved_1', 'typo_reserved_2', 'typo_reserved_3', 'typo_reserved_4',

    // Spacing (8D)
    'spacing_scale_length', 'spacing_median', 'spacing_consistency', 'spacing_density_score',
    'spacing_whitespace_ratio', 'spacing_padding_consistency', 'spacing_image_text_balance', 'spacing_reserved_1',

    // Shape (8D)
    'shape_radius_count', 'shape_radius_median', 'shape_shadow_count', 'shape_border_heaviness',
    'shape_shadow_depth', 'shape_grouping_strength', 'shape_compositional_complexity', 'shape_reserved_1',

    // Brand Personality (16D)
    'brand_tone_professional', 'brand_tone_playful', 'brand_tone_elegant', 'brand_tone_bold', 'brand_tone_minimal',
    'brand_energy_calm', 'brand_energy_energetic', 'brand_energy_sophisticated', 'brand_energy_dynamic',
    'brand_trust_conservative', 'brand_trust_modern', 'brand_trust_innovative', 'brand_trust_experimental',
    'brand_confidence', 'brand_color_saturation_energy', 'brand_color_role_distinction',
  ];

  // Calculate differences
  const diffs: { name: string; cnn: number; monzo: number; diff: number; }[] = [];

  for (let i = 0; i < 64; i++) {
    const diff = Math.abs(cnn.vec[i] - monzo.vec[i]);
    diffs.push({
      name: featureNames[i],
      cnn: cnn.vec[i],
      monzo: monzo.vec[i],
      diff
    });
  }

  // Sort by difference (descending)
  diffs.sort((a, b) => b.diff - a.diff);

  // Calculate L2 distance
  const sumSq = diffs.reduce((sum, d) => sum + d.diff * d.diff, 0);
  const l2Distance = Math.sqrt(sumSq);

  console.log('═'.repeat(100));
  console.log('📊 OVERALL METRICS');
  console.log('═'.repeat(100));
  console.log(`L2 Distance: ${l2Distance.toFixed(3)}`);
  console.log(`Avg Feature Δ: ${(diffs.reduce((s, d) => s + d.diff, 0) / 64).toFixed(3)}`);
  console.log(`Max Feature Δ: ${diffs[0].diff.toFixed(3)} (${diffs[0].name})`);
  console.log(`Features with Δ > 0.1: ${diffs.filter(d => d.diff > 0.1).length}/64`);
  console.log(`Features with Δ > 0.3: ${diffs.filter(d => d.diff > 0.3).length}/64`);
  console.log('');

  // Top 20 most different features
  console.log('═'.repeat(100));
  console.log('🔥 TOP 20 MOST DIFFERENT FEATURES');
  console.log('═'.repeat(100));
  console.log('');
  console.log('Rank | Feature                          | CNN      | Monzo    | Δ        | Category');
  console.log('─'.repeat(100));

  for (let i = 0; i < 20; i++) {
    const d = diffs[i];
    const category = d.name.split('_')[0];
    const rank = `${i + 1}`.padStart(4);
    const name = d.name.padEnd(32);
    const cnnVal = d.cnn.toFixed(3).padStart(8);
    const monzoVal = d.monzo.toFixed(3).padStart(8);
    const diffVal = d.diff.toFixed(3).padStart(8);
    const cat = category.padEnd(10);

    console.log(`${rank} | ${name} | ${cnnVal} | ${monzoVal} | ${diffVal} | ${cat}`);
  }
  console.log('');

  // V3 Features Deep Dive
  console.log('═'.repeat(100));
  console.log('🎯 V3 FEATURES DEEP DIVE');
  console.log('═'.repeat(100));
  console.log('');

  const v3Features = [
    { name: 'Element Scale Variance', index: 24 },
    { name: 'Vertical Rhythm', index: 25 },
    { name: 'Grid Regularity', index: 26 },
    { name: 'Above-Fold Density', index: 27 },
  ];

  for (const feat of v3Features) {
    const cnnVal = cnn.vec[feat.index];
    const monzoVal = monzo.vec[feat.index];
    const diff = Math.abs(cnnVal - monzoVal);

    console.log(`${feat.name}:`);
    console.log(`  CNN:   ${cnnVal.toFixed(3)}`);
    console.log(`  Monzo: ${monzoVal.toFixed(3)}`);
    console.log(`  Δ:     ${diff.toFixed(3)} ${diff > 0.3 ? '✅ EXCELLENT' : diff > 0.15 ? '✓ Good' : '⚠️  Low'}`);
    console.log('');
  }

  // Category-level comparison
  console.log('═'.repeat(100));
  console.log('📦 CATEGORY-LEVEL COMPARISON');
  console.log('═'.repeat(100));
  console.log('');

  const categories = [
    { name: 'Color', start: 0, end: 16 },
    { name: 'Typography', start: 16, end: 32 },
    { name: 'Spacing', start: 32, end: 40 },
    { name: 'Shape', start: 40, end: 48 },
    { name: 'Brand', start: 48, end: 64 },
  ];

  for (const cat of categories) {
    const catDiffs = diffs.slice(0).filter((_, idx) => idx >= cat.start && idx < cat.end);
    const avgDiff = catDiffs.reduce((s, d) => s + d.diff, 0) / (cat.end - cat.start);
    const maxDiff = Math.max(...catDiffs.map(d => d.diff));
    const strongFeatures = catDiffs.filter(d => d.diff > 0.3).length;

    console.log(`${cat.name} (${cat.end - cat.start}D):`);
    console.log(`  Avg Δ:    ${avgDiff.toFixed(3)}`);
    console.log(`  Max Δ:    ${maxDiff.toFixed(3)}`);
    console.log(`  Strong (>0.3): ${strongFeatures}/${cat.end - cat.start}`);
    console.log('');
  }

  // Key insights
  console.log('═'.repeat(100));
  console.log('💡 KEY INSIGHTS');
  console.log('═'.repeat(100));
  console.log('');

  const layoutScaleVariance = diffs.find(d => d.name === 'layout_element_scale_variance');
  const gridRegularity = diffs.find(d => d.name === 'layout_grid_regularity');
  const verticalRhythm = diffs.find(d => d.name === 'layout_vertical_rhythm');

  if (layoutScaleVariance) {
    console.log(`1. Element Scale Variance (Δ=${layoutScaleVariance.diff.toFixed(3)}):`);
    console.log(`   - CNN (${layoutScaleVariance.cnn.toFixed(3)}): ${layoutScaleVariance.cnn > 0.7 ? 'Hero-driven layout with large + small elements' : 'More uniform element sizes'}`);
    console.log(`   - Monzo (${layoutScaleVariance.monzo.toFixed(3)}): ${layoutScaleVariance.monzo > 0.7 ? 'Hero-driven layout with large + small elements' : 'More uniform element sizes'}`);
    console.log('');
  }

  if (gridRegularity) {
    console.log(`2. Grid Regularity (Δ=${gridRegularity.diff.toFixed(3)}):`);
    console.log(`   - CNN (${gridRegularity.cnn.toFixed(3)}): ${gridRegularity.cnn > 0.7 ? 'Strict grid alignment (news layout)' : 'Flowing, freeform layout'}`);
    console.log(`   - Monzo (${gridRegularity.monzo.toFixed(3)}): ${gridRegularity.monzo > 0.7 ? 'Grid-based alignment' : 'Flowing, freeform layout'}`);
    console.log('');
  }

  if (verticalRhythm) {
    console.log(`3. Vertical Rhythm (Δ=${verticalRhythm.diff.toFixed(3)}):`);
    console.log(`   - CNN (${verticalRhythm.cnn.toFixed(3)}): ${verticalRhythm.cnn > 0.5 ? 'Regular, consistent spacing' : 'Organic, variable spacing'}`);
    console.log(`   - Monzo (${verticalRhythm.monzo.toFixed(3)}): ${verticalRhythm.monzo > 0.5 ? 'Regular spacing' : 'Organic, variable spacing'}`);
    console.log('');
  }

  process.exit(0);
}

main().catch(console.error);
