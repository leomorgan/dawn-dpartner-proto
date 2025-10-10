import { query } from '../lib/db/client';
import { explainCosineSimple, INTERPRETABLE_FEATURE_NAMES } from '../lib/vectors/cosine-explainer';

async function testContributions() {
  // Get a source profile
  const profiles = await query(
    `SELECT id, source_url, interpretable_vec FROM style_profiles WHERE interpretable_vec IS NOT NULL LIMIT 1`
  );

  if (profiles.rows.length === 0) {
    console.log('No profiles found');
    return;
  }

  const sourceProfile = profiles.rows[0];
  let sourceVec = sourceProfile.interpretable_vec;
  if (typeof sourceVec === 'string') {
    sourceVec = JSON.parse(sourceVec);
  }
  sourceVec = Array.from(sourceVec).map(Number);

  console.log(`\nSource: ${sourceProfile.source_url}`);

  // Get a few comparison profiles
  const comparisons = await query(
    `SELECT
      sp2.id,
      sp2.source_url,
      sp2.interpretable_vec,
      1 - (sp2.interpretable_vec <=> sp1.interpretable_vec) AS similarity
     FROM style_profiles sp1
     CROSS JOIN style_profiles sp2
     WHERE sp1.id = $1
       AND sp2.id != $1
       AND sp2.interpretable_vec IS NOT NULL
     ORDER BY similarity DESC
     LIMIT 3`,
    [sourceProfile.id]
  );

  for (const comp of comparisons.rows) {
    let targetVec = comp.interpretable_vec;
    if (typeof targetVec === 'string') {
      targetVec = JSON.parse(targetVec);
    }
    targetVec = Array.from(targetVec).map(Number);

    const explanation = explainCosineSimple(
      sourceVec,
      targetVec,
      INTERPRETABLE_FEATURE_NAMES,
      3
    );

    console.log(`\n${comp.source_url} (similarity: ${(comp.similarity * 100).toFixed(1)}%)`);

    // Analyze ALL contributions
    const uh = sourceVec.map((v: number, i: number) => {
      const norm = Math.sqrt(sourceVec.reduce((s: number, x: number) => s + x * x, 0));
      return v / norm;
    });
    const vh = targetVec.map((v: number, i: number) => {
      const norm = Math.sqrt(targetVec.reduce((s: number, x: number) => s + x * x, 0));
      return v / norm;
    });
    const allContrib = uh.map((ui: number, i: number) => ui * vh[i]);

    // Statistics
    const positive = allContrib.filter((c: number) => c > 0);
    const negative = allContrib.filter((c: number) => c < 0);
    const nearZero = allContrib.filter((c: number) => Math.abs(c) < 0.001);

    console.log(`  Contribution stats:`);
    console.log(`    Positive: ${positive.length} features (${(positive.reduce((s: number, c: number) => s + c, 0) * 100).toFixed(1)}% total)`);
    console.log(`    Negative: ${negative.length} features (${(negative.reduce((s: number, c: number) => s + c, 0) * 100).toFixed(1)}% total)`);
    console.log(`    Near-zero (|c| < 0.1%): ${nearZero.length} features`);

    console.log(`  Top 3 contributions (most similar):`);
    explanation.top.forEach((f) => {
      console.log(`    ${f.featureName}: ${(f.contribution * 100).toFixed(4)}%`);
    });

    console.log(`  Bottom 3 contributions (lowest):`);
    explanation.bottom.forEach((f) => {
      console.log(`    ${f.featureName}: ${(f.contribution * 100).toFixed(4)}%`);
    });

    // Find features with biggest raw differences
    const rawDiffs = sourceVec.map((v: number, i: number) => ({
      index: i,
      featureName: INTERPRETABLE_FEATURE_NAMES[i],
      diff: Math.abs(v - targetVec[i]),
      sourceVal: v,
      targetVal: targetVec[i]
    })).sort((a: any, b: any) => b.diff - a.diff).slice(0, 3);

    console.log(`  Top 3 raw differences (before normalization):`);
    rawDiffs.forEach((f: any) => {
      console.log(`    ${f.featureName}: |${f.sourceVal.toFixed(4)} - ${f.targetVal.toFixed(4)}| = ${f.diff.toFixed(4)}`);
    });

    // Test the explainer's top features (smallest differences)
    console.log(`  Top features from explainer (smallest rawDifference = most similar):`);
    explanation.top.forEach((f) => {
      console.log(`    ${f.featureName}: rawDiff=${(f.rawDifference || 0).toFixed(4)}, weight=${(f.weightRelative * 100).toFixed(1)}%`);
    });

    // Test the explainer's bottom features (largest differences)
    console.log(`  Bottom features from explainer (largest rawDifference = most different):`);
    explanation.bottom.forEach((f) => {
      console.log(`    ${f.featureName}: rawDiff=${(f.rawDifference || 0).toFixed(4)}, weight=${(f.weightRelative * 100).toFixed(1)}%`);
    });
  }

  process.exit(0);
}

testContributions().catch(console.error);
