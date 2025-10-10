#!/usr/bin/env node

// Load environment variables from .env.local
require('dotenv').config({ path: '.env.local' });

const { buildVisualEmbedding } = require('../dist/pipeline/vectors/visual-embedding');
const fs = require('fs');
const path = require('path');

async function testReplicateClip() {
  try {
    console.log('🧪 Testing Replicate CLIP Integration');
    console.log('=' .repeat(70));
    console.log('');

    // Check environment
    const hasToken = !!process.env.REPLICATE_API_TOKEN;
    console.log(`📋 Configuration:`);
    console.log(`   REPLICATE_API_TOKEN: ${hasToken ? '✅ Set' : '❌ Not set'}`);
    console.log('');

    if (!hasToken) {
      console.log('⚠️  No API token found - will use mock CLIP embeddings');
      console.log('');
      console.log('To use real CLIP:');
      console.log('  1. Get token from: https://replicate.com/account/api-tokens');
      console.log('  2. Add to .env.local: REPLICATE_API_TOKEN=r8_...');
      console.log('  3. Re-run this test');
      console.log('');
    }

    // Find a test capture
    const artifactsDir = path.join(process.cwd(), 'artifacts');
    const captures = fs.readdirSync(artifactsDir)
      .filter(name => name.includes('stripe') || name.includes('monzo'))
      .slice(0, 1);

    if (captures.length === 0) {
      console.log('❌ No test captures found in artifacts/');
      console.log('   Run: npm run capture -- https://stripe.com');
      return;
    }

    const runId = captures[0];
    console.log(`🎯 Testing with capture: ${runId}`);
    console.log('');

    // Test visual embedding
    console.log('🔄 Generating CLIP embedding...');
    const start = Date.now();

    const result = await buildVisualEmbedding(runId);

    const duration = Date.now() - start;

    console.log('');
    console.log('✅ Success!');
    console.log('');
    console.log('📊 Results:');
    console.log(`   Model: ${result.model}`);
    console.log(`   Dimensions: ${result.dimensions}D`);
    console.log(`   Image size: ${result.imageSize.width}x${result.imageSize.height}px`);
    console.log(`   Generation time: ${duration}ms`);
    console.log('');

    // Show embedding stats
    const embedding = result.embedding;
    const nonZero = embedding.filter(v => v !== 0).length;
    const min = Math.min(...embedding);
    const max = Math.max(...embedding);
    const avg = embedding.reduce((a, b) => a + b, 0) / embedding.length;

    console.log('🔍 Embedding Statistics:');
    console.log(`   Non-zero values: ${nonZero}/${embedding.length}`);
    console.log(`   Range: [${min.toFixed(4)}, ${max.toFixed(4)}]`);
    console.log(`   Average: ${avg.toFixed(4)}`);
    console.log('');

    if (result.model.includes('mock')) {
      console.log('💡 Using mock embeddings (deterministic hash-based)');
      console.log('   Add REPLICATE_API_TOKEN to .env.local for real CLIP');
    } else {
      console.log('🎉 Using real Replicate CLIP embeddings!');
      console.log('   Visual similarity search is now fully functional');
      console.log('');
      console.log('Next steps:');
      console.log('  - Run backfill: node scripts/backfill-visual-embeddings.js');
      console.log('  - Compare: node scripts/compare-similarity.js <url1> <url2>');
      console.log('  - Find similar: node scripts/find-similar.js <url> visual');
    }

  } catch (error) {
    console.error('');
    console.error('❌ Test failed:', error.message);
    console.error('');

    if (error.message.includes('authentication')) {
      console.error('🔧 Authentication error - check your REPLICATE_API_TOKEN');
    } else if (error.message.includes('Screenshot not found')) {
      console.error('🔧 No screenshots found - run a capture first:');
      console.error('   npm run capture -- https://stripe.com');
    }
  }
}

testReplicateClip();
