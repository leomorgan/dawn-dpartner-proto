#!/usr/bin/env node

const { query, getPool } = require('../dist/lib/db/client');
const fs = require('fs');
const path = require('path');

async function migrate() {
  try {
    console.log('📦 Running migration: Add visual embedding vectors...');

    const sqlPath = path.join(__dirname, '..', 'lib', 'db', 'migrations', '004_add_visual_vectors.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    await query(sql);

    console.log('✅ Migration complete: Visual vector columns added');
    console.log('');
    console.log('New columns:');
    console.log('  - interpretable_vec (64D) - Style token features');
    console.log('  - visual_vec (512D) - CLIP visual embedding');
    console.log('  - combined_vec (576D) - Hybrid search vector');
    console.log('  - visual_model - Model identifier');
    console.log('  - visual_embedding_date - Timestamp');
    console.log('');
    console.log('Indexes created for similarity search (ivfflat, lists=100)');

    // Verify the migration
    const result = await query(`
      SELECT
        column_name,
        data_type,
        character_maximum_length
      FROM information_schema.columns
      WHERE table_name = 'style_profiles'
        AND column_name IN ('interpretable_vec', 'visual_vec', 'combined_vec', 'visual_model')
      ORDER BY column_name
    `);

    console.log('');
    console.log('Verification:');
    result.rows.forEach(row => {
      console.log(`  ✓ ${row.column_name} (${row.data_type})`);
    });

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  } finally {
    const poolInstance = getPool();
    await poolInstance.end();
  }
}

migrate();
