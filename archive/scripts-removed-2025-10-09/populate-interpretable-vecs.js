#!/usr/bin/env node

const { query, getPool } = require('../dist/lib/db/client');

async function populateInterpretableVecs() {
  try {
    console.log('🔄 Populating interpretable_vec from existing style_vec...');

    const profiles = await query(`
      SELECT id, style_vec
      FROM style_profiles
      WHERE interpretable_vec IS NULL AND style_vec IS NOT NULL
    `);

    console.log(`Found ${profiles.rows.length} profiles to update`);

    for (const profile of profiles.rows) {
      // Convert pgvector to array
      const styleVecStr = profile.style_vec.toString();
      const fullVec = JSON.parse(styleVecStr);

      // Extract first 64 dimensions
      const interpretableVec = fullVec.slice(0, 64);

      // Update database
      await query(
        `UPDATE style_profiles SET interpretable_vec = $1 WHERE id = $2`,
        [`[${interpretableVec.join(',')}]`, profile.id]
      );

      console.log(`✓ Updated profile ${profile.id}`);
    }

    console.log(`\n✅ Updated ${profiles.rows.length} profiles`);

  } catch (error) {
    console.error('❌ Failed:', error.message);
  } finally {
    const poolInstance = getPool();
    await poolInstance.end();
  }
}

populateInterpretableVecs();
