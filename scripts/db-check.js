#!/usr/bin/env node

const { query, getPool } = require('../dist/lib/db/client');

async function checkDatabase() {
  try {
    // Check captures
    const captures = await query('SELECT COUNT(*) FROM captures');
    console.log(`📸 Captures: ${captures.rows[0].count}`);

    // Check style profiles
    const profiles = await query('SELECT COUNT(*) FROM style_profiles');
    console.log(`🎨 Style Profiles: ${profiles.rows[0].count}`);

    // Check CTA vectors
    const ctas = await query('SELECT COUNT(*) FROM role_vectors_primarycta');
    console.log(`🎯 CTA Vectors: ${ctas.rows[0].count}`);

    // Sample data
    console.log('\n📊 Sample Data:');
    const sample = await query(`
      SELECT
        c.source_url,
        jsonb_array_length(sp.tokens_json->'colors'->'foundation') as foundation_count,
        jsonb_array_length(sp.tokens_json->'colors'->'tintedNeutrals') as tinted_count,
        jsonb_array_length(sp.tokens_json->'colors'->'accentColors') as accent_count,
        jsonb_array_length(sp.tokens_json->'colors'->'brandColors') as brand_count
      FROM captures c
      JOIN style_profiles sp ON sp.capture_id = c.id
      ORDER BY c.captured_at DESC
      LIMIT 8
    `);

    console.log('\nURL                  | Foundation | Tinted | Accent | Brand');
    console.log('---------------------|------------|--------|--------|-------');
    sample.rows.forEach(row => {
      const url = row.source_url.replace('https://', '').slice(0, 20).padEnd(20);
      console.log(`${url} | ${String(row.foundation_count).padStart(10)} | ${String(row.tinted_count).padStart(6)} | ${String(row.accent_count).padStart(6)} | ${String(row.brand_count).padStart(5)}`);
    });

    console.log('\n✅ Database verification complete!');

  } catch (error) {
    console.error('❌ Database check failed:', error.message);
  } finally {
    const poolInstance = getPool();
    await poolInstance.end();
  }
}

checkDatabase();
