#!/usr/bin/env tsx

import { buildVectors } from '../pipeline/vectors/index';
import { readdirSync } from 'fs';
import { join } from 'path';

interface FeatureComparison {
  name: string;
  value1: number;
  value2: number;
  diff: number;
}

async function main() {
  const artifactsDir = join(process.cwd(), 'artifacts');
  const runs = readdirSync(artifactsDir).filter(f => f.includes('T'));

  console.log(`\n📁 Found ${runs.length} captures in artifacts/\n`);

  // Let user pick two runs or use command line args
  const runId1 = process.argv[2] || runs.find(r => r.includes('stripe'));
  const runId2 = process.argv[3] || runs.find(r => r.includes('fifa') || r.includes('koto'));

  if (!runId1 || !runId2) {
    console.log('Usage: npm run validate:features -- <runId1> <runId2>');
    console.log('\nAvailable captures:');
    runs.forEach(r => console.log(`  - ${r}`));
    process.exit(1);
  }

  console.log(`🔍 Comparing vectors:\n`);
  console.log(`  [1] ${runId1}`);
  console.log(`  [2] ${runId2}\n`);

  try {
    const result1 = await buildVectors(runId1);
    const result2 = await buildVectors(runId2);

    const features1 = result1.globalStyleVec.metadata.featureNames;
    const values1 = Array.from(result1.globalStyleVec.interpretable);
    const values2 = Array.from(result2.globalStyleVec.interpretable);

    // Extract layout features
    const layoutFeatureNames = [
      'typo_hierarchy_depth',
      'typo_weight_contrast',
      'spacing_density_score',
      'spacing_whitespace_ratio',
      'spacing_padding_consistency',
      'spacing_image_text_balance',
      'shape_border_heaviness',
      'shape_shadow_depth',
      'shape_grouping_strength',
      'shape_compositional_complexity',
      'brand_color_saturation_energy',
      'brand_color_role_distinction'
    ];

    const comparisons: FeatureComparison[] = features1
      .map((name, idx) => ({
        name,
        value1: values1[idx],
        value2: values2[idx],
        diff: Math.abs(values1[idx] - values2[idx])
      }))
      .filter(f => layoutFeatureNames.includes(f.name));

    // Sort by diff descending
    comparisons.sort((a, b) => b.diff - a.diff);

    console.log('━'.repeat(80));
    console.log('Feature'.padEnd(40), '[1]'.padStart(8), '[2]'.padStart(8), 'Diff'.padStart(8), 'Signal');
    console.log('━'.repeat(80));

    comparisons.forEach(f => {
      const signal = f.diff > 0.3 ? '✓' : f.diff > 0.1 ? '~' : ' ';
      const bar1 = '█'.repeat(Math.round(f.value1 * 10));
      const bar2 = '█'.repeat(Math.round(f.value2 * 10));

      console.log(
        f.name.padEnd(40),
        f.value1.toFixed(3).padStart(8),
        f.value2.toFixed(3).padStart(8),
        f.diff.toFixed(3).padStart(8),
        signal.padStart(7)
      );
      console.log('  '.padEnd(40), bar1.padEnd(12), bar2);
    });

    console.log('━'.repeat(80));

    // Calculate L2 distance
    const squaredDiffs = values1.map((v, i) => Math.pow(v - values2[i], 2));
    const l2Distance = Math.sqrt(squaredDiffs.reduce((sum, d) => sum + d, 0));

    // Calculate cosine similarity
    const dotProduct = values1.reduce((sum, v, i) => sum + v * values2[i], 0);
    const magnitude1 = Math.sqrt(values1.reduce((sum, v) => sum + v * v, 0));
    const magnitude2 = Math.sqrt(values2.reduce((sum, v) => sum + v * v, 0));
    const cosineSimilarity = dotProduct / (magnitude1 * magnitude2);

    console.log('\n📊 Distance Metrics:');
    console.log(`  L2 Distance:       ${l2Distance.toFixed(3)}`);
    console.log(`  Cosine Similarity: ${cosineSimilarity.toFixed(3)}`);

    const layoutOnlyL2 = Math.sqrt(
      comparisons.reduce((sum, f) => sum + Math.pow(f.diff, 2), 0)
    );
    console.log(`  Layout Features L2: ${layoutOnlyL2.toFixed(3)}\n`);

    if (l2Distance > 3.0) {
      console.log('✅ Good differentiation (L2 > 3.0)');
    } else if (l2Distance > 1.5) {
      console.log('⚠️  Moderate differentiation (1.5 < L2 < 3.0)');
    } else {
      console.log('❌ Poor differentiation (L2 < 1.5)');
    }

    console.log('\n🎯 Top Differentiating Features:');
    comparisons.slice(0, 5).forEach(f => {
      console.log(`  • ${f.name}: Δ${f.diff.toFixed(3)}`);
    });

    console.log('\n');

  } catch (error) {
    console.error('❌ Error comparing vectors:');
    console.error(error);
    process.exit(1);
  }
}

main();
