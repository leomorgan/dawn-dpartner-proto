#!/usr/bin/env tsx

import { query } from '../lib/db/client';
import { PCA } from 'ml-pca';

async function main() {
  console.log('🔬 Analyzing Vector Variance & PCA Clustering\n');
  console.log('═'.repeat(100));

  // Fetch all vectors
  const result = await query(`
    SELECT
      source_url,
      interpretable_vec,
      visual_vec,
      combined_vec
    FROM style_profiles
    WHERE interpretable_vec IS NOT NULL
    ORDER BY source_url
  `);

  if (result.rows.length < 2) {
    console.error('❌ Need at least 2 profiles for analysis');
    process.exit(1);
  }

  console.log(`\n📦 Loaded ${result.rows.length} style profiles\n`);

  const parseVec = (str: string): number[] =>
    str.slice(1, -1).split(',').map(Number);

  // Extract vectors
  const interpretableVecs: number[][] = [];
  const visualVecs: number[][] = [];
  const combinedVecs: number[][] = [];
  const urls: string[] = [];

  for (const row of result.rows) {
    urls.push(row.source_url);
    interpretableVecs.push(parseVec(row.interpretable_vec));
    if (row.visual_vec) visualVecs.push(parseVec(row.visual_vec));
    if (row.combined_vec) combinedVecs.push(parseVec(row.combined_vec));
  }

  // Analyze each vector type
  for (const [name, vecs] of [
    ['Interpretable (64D)', interpretableVecs],
    ['Visual (768D)', visualVecs],
    ['Combined (832D)', combinedVecs],
  ]) {
    if (vecs.length === 0) continue;

    console.log('═'.repeat(100));
    console.log(`📊 ${name}`);
    console.log('═'.repeat(100));
    console.log('');

    const dims = vecs[0].length;

    // Calculate per-dimension variance
    const dimVariances: number[] = [];
    for (let d = 0; d < dims; d++) {
      const values = vecs.map(v => v[d]);
      const mean = values.reduce((a, b) => a + b, 0) / values.length;
      const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
      dimVariances.push(variance);
    }

    // Statistics
    const totalVariance = dimVariances.reduce((a, b) => a + b, 0);
    const avgVariance = totalVariance / dims;
    const maxVariance = Math.max(...dimVariances);
    const minVariance = Math.min(...dimVariances);
    const nonZeroVariance = dimVariances.filter(v => v > 0.001).length;
    const highVariance = dimVariances.filter(v => v > 0.1).length;

    console.log(`Total Variance:     ${totalVariance.toFixed(3)}`);
    console.log(`Avg Variance/Dim:   ${avgVariance.toFixed(3)}`);
    console.log(`Max Variance:       ${maxVariance.toFixed(3)}`);
    console.log(`Min Variance:       ${minVariance.toFixed(3)}`);
    console.log(`Dims with Var>0.001: ${nonZeroVariance}/${dims} (${(nonZeroVariance/dims*100).toFixed(1)}%)`);
    console.log(`Dims with Var>0.1:   ${highVariance}/${dims} (${(highVariance/dims*100).toFixed(1)}%)`);
    console.log('');

    // Top 10 highest variance dimensions
    const sortedDims = dimVariances
      .map((v, i) => ({ dim: i, variance: v }))
      .sort((a, b) => b.variance - a.variance)
      .slice(0, 10);

    console.log('Top 10 Highest Variance Dimensions:');
    sortedDims.forEach((d, i) => {
      console.log(`  ${i + 1}. Dim ${d.dim}: ${d.variance.toFixed(4)}`);
    });
    console.log('');

    // PCA Analysis
    if (vecs.length >= 2) {
      const pca = new PCA(vecs);
      const explainedVariance = pca.getExplainedVariance();

      console.log('PCA Explained Variance:');
      console.log(`  PC1: ${(explainedVariance[0] * 100).toFixed(1)}%`);
      console.log(`  PC2: ${(explainedVariance[1] * 100).toFixed(1)}%`);
      console.log(`  PC1+PC2: ${((explainedVariance[0] + explainedVariance[1]) * 100).toFixed(1)}%`);

      // Get projections
      const projections = pca.predict(vecs, { nComponents: 2 }).to2DArray();

      // Calculate spread in 2D space
      const xCoords = projections.map(p => p[0]);
      const yCoords = projections.map(p => p[1]);

      const xRange = Math.max(...xCoords) - Math.min(...xCoords);
      const yRange = Math.max(...yCoords) - Math.min(...yCoords);

      console.log('');
      console.log('2D Projection Stats:');
      console.log(`  X Range: ${xRange.toFixed(3)}`);
      console.log(`  Y Range: ${yRange.toFixed(3)}`);
      console.log('');

      // Show actual projections
      console.log('Projections:');
      projections.forEach((p, i) => {
        console.log(`  ${urls[i].padEnd(30)} (${p[0].toFixed(3)}, ${p[1].toFixed(3)})`);
      });
      console.log('');
    }

    // Pairwise distances
    console.log('Pairwise L2 Distances:');
    const distances: number[] = [];
    for (let i = 0; i < vecs.length; i++) {
      for (let j = i + 1; j < vecs.length; j++) {
        let sumSq = 0;
        for (let d = 0; d < dims; d++) {
          sumSq += Math.pow(vecs[i][d] - vecs[j][d], 2);
        }
        const dist = Math.sqrt(sumSq);
        distances.push(dist);
        console.log(`  ${urls[i].padEnd(30)} ↔ ${urls[j].padEnd(30)}: ${dist.toFixed(3)}`);
      }
    }

    const avgDist = distances.reduce((a, b) => a + b, 0) / distances.length;
    const maxDist = Math.max(...distances);
    const minDist = Math.min(...distances);

    console.log('');
    console.log('Distance Summary:');
    console.log(`  Avg: ${avgDist.toFixed(3)}`);
    console.log(`  Max: ${maxDist.toFixed(3)}`);
    console.log(`  Min: ${minDist.toFixed(3)}`);
    console.log('');
  }

  // Diagnosis
  console.log('═'.repeat(100));
  console.log('💡 CLUSTERING DIAGNOSIS');
  console.log('═'.repeat(100));
  console.log('');

  console.log('Why are vectors clustering closely in PCA?');
  console.log('');

  // Check interpretable vector issues
  const interpretablePCA = new PCA(interpretableVecs);
  const interpretableVar = interpretablePCA.getExplainedVariance();

  console.log('1. LOW EXPLAINED VARIANCE:');
  console.log(`   - PC1+PC2 explains only ${((interpretableVar[0] + interpretableVar[1]) * 100).toFixed(1)}% of total variance`);
  console.log(`   - This means most variation is in higher dimensions (PC3-PC64)`);
  console.log(`   - 2D projection loses critical differentiating information`);
  console.log('');

  // Check for feature saturation
  const saturationCount = interpretableVecs[0].filter((_, i) => {
    const values = interpretableVecs.map(v => v[i]);
    const allSame = values.every(v => Math.abs(v - values[0]) < 0.01);
    return allSame;
  }).length;

  console.log('2. FEATURE SATURATION:');
  console.log(`   - ${saturationCount}/64 features have near-identical values across all sites`);
  console.log(`   - These features contribute no discriminative power`);
  console.log('');

  // Check normalization issues
  const interpretableDimVariances: number[] = [];
  for (let d = 0; d < interpretableVecs[0].length; d++) {
    const values = interpretableVecs.map(v => v[d]);
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
    interpretableDimVariances.push(variance);
  }
  const avgDimVariance = interpretableDimVariances.reduce((a, b) => a + b, 0) / interpretableDimVariances.length;

  console.log('3. NORMALIZATION ISSUES:');
  console.log(`   - Average variance per dimension: ${avgDimVariance.toFixed(4)}`);
  if (avgDimVariance < 0.05) {
    console.log(`   - ⚠️  Very low variance suggests features are poorly scaled`);
    console.log(`   - Most features clustered near same values (0.5-0.8 range)`);
  }
  console.log('');

  // Check dataset size
  console.log('4. SMALL DATASET:');
  console.log(`   - Only ${interpretableVecs.length} samples in 64D space`);
  console.log(`   - PCA needs ~10x more samples than dimensions for reliable projection`);
  console.log(`   - Recommended minimum: ~640 samples for 64D`);
  console.log('');

  console.log('RECOMMENDATIONS:');
  console.log('');
  console.log('A. Increase dataset size to 50+ captures for better PCA');
  console.log('B. Use t-SNE instead of PCA (better for small datasets)');
  console.log('C. Select top-K most variant features (e.g., top 10-20 features)');
  console.log('D. Review normalization ranges - ensure features span 0-1 effectively');
  console.log('E. Consider UMAP for non-linear dimensionality reduction');
  console.log('');

  process.exit(0);
}

main().catch(console.error);
