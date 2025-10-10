#!/usr/bin/env node

import { readFileSync } from 'fs';
import { join } from 'path';
import { query } from '../lib/db/client';

async function runMigration(name: string, filepath: string) {
  console.log(`\nRunning ${name}...\n`);

  const sql = readFileSync(filepath, 'utf8');

  // Split by semicolons and execute each statement
  const statements = sql
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'));

  for (const statement of statements) {
    const preview = statement.substring(0, 80).replace(/\n/g, ' ');
    console.log(`Executing: ${preview}...`);
    try {
      await query(statement);
      console.log('✅ Success');
    } catch (err: any) {
      console.error(`❌ Error: ${err.message}`);
      throw err;
    }
  }

  console.log(`✅ ${name} completed successfully`);
}

async function main() {
  const migrationsDir = join(process.cwd(), 'lib/db/migrations');

  // Run migration 007 first (64D → 58D)
  await runMigration(
    'Migration 007 (64D → 58D)',
    join(migrationsDir, '007_update_to_58d_interpretable.sql')
  );

  // Then run migration 008 (58D → 55D)
  await runMigration(
    'Migration 008 (58D → 55D)',
    join(migrationsDir, '008_update_to_55d_interpretable.sql')
  );

  console.log('\n✅ All migrations completed successfully');
  process.exit(0);
}

main().catch(err => {
  console.error('\n❌ Migration failed:', err.message);
  process.exit(1);
});
