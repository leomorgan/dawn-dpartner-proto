#!/usr/bin/env node

const { query, getPool } = require('../dist/lib/db/client');

async function compareVectors() {
  try {
    // Get Stripe and FIFA profiles
    const stripeResult = await query(`
      SELECT
        c.source_url,
        sp.style_vec,
        sp.interpretable_vec
      FROM captures c
      JOIN style_profiles sp ON sp.capture_id = c.id
      WHERE c.source_url LIKE '%stripe%'
      ORDER BY sp.created_at DESC
      LIMIT 1
    `);

    const fifaResult = await query(`
      SELECT
        c.source_url,
        sp.style_vec,
        sp.interpretable_vec
      FROM captures c
      JOIN style_profiles sp ON sp.capture_id = c.id
      WHERE c.source_url LIKE '%fifa%'
      ORDER BY sp.created_at DESC
      LIMIT 1
    `);

    if (stripeResult.rows.length === 0 || fifaResult.rows.length === 0) {
      console.log('❌ Could not find both profiles');
      console.log('Stripe found:', stripeResult.rows.length);
      console.log('FIFA found:', fifaResult.rows.length);
      return;
    }

    const stripeRow = stripeResult.rows[0];
    const fifaRow = fifaResult.rows[0];

    console.log('\n📊 Comparing Layout Features');
    console.log('='.repeat(80));
    console.log('Stripe:', stripeRow.source_url);
    console.log('FIFA:', fifaRow.source_url);

    // Parse interpretable_vec which is a JSONB column
    const stripeVecData = stripeRow.interpretable_vec;
    const fifaVecData = fifaRow.interpretable_vec;

    const stripeInterpretable = stripeVecData.interpretable || [];
    const fifaInterpretable = fifaVecData.interpretable || [];
    const featureNames = stripeVecData.metadata?.featureNames || [];

    console.log('\nVector dimensions:', stripeInterpretable.length);
    console.log('Feature names count:', featureNames.length);

    // Target features
    const targetFeatures = [
      'spacing_density_score',
      'spacing_whitespace_ratio',
      'spacing_padding_consistency',
      'shape_grouping_strength',
      'shape_compositional_complexity',
      'brand_color_saturation_energy',
      'brand_color_role_distinction',
    ];

    console.log('\n' + '='.repeat(80));
    console.log('LAYOUT FEATURES COMPARISON');
    console.log('='.repeat(80));
    console.log(
      'Feature'.padEnd(40) +
        '| Stripe      | FIFA        | Δ        | Status'
    );
    console.log('-'.repeat(40) + '+-------------+-------------+----------+----------');

    for (const feat of targetFeatures) {
      const idx = featureNames.indexOf(feat);
      if (idx === -1) {
        console.log(`${feat.padEnd(40)}| NOT FOUND`);
        continue;
      }

      const stripeVal = stripeInterpretable[idx];
      const fifaVal = fifaInterpretable[idx];
      const diff = Math.abs(stripeVal - fifaVal);
      const status =
        diff > 0.1 ? '✅ GOOD' : diff > 0.01 ? '⚠️  CLOSE' : '❌ IDENTICAL';

      console.log(
        `${feat.padEnd(40)}| ${stripeVal.toFixed(6).padEnd(11)} | ${fifaVal
          .toFixed(6)
          .padEnd(11)} | ${diff.toFixed(6).padEnd(8)} | ${status}`
      );
    }

    // Show all layout-related features
    console.log('\n' + '='.repeat(80));
    console.log('ALL LAYOUT/BRAND FEATURES');
    console.log('='.repeat(80));

    for (let i = 0; i < featureNames.length; i++) {
      const name = featureNames[i];
      if (
        name.includes('spacing_') ||
        name.includes('shape_') ||
        name.includes('brand_') ||
        name.includes('typo_weight') ||
        name.includes('typo_hierarchy')
      ) {
        const stripeVal = stripeInterpretable[i];
        const fifaVal = fifaInterpretable[i];
        const diff = Math.abs(stripeVal - fifaVal);
        const status = diff > 0.1 ? '✓' : diff > 0.01 ? '~' : '✗';
        console.log(
          `[${i.toString().padStart(2)}] ${name.padEnd(40)} | ${stripeVal
            .toFixed(3)
            .padStart(7)} | ${fifaVal.toFixed(3).padStart(7)} | Δ=${diff
            .toFixed(3)
            .padStart(7)} ${status}`
        );
      }
    }

  } catch (error) {
    console.error('❌ Comparison failed:', error.message);
    console.error(error.stack);
  } finally {
    const poolInstance = getPool();
    await poolInstance.end();
  }
}

compareVectors();
