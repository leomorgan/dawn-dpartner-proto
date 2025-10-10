#!/usr/bin/env node

import { query } from '../lib/db/client';

async function main() {
  console.log('Checking vector dimensions...\n');

  // Get one row to inspect actual dimensions
  const result = await query(`
    SELECT
      source_url,
      array_length(interpretable_vec::real[], 1) as interpretable_dim,
      array_length(visual_vec::real[], 1) as visual_dim,
      array_length(combined_vec::real[], 1) as combined_dim
    FROM style_profiles
    LIMIT 1;
  `);

  if (result.rows.length > 0) {
    const row = result.rows[0];
    console.log(`Current dimensions (from ${row.source_url}):`);
    console.log(`  interpretable_vec: ${row.interpretable_dim}D`);
    console.log(`  visual_vec: ${row.visual_dim}D`);
    console.log(`  combined_vec: ${row.combined_dim}D`);
  } else {
    console.log('No data in style_profiles table');
  }

  process.exit(0);
}

main().catch(console.error);
