#!/usr/bin/env node

import { query } from '../lib/db/client';

async function main() {
  console.log('Force migrating to 55D (this will clear all vector data)\n');

  // Step 1: Drop all vector columns
  console.log('Step 1: Dropping all existing vector columns and indexes...');
  await query('DROP INDEX IF EXISTS idx_style_profiles_interpretable');
  await query('DROP INDEX IF EXISTS idx_style_profiles_combined');
  await query('DROP INDEX IF EXISTS idx_style_profiles_style');
  await query('DROP INDEX IF EXISTS idx_style_profiles_visual');
  await query('ALTER TABLE style_profiles DROP COLUMN IF EXISTS interpretable_vec CASCADE');
  await query('ALTER TABLE style_profiles DROP COLUMN IF EXISTS combined_vec CASCADE');
  await query('ALTER TABLE style_profiles DROP COLUMN IF EXISTS style_vec CASCADE');
  await query('ALTER TABLE style_profiles DROP COLUMN IF EXISTS visual_vec CASCADE');
  console.log('✅ Dropped all vector columns\n');

  // Step 2: Add new 55D columns
  console.log('Step 2: Adding new 55D vector columns...');
  await query('ALTER TABLE style_profiles ADD COLUMN interpretable_vec VECTOR(55)');
  await query('ALTER TABLE style_profiles ADD COLUMN visual_vec VECTOR(768)');
  await query('ALTER TABLE style_profiles ADD COLUMN combined_vec VECTOR(823)');
  console.log('✅ Added new vector columns\n');

  // Step 3: Add comments
  console.log('Step 3: Adding column comments...');
  await query(`COMMENT ON COLUMN style_profiles.interpretable_vec IS '55D style token features (color 15D, typography 11D, spacing 7D, shape 7D, brand 15D)'`);
  await query(`COMMENT ON COLUMN style_profiles.visual_vec IS '768D CLIP visual embeddings from screenshot'`);
  await query(`COMMENT ON COLUMN style_profiles.combined_vec IS '823D concatenated vector [55D interpretable + 768D visual] for hybrid search'`);
  console.log('✅ Added comments\n');

  // Step 4: Create indexes
  console.log('Step 4: Creating vector indexes...');
  await query(`
    CREATE INDEX idx_style_profiles_interpretable ON style_profiles
      USING ivfflat (interpretable_vec vector_cosine_ops)
      WITH (lists = 100)
  `);
  await query(`
    CREATE INDEX idx_style_profiles_combined ON style_profiles
      USING ivfflat (combined_vec vector_cosine_ops)
      WITH (lists = 100)
  `);
  console.log('✅ Created indexes\n');

  console.log('✅ Migration to 55D completed successfully');
  console.log('\nNext step: Re-ingest all 11 sites with new 55D vectors');
  process.exit(0);
}

main().catch(err => {
  console.error('\n❌ Migration failed:', err.message);
  process.exit(1);
});
