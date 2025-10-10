#!/usr/bin/env node

require('dotenv').config({ path: '.env.local' });

const { query, getPool } = require('../dist/lib/db/client');
const fs = require('fs');
const path = require('path');

async function migrate() {
  try {
    console.log('📦 Running migration: Update visual vectors to 768D...');

    const sqlPath = path.join(__dirname, '..', 'lib', 'db', 'migrations', '005_update_visual_vec_to_768d.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    await query(sql);

    console.log('✅ Migration complete: Visual vectors updated to 768D');
    console.log('');
    console.log('Updated columns:');
    console.log('  - visual_vec: 512D → 768D');
    console.log('  - combined_vec: 576D → 832D (64D + 768D)');
    console.log('');
    console.log('⚠️  Note: Existing visual embeddings have been cleared');
    console.log('   Run backfill to regenerate with correct dimensions');

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  } finally {
    const poolInstance = getPool();
    await poolInstance.end();
  }
}

migrate();
