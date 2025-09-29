#!/usr/bin/env node

/**
 * Test script for CTA template generation using existing captured data
 */

const { extractTokens } = require('../dist/pipeline/tokens/index.js');
const { selectTemplate, applyTokensToTemplate } = require('../dist/pipeline/cta-template/index.js');

async function main() {
  const runId = process.argv[2];

  if (!runId) {
    console.error('Usage: node test-cta.js <runId>');
    process.exit(1);
  }

  try {
    console.log(`🎨 Testing CTA template generation for: ${runId}`);

    // Extract design tokens
    console.log('📊 Extracting design tokens...');
    const tokenResult = await extractTokens(runId);

    console.log(`✅ Extracted ${tokenResult.tokens.buttons.variants.length} button variants`);
    console.log(`✅ Found ${tokenResult.tokens.colors.primary.length} primary colors`);

    // Select and apply CTA template
    console.log('🎯 Generating CTA template...');
    const template = selectTemplate();
    const ctaResult = await applyTokensToTemplate(template, tokenResult.tokens, runId);

    console.log('✅ CTA Template Generated Successfully!');
    console.log(`📁 Components saved to: artifacts/${runId}/cta/`);
    console.log(`🎨 Template type: ${ctaResult.templateType}`);
    console.log(`🎨 Primary color: ${ctaResult.safeColors.ctaPrimary}`);
    console.log(`🎨 Secondary color: ${ctaResult.safeColors.ctaSecondary}`);
    console.log(`🔗 Preview at: http://localhost:3000/preview-cta/${runId}`);

    // Show sample of generated code
    console.log('\n📄 Sample generated component:');
    console.log(ctaResult.componentCode.substring(0, 300) + '...');

  } catch (error) {
    console.error('❌ CTA template generation failed:', error.message);
    process.exit(1);
  }
}

main();