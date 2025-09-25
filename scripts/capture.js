#!/usr/bin/env node

const { capture } = require('../dist/pipeline/capture');

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.error('Usage: npm run capture -- <url>');
    console.error('Example: npm run capture -- https://airbnb.com');
    process.exit(1);
  }

  const url = args[0];
  const outputDir = args.find(arg => arg.startsWith('--out='))?.split('=')[1];

  console.log(`🌐 Capturing ${url}...`);

  try {
    const result = await capture(url, outputDir);

    console.log(`✅ Capture complete!`);
    console.log(`📁 Run ID: ${result.runId}`);
    console.log(`🎯 Found ${result.artifacts.styles.length} visible elements`);
    console.log(`📄 HTML: ${Math.round(result.artifacts.html.length / 1024)}KB`);
    console.log(`🖼️  Screenshot: ${result.artifacts.screenshot}`);

    // Output JSON for programmatic use
    console.log('---JSON-OUTPUT---');
    console.log(JSON.stringify({
      runId: result.runId,
      url,
      nodeCount: result.artifacts.styles.length,
      title: result.artifacts.meta.title
    }));

  } catch (error) {
    console.error('❌ Capture failed:', error.message);
    process.exit(1);
  }
}

main().catch(console.error);