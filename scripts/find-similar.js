#!/usr/bin/env node

require('dotenv').config({ path: '.env.local' });

const { query, getPool } = require('../dist/lib/db/client');

async function findSimilar(targetUrl, mode = 'combined', limit = 5) {
  try {
    // Get target profile
    const target = await query(`
      SELECT
        sp.id,
        sp.interpretable_vec,
        sp.visual_vec,
        sp.combined_vec,
        sp.visual_model,
        c.source_url
      FROM style_profiles sp
      JOIN captures c ON c.id = sp.capture_id
      WHERE c.source_url = $1
    `, [targetUrl]);

    if (target.rows.length === 0) {
      console.log('❌ Target URL not found in database');
      console.log(`   Searched for: ${targetUrl}`);
      console.log('');
      console.log('Available URLs:');
      const available = await query('SELECT DISTINCT source_url FROM captures ORDER BY source_url');
      available.rows.forEach(row => console.log(`   - ${row.source_url}`));
      return;
    }

    const targetProfile = target.rows[0];

    // Validate mode
    const validModes = ['style', 'visual', 'combined'];
    if (!validModes.includes(mode)) {
      console.log(`❌ Invalid mode: ${mode}`);
      console.log(`   Valid modes: ${validModes.join(', ')}`);
      return;
    }

    // Map mode to column
    const vecColumn = mode === 'style' ? 'interpretable_vec'
                    : mode === 'visual' ? 'visual_vec'
                    : 'combined_vec';

    // Check if visual mode is available
    if (mode === 'visual' && !targetProfile.visual_vec) {
      console.log('❌ Visual mode not available - target site has no CLIP embedding');
      console.log('   Run backfill script or re-capture with visual embeddings enabled');
      return;
    }

    // Find most similar sites using cosine distance
    const similar = await query(`
      SELECT
        c.source_url,
        1 - (sp.${vecColumn} <=> $1) as similarity,
        sp.visual_model
      FROM style_profiles sp
      JOIN captures c ON c.id = sp.capture_id
      WHERE sp.id != $2
        ${mode === 'visual' ? 'AND sp.visual_vec IS NOT NULL' : ''}
      ORDER BY sp.${vecColumn} <=> $1
      LIMIT $3
    `, [targetProfile[vecColumn], targetProfile.id, limit]);

    const modeLabel = mode === 'style' ? '🎨 Style Tokens'
                    : mode === 'visual' ? '👁️  Visual/CLIP'
                    : '🔀 Combined';

    console.log(`\n🔍 Sites most similar to: ${targetUrl}`);
    console.log(`   (using ${modeLabel} similarity)`);
    console.log('=' .repeat(70));
    console.log('');

    if (similar.rows.length === 0) {
      console.log('No similar sites found');
      if (mode === 'visual') {
        console.log('(This might be because other sites lack CLIP embeddings)');
      }
      return;
    }

    similar.rows.forEach((row, i) => {
      const percentage = (row.similarity * 100).toFixed(1);
      const bar = '█'.repeat(Math.round(row.similarity * 20));
      const visualTag = mode === 'visual' && row.visual_model ? ` [${row.visual_model}]` : '';

      console.log(`${String(i + 1).padStart(2)}. ${percentage.padStart(5)}% ${bar.padEnd(20)} ${row.source_url}${visualTag}`);
    });

    console.log('');

    // Summary statistics
    const similarities = similar.rows.map(r => r.similarity);
    const avgSim = similarities.reduce((a, b) => a + b, 0) / similarities.length;
    const maxSim = Math.max(...similarities);
    const minSim = Math.min(...similarities);

    console.log('Statistics:');
    console.log(`  Average similarity: ${(avgSim * 100).toFixed(1)}%`);
    console.log(`  Range: ${(minSim * 100).toFixed(1)}% - ${(maxSim * 100).toFixed(1)}%`);

    if (mode === 'combined') {
      console.log('');
      console.log('💡 Tip: Try mode=style or mode=visual to see different aspects of similarity');
    }

    console.log('');

  } catch (error) {
    console.error('❌ Search failed:', error.message);
  } finally {
    const poolInstance = getPool();
    await poolInstance.end();
  }
}

// Usage: node scripts/find-similar.js https://stripe.com [style|visual|combined] [limit]
const [, , url, mode = 'combined', limitStr = '5'] = process.argv;

if (!url) {
  console.log('Usage: node scripts/find-similar.js <url> [mode] [limit]');
  console.log('');
  console.log('Arguments:');
  console.log('  url    - Target URL to find similar sites for');
  console.log('  mode   - Similarity mode: style|visual|combined (default: combined)');
  console.log('  limit  - Number of results (default: 5)');
  console.log('');
  console.log('Examples:');
  console.log('  node scripts/find-similar.js https://stripe.com');
  console.log('  node scripts/find-similar.js https://stripe.com style');
  console.log('  node scripts/find-similar.js https://stripe.com visual 10');
  process.exit(1);
}

const limit = parseInt(limitStr, 10);
if (isNaN(limit) || limit < 1) {
  console.log('❌ Invalid limit - must be a positive number');
  process.exit(1);
}

findSimilar(url, mode, limit);
