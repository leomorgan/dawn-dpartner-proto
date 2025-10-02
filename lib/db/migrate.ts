// lib/db/migrate.ts
import { readFile } from 'fs/promises';
import { join } from 'path';
import { query, getPool } from './client';

export async function runMigrations() {
  try {
    // Check if pgvector extension exists
    const extCheck = await query(`
      SELECT * FROM pg_extension WHERE extname = 'vector'
    `);

    if (extCheck.rows.length === 0) {
      console.log('⚠️  pgvector extension not found. Installing...');
      await query('CREATE EXTENSION IF NOT EXISTS vector');
    }

    // Run schema (use source path, not dist)
    const schemaPath = __dirname.includes('dist')
      ? join(__dirname, '../../../lib/db/schema.sql')
      : join(__dirname, 'schema.sql');
    const schemaSQL = await readFile(schemaPath, 'utf8');

    await query(schemaSQL);
    console.log('✅ Database schema migrated successfully');

    // Verify tables
    const tables = await query(`
      SELECT tablename FROM pg_tables
      WHERE schemaname = 'public'
      AND tablename IN ('captures', 'style_profiles', 'role_vectors_primarycta')
    `);

    console.log(`✅ Found ${tables.rows.length}/3 required tables`);

    if (tables.rows.length !== 3) {
      throw new Error('Schema migration incomplete');
    }

  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    const poolInstance = getPool();
    await poolInstance.end();
  }
}

// CLI: scripts/db-migrate.js
if (require.main === module) {
  runMigrations()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}
