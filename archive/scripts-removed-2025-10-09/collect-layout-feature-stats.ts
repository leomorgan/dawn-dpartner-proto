#!/usr/bin/env tsx

import { query } from '../lib/db/client';

interface FeatureStats {
  featureName: string;
  values: number[];
  min: number;
  max: number;
  mean: number;
  median: number;
  p10: number;
  p25: number;
  p75: number;
  p90: number;
  stdDev: number;
  cv: number; // coefficient of variation
}

async function main() {
  console.log('📊 Collecting layout feature statistics from database...\n');

  // Get all style profiles with interpretable vectors
  const result = await query(`
    SELECT source_url, interpretable_vec
    FROM style_profiles
    ORDER BY created_at
  `);

  if (result.rows.length === 0) {
    console.error('❌ No vectors found in database');
    process.exit(1);
  }

  console.log(`Found ${result.rows.length} captures\n`);

  // Parse vectors
  const parseVec = (str: string): number[] =>
    str.slice(1, -1).split(',').map(Number);

  const vectors = result.rows.map(r => ({
    url: r.source_url,
    vec: parseVec(r.interpretable_vec)
  }));

  // Feature indices (from global-style-vec.ts)
  const features = [
    { name: 'Element Scale Variance', index: 24 },
    { name: 'Vertical Rhythm', index: 25 },
    { name: 'Grid Regularity', index: 26 },
    { name: 'Above-Fold Density', index: 27 },
    { name: 'Density Score', index: 35 },
    { name: 'Whitespace Ratio', index: 36 },
  ];

  const stats: FeatureStats[] = [];

  for (const feature of features) {
    const values = vectors.map(v => v.vec[feature.index]);
    const sorted = [...values].sort((a, b) => a - b);

    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
    const stdDev = Math.sqrt(variance);

    stats.push({
      featureName: feature.name,
      values,
      min: sorted[0],
      max: sorted[sorted.length - 1],
      mean,
      median: sorted[Math.floor(sorted.length / 2)],
      p10: sorted[Math.floor(sorted.length * 0.1)],
      p25: sorted[Math.floor(sorted.length * 0.25)],
      p75: sorted[Math.floor(sorted.length * 0.75)],
      p90: sorted[Math.floor(sorted.length * 0.9)],
      stdDev,
      cv: stdDev / mean
    });
  }

  // Print results
  console.log('═'.repeat(100));
  console.log('LAYOUT FEATURE STATISTICS (11 captures)');
  console.log('═'.repeat(100));
  console.log('');

  for (const stat of stats) {
    console.log(`${stat.featureName}:`);
    console.log(`  Range:  ${stat.min.toFixed(3)} - ${stat.max.toFixed(3)} (span: ${(stat.max - stat.min).toFixed(3)})`);
    console.log(`  Mean:   ${stat.mean.toFixed(3)} ± ${stat.stdDev.toFixed(3)} (CV: ${stat.cv.toFixed(3)})`);
    console.log(`  P10:    ${stat.p10.toFixed(3)}`);
    console.log(`  P25:    ${stat.p25.toFixed(3)}`);
    console.log(`  Median: ${stat.median.toFixed(3)}`);
    console.log(`  P75:    ${stat.p75.toFixed(3)}`);
    console.log(`  P90:    ${stat.p90.toFixed(3)}`);
    console.log('');

    // Individual values per site
    console.log('  Values by site:');
    vectors.forEach((v, i) => {
      const featureIdx = features.find(f => f.name === stat.featureName)!.index;
      console.log(`    ${v.url.padEnd(25)} ${v.vec[featureIdx].toFixed(3)}`);
    });
    console.log('');
  }

  // Pairwise differentiation analysis
  console.log('═'.repeat(100));
  console.log('PAIRWISE DIFFERENTIATION ANALYSIS');
  console.log('═'.repeat(100));
  console.log('');

  for (const feature of features) {
    const values = vectors.map(v => v.vec[feature.index]);

    // Calculate all pairwise differences
    const diffs: number[] = [];
    for (let i = 0; i < values.length; i++) {
      for (let j = i + 1; j < values.length; j++) {
        diffs.push(Math.abs(values[i] - values[j]));
      }
    }

    const sortedDiffs = diffs.sort((a, b) => a - b);
    const avgDiff = diffs.reduce((a, b) => a + b, 0) / diffs.length;
    const medianDiff = sortedDiffs[Math.floor(sortedDiffs.length / 2)];

    console.log(`${feature.name}:`);
    console.log(`  Avg pairwise Δ:    ${avgDiff.toFixed(3)}`);
    console.log(`  Median pairwise Δ: ${medianDiff.toFixed(3)}`);
    console.log(`  Max pairwise Δ:    ${sortedDiffs[sortedDiffs.length - 1].toFixed(3)}`);
    console.log(`  Min pairwise Δ:    ${sortedDiffs[0].toFixed(3)}`);
    console.log('');
  }

  process.exit(0);
}

main().catch(console.error);
