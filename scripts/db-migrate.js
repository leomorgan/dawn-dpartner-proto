#!/usr/bin/env node
// scripts/db-migrate.js
require('dotenv').config({ path: '.env.local' });
const { runMigrations } = require('../dist/lib/db/migrate');

runMigrations()
  .then(() => {
    console.log('✅ Migration complete');
    process.exit(0);
  })
  .catch((err) => {
    console.error('❌ Migration failed:', err.message);
    process.exit(1);
  });
