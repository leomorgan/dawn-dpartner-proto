#!/usr/bin/env node

/**
 * Recapture all unique URLs from the database
 * Steps:
 * 1. Empty captures table
 * 2. Query unique URLs
 * 3. Run capture + store pipeline for each URL
 */

const { getPool } = require('../dist/lib/db/client');
const { spawn } = require('child_process');

async function getUniqueUrls() {
  const pool = getPool();
  const result = await pool.query(
    'SELECT DISTINCT source_url FROM captures ORDER BY source_url'
  );
  return result.rows.map(row => row.source_url);
}

async function emptyCaptures() {
  const pool = getPool();
  console.log('🗑️  Emptying captures table (cascading to style_profiles and role_vectors)...');
  await pool.query('DELETE FROM captures');
  console.log('✅ Captures table emptied\n');
}

async function captureAndStoreUrl(url, index, total) {
  return new Promise((resolve, reject) => {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`[${index + 1}/${total}] 🌐 Capturing: ${url}`);
    console.log('='.repeat(60));

    const child = spawn('npm', ['run', 'generate', '--', '--url', url, '--prompt', 'cta extraction'], {
      stdio: 'pipe',
      shell: true
    });

    let output = '';
    let runId = null;

    child.stdout.on('data', (data) => {
      const str = data.toString();
      process.stdout.write(str);
      output += str;

      // Extract runId from output
      const runIdMatch = str.match(/📁 Run ID: ([\w-]+)/);
      if (runIdMatch) {
        runId = runIdMatch[1];
      }
    });

    child.stderr.on('data', (data) => {
      process.stderr.write(data);
    });

    child.on('close', async (code) => {
      if (code === 0 && runId) {
        console.log(`\n[${index + 1}/${total}] ✅ Capture complete, now storing to database...`);

        // Now run store-vectors to save to database
        const storeChild = spawn('npm', ['run', 'store-vectors', '--', runId], {
          stdio: 'inherit',
          shell: true
        });

        storeChild.on('close', (storeCode) => {
          if (storeCode === 0) {
            console.log(`\n[${index + 1}/${total}] ✅ Success: ${url} (stored to database)`);
            resolve({ url, status: 'success', runId });
          } else {
            console.log(`\n[${index + 1}/${total}] ⚠️  Capture succeeded but storage failed: ${url}`);
            resolve({ url, status: 'partial', runId, message: 'Capture OK, storage failed' });
          }
        });

        storeChild.on('error', (err) => {
          console.error(`\n[${index + 1}/${total}] ❌ Storage error: ${url}`, err.message);
          resolve({ url, status: 'partial', runId, message: err.message });
        });
      } else {
        console.log(`\n[${index + 1}/${total}] ❌ Failed: ${url} (exit code ${code})`);
        resolve({ url, status: 'failed', code });
      }
    });

    child.on('error', (err) => {
      console.error(`\n[${index + 1}/${total}] ❌ Error: ${url}`, err.message);
      resolve({ url, status: 'error', error: err.message });
    });
  });
}

async function main() {
  console.log('🚀 Recapture All URLs from Database\n');

  // Step 1: Get unique URLs before emptying
  console.log('📊 Querying unique URLs from database...');
  const urls = await getUniqueUrls();
  console.log(`✅ Found ${urls.length} unique URLs\n`);

  if (urls.length === 0) {
    console.log('⚠️  No URLs found in database. Nothing to recapture.');
    process.exit(0);
  }

  console.log('URLs to recapture:');
  urls.forEach((url, i) => console.log(`  ${i + 1}. ${url}`));
  console.log('');

  // Step 2: Empty captures table
  await emptyCaptures();

  // Step 3: Recapture each URL
  console.log('🔄 Starting recapture process...\n');
  const results = [];

  for (let i = 0; i < urls.length; i++) {
    const result = await captureAndStoreUrl(urls[i], i, urls.length);
    results.push(result);
  }

  // Print summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 RECAPTURE SUMMARY');
  console.log('='.repeat(60));

  const successful = results.filter(r => r.status === 'success');
  const partial = results.filter(r => r.status === 'partial');
  const failed = results.filter(r => r.status === 'failed' || r.status === 'error');

  console.log(`\nTotal URLs: ${results.length}`);
  console.log(`✅ Successful: ${successful.length}`);
  console.log(`⚠️  Partial (captured but not stored): ${partial.length}`);
  console.log(`❌ Failed: ${failed.length}\n`);

  if (successful.length > 0) {
    console.log('✅ Successful URLs:');
    successful.forEach(r => console.log(`   - ${r.url}`));
    console.log('');
  }

  if (partial.length > 0) {
    console.log('⚠️  Partial URLs:');
    partial.forEach(r => console.log(`   - ${r.url}: ${r.message}`));
    console.log('');
  }

  if (failed.length > 0) {
    console.log('❌ Failed URLs:');
    failed.forEach(r => console.log(`   - ${r.url}`));
    console.log('');
  }

  // Close pool
  await getPool().end();

  process.exit(failed.length > 0 ? 1 : 0);
}

main().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
