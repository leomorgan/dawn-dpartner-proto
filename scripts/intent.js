#!/usr/bin/env node

// Load environment variables
require('dotenv').config({ path: '.env.local' });

const { parseIntent } = require('../dist/pipeline/intent');

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.error('Usage: npm run intent -- "<prompt>" [--scenegraph artifacts/<runId>/scenegraph.json]');
    console.error('Example: npm run intent -- "create a property detail page"');
    process.exit(1);
  }

  const prompt = args[0];
  let runId = null;

  // Extract runId from scenegraph path if provided
  const scenegraphIndex = args.indexOf('--scenegraph');
  if (scenegraphIndex !== -1 && args[scenegraphIndex + 1]) {
    const scenegraphPath = args[scenegraphIndex + 1];
    const match = scenegraphPath.match(/artifacts\/([^\/]+)/);
    if (match) {
      runId = match[1];
    }
  }

  if (!runId) {
    console.error('Error: Could not determine runId. Please provide --scenegraph path.');
    process.exit(1);
  }

  console.log(`🧠 Parsing intent for "${prompt}"...`);

  try {
    const result = await parseIntent(prompt, runId);

    console.log(`✅ Intent parsing complete!`);
    console.log(`📋 Page type: ${result.intent.page_type}`);
    console.log(`🎯 Primary entity: ${result.intent.primary_entity}`);
    console.log(`📦 Required sections: ${result.intent.required_sections.join(', ')}`);
    console.log(`⭐ Priority order: ${result.intent.priority_order.join(', ')}`);
    console.log(`🎲 Confidence: ${(result.intent.confidence * 100).toFixed(1)}%`);
    console.log(`🤖 Provider: ${result.provider}`);

    if (result.intent.confidence < 0.7) {
      console.log(`⚠️  Low confidence - consider refining the prompt`);
    }

    // Output JSON for programmatic use
    console.log('---JSON-OUTPUT---');
    console.log(JSON.stringify({
      runId: result.runId,
      pageType: result.intent.page_type,
      primaryEntity: result.intent.primary_entity,
      requiredSections: result.intent.required_sections.length,
      confidence: result.intent.confidence,
      provider: result.provider
    }));

  } catch (error) {
    console.error('❌ Intent parsing failed:', error.message);
    process.exit(1);
  }
}

main().catch(console.error);