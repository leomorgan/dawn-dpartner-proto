#!/usr/bin/env tsx

import { buildVectors } from '../pipeline/vectors/index';
import { readdirSync, writeFileSync } from 'fs';
import { join } from 'path';

async function main() {
  const artifactsDir = join(process.cwd(), 'artifacts');
  const runs = readdirSync(artifactsDir).filter(f => f.includes('T'));

  console.log(`\n🔄 Recalculating vectors for ${runs.length} captures...\n`);

  let successCount = 0;
  let failCount = 0;
  const failed: string[] = [];

  for (const runId of runs) {
    try {
      console.log(`Processing: ${runId}`);

      const result = await buildVectors(runId);

      // Write updated vector_data.json
      const outputPath = join(artifactsDir, runId, 'vector_data.json');
      const vectorData = {
        runId: result.runId,
        globalStyleVec: {
          interpretable: result.globalStyleVec.interpretable,
          visual: result.globalStyleVec.visual,
          combined: result.globalStyleVec.combined,
          metadata: result.globalStyleVec.metadata
        },
        primaryCtaVec: {
          interpretable: result.primaryCtaVec.interpretable,
          visual: result.primaryCtaVec.visual,
          combined: result.primaryCtaVec.combined,
          metadata: result.primaryCtaVec.metadata
        }
      };

      writeFileSync(outputPath, JSON.stringify(vectorData, null, 2));

      console.log(`  ✅ Updated (${result.globalStyleVec.metadata.nonZeroCount}/64 non-zero features)\n`);
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

  console.log('\n✨ Vector recalculation complete!\n');
}

main();
