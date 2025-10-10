#!/usr/bin/env ts-node

/**
 * Verification script to audit new vector encoding
 * Checks dimensions, feature calculations, and CIEDE2000 color distances
 */

import { getPool } from '../lib/db/client';

async function verifyVectors() {
  const pool = getPool();

  console.log('🔍 Vector Verification Audit\n');
  console.log('='.repeat(70));

  // 1. Check database vector dimensions
  console.log('\n📊 1. DATABASE SCHEMA VERIFICATION');
  console.log('-'.repeat(70));

  const schemaQuery = `
    SELECT
      column_name,
      udt_name,
      col_description('style_profiles'::regclass, ordinal_position) as description
    FROM information_schema.columns
    WHERE table_name = 'style_profiles'
      AND column_name LIKE '%vec%'
    ORDER BY ordinal_position;
  `;

  const schemaResult = await pool.query(schemaQuery);
  console.log('\nStyle Profiles Vector Columns:');
  schemaResult.rows.forEach(row => {
    console.log(`  - ${row.column_name}: ${row.udt_name}`);
  });

  // Check CTA vec
  const ctaSchemaQuery = `
    SELECT
      column_name,
      udt_name,
      col_description('role_vectors_primarycta'::regclass, ordinal_position) as description
    FROM information_schema.columns
    WHERE table_name = 'role_vectors_primarycta'
      AND column_name = 'vec';
  `;

  const ctaSchemaResult = await pool.query(ctaSchemaQuery);
  console.log('\nCTA Vector Column:');
  ctaSchemaResult.rows.forEach(row => {
    console.log(`  - ${row.column_name}: ${row.udt_name}`);
  });

  // 2. Check actual stored vector dimensions
  console.log('\n\n📏 2. STORED VECTOR DIMENSIONS');
  console.log('-'.repeat(70));

  const countQuery = `SELECT COUNT(*) as count FROM style_profiles`;
  const countResult = await pool.query(countQuery);
  const profileCount = parseInt(countResult.rows[0].count);

  console.log(`\nFound ${profileCount} style profiles in database`);

  if (profileCount > 0) {
    const vectorQuery = `
      SELECT
        source_url,
        array_length(interpretable_vec::float[], 1) as interpretable_dim,
        array_length(font_embedding_vec::float[], 1) as font_dim,
        array_length(combined_vec::float[], 1) as combined_dim
      FROM style_profiles
      LIMIT 5;
    `;

    const vectorResult = await pool.query(vectorQuery);
    console.log('\nVector Dimensions (first 5 profiles):');
    vectorResult.rows.forEach(row => {
      console.log(`\n  ${row.source_url}:`);
      console.log(`    - Interpretable: ${row.interpretable_dim}D (expected: 53D)`);
      console.log(`    - Font Embedding: ${row.font_dim}D (expected: 256D)`);
      console.log(`    - Combined: ${row.combined_dim}D (expected: 309D)`);

      // Validation
      const interpretableOK = row.interpretable_dim === 53 ? '✅' : '❌';
      const fontOK = row.font_dim === 256 ? '✅' : '❌';
      const combinedOK = row.combined_dim === 309 ? '✅' : '❌';
      console.log(`    Status: ${interpretableOK} ${fontOK} ${combinedOK}`);
    });

    // Check CTA vectors
    const ctaQuery = `
      SELECT
        sp.source_url,
        array_length(cta.vec::float[], 1) as cta_dim
      FROM role_vectors_primarycta cta
      JOIN style_profiles sp ON sp.id = cta.style_profile_id
      LIMIT 5;
    `;

    const ctaResult = await pool.query(ctaQuery);
    if (ctaResult.rows.length > 0) {
      console.log('\nCTA Vector Dimensions (first 5):');
      ctaResult.rows.forEach(row => {
        const ctaOK = row.cta_dim === 26 ? '✅' : '❌';
        console.log(`  ${row.source_url}: ${row.cta_dim}D (expected: 26D) ${ctaOK}`);
      });
    }

    // 3. Feature statistics
    console.log('\n\n📈 3. FEATURE STATISTICS');
    console.log('-'.repeat(70));

    const statsQuery = `
      SELECT
        source_url,
        interpretable_vec::float[] as vec
      FROM style_profiles
      WHERE interpretable_vec IS NOT NULL
      LIMIT 3;
    `;

    const statsResult = await pool.query(statsQuery);

    console.log('\nFeature Value Ranges (first 3 profiles):');
    statsResult.rows.forEach(row => {
      const vec: number[] = row.vec;
      console.log(`\n  ${row.source_url}:`);
      console.log(`    - Min value: ${Math.min(...vec).toFixed(4)}`);
      console.log(`    - Max value: ${Math.max(...vec).toFixed(4)}`);
      console.log(`    - Mean: ${(vec.reduce((a,b) => a+b, 0) / vec.length).toFixed(4)}`);
      console.log(`    - Non-zero: ${vec.filter(v => v !== 0).length}/${vec.length}`);

      // Check first 17 features (color encoding)
      const colorFeatures = vec.slice(0, 17);
      console.log(`    - Color features (0-16):`);
      console.log(`      Min: ${Math.min(...colorFeatures).toFixed(4)}, Max: ${Math.max(...colorFeatures).toFixed(4)}`);

      // Check normalization (should be mostly 0-1 range, except hue cos/sin which are -1 to 1)
      const outOfRange = vec.filter((v, i) => {
        // Allow -1 to 1 for hue features (indices with cos/sin)
        if (i >= 10 && i <= 16) return v < -1.1 || v > 1.1; // Color hue features
        return v < -0.1 || v > 1.1; // Other features should be 0-1
      });

      if (outOfRange.length > 0) {
        console.log(`    ⚠️  Warning: ${outOfRange.length} features out of expected range`);
      } else {
        console.log(`    ✅ All features within expected ranges`);
      }
    });

    // 4. Color encoding verification (CIEDE2000 distances)
    console.log('\n\n🎨 4. COLOR ENCODING VERIFICATION');
    console.log('-'.repeat(70));

    console.log('\nFirst 17 features are CIEDE2000-based palette encoding:');
    console.log('  - Features 0-2: Brand palette relationships (avg/min/max pairwise distances)');
    console.log('  - Features 3-6: Semantic relationships (bg-text, cta-bg, cta-text, hero-bg)');
    console.log('  - Features 7-9: Background absolute (L, C, reserved)');
    console.log('  - Features 10-13: Hero color absolute (L, C, hue cos, hue sin)');
    console.log('  - Features 14-16: CTA color (L, C, distance from hero)');

    // Show first profile's color features in detail
    if (statsResult.rows.length > 0) {
      const firstVec: number[] = statsResult.rows[0].vec;
      const colorFeats = firstVec.slice(0, 17);

      console.log(`\n  ${statsResult.rows[0].source_url} color features:`);
      console.log(`    Palette relationships: ${colorFeats.slice(0,3).map(v => v.toFixed(3)).join(', ')}`);
      console.log(`    Semantic distances:    ${colorFeats.slice(3,7).map(v => v.toFixed(3)).join(', ')}`);
      console.log(`    Background (L,C):      ${colorFeats.slice(7,9).map(v => v.toFixed(3)).join(', ')}`);
      console.log(`    Hero (L,C,h_cos,sin):  ${colorFeats.slice(9,13).map(v => v.toFixed(3)).join(', ')}`);
      console.log(`    CTA (L,C,dist):        ${colorFeats.slice(14,17).map(v => v.toFixed(3)).join(', ')}`);
    }

    // 5. Brand similarity test
    console.log('\n\n🔬 5. BRAND SIMILARITY TEST');
    console.log('-'.repeat(70));

    if (profileCount >= 2) {
      const simQuery = `
        WITH profiles AS (
          SELECT id, source_url, interpretable_vec
          FROM style_profiles
          WHERE interpretable_vec IS NOT NULL
          LIMIT 3
        )
        SELECT
          p1.source_url as url1,
          p2.source_url as url2,
          1 - (p1.interpretable_vec <=> p2.interpretable_vec) as similarity
        FROM profiles p1
        CROSS JOIN profiles p2
        WHERE p1.id != p2.id
        ORDER BY similarity DESC;
      `;

      const simResult = await pool.query(simQuery);
      console.log('\nPairwise Brand Similarity (cosine similarity):');
      simResult.rows.forEach(row => {
        console.log(`  ${row.url1}`);
        console.log(`    vs ${row.url2}`);
        console.log(`    → Similarity: ${(row.similarity * 100).toFixed(2)}%\n`);
      });
    }

  } else {
    console.log('\n⚠️  No style profiles found in database. Run full-ingest first.');
  }

  // 6. Summary
  console.log('\n' + '='.repeat(70));
  console.log('📋 VERIFICATION SUMMARY');
  console.log('='.repeat(70));
  console.log('\n✅ Verification complete!');
  console.log('\nExpected dimensions:');
  console.log('  - Global interpretable: 53D');
  console.log('  - Global font embedding: 256D');
  console.log('  - Global combined: 309D');
  console.log('  - Primary CTA: 26D');

  await pool.end();
}

verifyVectors().catch(error => {
  console.error('❌ Verification failed:', error);
  process.exit(1);
});
