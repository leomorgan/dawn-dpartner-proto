#!/usr/bin/env node

const { spawn } = require('child_process');

const urls = process.argv.slice(2);

if (urls.length === 0) {
  console.error('Usage: npm run batch-capture -- <url1> <url2> ...');
  console.error('Example: npm run batch-capture -- https://stripe.com https://monzo.com');
  process.exit(1);
}

console.log(`🚀 Batch capture starting for ${urls.length} URLs...\n`);

async function captureUrl(url, index, total) {
  return new Promise((resolve, reject) => {
    console.log(`[${index + 1}/${total}] 🌐 Capturing: ${url}`);

    const child = spawn('npm', ['run', 'generate', '--', '--url', url, '--prompt', 'cta extraction'], {
      stdio: 'inherit',
      shell: true
    });

    child.on('close', (code) => {
      if (code === 0) {
        console.log(`[${index + 1}/${total}] ✅ Success: ${url}\n`);
        resolve({ url, status: 'success' });
      } else {
        console.log(`[${index + 1}/${total}] ❌ Failed: ${url} (exit code ${code})\n`);
        resolve({ url, status: 'failed', code });
      }
    });

    child.on('error', (err) => {
      console.error(`[${index + 1}/${total}] ❌ Error: ${url}`, err.message);
      resolve({ url, status: 'error', error: err.message });
    });
  });
}

(async () => {
  const results = [];

  for (let i = 0; i < urls.length; i++) {
    const result = await captureUrl(urls[i], i, urls.length);
    results.push(result);
  }

  console.log('\n' + '='.repeat(60));
  console.log('📊 Batch Capture Summary');
  console.log('='.repeat(60) + '\n');

  const successful = results.filter(r => r.status === 'success');
  const failed = results.filter(r => r.status === 'failed' || r.status === 'error');

  console.log(`Total URLs: ${results.length}`);
  console.log(`✅ Successful: ${successful.length}`);
  console.log(`❌ Failed: ${failed.length}\n`);

  if (successful.length > 0) {
    console.log('✅ Successful URLs:');
    successful.forEach(r => console.log(`   - ${r.url}`));
    console.log('');
  }

  if (failed.length > 0) {
    console.log('❌ Failed URLs:');
    failed.forEach(r => console.log(`   - ${r.url}`));
    console.log('');
  }

  process.exit(failed.length > 0 ? 1 : 0);
})();
