#!/usr/bin/env node

const { buildSceneGraph } = require('../dist/pipeline/scenegraph');

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.error('Usage: npm run scenegraph -- <runId>');
    console.error('Example: npm run scenegraph -- artifacts/2025-09-25T12-00Z');
    process.exit(1);
  }

  const runId = args[0].replace(/^artifacts\//, '');

  console.log(`🏗️  Building scene graph for ${runId}...`);

  try {
    const result = await buildSceneGraph(runId);

    console.log(`✅ Scene graph build complete!`);
    console.log(`📊 Total nodes: ${result.scenegraph.totalNodes}`);
    console.log(`📉 Wrapper reduction: ${result.scenegraph.wrapperReduction.toFixed(1)}%`);
    console.log(`📖 Reading order: ${result.scenegraph.readingOrder.length} text nodes`);
    console.log(`🎯 Root role: ${result.scenegraph.root.role}`);

    // Output JSON for programmatic use
    console.log('---JSON-OUTPUT---');
    console.log(JSON.stringify({
      runId: result.runId,
      totalNodes: result.scenegraph.totalNodes,
      wrapperReduction: result.scenegraph.wrapperReduction,
      readingOrderLength: result.scenegraph.readingOrder.length,
      rootRole: result.scenegraph.root.role
    }));

  } catch (error) {
    console.error('❌ Scene graph build failed:', error.message);
    process.exit(1);
  }
}

main().catch(console.error);