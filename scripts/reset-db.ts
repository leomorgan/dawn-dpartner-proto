#!/usr/bin/env ts-node

/**
 * Reset database - drop and recreate schema, then apply fresh schema
 */

import { getPool } from '../lib/db/client';
import * as fs from 'fs';
import * as path from 'path';

async function resetDatabase() {
  console.log('🔄 Resetting database...\n');

  const pool = getPool();

  try {
    // Drop and recreate schema
    console.log('1. Dropping and recreating public schema...');
    await pool.query('DROP SCHEMA IF EXISTS public CASCADE');
    await pool.query('CREATE SCHEMA public');
    await pool.query('CREATE EXTENSION IF NOT EXISTS vector');
    console.log('✅ Schema reset complete\n');

    // Apply fresh schema
    console.log('2. Applying fresh schema from lib/db/schema.sql...');
    const schemaPath = path.resolve(process.cwd(), 'lib/db/schema.sql');
    const schemaSql = fs.readFileSync(schemaPath, 'utf-8');
    await pool.query(schemaSql);
    console.log('✅ Schema applied\n');

    // Verify vector dimensions
    console.log('3. Verifying vector dimensions...');
    const result = await pool.query(`
      SELECT
        column_name,
        udt_name
      FROM information_schema.columns
      WHERE table_name IN ('style_profiles', 'role_vectors_primarycta')
        AND column_name LIKE '%vec%'
      ORDER BY table_name, ordinal_position;
    `);

    result.rows.forEach(row => {
      console.log(`  - ${row.column_name}: ${row.udt_name}`);
    });

    console.log('\n✅ Database reset complete!\n');
  } catch (error) {
    console.error('❌ Database reset failed:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

resetDatabase().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
