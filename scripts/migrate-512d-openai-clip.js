#!/usr/bin/env node
require('dotenv').config({ path: '.env.local' });
const { query, getPool } = require('../dist/lib/db/client');
const fs = require('fs');
const path = require('path');

async function migrate() {
  try {
    console.log('📦 Migrating to 512D for OpenAI CLIP model...');
    const sql = fs.readFileSync(path.join(__dirname, '..', 'lib', 'db', 'migrations', '006_update_to_512d_openai_clip.sql'), 'utf8');
    await query(sql);
    console.log('✅ Migration complete: 512D vectors (openai/clip)');
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  } finally {
    await getPool().end();
  }
}
migrate();
