#!/usr/bin/env node

// Load environment variables
require('dotenv').config({ path: '.env.local' });

const { capture } = require('../dist/pipeline/capture');
const { extractTokens } = require('../dist/pipeline/tokens');
const { buildSceneGraph } = require('../dist/pipeline/scenegraph');
const { parseIntent } = require('../dist/pipeline/intent');
const { synthesizeLayout } = require('../dist/pipeline/layout');
const { applyStyling } = require('../dist/pipeline/styling');
const { generateCode } = require('../dist/pipeline/codegen');

async function main() {
  const args = process.argv.slice(2);

  if (args.length < 4 || !args.includes('--url') || !args.includes('--prompt')) {
    console.error('Usage: npm run generate -- --url <url> --prompt <prompt>');
    console.error('Example: npm run generate -- --url https://airbnb.com --prompt "create a property detail page"');
    process.exit(1);
  }

  const urlIndex = args.indexOf('--url');
  const promptIndex = args.indexOf('--prompt');

  if (urlIndex === -1 || promptIndex === -1 || !args[urlIndex + 1] || !args[promptIndex + 1]) {
    console.error('❌ Both --url and --prompt are required');
    process.exit(1);
  }

  const url = args[urlIndex + 1];
  const prompt = args[promptIndex + 1];
  const outputDir = args.find(arg => arg.startsWith('--out='))?.split('=')[1];

  console.log(`🚀 Starting full pipeline generation...`);
  console.log(`🌐 URL: ${url}`);
  console.log(`💭 Prompt: ${prompt}`);
  console.log('');

  let result;
  let runId;

  try {
    // Stage 1: Capture & Normalize
    console.log('📷 Stage 1: Capture & Normalize...');
    result = await capture(url, outputDir);
    runId = result.runId;
    console.log(`   ✅ Captured ${result.artifacts.styles.length} elements from "${result.artifacts.meta.title}"`);

    // Stage 2: Style Token Extractor
    console.log('🎨 Stage 2: Design Token Extraction...');
    const tokensResult = await extractTokens(runId, outputDir || 'artifacts');
    console.log(`   ✅ Extracted ${tokensResult.tokens.colors.primary.length} primary colors, ${tokensResult.tokens.spacing.length} spacing values`);

    // Stage 3: DOM Scenegraph Builder
    console.log('🏗️  Stage 3: DOM Scenegraph Builder...');
    const scenegraphResult = await buildSceneGraph(runId, outputDir || 'artifacts');
    console.log(`   ✅ Built scenegraph with ${scenegraphResult.scenegraph.totalNodes} nodes`);

    // Stage 4: Intent Parser
    console.log('🧠 Stage 4: Intent Parser...');
    const intentResult = await parseIntent(prompt, runId, outputDir || 'artifacts');
    console.log(`   ✅ Parsed intent: ${intentResult.adaptiveIntent.pageType} page with ${intentResult.adaptiveIntent.discoveredSections.length} sections`);

    // Stage 5: Layout Synthesizer
    console.log('📐 Stage 5: Layout Synthesizer...');
    const layoutResult = await synthesizeLayout(runId, outputDir || 'artifacts');
    console.log(`   ✅ Generated ${layoutResult.layout.grid.columns}-column layout`);

    // Stage 6: Styling & Accessibility Applier
    console.log('💅 Stage 6: Styling & Accessibility...');
    let stylingResult;
    try {
      stylingResult = await applyStyling(runId, outputDir || 'artifacts');
      console.log(`   ✅ Applied ${stylingResult.components ? stylingResult.components.length : stylingResult.componentPlan?.semanticComponents?.length || 0} styled components`);
    } catch (error) {
      console.error(`   ❌ Error in styling stage:`, error.message);
      throw error;
    }

    // Stage 7: Component Code Generator
    console.log('⚛️  Stage 7: Component Code Generator...');
    const codegenResult = await generateCode(runId, outputDir || 'artifacts');
    console.log(`   ✅ Generated ${codegenResult.components.length} component files`);

    console.log('');
    console.log('🎉 Pipeline complete!');
    console.log(`📁 Run ID: ${runId}`);
    console.log(`📂 Artifacts: ${outputDir || 'artifacts'}/${runId}/`);
    console.log('');
    console.log('Generated files:');
    codegenResult.components.forEach(component => {
      console.log(`   📄 ${component.filePath}`);
    });

    // Output JSON for programmatic use
    console.log('');
    console.log('---JSON-OUTPUT---');
    console.log(JSON.stringify({
      runId,
      url,
      prompt,
      stages: {
        capture: { nodeCount: result.artifacts.styles.length, title: result.artifacts.meta.title },
        tokens: { colors: tokensResult.tokens.colors.primary.length, spacing: tokensResult.tokens.spacing.length },
        scenegraph: { nodes: scenegraphResult.scenegraph.totalNodes },
        intent: { pageType: intentResult.adaptiveIntent.pageType, sections: intentResult.adaptiveIntent.discoveredSections.length },
        layout: { columns: layoutResult.layout.grid.columns },
        styling: { components: stylingResult.components.length },
        codegen: { files: codegenResult.components.length }
      }
    }));

  } catch (error) {
    console.error('❌ Pipeline failed:', error.message);
    if (runId) {
      console.error(`📂 Partial artifacts available in: ${outputDir || 'artifacts'}/${runId}/`);
    }
    process.exit(1);
  }
}

main().catch(console.error);