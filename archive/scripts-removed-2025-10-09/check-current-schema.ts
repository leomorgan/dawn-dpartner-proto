#!/usr/bin/env node

import { query } from '../lib/db/client';

async function main() {
  console.log('Checking current schema...\n');

  const result = await query(`
    SELECT
      column_name,
      data_type,
      udt_name
    FROM information_schema.columns
    WHERE table_name = 'style_profiles'
    AND column_name LIKE '%vec%'
    ORDER BY ordinal_position;
  `);

  console.log('Vector columns in style_profiles:');
  result.rows.forEach(row => {
    console.log(`  ${row.column_name}: ${row.data_type} (${row.udt_name})`);
  });

  process.exit(0);
}

main().catch(console.error);
