#!/usr/bin/env node

import { storeVectors } from '../pipeline/storage';
import { readdirSync } from 'fs';
import { join } from 'path';

async function main() {
  const artifactsDir = join(process.cwd(), 'artifacts');
  const runs = readdirSync(artifactsDir).filter(f => f.includes('T'));

  console.log(`\n🔄 Re-ingesting ${runs.length} captures with new 55D vectors...\n`);

  let successCount = 0;
  let failCount = 0;
  const failed: string[] = [];

  for (const runId of runs) {
    try {
      console.log(`\n${'='.repeat(80)}`);
      console.log(`Processing: ${runId}`);
      console.log('='.repeat(80));

      const result = await storeVectors(runId);

      console.log(`✅ Success`);
      console.log(`   Global vector: ${result.stats.globalVecDim}D`);
      console.log(`   CTA vector: ${result.stats.ctaVecDim}D`);
      console.log(`   Has CTA button: ${result.stats.hasCtaButton ? 'Yes' : 'No'}`);

      successCount++;

    } catch (error: any) {
      console.error(`❌ Failed: ${error.message}`);
      console.error(error.stack);
      failCount++;
      failed.push(runId);
    }
  }

  console.log('\n' + '='.repeat(80));
  console.log('📊 Summary:');
  console.log('='.repeat(80));
  console.log(`✅ Success: ${successCount}`);
  console.log(`❌ Failed: ${failCount}`);

  if (failed.length > 0) {
    console.log(`\n⚠️  Failed captures:`);
    failed.forEach(id => console.log(`  - ${id}`));
  }

  console.log('\n✨ Vector re-ingestion complete!\n');
  process.exit(failCount > 0 ? 1 : 0);
}

main().catch(err => {
  console.error('\n❌ Fatal error:', err);
  process.exit(1);
});
