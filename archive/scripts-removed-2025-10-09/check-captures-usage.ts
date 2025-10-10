#!/usr/bin/env node

import { query } from '../lib/db/client';

async function main() {
  console.log('Checking captures table usage...\n');

  // Check total captures
  const captureCount = await query('SELECT COUNT(*) FROM captures');
  console.log(`Total captures: ${captureCount.rows[0].count}`);

  // Check how many have corresponding style_profiles
  const profileCount = await query(`
    SELECT COUNT(*)
    FROM captures c
    JOIN style_profiles sp ON sp.capture_id = c.id
  `);
  console.log(`Captures with style_profiles: ${profileCount.rows[0].count}`);

  // Check for captures without style_profiles (orphaned)
  const orphanedCaptures = await query(`
    SELECT c.id, c.source_url, c.run_id, c.captured_at
    FROM captures c
    LEFT JOIN style_profiles sp ON sp.capture_id = c.id
    WHERE sp.id IS NULL
    ORDER BY c.captured_at DESC
  `);

  if (orphanedCaptures.rows.length > 0) {
    console.log(`\n⚠️  Orphaned captures (no style_profile): ${orphanedCaptures.rows.length}`);
    orphanedCaptures.rows.forEach(row => {
      console.log(`  - ${row.source_url} (${row.run_id})`);
    });
  }

  // Check most recent captures
  const recentCaptures = await query(`
    SELECT c.source_url, c.captured_at, sp.id as has_profile
    FROM captures c
    LEFT JOIN style_profiles sp ON sp.capture_id = c.id
    ORDER BY c.captured_at DESC
    LIMIT 5
  `);

  console.log('\nMost recent captures:');
  recentCaptures.rows.forEach(row => {
    const status = row.has_profile ? '✅' : '❌';
    console.log(`  ${status} ${row.source_url} - ${new Date(row.captured_at).toLocaleString()}`);
  });

  // Check if captures data matches current artifacts
  const artifactCheck = await query(`
    SELECT c.run_id, c.source_url
    FROM captures c
    JOIN style_profiles sp ON sp.capture_id = c.id
    ORDER BY c.captured_at DESC
    LIMIT 5
  `);

  console.log('\nCaptures with style_profiles (checking run_ids):');
  artifactCheck.rows.forEach(row => {
    console.log(`  ${row.run_id} - ${row.source_url}`);
  });

  process.exit(0);
}

main().catch(console.error);
