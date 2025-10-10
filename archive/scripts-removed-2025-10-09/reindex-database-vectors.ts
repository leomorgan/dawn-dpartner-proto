#!/usr/bin/env tsx

import { storeVectors } from '../pipeline/storage/index';
import { readdirSync } from 'fs';
import { join } from 'path';

async function main() {
  const artifactsDir = join(process.cwd(), 'artifacts');
  const runs = readdirSync(artifactsDir).filter(f => f.includes('T'));

  console.log(`\n🔄 Re-indexing database with ${runs.length} captures...\n`);

  let successCount = 0;
  let failCount = 0;
  const failed: string[] = [];

  for (const runId of runs) {
    try {
      console.log(`📦 Processing: ${runId}`);

      const result = await storeVectors(runId);

      console.log(`  ✅ Stored in database`);
      console.log(`     Style Profile ID: ${result.styleProfileId}`);
      console.log(`     Vector dims: ${result.stats.globalVecDim}D global, ${result.stats.ctaVecDim}D CTA\n`);

      successCount++;

    } catch (error: any) {
      console.error(`  ❌ Failed: ${error.message}\n`);
      failCount++;
      failed.push(runId);
    }
  }

  console.log('━'.repeat(80));
  console.log(`\n📊 Summary:`);
  console.log(`  ✅ Success: ${successCount}`);
  console.log(`  ❌ Failed: ${failCount}`);

  if (failed.length > 0) {
    console.log(`\n⚠️  Failed captures:`);
    failed.forEach(id => console.log(`  - ${id}`));
  }

  console.log('\n✨ Database re-indexing complete!\n');
  console.log(`💡 Note: All ${successCount} style profiles now include the 12 new layout features in interpretable_vec (64D)`);
}

main();
