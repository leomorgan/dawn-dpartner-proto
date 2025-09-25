#!/usr/bin/env node

const { generateCanvas } = require('../pipeline/canvas');

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.error('Usage: npm run canvas -- <runId> [--artifacts <dir>]');
    console.error('Example: npm run canvas -- 2025-09-25T15-58-53-981Z_2c2047cf');
    process.exit(1);
  }

  const runId = args[0];
  let artifactsDir = null;

  // Extract artifacts dir if provided
  const artifactsIndex = args.indexOf('--artifacts');
  if (artifactsIndex !== -1 && args[artifactsIndex + 1]) {
    artifactsDir = args[artifactsIndex + 1];
  }

  console.log(`🎨 Generating vector canvas for runId: ${runId}...`);

  try {
    const result = await generateCanvas(runId, artifactsDir);

    console.log(`✅ Canvas generation complete!`);
    console.log(`📐 Canvas dimensions: ${result.canvas.width}x${result.canvas.height}px`);
    console.log(`🎯 Total elements: ${result.totalElements}`);
    console.log(`🎨 Background: ${result.canvas.background}`);

    console.log(`🏗️  Canvas structure:`);
    result.canvas.elements.forEach(element => {
      if ('children' in element) {
        console.log(`   • Group: ${element.id} (${element.width}x${element.height}px)`);
        console.log(`     └─ Children: ${element.children.length}`);

        // Show first few children
        element.children.slice(0, 3).forEach(child => {
          const type = 'text' in child ? 'Text' : 'children' in child ? 'Group' : 'Rect';
          const name = 'text' in child ? child.text.substring(0, 20) : child.id;
          console.log(`       ├─ ${type}: ${name}`);
        });

        if (element.children.length > 3) {
          console.log(`       └─ ... and ${element.children.length - 3} more`);
        }
      } else {
        const type = 'text' in element ? 'Text' : 'Rect';
        console.log(`   • ${type}: ${element.id}`);
      }
    });

    console.log(`💾 Files saved:`);
    console.log(`   • artifacts/${runId}/canvas.json`);
    console.log(`   • artifacts/${runId}/design.svg`);

    console.log(`📏 SVG size: ${Math.round(result.svg.length / 1024)}KB`);

    // Output JSON for programmatic use
    console.log('---JSON-OUTPUT---');
    console.log(JSON.stringify({
      runId: result.runId,
      canvasWidth: result.canvas.width,
      canvasHeight: result.canvas.height,
      totalElements: result.totalElements,
      svgSize: result.svg.length,
      groups: result.canvas.elements.length,
      hasBackground: result.canvas.background !== '#ffffff'
    }));

  } catch (error) {
    console.error('❌ Canvas generation failed:', error.message);
    process.exit(1);
  }
}

main().catch(console.error);