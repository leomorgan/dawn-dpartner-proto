import { query } from '../lib/db/client';
import { INTERPRETABLE_FEATURE_NAMES } from '../lib/vectors/cosine-explainer';

async function compareMetrics() {
  const profiles = await query(
    `SELECT id, source_url, interpretable_vec FROM style_profiles WHERE interpretable_vec IS NOT NULL LIMIT 1`
  );

  const sourceProfile = profiles.rows[0];
  let sourceVec = sourceProfile.interpretable_vec;
  if (typeof sourceVec === 'string') {
    sourceVec = JSON.parse(sourceVec);
  }
  sourceVec = Array.from(sourceVec).map(Number);

  const comparisons = await query(
    `SELECT sp2.id, sp2.source_url, sp2.interpretable_vec, 1 - (sp2.interpretable_vec <=> sp1.interpretable_vec) AS similarity
     FROM style_profiles sp1
     CROSS JOIN style_profiles sp2
     WHERE sp1.id = $1 AND sp2.id != $1 AND sp2.interpretable_vec IS NOT NULL
     ORDER BY similarity DESC LIMIT 1`,
    [sourceProfile.id]
  );

  const comp = comparisons.rows[0];
  let targetVec = comp.interpretable_vec;
  if (typeof targetVec === 'string') {
    targetVec = JSON.parse(targetVec);
  }
  targetVec = Array.from(targetVec).map(Number);

  // Normalize
  const norm1 = Math.sqrt(sourceVec.reduce((s: number, x: number) => s + x * x, 0));
  const norm2 = Math.sqrt(targetVec.reduce((s: number, x: number) => s + x * x, 0));
  const uh = sourceVec.map((v: number) => v / norm1);
  const vh = targetVec.map((v: number) => v / norm2);

  // Calculate both metrics for all features
  const features = sourceVec.map((v: number, i: number) => ({
    name: INTERPRETABLE_FEATURE_NAMES[i],
    sourceVal: sourceVec[i],
    targetVal: targetVec[i],
    rawDiff: Math.abs(sourceVec[i] - targetVec[i]),
    contribution: uh[i] * vh[i]
  }));

  console.log(`\nComparing ${sourceProfile.source_url} vs ${comp.source_url}\n`);

  console.log('Top 5 by COSINE CONTRIBUTION (highest contribution to similarity):');
  [...features].sort((a, b) => b.contribution - a.contribution).slice(0, 5).forEach(f => {
    console.log(`  ${f.name}:`);
    console.log(`    Source: ${f.sourceVal.toFixed(4)}, Target: ${f.targetVal.toFixed(4)}`);
    console.log(`    Raw diff: ${f.rawDiff.toFixed(4)}, Contribution: ${(f.contribution * 100).toFixed(2)}%`);
  });

  console.log('\nTop 5 by SMALLEST RAW DIFFERENCE (most similar values):');
  [...features].sort((a, b) => a.rawDiff - b.rawDiff).slice(0, 5).forEach(f => {
    console.log(`  ${f.name}:`);
    console.log(`    Source: ${f.sourceVal.toFixed(4)}, Target: ${f.targetVal.toFixed(4)}`);
    console.log(`    Raw diff: ${f.rawDiff.toFixed(4)}, Contribution: ${(f.contribution * 100).toFixed(2)}%`);
  });

  process.exit(0);
}

compareMetrics().catch(console.error);
