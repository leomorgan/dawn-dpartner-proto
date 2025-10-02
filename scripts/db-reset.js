#!/usr/bin/env node

const { query, getPool } = require('../dist/lib/db/client');

async function resetDatabase() {
  try {
    console.log('🗑️  Resetting database...');

    // Drop tables in reverse order (respecting foreign keys)
    console.log('   Dropping role_vectors_primarycta...');
    await query('DROP TABLE IF EXISTS role_vectors_primarycta CASCADE');

    console.log('   Dropping style_profiles...');
    await query('DROP TABLE IF EXISTS style_profiles CASCADE');

    console.log('   Dropping captures...');
    await query('DROP TABLE IF EXISTS captures CASCADE');

    console.log('   Dropping views...');
    await query('DROP VIEW IF EXISTS style_profiles_with_cta CASCADE');

    console.log('✅ Database reset complete! All tables dropped.');
    console.log('');
    console.log('Next step: Run migrations to recreate schema');
    console.log('  npm run db:migrate');

  } catch (error) {
    console.error('❌ Database reset failed:', error.message);
    throw error;
  } finally {
    const poolInstance = getPool();
    await poolInstance.end();
  }
}

// CLI
resetDatabase()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
