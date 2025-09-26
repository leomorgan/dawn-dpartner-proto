#!/usr/bin/env node

// Load environment variables from .env.local
require('dotenv').config({ path: '.env.local' });

const { generateCode } = require('../dist/pipeline/codegen');

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.error('Usage: npm run codegen -- <runId> [--artifacts <dir>]');
    console.error('Example: npm run codegen -- 2025-09-25T15-58-53-981Z_2c2047cf');
    process.exit(1);
  }

  const runId = args[0];
  let artifactsDir = null;

  // Extract artifacts dir if provided
  const artifactsIndex = args.indexOf('--artifacts');
  if (artifactsIndex !== -1 && args[artifactsIndex + 1]) {
    artifactsDir = args[artifactsIndex + 1];
  }

  console.log(`⚛️  Generating React components for runId: ${runId}...`);

  try {
    const result = await generateCode(runId, artifactsDir);

    console.log(`✅ Code generation complete!`);
    console.log(`📦 Components generated: ${result.components.length}`);
    console.log(`📄 Total lines of code: ${result.totalLines}`);

    console.log(`🏗️  Component structure:`);
    result.components.forEach(component => {
      console.log(`   • ${component.name} (${component.filename})`);
      console.log(`     └─ Exports: ${component.exports.join(', ')}`);
    });

    console.log(`💾 Files saved to: artifacts/${runId}/components/`);
    result.components.forEach(component => {
      console.log(`   • ${component.filename}`);
    });
    console.log(`   • index.ts`);

    // Output JSON for programmatic use
    console.log('---JSON-OUTPUT---');
    console.log(JSON.stringify({
      runId: result.runId,
      componentsCount: result.components.length,
      totalLines: result.totalLines,
      components: result.components.map(c => ({
        name: c.name,
        filename: c.filename,
        exports: c.exports
      }))
    }));

  } catch (error) {
    console.error('❌ Code generation failed:', error.message);
    process.exit(1);
  }
}

main().catch(console.error);