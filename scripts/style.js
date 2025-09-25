#!/usr/bin/env node

const { applyStyling } = require('../pipeline/styling');

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.error('Usage: npm run styling -- <runId> [--artifacts <dir>]');
    console.error('Example: npm run styling -- 2025-09-25T15-58-53-981Z_2c2047cf');
    process.exit(1);
  }

  const runId = args[0];
  let artifactsDir = null;

  // Extract artifacts dir if provided
  const artifactsIndex = args.indexOf('--artifacts');
  if (artifactsIndex !== -1 && args[artifactsIndex + 1]) {
    artifactsDir = args[artifactsIndex + 1];
  }

  console.log(`🎨 Applying styling to runId: ${runId}...`);

  try {
    const result = await applyStyling(runId, artifactsDir);

    console.log(`✅ Styling application complete!`);
    console.log(`🎨 Components generated: ${result.components.length}`);
    console.log(`📏 Tailwind classes: ${result.tailwindClasses.length}`);
    console.log(`💅 CSS generated: ${result.css.split('\n').length} lines`);

    console.log(`🏗️  Component tree:`);
    result.components.forEach(component => {
      console.log(`   • ${component.id} (${component.element})`);
      if (component.children) {
        component.children.forEach(child => {
          const name = 'section' in child ? child.section : child.id;
          const type = 'section' in child ? 'section' : 'container';
          console.log(`     ├─ ${name} (${type})`);
        });
      }
    });

    console.log(`💾 Files saved:`);
    console.log(`   • artifacts/${runId}/styled_components.json`);
    console.log(`   • artifacts/${runId}/styles.css`);

    // Output JSON for programmatic use
    console.log('---JSON-OUTPUT---');
    console.log(JSON.stringify({
      runId: result.runId,
      componentsCount: result.components.length,
      tailwindClassesCount: result.tailwindClasses.length,
      cssLinesCount: result.css.split('\n').length,
      hasChildren: result.components.some(c => c.children && c.children.length > 0)
    }));

  } catch (error) {
    console.error('❌ Styling application failed:', error.message);
    process.exit(1);
  }
}

main().catch(console.error);