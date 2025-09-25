#!/usr/bin/env node

const { extractTokens } = require('../dist/pipeline/tokens');

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.error('Usage: npm run tokens -- <runId>');
    console.error('Example: npm run tokens -- artifacts/2025-09-25T12-00Z');
    process.exit(1);
  }

  const runId = args[0].replace(/^artifacts\//, '');

  console.log(`🎨 Extracting design tokens for ${runId}...`);

  try {
    const result = await extractTokens(runId);

    console.log(`✅ Token extraction complete!`);
    console.log(`🎯 Primary colors: ${result.tokens.colors.primary.length}`);
    console.log(`📐 Spacing steps: ${result.tokens.spacing.length}`);
    console.log(`🔤 Font families: ${result.tokens.typography.fontFamilies.length}`);
    console.log(`📊 AA pass rate: ${(result.report.contrastResults.aaPassRate * 100).toFixed(1)}%`);

    if (result.report.contrastResults.failures.length > 0) {
      console.log(`⚠️  ${result.report.contrastResults.failures.length} contrast failures`);
    }

    // Output JSON for programmatic use
    console.log('---JSON-OUTPUT---');
    console.log(JSON.stringify({
      runId: result.runId,
      primaryColors: result.tokens.colors.primary.length,
      spacingSteps: result.tokens.spacing.length,
      aaPassRate: result.report.contrastResults.aaPassRate,
      contrastFailures: result.report.contrastResults.failures.length
    }));

  } catch (error) {
    console.error('❌ Token extraction failed:', error.message);
    process.exit(1);
  }
}

main().catch(console.error);