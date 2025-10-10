#!/usr/bin/env ts-node

/**
 * Reprocess existing artifacts to regenerate vectors
 * Skips capture stage - uses existing captured data
 * Useful when vector dimensions or features change
 */

import { readdirSync, existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { storeVectors } from '../pipeline/storage';

interface ProcessResult {
  runId: string;
  status: 'success' | 'pipeline_failed' | 'storage_failed';
  captureId?: string;
  styleProfileId?: string;
  error?: string;
}

async function reprocessArtifact(runId: string, index: number, total: number): Promise<ProcessResult> {
  console.log('\n' + '='.repeat(70));
  console.log(`[${index + 1}/${total}] 🔄 Reprocessing: ${runId}`);
  console.log('='.repeat(70));

  const artifactPath = join(process.cwd(), 'artifacts', runId);

  if (!existsSync(join(artifactPath, 'design_tokens.json'))) {
    console.log('   ❌ No design_tokens.json found - skipping');
    return { runId, status: 'pipeline_failed', error: 'No design_tokens.json found' };
  }

  try {
    // Rebuild vectors and store to database
    console.log('🔄 Rebuilding vectors from existing tokens...');
    const storeResult = await storeVectors(runId);
    console.log(`   ✅ Vectors regenerated and stored to database`);
    console.log(`      Capture ID: ${storeResult.captureId}`);
    console.log(`      Style Profile ID: ${storeResult.styleProfileId}`);
    console.log(`      Interpretable vec: ${storeResult.stats.globalVecDim}D`);
    if (storeResult.primaryCtaId) {
      console.log(`      Primary CTA ID: ${storeResult.primaryCtaId}`);
    }

    return {
      runId,
      status: 'success',
      captureId: storeResult.captureId,
      styleProfileId: storeResult.styleProfileId,
    };
  } catch (error) {
    console.error(`   ❌ Pipeline failed:`, error);
    return {
      runId,
      status: 'pipeline_failed',
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function main() {
  console.log('\n🔄 Artifact Reprocessing Pipeline');
  console.log('==================================\n');

  const artifactsDir = join(process.cwd(), 'artifacts');

  // Get all artifact directories
  let runIds: string[];

  if (process.argv[2]) {
    // Use provided runIds from command line
    runIds = process.argv.slice(2);
    console.log(`📋 Processing ${runIds.length} specified artifacts\n`);
  } else {
    // Get all artifact directories with tokens
    const allRunIds = readdirSync(artifactsDir)
      .filter(dir => {
        const fullPath = join(artifactsDir, dir);
        const tokensExists = existsSync(join(fullPath, 'design_tokens.json'));
        return tokensExists;
      })
      .sort()
      .reverse();

    // Deduplicate by URL - keep only the most recent artifact per URL
    const urlToRunId = new Map<string, string>();

    for (const runId of allRunIds) {
      try {
        const metaPath = join(artifactsDir, runId, 'raw', 'meta.json');
        if (existsSync(metaPath)) {
          const meta = JSON.parse(readFileSync(metaPath, 'utf8'));
          const url = meta.url;

          // Only keep first (most recent) occurrence of each URL
          if (!urlToRunId.has(url)) {
            urlToRunId.set(url, runId);
          }
        }
      } catch (e) {
        // Skip artifacts with missing/invalid meta.json
        continue;
      }
    }

    runIds = Array.from(urlToRunId.values()).slice(0, 10);

    console.log(`📋 Found ${urlToRunId.size} unique URLs (${allRunIds.length} total artifacts)`);
    console.log(`📋 Processing ${runIds.length} artifacts\n`);
  }

  if (runIds.length === 0) {
    console.log('❌ No artifacts found to reprocess');
    process.exit(1);
  }

  const results: ProcessResult[] = [];

  for (let i = 0; i < runIds.length; i++) {
    const result = await reprocessArtifact(runIds[i], i, runIds.length);
    results.push(result);
  }

  // Summary
  console.log('\n' + '='.repeat(70));
  console.log('📊 REPROCESSING SUMMARY');
  console.log('='.repeat(70));

  const successful = results.filter(r => r.status === 'success');
  const failed = results.filter(r => r.status !== 'success');

  console.log(`\n✅ Successful: ${successful.length}/${results.length}`);
  if (failed.length > 0) {
    console.log(`❌ Failed: ${failed.length}/${results.length}`);
    console.log('\nFailed artifacts:');
    failed.forEach(r => {
      console.log(`  - ${r.runId}: ${r.error}`);
    });
  }

  console.log('\n✨ Reprocessing complete!\n');
}

main().catch(console.error);
