#!/usr/bin/env ts-node

/**
 * Analyze RAW feature values BEFORE normalization
 *
 * This script reads design tokens and layout features from artifacts
 * and analyzes the actual raw distributions to determine optimal normalization
 */

import { getPool } from '../lib/db/client';
import * as fs from 'fs';
import * as path from 'path';

interface RawFeatureStats {
  name: string;
  values: number[];
  mean: number;
  std: number;
  min: number;
  max: number;
  median: number;
  p05: number;  // 5th percentile
  p95: number;  // 95th percentile
  skewness: number;
  kurtosis: number;
  recommendedStrategy: 'zscore' | 'log-zscore' | 'absolute' | 'needs-review';
  reasoning: string;
}

async function analyzeRawValues() {
  console.log('🔍 RAW Feature Value Analysis (Pre-Normalization)\n');
  console.log('='.repeat(80));

  const pool = getPool();

  try {
    // Read directly from artifacts directory instead of database
    const artifactsDir = path.join(process.cwd(), 'artifacts');

    if (!fs.existsSync(artifactsDir)) {
      console.log('❌ Artifacts directory not found.');
      return;
    }

    const dirs = fs.readdirSync(artifactsDir).filter(d => {
      const stat = fs.statSync(path.join(artifactsDir, d));
      return stat.isDirectory();
    });

    console.log(`\n✅ Found ${dirs.length} artifact directories\n`);

    // Storage for raw features
    const rawFeatures: { [key: string]: number[] } = {};

    // Process each artifact
    for (const dir of dirs) {
      const artifactPath = path.join(artifactsDir, dir);

      // Read design tokens
      const tokensPath = path.join(artifactPath, 'design_tokens.json');
      if (!fs.existsSync(tokensPath)) {
        continue;
      }

      console.log(`📦 Processing: ${dir}`);

      let tokens;
      try {
        tokens = JSON.parse(fs.readFileSync(tokensPath, 'utf-8'));
      } catch (e) {
        console.log(`  ⚠️  Failed to parse JSON, skipping`);
        continue;
      }

      // Extract raw feature values

      // === TYPOGRAPHY ===
      const fontSizes = tokens.typography?.fontSizes || [];
      const fontWeights = tokens.typography?.fontWeights || [];

      if (fontSizes.length > 0) {
        addFeature(rawFeatures, 'font_size_min_RAW', Math.min(...fontSizes));
        addFeature(rawFeatures, 'font_size_max_RAW', Math.max(...fontSizes));
        addFeature(rawFeatures, 'font_size_range_RAW', Math.max(...fontSizes) - Math.min(...fontSizes));
        addFeature(rawFeatures, 'font_size_count_RAW', fontSizes.length);
      }

      if (fontWeights.length > 0) {
        addFeature(rawFeatures, 'font_weight_min_RAW', Math.min(...fontWeights));
        addFeature(rawFeatures, 'font_weight_max_RAW', Math.max(...fontWeights));
        addFeature(rawFeatures, 'font_weight_range_RAW', Math.max(...fontWeights) - Math.min(...fontWeights));
        addFeature(rawFeatures, 'font_weight_count_RAW', fontWeights.length);
      }

      // === SPACING ===
      const spacing = tokens.spacing || [];
      if (spacing.length > 0) {
        const sorted = [...spacing].sort((a, b) => a - b);
        addFeature(rawFeatures, 'spacing_min_RAW', Math.min(...spacing));
        addFeature(rawFeatures, 'spacing_median_RAW', sorted[Math.floor(sorted.length / 2)]);
        addFeature(rawFeatures, 'spacing_max_RAW', Math.max(...spacing));
        addFeature(rawFeatures, 'spacing_count_RAW', spacing.length);
      }

      // === BORDER RADIUS ===
      const radii = (tokens.borderRadius || []).map((r: string) => parseFloat(r) || 0);
      if (radii.length > 0) {
        const sorted = [...radii].sort((a, b) => a - b);
        addFeature(rawFeatures, 'radius_min_RAW', Math.min(...radii));
        addFeature(rawFeatures, 'radius_median_RAW', sorted[Math.floor(sorted.length / 2)]);
        addFeature(rawFeatures, 'radius_max_RAW', Math.max(...radii));
        addFeature(rawFeatures, 'radius_count_RAW', radii.length);
      }

      // === SHADOWS ===
      const shadows = tokens.boxShadow || [];
      addFeature(rawFeatures, 'shadow_count_RAW', shadows.length);

      // === COLORS ===
      const allColors = [
        ...(tokens.colors?.primary || []),
        ...(tokens.colors?.brandColors || []),
        ...(tokens.colors?.accentColors || []),
      ];
      addFeature(rawFeatures, 'color_count_RAW', allColors.length);

      // === LIGHTNESS VALUES (LCH) ===
      if (tokens.colors?.semantic?.background) {
        // Would need to parse LCH - skip for now, or add if needed
      }

      console.log(`  ✅ Extracted features`);
    }

    console.log('\n' + '='.repeat(80));
    console.log('RAW FEATURE STATISTICS');
    console.log('='.repeat(80));

    // Calculate statistics for each feature
    const stats: RawFeatureStats[] = [];

    for (const [name, values] of Object.entries(rawFeatures)) {
      if (values.length === 0) continue;

      const sorted = [...values].sort((a, b) => a - b);
      const n = values.length;

      const min = sorted[0];
      const max = sorted[n - 1];
      const median = sorted[Math.floor(n / 2)];
      const p05 = sorted[Math.floor(n * 0.05)];
      const p95 = sorted[Math.floor(n * 0.95)];
      const mean = values.reduce((sum, v) => sum + v, 0) / n;

      const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / n;
      const std = Math.sqrt(variance);

      const skewness = std === 0 ? 0 :
        values.reduce((sum, v) => sum + Math.pow((v - mean) / std, 3), 0) / n;

      const kurtosis = std === 0 ? 0 :
        values.reduce((sum, v) => sum + Math.pow((v - mean) / std, 4), 0) / n - 3;

      // Determine strategy
      let strategy: RawFeatureStats['recommendedStrategy'];
      let reasoning: string;

      // Check if bounded theoretical range
      if (name.includes('lightness') || name.includes('chroma') || name.includes('hue')) {
        strategy = 'absolute';
        reasoning = 'Theoretical LCH bounds';
      }
      // Check for high skewness (needs log)
      else if (Math.abs(skewness) > 1.0) {
        strategy = 'log-zscore';
        reasoning = `Highly skewed (${skewness.toFixed(2)}), log transform + z-score recommended`;
      }
      // Moderate skewness
      else if (Math.abs(skewness) > 0.5) {
        strategy = 'needs-review';
        reasoning = `Moderately skewed (${skewness.toFixed(2)}), review if log needed`;
      }
      // Roughly symmetric
      else {
        strategy = 'zscore';
        reasoning = `Roughly symmetric (skew=${skewness.toFixed(2)}), z-score only`;
      }

      stats.push({
        name,
        values,
        mean,
        std,
        min,
        max,
        median,
        p05,
        p95,
        skewness,
        kurtosis,
        recommendedStrategy: strategy,
        reasoning,
      });
    }

    // Print results
    console.log('\n');

    // Group by category
    const categories = [
      { name: 'Font Sizes', prefix: 'font_size' },
      { name: 'Font Weights', prefix: 'font_weight' },
      { name: 'Spacing', prefix: 'spacing' },
      { name: 'Border Radius', prefix: 'radius' },
      { name: 'Counts', suffix: 'count' },
    ];

    for (const cat of categories) {
      const categoryStats = stats.filter(s =>
        (cat.prefix && s.name.startsWith(cat.prefix)) ||
        (cat.suffix && s.name.includes(cat.suffix))
      );

      if (categoryStats.length === 0) continue;

      console.log(`\n### ${cat.name.toUpperCase()}`);
      console.log('-'.repeat(80));

      for (const s of categoryStats) {
        console.log(`\n${s.name}:`);
        console.log(`  Range: [${s.min.toFixed(1)}, ${s.max.toFixed(1)}]`);
        console.log(`  Mean: ${s.mean.toFixed(1)}, Median: ${s.median.toFixed(1)}, Std: ${s.std.toFixed(1)}`);
        console.log(`  5th-95th percentile: [${s.p05.toFixed(1)}, ${s.p95.toFixed(1)}]`);
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
      'zscore': 0,
      'log-zscore': 0,
      'absolute': 0,
      'needs-review': 0,
    };

    stats.forEach(s => strategyCounts[s.recommendedStrategy]++);

    console.log('\nRecommended Normalization Strategies (RAW values):');
    console.log(`  Z-score only: ${strategyCounts.zscore}`);
    console.log(`  Log → Z-score: ${strategyCounts['log-zscore']}`);
    console.log(`  Absolute (theoretical bounds): ${strategyCounts.absolute}`);
    console.log(`  Needs review: ${strategyCounts['needs-review']}`);

    // Compare to current hardcoded ranges
    console.log('\n\n' + '='.repeat(80));
    console.log('COMPARISON: RAW vs HARDCODED RANGES');
    console.log('='.repeat(80));

    const comparisons = [
      { name: 'font_size_min_RAW', hardcoded: '8-20px' },
      { name: 'font_size_max_RAW', hardcoded: '16-96px' },
      { name: 'font_weight_min_RAW', hardcoded: '100-400' },
      { name: 'font_weight_max_RAW', hardcoded: '400-900' },
      { name: 'spacing_min_RAW', hardcoded: '0-16px' },
      { name: 'spacing_median_RAW', hardcoded: '8-64px' },
      { name: 'spacing_max_RAW', hardcoded: '16-96px' },
      { name: 'radius_min_RAW', hardcoded: '0-8px' },
      { name: 'radius_median_RAW', hardcoded: '0-32px' },
      { name: 'radius_max_RAW', hardcoded: '0-64px' },
    ];

    console.log('\n');
    for (const comp of comparisons) {
      const stat = stats.find(s => s.name === comp.name);
      if (!stat) continue;

      console.log(`\n${comp.name}:`);
      console.log(`  Hardcoded range: ${comp.hardcoded}`);
      console.log(`  Actual range: [${stat.min.toFixed(1)}, ${stat.max.toFixed(1)}]`);
      console.log(`  5th-95th percentile: [${stat.p05.toFixed(1)}, ${stat.p95.toFixed(1)}]`);

      // Check if hardcoded range is appropriate
      const hardcodedParts = comp.hardcoded.match(/(\d+)-(\d+)/);
      if (hardcodedParts) {
        const hardMin = parseFloat(hardcodedParts[1]);
        const hardMax = parseFloat(hardcodedParts[2]);

        if (stat.max > hardMax * 1.1) {
          console.log(`  ⚠️  WARNING: Max value ${stat.max.toFixed(1)} exceeds hardcoded max ${hardMax} by >10%`);
        }
        if (stat.min < hardMin * 0.9 && hardMin > 0) {
          console.log(`  ⚠️  WARNING: Min value ${stat.min.toFixed(1)} below hardcoded min ${hardMin} by >10%`);
        }
        if (stat.p95 > hardMax) {
          console.log(`  ⚠️  WARNING: 95th percentile ${stat.p95.toFixed(1)} exceeds hardcoded max ${hardMax}`);
        }
      }
    }

    // Export to JSON
    const output = {
      brands_analyzed: dirs.length,
      features: stats.map(s => ({
        name: s.name,
        min: s.min,
        max: s.max,
        mean: s.mean,
        median: s.median,
        std: s.std,
        p05: s.p05,
        p95: s.p95,
        skewness: s.skewness,
        kurtosis: s.kurtosis,
        recommendedStrategy: s.recommendedStrategy,
        reasoning: s.reasoning,
      })),
      summary: strategyCounts,
    };

    fs.writeFileSync('raw-feature-analysis.json', JSON.stringify(output, null, 2));
    console.log('\n\n✅ Analysis saved to: raw-feature-analysis.json\n');

  } catch (error) {
    console.error('❌ Analysis failed:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

function addFeature(features: { [key: string]: number[] }, name: string, value: number) {
  if (!features[name]) {
    features[name] = [];
  }
  features[name].push(value);
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

analyzeRawValues().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
