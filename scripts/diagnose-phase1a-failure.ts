#!/usr/bin/env tsx

import { query } from '../lib/db/client';
import { readFile } from 'fs/promises';
import { resolve } from 'path';

interface CaptureData {
  runId: string;
  url: string;
  backgrounds: number;
  colorSaturationEnergy: number;
  colorRoleDistinction: number;
  spacingMedian: number;
  gestaltGroupingStrength: number;
}

async function main() {
  console.log('🔍 Diagnosing Phase 1A Failure\n');
  console.log('Checking raw feature values vs normalized values...\n');

  const result = await query(`
    SELECT run_id, source_url
    FROM style_profiles
    ORDER BY source_url
  `);

  const captures: CaptureData[] = [];

  for (const row of result.rows) {
    try {
      const tokensPath = resolve(`artifacts/${row.run_id}/design_tokens.json`);
      const reportPath = resolve(`artifacts/${row.run_id}/style_report.json`);

      const tokens = JSON.parse(await readFile(tokensPath, 'utf-8'));
      const report = JSON.parse(await readFile(reportPath, 'utf-8'));

      captures.push({
        runId: row.run_id,
        url: row.source_url,
        backgrounds: tokens.colors?.contextual?.backgrounds?.length || 0,
        colorSaturationEnergy: report.layoutFeatures?.colorSaturationEnergy || 0,
        colorRoleDistinction: report.layoutFeatures?.colorRoleDistinction || 0,
        spacingMedian: tokens.spacing?.length > 0
          ? tokens.spacing[Math.floor(tokens.spacing.length / 2)]
          : 0,
        gestaltGroupingStrength: report.layoutFeatures?.gestaltGroupingStrength || 0,
      });
    } catch (err) {
      console.log(`⚠️  Skipping ${row.run_id}: ${err.message}`);
    }
  }

  console.log('═'.repeat(100));
  console.log('RAW VALUES vs NORMALIZED (Phase 1A ranges)');
  console.log('═'.repeat(100));
  console.log('');

  console.log('1️⃣  color_background_variation (backgrounds count)');
  console.log('   Normalization: normalizeLog(value, 8)');
  console.log('');
  captures.forEach(c => {
    const normalized = Math.min(1, Math.log(c.backgrounds + 1) / Math.log(8 * 2 + 1));
    console.log(`   ${c.url.padEnd(30)} Raw: ${c.backgrounds.toString().padStart(2)}  →  Normalized: ${normalized.toFixed(3)}`);
  });
  console.log('');

  console.log('2️⃣  brand_color_saturation_energy (avg chroma)');
  console.log('   Normalization: normalizeLinear(value, 0, 20)');
  console.log('');
  captures.forEach(c => {
    const normalized = Math.max(0, Math.min(1, (c.colorSaturationEnergy - 0) / (20 - 0)));
    console.log(`   ${c.url.padEnd(30)} Raw: ${c.colorSaturationEnergy.toFixed(2).padStart(6)}  →  Normalized: ${normalized.toFixed(3)}`);
  });
  console.log('');

  console.log('3️⃣  brand_color_role_distinction (avg ΔE)');
  console.log('   Normalization: normalizeLinear(value, 3000, 8000)');
  console.log('');
  captures.forEach(c => {
    const normalized = Math.max(0, Math.min(1, (c.colorRoleDistinction - 3000) / (8000 - 3000)));
    console.log(`   ${c.url.padEnd(30)} Raw: ${c.colorRoleDistinction.toFixed(0).padStart(6)}  →  Normalized: ${normalized.toFixed(3)}`);
  });
  console.log('');

  console.log('4️⃣  spacing_median (median spacing value)');
  console.log('   Normalization: normalizeLinear(value, 8, 64)');
  console.log('');
  captures.forEach(c => {
    const normalized = Math.max(0, Math.min(1, (c.spacingMedian - 8) / (64 - 8)));
    console.log(`   ${c.url.padEnd(30)} Raw: ${c.spacingMedian.toFixed(0).padStart(6)}  →  Normalized: ${normalized.toFixed(3)}`);
  });
  console.log('');

  console.log('5️⃣  shape_grouping_strength (inter/intra spacing ratio)');
  console.log('   Normalization: normalizeLinear(value, 3000, 8000)');
  console.log('');
  captures.forEach(c => {
    // gestaltGroupingStrength is already normalized, need to check artifact
    console.log(`   ${c.url.padEnd(30)} Already normalized: ${c.gestaltGroupingStrength.toFixed(3)}`);
  });
  console.log('');

  console.log('═'.repeat(100));
  console.log('DIAGNOSIS');
  console.log('═'.repeat(100));
  console.log('');

  // Calculate variance of raw values
  const bgVariance = calcVariance(captures.map(c => c.backgrounds));
  const satVariance = calcVariance(captures.map(c => c.colorSaturationEnergy));
  const roleVariance = calcVariance(captures.map(c => c.colorRoleDistinction));
  const spacingVariance = calcVariance(captures.map(c => c.spacingMedian));

  console.log('Raw value variances:');
  console.log(`  backgrounds:              ${bgVariance.toFixed(2)}`);
  console.log(`  colorSaturationEnergy:    ${satVariance.toFixed(2)}`);
  console.log(`  colorRoleDistinction:     ${roleVariance.toFixed(2)}`);
  console.log(`  spacingMedian:            ${spacingVariance.toFixed(2)}`);
  console.log('');

  console.log('❗ FINDING:');
  console.log('If raw variance is low, normalization changes will NOT help.');
  console.log('Phase 1A assumes underlying values differ enough to benefit from better ranges.');
  console.log('If all sites have ~11 backgrounds, changing log midpoint from 4→8 does nothing.');
  console.log('');

  process.exit(0);
}

function calcVariance(values: number[]): number {
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  return values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
}

main().catch(console.error);
