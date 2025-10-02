#!/usr/bin/env node

require('dotenv').config({ path: '.env.local' });

const { query, getPool } = require('../dist/lib/db/client');

async function compareSimilarity(url1, url2) {
  try {
    // Get both profiles
    const result = await query(`
      SELECT
        c.source_url,
        sp.id,
        sp.interpretable_vec,
        sp.visual_vec,
        sp.combined_vec,
        sp.visual_model
      FROM style_profiles sp
      JOIN captures c ON c.id = sp.capture_id
      WHERE c.source_url IN ($1, $2)
      ORDER BY c.source_url
    `, [url1, url2]);

    if (result.rows.length < 2) {
      console.log('❌ Need 2 profiles to compare');
      console.log(`   Found ${result.rows.length} profile(s)`);
      return;
    }

    const [profile1, profile2] = result.rows;

    // Handle missing visual embeddings
    if (!profile1.visual_vec || !profile2.visual_vec) {
      console.log('⚠️  One or both profiles missing visual embeddings');
      console.log(`   ${profile1.source_url}: ${profile1.visual_model || 'missing'}`);
      console.log(`   ${profile2.source_url}: ${profile2.visual_model || 'missing'}`);
    }

    // Compare using pgvector distance operators
    // <=> is the cosine distance operator (0 = identical, 2 = opposite)
    // Similarity = 1 - distance
    const similarities = await query(`
      SELECT
        1 - (v1.interpretable_vec <=> v2.interpretable_vec) as interpretable_similarity,
        CASE
          WHEN v1.visual_vec IS NOT NULL AND v2.visual_vec IS NOT NULL
          THEN 1 - (v1.visual_vec <=> v2.visual_vec)
          ELSE NULL
        END as visual_similarity,
        CASE
          WHEN v1.combined_vec IS NOT NULL AND v2.combined_vec IS NOT NULL
          THEN 1 - (v1.combined_vec <=> v2.combined_vec)
          ELSE NULL
        END as combined_similarity
      FROM
        (SELECT $1::vector(64) as interpretable_vec,
                $2::vector(768) as visual_vec,
                $3::vector(832) as combined_vec) v1,
        (SELECT $4::vector(64) as interpretable_vec,
                $5::vector(768) as visual_vec,
                $6::vector(832) as combined_vec) v2
    `, [
      profile1.interpretable_vec, profile1.visual_vec, profile1.combined_vec,
      profile2.interpretable_vec, profile2.visual_vec, profile2.combined_vec
    ]);

    const sim = similarities.rows[0];

    console.log('\n📊 Similarity Comparison');
    console.log('=' .repeat(70));
    console.log(`Site 1: ${profile1.source_url}`);
    console.log(`Site 2: ${profile2.source_url}`);
    console.log('');
    console.log('Similarity Scores:');
    console.log(`  🎨 Style Tokens (64D):     ${(sim.interpretable_similarity * 100).toFixed(1)}%`);

    if (sim.visual_similarity !== null) {
      console.log(`  👁️  Visual/CLIP (768D):     ${(sim.visual_similarity * 100).toFixed(1)}%`);
      console.log(`  🔀 Combined (832D):        ${(sim.combined_similarity * 100).toFixed(1)}%`);
    } else {
      console.log(`  👁️  Visual/CLIP (768D):     N/A (missing embeddings)`);
    }

    console.log('');

    // Interpretation
    if (sim.visual_similarity !== null) {
      const styleSim = sim.interpretable_similarity;
      const visualSim = sim.visual_similarity;

      if (styleSim > visualSim + 0.2) {
        console.log('💡 These sites have similar design tokens but different visual appearance');
        console.log('   (e.g., same colors/fonts but different layouts)');
      } else if (visualSim > styleSim + 0.2) {
        console.log('💡 These sites look visually similar but use different design tokens');
        console.log('   (e.g., similar layouts but different colors/fonts)');
      } else {
        console.log('💡 These sites are similarly aligned in both style tokens and visual appearance');
      }

      // Specific insights
      if (styleSim > 0.7) {
        console.log('   → Design system similarity is HIGH - likely same brand or style guide');
      }
      if (visualSim > 0.7) {
        console.log('   → Visual similarity is HIGH - similar composition and layout patterns');
      }
      if (styleSim < 0.3 && visualSim < 0.3) {
        console.log('   → Both scores LOW - these are distinctly different sites');
      }
    } else {
      console.log('💡 Only style token comparison available');
      console.log('   Run with --generate-visual to add CLIP embeddings');
    }

    console.log('');

  } catch (error) {
    console.error('❌ Comparison failed:', error.message);
  } finally {
    const poolInstance = getPool();
    await poolInstance.end();
  }
}

// Usage: node scripts/compare-similarity.js https://stripe.com https://monzo.com
const [, , url1, url2] = process.argv;

if (!url1 || !url2) {
  console.log('Usage: node scripts/compare-similarity.js <url1> <url2>');
  console.log('');
  console.log('Example:');
  console.log('  node scripts/compare-similarity.js https://stripe.com https://monzo.com');
  process.exit(1);
}

compareSimilarity(url1, url2);
