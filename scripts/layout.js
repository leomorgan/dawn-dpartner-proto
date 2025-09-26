#!/usr/bin/env node

// Load environment variables
require('dotenv').config({ path: '.env.local' });

const { synthesizeLayout } = require('../dist/pipeline/layout');

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.error('Usage: npm run layout -- <runId> [--artifacts <dir>]');
    console.error('Example: npm run layout -- 2025-09-25T15-58-53-981Z_2c2047cf');
    process.exit(1);
  }

  const runId = args[0];
  let artifactsDir = null;

  // Extract artifacts dir if provided
  const artifactsIndex = args.indexOf('--artifacts');
  if (artifactsIndex !== -1 && args[artifactsIndex + 1]) {
    artifactsDir = args[artifactsIndex + 1];
  }

  console.log(`🏗️  Synthesizing layout for runId: ${runId}...`);

  try {
    const result = await synthesizeLayout(runId, artifactsDir);

    console.log(`✅ Layout synthesis complete!`);
    console.log(`📋 Page type: ${result.layout.sections ? Object.keys(result.layout.sections).length : 0} section specs loaded`);
    console.log(`🏗️  Layout stacks: ${result.layout.stacks.length}`);
    console.log(`📦 Required sections: ${result.sections.join(', ')}`);
    console.log(`✅ Constraints satisfied: ${result.constraints.satisfied}/${result.constraints.total}`);

    if (result.constraints.violations.length > 0) {
      console.log(`⚠️  Constraint violations:`);
      result.constraints.violations.forEach(violation => {
        console.log(`   • ${violation}`);
      });
    } else {
      console.log(`🎉 All constraints satisfied!`);
    }

    console.log(`💾 Layout saved to: artifacts/${runId}/layout.json`);

    // Output JSON for programmatic use
    console.log('---JSON-OUTPUT---');
    console.log(JSON.stringify({
      runId: result.runId,
      stacksCount: result.layout.stacks.length,
      sectionsCount: result.sections.length,
      constraintsSatisfied: result.constraints.satisfied,
      constraintsTotal: result.constraints.total,
      hasViolations: result.constraints.violations.length > 0
    }));

  } catch (error) {
    console.error('❌ Layout synthesis failed:', error.message);
    process.exit(1);
  }
}

main().catch(console.error);