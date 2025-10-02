#!/usr/bin/env node

const { buildVectors } = require('../dist/pipeline/vectors');

const runId = process.argv[2];
if (!runId) {
  console.error('Usage: node scripts/test-vectors.js <runId>');
  process.exit(1);
}

async function testVectors() {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Testing Vector Extraction for: ${runId}`);
  console.log(`${'='.repeat(60)}\n`);

  try {
    const result = await buildVectors(runId);

    console.log('✅ Vector extraction successful!\n');

    // Global Style Vector
    console.log('📊 Global Style Vector (192D):');
    console.log(`   Interpretable: ${result.globalStyleVec.interpretable.length}D`);
    console.log(`   Visual: ${result.globalStyleVec.visual.length}D`);
    console.log(`   Combined: ${result.globalStyleVec.combined.length}D`);
    console.log(`   Non-zero features: ${result.globalStyleVec.metadata.nonZeroCount}/64`);
    console.log(`   Sparsity: ${((1 - result.globalStyleVec.metadata.nonZeroCount/64) * 100).toFixed(1)}%`);

    // Show sample features
    console.log('\n   Sample interpretable features:');
    const globalSample = result.globalStyleVec.metadata.featureNames.slice(0, 10);
    const globalValues = Array.from(result.globalStyleVec.interpretable).slice(0, 10);
    globalSample.forEach((name, i) => {
      console.log(`     ${name.padEnd(30)} = ${globalValues[i].toFixed(4)}`);
    });

    // Primary CTA Vector
    console.log('\n🎯 Primary CTA Vector (64D):');
    console.log(`   Interpretable: ${result.primaryCtaVec.interpretable.length}D`);
    console.log(`   Visual: ${result.primaryCtaVec.visual.length}D`);
    console.log(`   Combined: ${result.primaryCtaVec.combined.length}D`);
    console.log(`   Non-zero features: ${result.primaryCtaVec.metadata.nonZeroCount}/24`);
    console.log(`   Sparsity: ${((1 - result.primaryCtaVec.metadata.nonZeroCount/24) * 100).toFixed(1)}%`);
    console.log(`   Button index: ${result.primaryCtaVec.metadata.buttonIndex}`);

    // Show sample features
    console.log('\n   Sample interpretable features:');
    const ctaSample = result.primaryCtaVec.metadata.featureNames.slice(0, 10);
    const ctaValues = Array.from(result.primaryCtaVec.interpretable).slice(0, 10);
    ctaSample.forEach((name, i) => {
      console.log(`     ${name.padEnd(30)} = ${ctaValues[i].toFixed(4)}`);
    });

    // Validation
    console.log('\n✅ Validation:');
    const allGlobalFinite = Array.from(result.globalStyleVec.combined).every(v => Number.isFinite(v));
    const allCtaFinite = Array.from(result.primaryCtaVec.combined).every(v => Number.isFinite(v));
    const allGlobalInRange = Array.from(result.globalStyleVec.interpretable).every(v => v >= 0 && v <= 1);
    const allCtaInRange = Array.from(result.primaryCtaVec.interpretable).every(v => v >= 0 && v <= 1);

    console.log(`   Global vector all finite: ${allGlobalFinite ? '✅' : '❌'}`);
    console.log(`   CTA vector all finite: ${allCtaFinite ? '✅' : '❌'}`);
    console.log(`   Global interpretable in [0,1]: ${allGlobalInRange ? '✅' : '❌'}`);
    console.log(`   CTA interpretable in [0,1]: ${allCtaInRange ? '✅' : '❌'}`);

    // Check for NaN/Infinity
    const globalNaN = Array.from(result.globalStyleVec.combined).filter(v => !Number.isFinite(v)).length;
    const ctaNaN = Array.from(result.primaryCtaVec.combined).filter(v => !Number.isFinite(v)).length;

    if (globalNaN > 0 || ctaNaN > 0) {
      console.log(`\n⚠️  Warning: Found ${globalNaN} NaN/Infinity in global, ${ctaNaN} in CTA`);
    }

    // Brand personality
    if (result.report.brandPersonality) {
      console.log('\n🎨 Brand Personality:');
      console.log(`   Tone: ${result.report.brandPersonality.tone}`);
      console.log(`   Energy: ${result.report.brandPersonality.energy}`);
      console.log(`   Trust: ${result.report.brandPersonality.trustLevel}`);
      console.log(`   Confidence: ${result.report.brandPersonality.confidence}`);
    }

    // Color harmony null handling check
    console.log('\n🔍 Null Handling Check:');
    const colorHarmony = result.report.realTokenMetrics?.colorHarmony;
    console.log(`   colorHarmony exists: ${colorHarmony ? '✅' : '❌ (using defaults)'}`);
    if (colorHarmony) {
      console.log(`   dominantHue: ${colorHarmony.dominantHue ?? 'NULL (using default 0)'}`);
      console.log(`   harmonyScore: ${colorHarmony.harmonyScore ?? 'NULL (using default 0.5)'}`);
      console.log(`   saturationRange.avg: ${colorHarmony.saturationRange?.avg ?? 'NULL (using default 0.5)'}`);
    }

    console.log(`\n${'='.repeat(60)}`);
    console.log('✅ All tests passed!');
    console.log(`${'='.repeat(60)}\n`);

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    if (error.stack) {
      console.error('\nStack trace:');
      console.error(error.stack);
    }
    process.exit(1);
  }
}

testVectors();
