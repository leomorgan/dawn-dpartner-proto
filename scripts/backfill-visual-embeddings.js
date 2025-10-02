#!/usr/bin/env node

// Load environment variables from .env.local
require('dotenv').config({ path: '.env.local' });

const { query, getPool } = require('../dist/lib/db/client');
const { buildVisualEmbedding } = require('../dist/pipeline/vectors/visual-embedding');
const { normalizeL2 } = require('../dist/pipeline/vectors/utils');

async function backfillVisualEmbeddings() {
  try {
    console.log('🔄 Backfilling visual embeddings for existing captures...');
    console.log('');

    // Get all profiles to rebuild with proper L2 normalization
    // Force rebuild for all profiles (not just missing visual_vec)
    const forceRebuild = process.argv.includes('--force');

    const profiles = await query(`
      SELECT
        sp.id,
        sp.interpretable_vec,
        c.run_id,
        c.source_url
      FROM style_profiles sp
      JOIN captures c ON c.id = sp.capture_id
      WHERE ${forceRebuild ? 'TRUE' : 'sp.visual_vec IS NULL'}
      ORDER BY c.captured_at DESC
    `);

    if (profiles.rows.length === 0) {
      console.log('✅ All profiles already have visual embeddings!');
      console.log('   Use --force to rebuild with L2 normalization');
      return;
    }

    console.log(`📊 Found ${profiles.rows.length} profile(s) to backfill:`);
    profiles.rows.forEach((p, i) => {
      console.log(`   ${i + 1}. ${p.source_url} (${p.run_id})`);
    });
    console.log('');

    let successCount = 0;
    let failCount = 0;

    for (const profile of profiles.rows) {
      try {
        console.log(`Processing ${profile.source_url}...`);

        const visualResult = await buildVisualEmbedding(profile.run_id);

        // Build combined vector (interpretable + visual)
        // pgvector returns as "[1,2,3]" string, parse it correctly
        const interpretableVecStr = profile.interpretable_vec.toString();
        const interpretableVec = JSON.parse(interpretableVecStr);

        if (!interpretableVec) {
          console.log(`  ⚠️  Skipping - no interpretable vector (need to regenerate)`);
          failCount++;
          continue;
        }

        // Apply L2 normalization before concatenation
        const visualVec = visualResult.embedding;
        const interpretableNorm = normalizeL2(interpretableVec);
        const visualNorm = normalizeL2(visualVec);
        const combinedVec = [...interpretableNorm, ...visualNorm];

        // Update database
        await query(
          `UPDATE style_profiles SET
            visual_vec = $1,
            combined_vec = $2,
            visual_model = $3,
            visual_embedding_date = NOW()
          WHERE id = $4`,
          [
            `[${visualVec.join(',')}]`,
            `[${combinedVec.join(',')}]`,
            visualResult.model,
            profile.id
          ]
        );

        console.log(`  ✅ ${visualResult.dimensions}D embedding stored (${visualResult.model})`);
        successCount++;

      } catch (error) {
        console.error(`  ❌ Failed: ${error.message}`);
        failCount++;
      }
    }

    console.log('');
    console.log('=' .repeat(70));
    console.log('📈 Backfill Summary:');
    console.log(`  ✅ Success: ${successCount}`);
    console.log(`  ❌ Failed:  ${failCount}`);
    console.log(`  📊 Total:   ${profiles.rows.length}`);

    if (successCount > 0) {
      console.log('');
      console.log('You can now use:');
      console.log('  - node scripts/compare-similarity.js <url1> <url2>');
      console.log('  - node scripts/find-similar.js <url> visual');
    }

    if (failCount > 0) {
      console.log('');
      console.log('⚠️  Some captures failed - common reasons:');
      console.log('  - Missing screenshot (fullpage.png not found)');
      console.log('  - Missing interpretable_vec (run migration first)');
      console.log('  - CLIP API errors (check OpenAI key)');
    }

  } catch (error) {
    console.error('❌ Backfill failed:', error.message);
  } finally {
    const poolInstance = getPool();
    await poolInstance.end();
  }
}

backfillVisualEmbeddings();
