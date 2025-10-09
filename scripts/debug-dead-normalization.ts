#!/usr/bin/env tsx

import { readFileSync } from 'fs';
import { join } from 'path';
import type { DesignTokens, StyleReport } from '../pipeline/tokens';

interface SiteData {
  url: string;
  backgroundCount: number;
  backgroundCountNormalized: number;
  fontFamilyCount: number;
  fontFamilyCountNormalized: number;
  colorSaturationEnergyRaw: number;
  colorSaturationEnergyNormalized: number;
}

// Reproduction of normalization functions
function normalizeLog(value: number, midpoint: number): number {
  if (value < 0) return 0;
  if (midpoint <= 0) return 0;
  return Math.min(1, Math.log(value + 1) / Math.log(midpoint * 2 + 1));
}

function normalizeLinear(value: number, min: number, max: number): number {
  if (max === min) return 0;
  return Math.max(0, Math.min(1, (value - min) / (max - min)));
}

async function main() {
  console.log('\n🔍 Debugging Dead Normalization Features\n');
  console.log('═'.repeat(100));

  const artifactsDir = join(process.cwd(), 'artifacts');
  const runs = [
    '2025-10-02T13-03-18-205Z_4b76f711_stripe-com',
    '2025-10-02T13-03-58-115Z_03ad24ee_monzo-com',
    '2025-10-02T13-05-26-998Z_1a97b63c_fifa-com',
    '2025-10-02T13-06-26-845Z_2e4c21d2_dawnlabs-co',
    '2025-10-02T13-06-40-558Z_e91872a0_vercel-com',
    '2025-10-02T13-07-18-941Z_07e71399_github-com',
    '2025-10-02T13-08-22-753Z_1f20dfb8_apple-com',
    '2025-10-02T13-09-20-742Z_14fe0555_cnn-com',
    '2025-10-02T15-22-47-260Z_6a53edbd_koto-studio',
    '2025-10-02T15-25-23-992Z_dcbf8dbb_bbc-co-uk',
    '2025-10-07T16-20-27-330Z_fb08731c_stripe-com',
  ];

  const siteData: SiteData[] = [];

  for (const runId of runs) {
    try {
      const tokensPath = join(artifactsDir, runId, 'design_tokens.json');
      const reportPath = join(artifactsDir, runId, 'style_report.json');

      const tokens: DesignTokens = JSON.parse(readFileSync(tokensPath, 'utf8'));
      const report: StyleReport = JSON.parse(readFileSync(reportPath, 'utf8'));

      // 1. color_background_variation
      const backgroundCount = tokens.colors?.contextual?.backgrounds?.length || 0;
      const backgroundCountNormalized = normalizeLog(backgroundCount, 8); // Phase 1A changed from 4 to 8

      // 2. typo_family_count
      const fontFamilyCount = tokens.typography?.fontFamilies?.length || 0;
      const fontFamilyCountNormalized = normalizeLog(fontFamilyCount, 2);

      // 3. brand_color_saturation_energy
      const colorSaturationEnergyRaw = report.layoutFeatures?.colorSaturationEnergy || 0;
      const colorSaturationEnergyNormalized = normalizeLinear(colorSaturationEnergyRaw, 0, 20); // Phase 1A changed from 0-130

      siteData.push({
        url: report.source_url || runId,
        backgroundCount,
        backgroundCountNormalized,
        fontFamilyCount,
        fontFamilyCountNormalized,
        colorSaturationEnergyRaw,
        colorSaturationEnergyNormalized,
      });
    } catch (err: any) {
      console.error(`⚠️  Skipped ${runId}: ${err.message}`);
    }
  }

  // Print results
  console.log('\n1️⃣  color_background_variation (backgrounds.length)');
  console.log('   Current normalization: normalizeLog(count, 8)');
  console.log('');
  console.log('   Site'.padEnd(30) + 'Raw Count'.padEnd(12) + 'Normalized'.padEnd(12) + 'Issue');
  console.log('   ' + '─'.repeat(80));

  siteData.forEach(d => {
    const issue = d.backgroundCountNormalized > 0.7 && d.backgroundCountNormalized < 0.75 ? '← CLUSTERED' : '';
    console.log(`   ${d.url.padEnd(30)}${d.backgroundCount.toString().padEnd(12)}${d.backgroundCountNormalized.toFixed(3).padEnd(12)}${issue}`);
  });

  const bgVariance = calculateVariance(siteData.map(d => d.backgroundCountNormalized));
  console.log(`\n   Normalized variance: ${bgVariance.toFixed(6)}`);
  console.log(`   Raw count range: ${Math.min(...siteData.map(d => d.backgroundCount))} - ${Math.max(...siteData.map(d => d.backgroundCount))}`);
  console.log(`   Diagnosis: ${bgVariance < 0.001 ? '❌ DEAD (all sites have ~11-12 backgrounds)' : '✅ OK'}`);

  console.log('\n═'.repeat(100));
  console.log('\n2️⃣  typo_family_count (fontFamilies.length)');
  console.log('   Current normalization: normalizeLog(count, 2)');
  console.log('');
  console.log('   Site'.padEnd(30) + 'Raw Count'.padEnd(12) + 'Normalized'.padEnd(12) + 'Issue');
  console.log('   ' + '─'.repeat(80));

  siteData.forEach(d => {
    const issue = Math.abs(d.fontFamilyCountNormalized - 0.683) < 0.01 ? '← IDENTICAL' : '';
    console.log(`   ${d.url.padEnd(30)}${d.fontFamilyCount.toString().padEnd(12)}${d.fontFamilyCountNormalized.toFixed(3).padEnd(12)}${issue}`);
  });

  const ffVariance = calculateVariance(siteData.map(d => d.fontFamilyCountNormalized));
  console.log(`\n   Normalized variance: ${ffVariance.toFixed(6)}`);
  console.log(`   Raw count range: ${Math.min(...siteData.map(d => d.fontFamilyCount))} - ${Math.max(...siteData.map(d => d.fontFamilyCount))}`);
  console.log(`   Diagnosis: ${ffVariance < 0.001 ? '❌ DEAD (all sites use 2 fonts)' : '✅ OK'}`);

  console.log('\n═'.repeat(100));
  console.log('\n3️⃣  brand_color_saturation_energy (avg chroma from layout)');
  console.log('   Current normalization: normalizeLinear(chroma, 0, 20)');
  console.log('');
  console.log('   Site'.padEnd(30) + 'Raw Chroma'.padEnd(12) + 'Normalized'.padEnd(12) + 'Issue');
  console.log('   ' + '─'.repeat(80));

  siteData.forEach(d => {
    const issue = d.colorSaturationEnergyNormalized < 0.05 ? '← NEAR-ZERO' : '';
    console.log(`   ${d.url.padEnd(30)}${d.colorSaturationEnergyRaw.toFixed(2).padEnd(12)}${d.colorSaturationEnergyNormalized.toFixed(3).padEnd(12)}${issue}`);
  });

  const chromaVariance = calculateVariance(siteData.map(d => d.colorSaturationEnergyNormalized));
  console.log(`\n   Normalized variance: ${chromaVariance.toFixed(6)}`);
  console.log(`   Raw chroma range: ${Math.min(...siteData.map(d => d.colorSaturationEnergyRaw)).toFixed(2)} - ${Math.max(...siteData.map(d => d.colorSaturationEnergyRaw)).toFixed(2)}`);
  console.log(`   Diagnosis: ${chromaVariance < 0.001 ? '❌ DEAD (values clustered near zero)' : '⚠️  LOW VARIANCE'}`);

  console.log('\n═'.repeat(100));
  console.log('\n💡 RECOMMENDATIONS:');
  console.log('');
  console.log('1. color_background_variation:');
  console.log('   → REMOVE: Not discriminative in modern web (all sites have 11-12 backgrounds)');
  console.log('   → OR: Change metric to background *diversity* (color distance) not count');
  console.log('');
  console.log('2. typo_family_count:');
  console.log('   → REMOVE: Not discriminative in modern web (all sites use 1-2 fonts)');
  console.log('   → OR: Change metric to font *pairing sophistication* (serif+sans, display+text)');
  console.log('');
  console.log('3. brand_color_saturation_energy:');
  console.log('   → CHECK: Verify colorSaturationEnergy extraction is working correctly');
  console.log('   → Values are very low (0-5.4 chroma) suggesting desaturated colors across all sites');
  console.log('   → May be accurate reflection of modern minimal aesthetic');
  console.log('');
}

function calculateVariance(values: number[]): number {
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  return values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
}

main().catch(console.error);
