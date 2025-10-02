#!/usr/bin/env node

/**
 * Batch URL vectorization: capture → tokens → CTA → vectors → storage
 */

const { capture } = require('../dist/pipeline/capture');
const { extractTokens } = require('../dist/pipeline/tokens');
const { applyTokensToTemplate, selectTemplate } = require('../dist/pipeline/cta-template');
const { storeVectors } = require('../dist/pipeline/storage');

const urls = process.argv.slice(2);

if (urls.length === 0) {
  console.error('Usage: npm run batch-vector -- <url1> <url2> ...');
  console.error('Example: npm run batch-vector -- https://monzo.com https://revolut.com');
  process.exit(1);
}

console.log(`🚀 Batch vectorization starting for ${urls.length} URLs...\n`);

const results = {
  success: [],
  failed: []
};

async function processUrl(url, index, total) {
  console.log(`${'='.repeat(70)}`);
  console.log(`[${index + 1}/${total}] 🌐 Processing: ${url}`);
  console.log(`${'='.repeat(70)}\n`);

  try {
    // Step 1: Capture
    console.log('📷 Step 1: Capturing website...');
    const captureResult = await capture(url);
    const runId = captureResult.runId;
    console.log(`✅ Captured: ${runId}\n`);

    // Step 2: Extract tokens
    console.log('🎨 Step 2: Extracting design tokens...');
    const tokensResult = await extractTokens(runId);
    console.log(`✅ Extracted tokens: ${tokensResult.tokens.colors.primary.length} colors\n`);

    // Step 3: Generate CTA template
    console.log('🎯 Step 3: Generating CTA template...');
    const template = selectTemplate();
    const ctaResult = await applyTokensToTemplate(template, tokensResult.tokens, runId);
    console.log(`✅ Generated CTA template\n`);

    // Step 4: Build and store vectors
    console.log('🔢 Step 4: Building and storing vectors...');
    const storageResult = await storeVectors(runId);
    console.log(`✅ Stored vectors:`);
    console.log(`   - Style Profile ID: ${storageResult.styleProfileId}`);
    console.log(`   - CTA Vector ID: ${storageResult.primaryCtaId || 'N/A (no primary button)'}`);
    console.log(`   - Global vector: ${storageResult.stats.globalVecDim}D`);
    console.log(`   - CTA vector: ${storageResult.stats.ctaVecDim}D\n`);

    results.success.push({
      url,
      runId,
      styleProfileId: storageResult.styleProfileId,
      primaryCtaId: storageResult.primaryCtaId
    });

    console.log(`✅ [${index + 1}/${total}] SUCCESS: ${url}\n`);

  } catch (error) {
    console.error(`❌ [${index + 1}/${total}] FAILED: ${url}`);
    console.error(`   Error: ${error.message}\n`);

    results.failed.push({
      url,
      error: error.message
    });
  }
}

(async () => {
  for (let i = 0; i < urls.length; i++) {
    await processUrl(urls[i], i, urls.length);

    // Add small delay between requests
    if (i < urls.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  // Summary
  console.log('\n' + '='.repeat(70));
  console.log('📊 Batch Vectorization Summary');
  console.log('='.repeat(70) + '\n');

  console.log(`Total URLs: ${urls.length}`);
  console.log(`✅ Successful: ${results.success.length}`);
  console.log(`❌ Failed: ${results.failed.length}\n`);

  if (results.success.length > 0) {
    console.log('✅ Successfully vectorized:');
    results.success.forEach(r => {
      console.log(`   - ${r.url}`);
      console.log(`     runId: ${r.runId}`);
      console.log(`     styleProfileId: ${r.styleProfileId}`);
    });
    console.log('');
  }

  if (results.failed.length > 0) {
    console.log('❌ Failed URLs:');
    results.failed.forEach(r => {
      console.log(`   - ${r.url}: ${r.error}`);
    });
    console.log('');
  }

  process.exit(results.failed.length > 0 ? 1 : 0);
})();
