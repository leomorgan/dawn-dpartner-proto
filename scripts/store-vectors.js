#!/usr/bin/env node

const { storeVectors } = require('../dist/pipeline/storage');

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.error('Usage: npm run store-vectors -- <runId>');
    console.error('Example: npm run store-vectors -- 2025-10-01T11-43-00-083Z_7n3iiw69_dojo-tech_cta');
    process.exit(1);
  }

  const runId = args[0].replace(/^artifacts\//, '');

  console.log(`💾 Storing vectors for ${runId}...`);

  try {
    const result = await storeVectors(runId);

    console.log(`\n✅ Vector storage complete!`);
    console.log(`📊 Stats:`);
    console.log(`   - Capture ID: ${result.captureId}`);
    console.log(`   - Style Profile ID: ${result.styleProfileId}`);
    console.log(`   - Primary CTA ID: ${result.primaryCtaId || 'N/A (no primary button)'}`);
    console.log(`   - Global Vec Dim: ${result.stats.globalVecDim}D`);
    console.log(`   - CTA Vec Dim: ${result.stats.ctaVecDim}D`);
    console.log(`   - Tokens Size: ${result.stats.tokensSize} bytes`);
    console.log(`   - Has CTA Button: ${result.stats.hasCtaButton ? 'Yes' : 'No'}`);

    // Output JSON for programmatic use
    console.log('\n---JSON-OUTPUT---');
    console.log(JSON.stringify({
      runId: result.runId,
      captureId: result.captureId,
      styleProfileId: result.styleProfileId,
      primaryCtaId: result.primaryCtaId,
      stats: result.stats
    }));

  } catch (error) {
    console.error('❌ Vector storage failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

main().catch(console.error);
