#!/usr/bin/env node

const { query, getPool } = require('../dist/lib/db/client');

async function analyzeVectorBreakdown() {
  try {
    // Get a sample vector from database
    const result = await query(`
      SELECT
        c.source_url,
        sp.style_vec,
        sp.tokens_json
      FROM captures c
      JOIN style_profiles sp ON sp.capture_id = c.id
      WHERE c.source_url LIKE '%stripe%'
      LIMIT 1
    `);

    if (result.rows.length === 0) {
      console.log('❌ No vectors found in database');
      return;
    }

    const row = result.rows[0];
    const vector = row.style_vec;
    const vectorArray = typeof vector === 'string'
      ? JSON.parse(vector)
      : Array.from(vector);

    // Feature names from global-style-vec.ts
    const featureNames = [
      // Color (16D) - lines 21-96
      'color_primary_count',
      'color_neutral_count',
      'color_hue_diversity',
      'color_saturation_avg',
      'color_lightness_avg',
      'color_contrast_ratio',
      'color_palette_type',
      'color_harmony_score',
      'color_dominant_hue',
      'color_saturation_range',
      'color_lightness_range',
      'color_brand_presence',
      'color_foundation_count',
      'color_brand_count',
      'color_brand_saturation',
      'color_neutral_tint',

      // Typography (16D) - lines 110-160
      'typo_family_count',
      'typo_weight_variety',
      'typo_size_scale_min',
      'typo_size_scale_max',
      'typo_line_height_avg',
      'typo_letter_spacing_avg',
      'typo_reserved_1',
      'typo_reserved_2',
      'typo_reserved_3',
      'typo_reserved_4',
      'typo_reserved_5',
      'typo_reserved_6',
      'typo_reserved_7',
      'typo_reserved_8',
      'typo_reserved_9',
      'typo_reserved_10',

      // Spacing (8D) - lines 162-193
      'spacing_scale_min',
      'spacing_scale_max',
      'spacing_consistency',
      'spacing_reserved_1',
      'spacing_reserved_2',
      'spacing_reserved_3',
      'spacing_reserved_4',
      'spacing_reserved_5',

      // Shape (8D) - lines 195-226
      'shape_radius_min',
      'shape_radius_max',
      'shape_radius_variety',
      'shape_reserved_1',
      'shape_reserved_2',
      'shape_reserved_3',
      'shape_reserved_4',
      'shape_reserved_5',

      // Brand (16D) - lines 228-329
      'brand_personality_professional',
      'brand_personality_playful',
      'brand_personality_luxurious',
      'brand_personality_energetic',
      'brand_personality_calm',
      'brand_personality_bold',
      'brand_personality_minimal',
      'brand_personality_organic',
      'brand_maturity_emerging',
      'brand_maturity_growing',
      'brand_maturity_mature',
      'brand_maturity_enterprise',
      'brand_consistency',
      'brand_complexity',
      'brand_reserved_1',
      'brand_reserved_2'
    ];

    console.log('📊 Complete 64D Vector Breakdown');
    console.log('=' .repeat(80));
    console.log('');

    // Category ranges
    const categories = [
      { name: 'Color', start: 0, end: 16, reserved: 0 },
      { name: 'Typography', start: 16, end: 32, reserved: 10 },
      { name: 'Spacing', start: 32, end: 40, reserved: 5 },
      { name: 'Shape', start: 40, end: 48, reserved: 5 },
      { name: 'Brand', start: 48, end: 64, reserved: 2 }
    ];

    let totalNonZero = 0;
    let totalZero = 0;
    let reservedZero = 0;
    let unexpectedZero = 0;

    for (const cat of categories) {
      console.log(`\n${cat.name.toUpperCase()} (${cat.end - cat.start}D)`);
      console.log('-'.repeat(80));

      let catNonZero = 0;
      let catZero = 0;
      let catReservedZero = 0;
      let catUnexpectedZero = 0;

      for (let i = cat.start; i < cat.end; i++) {
        const name = featureNames[i];
        const value = vectorArray[i];
        const isReserved = name.includes('reserved');
        const isZero = value === 0;

        if (isZero) {
          catZero++;
          totalZero++;
          if (isReserved) {
            catReservedZero++;
            reservedZero++;
            console.log(`  [${String(i).padStart(2)}] ${name.padEnd(40)} = ${value.toFixed(4)}  (reserved)`);
          } else {
            catUnexpectedZero++;
            unexpectedZero++;
            console.log(`  [${String(i).padStart(2)}] ${name.padEnd(40)} = ${value.toFixed(4)}  ⚠️  UNEXPECTED ZERO`);
          }
        } else {
          catNonZero++;
          totalNonZero++;
          console.log(`  [${String(i).padStart(2)}] ${name.padEnd(40)} = ${value.toFixed(4)}  ✅`);
        }
      }

      console.log('');
      console.log(`  ${cat.name} Summary: ${catNonZero} active, ${catZero} zero (${catReservedZero} reserved, ${catUnexpectedZero} unexpected)`);
    }

    console.log('');
    console.log('=' .repeat(80));
    console.log('OVERALL SUMMARY');
    console.log('=' .repeat(80));
    console.log(`Total Dimensions:        64`);
    console.log(`Active (non-zero):       ${totalNonZero}`);
    console.log(`Zero (total):            ${totalZero}`);
    console.log(`  - Reserved (expected): ${reservedZero}`);
    console.log(`  - Unexpected zeros:    ${unexpectedZero}`);
    console.log('');
    console.log(`Utilization: ${(totalNonZero / 64 * 100).toFixed(1)}% (${totalNonZero}/64)`);
    console.log(`Expected utilization: ${((64 - 26) / 64 * 100).toFixed(1)}% (38/64 non-reserved)`);

    if (unexpectedZero > 0) {
      console.log('');
      console.log('⚠️  ACTION REQUIRED: ' + unexpectedZero + ' non-reserved dimensions are unexpectedly zero');
      console.log('    This may indicate missing token data or vector building bugs');
    } else {
      console.log('');
      console.log('✅ All non-reserved dimensions are active (no unexpected zeros)');
    }

  } catch (error) {
    console.error('❌ Analysis failed:', error.message);
  } finally {
    const poolInstance = getPool();
    await poolInstance.end();
  }
}

analyzeVectorBreakdown();
