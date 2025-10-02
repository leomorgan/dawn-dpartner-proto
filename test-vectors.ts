#!/usr/bin/env tsx

import { buildVectors } from './pipeline/vectors/index';

async function main() {
  const runId = process.argv[2] || '2025-10-02T13-03-18-205Z_4b76f711_stripe-com';

  console.log(`\n🔍 Testing vector generation for: ${runId}\n`);

  try {
    const result = await buildVectors(runId);

    console.log('✅ Vector generation successful!');
    console.log(`\nGlobal Style Vector (${result.globalStyleVec.combined.length}D):`);
    console.log(`  - Interpretable: ${result.globalStyleVec.interpretable.length}D`);
    console.log(`  - Visual: ${result.globalStyleVec.visual.length}D`);
    console.log(`  - Non-zero features: ${result.globalStyleVec.metadata.nonZeroCount}/${result.globalStyleVec.interpretable.length}`);

    console.log(`\n📊 Feature Summary:`);
    const features = result.globalStyleVec.metadata.featureNames;
    const values = Array.from(result.globalStyleVec.interpretable);

    // Show new layout features
    const layoutFeatures = features
      .map((name, idx) => ({ name, value: values[idx] }))
      .filter(f =>
        f.name.includes('hierarchy_depth') ||
        f.name.includes('weight_contrast') ||
        f.name.includes('density_score') ||
        f.name.includes('whitespace_ratio') ||
        f.name.includes('padding_consistency') ||
        f.name.includes('image_text_balance') ||
        f.name.includes('border_heaviness') ||
        f.name.includes('shadow_depth') ||
        f.name.includes('grouping_strength') ||
        f.name.includes('compositional_complexity') ||
        f.name.includes('saturation_energy') ||
        f.name.includes('role_distinction')
      );

    console.log('\n🆕 New Layout Features:');
    layoutFeatures.forEach(f => {
      const bar = '█'.repeat(Math.round(f.value * 20));
      console.log(`  ${f.name.padEnd(35)} ${f.value.toFixed(3)} [${bar}]`);
    });

    console.log('\n✅ All features extracted successfully!\n');

  } catch (error) {
    console.error('❌ Error generating vectors:');
    console.error(error);
    process.exit(1);
  }
}

main();
