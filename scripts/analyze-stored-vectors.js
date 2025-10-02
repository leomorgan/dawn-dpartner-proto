#!/usr/bin/env node

const { query, getPool } = require('../dist/lib/db/client');

async function analyzeVectors() {
  try {
    // Get a sample style profile with vector
    const result = await query(`
      SELECT
        c.source_url,
        sp.style_vec,
        sp.tokens_json
      FROM captures c
      JOIN style_profiles sp ON sp.capture_id = c.id
      WHERE c.source_url LIKE '%stripe%'
      LIMIT 1
    `);

    if (result.rows.length === 0) {
      console.log('❌ No vectors found in database');
      return;
    }

    const row = result.rows[0];
    const vector = row.style_vec; // This is the pgvector array
    const tokens = row.tokens_json;

    console.log('📊 Analyzing Stored Vector for:', row.source_url);
    console.log('='.repeat(70));
    console.log('');

    // Vector is stored as string like "[0.123,0.456,...]", parse it
    const vectorArray = typeof vector === 'string'
      ? JSON.parse(vector)
      : Array.from(vector);

    console.log(`Vector Dimensions: ${vectorArray.length}`);
    console.log(`Non-Zero Values: ${vectorArray.filter(v => v !== 0).length}`);
    console.log(`Zero Values: ${vectorArray.filter(v => v === 0).length}`);
    console.log('');

    // Check first 16 (color features)
    console.log('Color Features (first 16 dimensions):');
    console.log('-'.repeat(70));
    for (let i = 0; i < 16; i++) {
      const val = vectorArray[i];
      console.log(`  [${String(i).padStart(2)}] = ${val.toFixed(6)} ${val === 0 ? '❌ ZERO' : '✅'}`);
    }

    console.log('');
    console.log('Token Colors:');
    console.log(`  Foundation: ${tokens.colors.foundation.length}`);
    console.log(`  Tinted: ${tokens.colors.tintedNeutrals.length}`);
    console.log(`  Accent: ${tokens.colors.accentColors.length}`);
    console.log(`  Brand: ${tokens.colors.brandColors.length}`);
    console.log(`  Primary (legacy): ${tokens.colors.primary.length}`);
    console.log(`  Neutral (legacy): ${tokens.colors.neutral.length}`);

    // Check 64D vs 192D
    console.log('');
    console.log('Vector Structure:');
    const first64 = vectorArray.slice(0, 64);
    const next128 = vectorArray.slice(64, 192);
    console.log(`  First 64D (interpretable): ${first64.filter(v => v !== 0).length} non-zero`);
    console.log(`  Next 128D (visual): ${next128.filter(v => v !== 0).length} non-zero (expected: 0)`);

  } catch (error) {
    console.error('❌ Analysis failed:', error.message);
  } finally {
    const poolInstance = getPool();
    await poolInstance.end();
  }
}

analyzeVectors();
