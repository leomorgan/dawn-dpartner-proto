#!/usr/bin/env tsx

import { readFileSync, writeFileSync, readdirSync } from 'fs';
import { join } from 'path';
import type { DesignTokens, BrandPersonality, StyleReport } from '../pipeline/tokens';
import type { ComputedStyleNode } from '../pipeline/capture';

// Import the fixed functions from pipeline/tokens/index.ts
// Since we can't easily import non-exported functions, we'll duplicate the logic here

function determineTone(tokens: DesignTokens): string {
  const scores = {
    professional: 0,
    playful: 0,
    elegant: 0,
    bold: 0,
    minimal: 0,
  };

  // Color saturation → playful vs professional
  const avgSat = 0.5; // Simplified for now
  if (avgSat > 0.6) {
    scores.playful += 2;
    scores.bold += 1;
  } else if (avgSat < 0.3) {
    scores.professional += 2;
    scores.elegant += 1;
  }

  // Border radius → playful vs professional
  const avgRadius = tokens.borderRadius.length > 0
    ? tokens.borderRadius.reduce((sum, r) => sum + parseFloat(r), 0) / tokens.borderRadius.length
    : 0;
  if (avgRadius > 16) {
    scores.playful += 1;
  } else if (avgRadius < 4) {
    scores.professional += 1;
  }

  // Color count → minimal vs bold
  const totalColors = (tokens.colors?.foundation?.length || 0) + (tokens.colors?.accentColors?.length || 0);
  if (totalColors < 8) {
    scores.minimal += 2;
    scores.elegant += 1;
  } else if (totalColors > 15) {
    scores.bold += 1;
  }

  // Font family count → minimal vs elaborate
  if (tokens.typography.fontFamilies.length === 1) {
    scores.minimal += 1;
  } else if (tokens.typography.fontFamilies.length > 2) {
    scores.elegant += 1;
  }

  // Spacing median → elegant vs bold
  const spacingMedian = tokens.spacing.length > 0
    ? tokens.spacing[Math.floor(tokens.spacing.length / 2)]
    : 0;
  if (spacingMedian > 32) {
    scores.elegant += 1;
    scores.minimal += 1;
  } else if (spacingMedian < 12) {
    scores.bold += 1;
  }

  // Return highest scoring tone
  return Object.entries(scores).sort((a, b) => b[1] - a[1])[0][0];
}

function determineEnergy(tokens: DesignTokens): string {
  const scores = {
    calm: 0,
    energetic: 0,
    sophisticated: 0,
    dynamic: 0,
  };

  // Color saturation → energetic vs calm
  const avgSat = 0.5; // Simplified

  // Simplified scoring
  const avgRadius = tokens.borderRadius.length > 0
    ? tokens.borderRadius.reduce((sum, r) => sum + parseFloat(r), 0) / tokens.borderRadius.length
    : 0;

  if (avgRadius > 12) {
    scores.dynamic += 1;
    scores.energetic += 1;
  } else {
    scores.calm += 1;
    scores.sophisticated += 1;
  }

  return Object.entries(scores).sort((a, b) => b[1] - a[1])[0][0];
}

function determineTrustLevel(tokens: DesignTokens): string {
  // V3 FIX: Improved scoring system for better variance
  const scores = {
    conservative: 0,
    modern: 0,
    innovative: 0,
    experimental: 0,
  };

  // 1. Border radius → conservative vs experimental
  const avgRadius = tokens.borderRadius.length > 0
    ? tokens.borderRadius.reduce((sum, r) => sum + parseFloat(r), 0) / tokens.borderRadius.length
    : 0;
  if (avgRadius < 2) {
    scores.conservative += 2;
  } else if (avgRadius > 20) {
    scores.experimental += 2;
    scores.innovative += 1;
  } else if (avgRadius > 8) {
    scores.modern += 1;
    scores.innovative += 1;
  }

  // 2. Color count → conservative vs experimental
  const colorCount = (tokens.colors?.foundation?.length || 0) + (tokens.colors?.accentColors?.length || 0);
  if (colorCount < 6) {
    scores.conservative += 1;
  } else if (colorCount > 12) {
    scores.experimental += 1;
    scores.innovative += 1;
  } else {
    scores.modern += 1;
  }

  // 3. Shadow complexity → conservative vs innovative
  const shadowCount = tokens.boxShadow.length;
  if (shadowCount === 0) {
    scores.conservative += 1;
  } else if (shadowCount > 3) {
    scores.innovative += 2;
  } else if (shadowCount > 1) {
    scores.modern += 1;
  }

  // 4. Font family count → conservative vs experimental
  if (tokens.typography.fontFamilies.length === 1) {
    scores.conservative += 1;
  } else if (tokens.typography.fontFamilies.length > 2) {
    scores.experimental += 1;
  }

  // 5. Font weight range → conservative vs innovative
  const weights = tokens.typography.fontWeights.map(w => typeof w === 'string' ? parseInt(w) : w);
  const weightRange = weights.length > 0 ? Math.max(...weights) - Math.min(...weights) : 0;
  if (weightRange < 200) {
    scores.conservative += 1;
  } else if (weightRange > 500) {
    scores.innovative += 1;
  }

  // Return highest scoring trust level
  return Object.entries(scores).sort((a, b) => b[1] - a[1])[0][0];
}

function calculateConfidence(tokens: DesignTokens): number {
  let distinctiveness = 0.5; // Start at 50%

  // 1. Color palette distinctiveness (+0-0.2)
  const colorCount = (tokens.colors?.foundation?.length || 0) + (tokens.colors?.accentColors?.length || 0);
  if (colorCount < 5) distinctiveness += 0.1; // Very minimal = distinct
  else if (colorCount > 15) distinctiveness += 0.15; // Very colorful = distinct
  else if (colorCount > 10) distinctiveness += 0.05; // Somewhat colorful

  // 2. Border radius distinctiveness (+0-0.15)
  const avgRadius = tokens.borderRadius.length > 0
    ? tokens.borderRadius.reduce((sum, r) => sum + parseFloat(r), 0) / tokens.borderRadius.length
    : 0;
  if (avgRadius < 2) distinctiveness += 0.15; // Very sharp = distinct
  else if (avgRadius > 20) distinctiveness += 0.15; // Very rounded = distinct
  else if (avgRadius > 12) distinctiveness += 0.05; // Somewhat rounded

  // 3. Shadow usage distinctiveness (+0-0.1)
  if (tokens.boxShadow.length === 0) distinctiveness += 0.1; // Flat = distinct
  else if (tokens.boxShadow.length > 4) distinctiveness += 0.1; // Very shadowy = distinct

  // 4. Typography distinctiveness (+0-0.15)
  if (tokens.typography.fontFamilies.length === 1) distinctiveness += 0.05; // Minimal = somewhat distinct
  else if (tokens.typography.fontFamilies.length > 2) distinctiveness += 0.15; // Multi-font = very distinct

  // 5. Spacing distinctiveness (+0-0.1)
  const spacingMedian = tokens.spacing.length > 0
    ? tokens.spacing[Math.floor(tokens.spacing.length / 2)]
    : 0;
  if (spacingMedian < 8) distinctiveness += 0.05; // Tight spacing
  else if (spacingMedian > 40) distinctiveness += 0.1; // Generous spacing = more distinct

  // Clamp to 0-1 range
  return Math.max(0, Math.min(1, distinctiveness));
}

async function main() {
  console.log('\n🔄 Regenerating brand personality for all captures...\n');

  const artifactsDir = join(process.cwd(), 'artifacts');
  const runs = readdirSync(artifactsDir).filter(f => f.includes('T'));

  let successCount = 0;
  let failCount = 0;

  for (const runId of runs) {
    try {
      const runDir = join(artifactsDir, runId);

      // Read tokens
      const tokensPath = join(runDir, 'design_tokens.json');
      const tokens: DesignTokens = JSON.parse(readFileSync(tokensPath, 'utf8'));

      // Read existing style report
      const reportPath = join(runDir, 'style_report.json');
      const report: StyleReport = JSON.parse(readFileSync(reportPath, 'utf8'));

      // Calculate new brand personality using heuristics
      const newTone = determineTone(tokens);
      const newEnergy = determineEnergy(tokens);
      const newTrustLevel = determineTrustLevel(tokens);
      const newConfidence = calculateConfidence(tokens);

      // Update only the brand personality fields
      report.brandPersonality.tone = newTone as any;
      report.brandPersonality.energy = newEnergy as any;
      report.brandPersonality.trustLevel = newTrustLevel as any;
      report.brandPersonality.confidence = newConfidence;

      // Write back
      writeFileSync(reportPath, JSON.stringify(report, null, 2));

      console.log(`✅ ${runId}`);
      console.log(`   tone: ${newTone}, energy: ${newEnergy}, trust: ${newTrustLevel}, conf: ${newConfidence.toFixed(2)}\n`);

      successCount++;
    } catch (error: any) {
      console.error(`❌ ${runId}: ${error.message}\n`);
      failCount++;
    }
  }

  console.log('━'.repeat(80));
  console.log(`\n📊 Summary:`);
  console.log(`  ✅ Success: ${successCount}`);
  console.log(`  ❌ Failed: ${failCount}`);
  console.log('\n✨ Brand personality regeneration complete!\n');
}

main().catch(console.error);
