#!/usr/bin/env ts-node

/**
 * Analyze feature distributions to determine optimal normalization strategy
 *
 * For each of the 53 interpretable features:
 * - Calculate mean, std, min, max, median
 * - Calculate skewness (Fisher-Pearson coefficient)
 * - Calculate kurtosis (tail heaviness)
 * - Recommend normalization strategy
 */

import { getPool } from '../lib/db/client';

interface FeatureStats {
  name: string;
  mean: number;
  std: number;
  min: number;
  max: number;
  median: number;
  skewness: number;
  kurtosis: number;
  recommendedStrategy: 'absolute' | 'zscore' | 'log-zscore' | 'needs-review';
  reasoning: string;
}

async function analyzeDistributions() {
  console.log('📊 Feature Distribution Analysis\n');
  console.log('='.repeat(80));

  const pool = getPool();

  try {
    // Get all interpretable vectors
    // Note: pgvector's vector type doesn't cast to float[], need to parse manually
    const result = await pool.query(`
      SELECT
        source_url,
        interpretable_vec::text as vec
      FROM style_profiles
      WHERE interpretable_vec IS NOT NULL
    `);

    if (result.rows.length === 0) {
      console.log('❌ No style profiles found. Run full-ingest first.');
      return;
    }

    console.log(`\n✅ Found ${result.rows.length} brands\n`);

    // Feature names (53D)
    const featureNames = [
      // Colors (17D)
      'color_palette_avg_distance', 'color_palette_min_distance', 'color_palette_max_distance',
      'color_bg_text_distance', 'color_cta_bg_distance', 'color_cta_text_distance', 'color_hero_bg_distance',
      'color_bg_lightness', 'color_bg_chroma', 'color_text_lightness',
      'color_hero_lightness', 'color_hero_chroma', 'color_hero_hue_cos', 'color_hero_hue_sin',
      'color_cta_lightness', 'color_cta_chroma', 'color_cta_hero_distance',

      // Color Stats (3D)
      'color_harmony', 'color_saturation_mean', 'color_contrast_pass_rate',

      // Typography (14D)
      'font_size_min', 'font_size_max', 'font_size_range',
      'font_weight_min', 'font_weight_max', 'font_weight_contrast',
      'typo_hierarchy_depth', 'typo_coherence', 'element_scale_variance',
      'vertical_rhythm', 'grid_regularity', 'above_fold_density',
      'compositional_complexity', 'color_role_distinction',

      // Spacing (11D)
      'spacing_min', 'spacing_median', 'spacing_max', 'spacing_consistency',
      'visual_density', 'whitespace_ratio', 'image_text_balance', 'gestalt_grouping',
      'border_heaviness', 'shadow_depth', 'shadow_count',

      // Shape (6D)
      'radius_min', 'radius_median', 'radius_max', 'palette_entropy',
      'brand_confidence', 'color_coherence',
    ];

    // Extract feature values across all brands
    const featureValues: number[][] = Array(53).fill(0).map(() => []);

    result.rows.forEach(row => {
      // Parse vector string: "[0.123, 0.456, ...]" → array of numbers
      const vecStr: string = row.vec;
      const vec: number[] = JSON.parse(vecStr.replace(/\[|\]/g, match => match === '[' ? '[' : ']'));
      vec.forEach((value, idx) => {
        featureValues[idx].push(value);
      });
    });

    // Calculate statistics for each feature
    const stats: FeatureStats[] = [];

    for (let i = 0; i < 53; i++) {
      const values = featureValues[i];
      const n = values.length;

      if (n === 0) continue;

      // Basic stats
      const sorted = [...values].sort((a, b) => a - b);
      const min = sorted[0];
      const max = sorted[n - 1];
      const median = sorted[Math.floor(n / 2)];
      const mean = values.reduce((sum, v) => sum + v, 0) / n;

      // Standard deviation
      const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / n;
      const std = Math.sqrt(variance);

      // Skewness (Fisher-Pearson)
      // Positive = right tail, Negative = left tail
      // |skew| < 0.5 = roughly symmetric
      // |skew| > 1.0 = highly skewed
      const skewness = std === 0 ? 0 :
        values.reduce((sum, v) => sum + Math.pow((v - mean) / std, 3), 0) / n;

      // Kurtosis (excess kurtosis, normal distribution = 0)
      // High kurtosis = heavy tails, outliers
      const kurtosis = std === 0 ? 0 :
        values.reduce((sum, v) => sum + Math.pow((v - mean) / std, 4), 0) / n - 3;

      // Determine strategy
      let strategy: FeatureStats['recommendedStrategy'];
      let reasoning: string;

      // Check if already normalized [0, 1]
      if (min >= -0.01 && max <= 1.01) {
        strategy = 'absolute';
        reasoning = 'Already normalized to [0,1] or [-1,1] range';
      }
      // Check for high skewness
      else if (Math.abs(skewness) > 1.0) {
        strategy = 'log-zscore';
        reasoning = `Highly skewed (${skewness.toFixed(2)}), log transform recommended`;
      }
      // Moderate skewness
      else if (Math.abs(skewness) > 0.5) {
        strategy = 'needs-review';
        reasoning = `Moderately skewed (${skewness.toFixed(2)}), review distribution`;
      }
      // Roughly symmetric
      else {
        strategy = 'zscore';
        reasoning = `Roughly symmetric (skew=${skewness.toFixed(2)})`;
      }

      stats.push({
        name: featureNames[i],
        mean,
        std,
        min,
        max,
        median,
        skewness,
        kurtosis,
        recommendedStrategy: strategy,
        reasoning,
      });
    }

    // Print results
    console.log('Feature Statistics & Recommendations\n');
    console.log('='.repeat(80));

    // Group by category
    const categories = [
      { name: 'Colors', start: 0, end: 17 },
      { name: 'Color Stats', start: 17, end: 20 },
      { name: 'Typography', start: 20, end: 34 },
      { name: 'Spacing', start: 34, end: 45 },
      { name: 'Shape', start: 45, end: 51 },
    ];

    for (const cat of categories) {
      console.log(`\n### ${cat.name.toUpperCase()}`);
      console.log('-'.repeat(80));

      for (let i = cat.start; i < cat.end; i++) {
        const s = stats[i];
        if (!s) continue;

        console.log(`\n${s.name}:`);
        console.log(`  Range: [${s.min.toFixed(3)}, ${s.max.toFixed(3)}]`);
        console.log(`  Mean: ${s.mean.toFixed(3)}, Median: ${s.median.toFixed(3)}, Std: ${s.std.toFixed(3)}`);
        console.log(`  Skewness: ${s.skewness.toFixed(3)} ${getSkewnessLabel(s.skewness)}`);
        console.log(`  Kurtosis: ${s.kurtosis.toFixed(3)} ${getKurtosisLabel(s.kurtosis)}`);
        console.log(`  → Strategy: ${s.recommendedStrategy.toUpperCase()}`);
        console.log(`  → ${s.reasoning}`);
      }
    }

    // Summary
    console.log('\n\n' + '='.repeat(80));
    console.log('SUMMARY');
    console.log('='.repeat(80));

    const strategyCounts = {
      'absolute': 0,
      'zscore': 0,
      'log-zscore': 0,
      'needs-review': 0,
    };

    stats.forEach(s => strategyCounts[s.recommendedStrategy]++);

    console.log('\nRecommended Normalization Strategies:');
    console.log(`  Absolute (already normalized): ${strategyCounts.absolute}`);
    console.log(`  Z-score only: ${strategyCounts.zscore}`);
    console.log(`  Log → Z-score: ${strategyCounts['log-zscore']}`);
    console.log(`  Needs review: ${strategyCounts['needs-review']}`);

    // Export to JSON for implementation
    const output = {
      brands_analyzed: result.rows.length,
      features: stats,
      summary: strategyCounts,
    };

    const fs = require('fs');
    fs.writeFileSync('feature-distribution-analysis.json', JSON.stringify(output, null, 2));
    console.log('\n✅ Analysis saved to: feature-distribution-analysis.json\n');

  } catch (error) {
    console.error('❌ Analysis failed:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

function getSkewnessLabel(skew: number): string {
  if (Math.abs(skew) < 0.5) return '(roughly symmetric)';
  if (skew > 1.0) return '(highly right-skewed)';
  if (skew < -1.0) return '(highly left-skewed)';
  if (skew > 0) return '(moderately right-skewed)';
  return '(moderately left-skewed)';
}

function getKurtosisLabel(kurt: number): string {
  if (Math.abs(kurt) < 1.0) return '(normal tails)';
  if (kurt > 3.0) return '(very heavy tails, many outliers)';
  if (kurt > 1.0) return '(heavy tails, some outliers)';
  return '(light tails)';
}

analyzeDistributions().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
