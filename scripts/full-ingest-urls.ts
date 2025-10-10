#!/usr/bin/env ts-node

/**
 * Full ingestion pipeline: Capture → Generate → Store Vectors
 * Reads URLs from test-urls.txt and processes each one
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import { capture } from '../pipeline/capture';
import { extractTokens } from '../pipeline/tokens';
import { buildSceneGraph } from '../pipeline/scenegraph';
import { parseIntent } from '../pipeline/intent';
import { synthesizeLayout } from '../pipeline/layout';
import { applyStyling } from '../pipeline/styling';
import { generateCode } from '../pipeline/codegen';
import { storeVectors } from '../pipeline/storage';

interface ProcessResult {
  url: string;
  status: 'success' | 'capture_failed' | 'pipeline_failed' | 'storage_failed';
  runId?: string;
  captureId?: string;
  styleProfileId?: string;
  error?: string;
}

async function processUrl(url: string, index: number, total: number): Promise<ProcessResult> {
  console.log('\n' + '='.repeat(70));
  console.log(`[${index + 1}/${total}] 🌐 Processing: ${url}`);
  console.log('='.repeat(70));

  let runId: string | undefined;

  try {
    // Stage 1: Capture
    console.log('📷 Stage 1: Capture & Normalize...');
    const captureResult = await capture(url);
    runId = captureResult.runId;
    console.log(`   ✅ Captured ${captureResult.artifacts.styles.length} elements`);

    // Stage 2: Tokens
    console.log('🎨 Stage 2: Design Token Extraction...');
    const tokensResult = await extractTokens(runId);
    console.log(`   ✅ Extracted ${tokensResult.tokens.colors.primary.length} colors`);

    // Stage 3: Scenegraph
    console.log('🏗️  Stage 3: DOM Scenegraph Builder...');
    const scenegraphResult = await buildSceneGraph(runId);
    console.log(`   ✅ Built scenegraph with ${scenegraphResult.scenegraph.totalNodes} nodes`);

    // Stage 4: Intent
    console.log('🧠 Stage 4: Intent Parser...');
    const intentResult = await parseIntent('cta extraction', runId);
    console.log(`   ✅ Parsed intent: ${intentResult.adaptiveIntent.pageType}`);

    // Stage 5: Layout
    console.log('📐 Stage 5: Layout Synthesizer...');
    const layoutResult = await synthesizeLayout(runId);
    console.log(`   ✅ Generated layout`);

    // Stage 6: Styling
    console.log('💅 Stage 6: Styling & Accessibility...');
    const stylingResult = await applyStyling(runId);
    console.log(`   ✅ Applied styling`);

    // Stage 7: Codegen
    console.log('⚛️  Stage 7: Component Code Generator...');
    const codegenResult = await generateCode(runId);
    console.log(`   ✅ Generated ${codegenResult.components.length} components`);

    // Stage 8: Store to Database
    console.log('💾 Stage 8: Store Vectors to Database...');
    const storeResult = await storeVectors(runId);
    console.log(`   ✅ Stored to database`);
    console.log(`      Capture ID: ${storeResult.captureId}`);
    console.log(`      Style Profile ID: ${storeResult.styleProfileId}`);
    if (storeResult.primaryCtaId) {
      console.log(`      Primary CTA ID: ${storeResult.primaryCtaId}`);
    }

    console.log(`\n[${index + 1}/${total}] ✅ SUCCESS: ${url}`);

    return {
      url,
      status: 'success',
      runId,
      captureId: storeResult.captureId,
      styleProfileId: storeResult.styleProfileId
    };

  } catch (error: any) {
    console.error(`\n[${index + 1}/${total}] ❌ FAILED: ${url}`);
    console.error(`   Error: ${error.message}`);

    // Determine failure stage
    let status: ProcessResult['status'] = 'capture_failed';
    if (runId) {
      status = error.message.includes('storeVectors') ? 'storage_failed' : 'pipeline_failed';
    }

    return {
      url,
      status,
      runId,
      error: error.message
    };
  }
}

async function main() {
  console.log('🚀 Full Ingestion Pipeline: Capture → Generate → Store\n');

  // Read URLs from file (default: test-urls.txt, or use command line argument)
  const urlFileName = process.argv[2] || 'test-urls.txt';
  const testUrlsPath = join(process.cwd(), urlFileName);

  console.log(`📂 Reading URLs from: ${urlFileName}\n`);
  const content = readFileSync(testUrlsPath, 'utf-8');
  const urls = content
    .split('\n')
    .map(line => line.trim())
    .filter(line => line && !line.startsWith('#'))
    .filter(line => line.startsWith('http'));

  console.log(`📋 Found ${urls.length} URLs to process\n`);
  urls.forEach((url, i) => console.log(`   ${i + 1}. ${url}`));
  console.log('');

  // Process each URL
  const results: ProcessResult[] = [];
  for (let i = 0; i < urls.length; i++) {
    const result = await processUrl(urls[i], i, urls.length);
    results.push(result);
  }

  // Print summary
  console.log('\n' + '='.repeat(70));
  console.log('📊 INGESTION SUMMARY');
  console.log('='.repeat(70));

  const successful = results.filter(r => r.status === 'success');
  const captureFailed = results.filter(r => r.status === 'capture_failed');
  const pipelineFailed = results.filter(r => r.status === 'pipeline_failed');
  const storageFailed = results.filter(r => r.status === 'storage_failed');

  console.log(`\nTotal URLs: ${results.length}`);
  console.log(`✅ Success: ${successful.length}`);
  console.log(`❌ Capture Failed: ${captureFailed.length}`);
  console.log(`❌ Pipeline Failed: ${pipelineFailed.length}`);
  console.log(`❌ Storage Failed: ${storageFailed.length}\n`);

  if (successful.length > 0) {
    console.log('✅ Successful URLs:');
    successful.forEach(r => {
      console.log(`   - ${r.url}`);
      console.log(`     Style Profile: ${r.styleProfileId}`);
    });
    console.log('');
  }

  if (captureFailed.length > 0) {
    console.log('❌ Capture Failed:');
    captureFailed.forEach(r => console.log(`   - ${r.url}: ${r.error}`));
    console.log('');
  }

  if (pipelineFailed.length > 0) {
    console.log('❌ Pipeline Failed:');
    pipelineFailed.forEach(r => console.log(`   - ${r.url}: ${r.error}`));
    console.log('');
  }

  if (storageFailed.length > 0) {
    console.log('❌ Storage Failed:');
    storageFailed.forEach(r => console.log(`   - ${r.url}: ${r.error}`));
    console.log('');
  }

  // Close database connection
  const { getPool } = require('../lib/db/client');
  await getPool().end();

  process.exit(successful.length === results.length ? 0 : 1);
}

main().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
