#!/usr/bin/env node

const { storeVectors } = require('../dist/pipeline/storage');
const { readdirSync } = require('fs');
const { join } = require('path');

async function main() {
  const args = process.argv.slice(2);
  const artifactsDir = args[0] || join(process.cwd(), 'artifacts');

  console.log(`🚀 Batch ingestion starting...`);
  console.log(`📁 Artifacts directory: ${artifactsDir}\n`);

  // Find all runIds in artifacts directory
  let runIds;
  try {
    runIds = readdirSync(artifactsDir, { withFileTypes: true })
      .filter(dirent => dirent.isDirectory())
      .map(dirent => dirent.name)
      .filter(name => !name.startsWith('.'));
  } catch (error) {
    console.error('❌ Failed to read artifacts directory:', error.message);
    process.exit(1);
  }

  console.log(`📊 Found ${runIds.length} artifacts to process\n`);

  const results = {
    success: [],
    failed: [],
    skipped: []
  };

  for (let i = 0; i < runIds.length; i++) {
    const runId = runIds[i];
    const progress = `[${i + 1}/${runIds.length}]`;

    console.log(`${progress} Processing ${runId}...`);

    try {
      const result = await storeVectors(runId, artifactsDir);
      results.success.push({
        runId,
        captureId: result.captureId,
        styleProfileId: result.styleProfileId,
        primaryCtaId: result.primaryCtaId
      });
      console.log(`  ✅ Success (CTA: ${result.stats.hasCtaButton ? 'Yes' : 'No'})\n`);
    } catch (error) {
      // Check if it's a missing file error (artifact might be incomplete)
      if (error.code === 'ENOENT') {
        results.skipped.push({ runId, reason: 'Missing required files' });
        console.log(`  ⏭️  Skipped (incomplete artifact)\n`);
      } else {
        results.failed.push({ runId, error: error.message });
        console.error(`  ❌ Failed: ${error.message}\n`);
      }
    }
  }

  // Print summary
  console.log('━'.repeat(60));
  console.log('📊 BATCH INGESTION SUMMARY');
  console.log('━'.repeat(60));
  console.log(`✅ Success: ${results.success.length}`);
  console.log(`❌ Failed: ${results.failed.length}`);
  console.log(`⏭️  Skipped: ${results.skipped.length}`);
  console.log(`📦 Total: ${runIds.length}`);
  console.log('');

  if (results.failed.length > 0) {
    console.log('❌ Failed artifacts:');
    results.failed.forEach(f => {
      console.log(`  - ${f.runId}: ${f.error}`);
    });
    console.log('');
  }

  if (results.skipped.length > 0) {
    console.log('⏭️  Skipped artifacts:');
    results.skipped.forEach(s => {
      console.log(`  - ${s.runId}: ${s.reason}`);
    });
    console.log('');
  }

  // Output JSON for programmatic use
  console.log('---JSON-OUTPUT---');
  console.log(JSON.stringify({
    total: runIds.length,
    success: results.success.length,
    failed: results.failed.length,
    skipped: results.skipped.length,
    successIds: results.success.map(r => r.runId),
    failedIds: results.failed.map(r => r.runId),
    skippedIds: results.skipped.map(r => r.runId)
  }));

  // Exit with error code if any failures
  if (results.failed.length > 0) {
    process.exit(1);
  }
}

main().catch(error => {
  console.error('❌ Batch ingestion fatal error:', error);
  process.exit(1);
});
