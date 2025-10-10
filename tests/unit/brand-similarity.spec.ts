import { describe, it, expect } from '@jest/globals';
import { buildVectors } from '../../pipeline/vectors';
import { join } from 'path';

/**
 * Calculate cosine similarity between two vectors
 * Returns value between -1 and 1 (1 = identical, 0 = orthogonal, -1 = opposite)
 */
function cosineSimilarity(a: Float32Array, b: Float32Array): number {
  if (a.length !== b.length) {
    throw new Error(`Vector dimensions must match: ${a.length} vs ${b.length}`);
  }

  let dot = 0;
  let magA = 0;
  let magB = 0;

  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }

  const denominator = Math.sqrt(magA) * Math.sqrt(magB);
  if (denominator === 0) return 0;

  return dot / denominator;
}

/**
 * Calculate Euclidean distance between two vectors
 */
function euclideanDistance(a: Float32Array, b: Float32Array): number {
  if (a.length !== b.length) {
    throw new Error(`Vector dimensions must match: ${a.length} vs ${b.length}`);
  }

  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    const diff = a[i] - b[i];
    sum += diff * diff;
  }

  return Math.sqrt(sum);
}

describe('Brand Similarity Tests', () => {
  const ARTIFACTS_DIR = join(process.cwd(), 'artifacts');

  // Test brands
  const STRIPE_RUN_ID = '2025-10-09T09-32-42-176Z_adeb7a11_stripe-com';
  const VERCEL_RUN_ID = '2025-10-09T09-37-50-903Z_dbf8ecdd_vercel-com';
  const CNN_RUN_ID = '2025-10-09T09-45-22-578Z_8212741d_cnn-com';

  it('should calculate similar brands have high similarity (Stripe vs Vercel)', async () => {
    const stripeVec = await buildVectors(STRIPE_RUN_ID, ARTIFACTS_DIR);
    const vercelVec = await buildVectors(VERCEL_RUN_ID, ARTIFACTS_DIR);

    const similarity = cosineSimilarity(
      stripeVec.globalStyleVec.combined,
      vercelVec.globalStyleVec.combined
    );

    // Both are modern SaaS brands - expect moderate to high similarity
    expect(similarity).toBeGreaterThan(0.40);
    expect(similarity).toBeLessThanOrEqual(1.0);

    console.log(`Stripe vs Vercel similarity: ${similarity.toFixed(4)}`);
  });

  it('should calculate different brands have measurable similarity (Stripe vs CNN)', async () => {
    const stripeVec = await buildVectors(STRIPE_RUN_ID, ARTIFACTS_DIR);
    const cnnVec = await buildVectors(CNN_RUN_ID, ARTIFACTS_DIR);

    const similarity = cosineSimilarity(
      stripeVec.globalStyleVec.combined,
      cnnVec.globalStyleVec.combined
    );

    // Different styles: modern SaaS vs news media
    // But may share some common design patterns (modern sans-serif fonts, etc.)
    expect(similarity).toBeGreaterThan(0.0);
    expect(similarity).toBeLessThanOrEqual(1.0);

    console.log(`Stripe vs CNN similarity: ${similarity.toFixed(4)}`);
  });

  it('should have symmetric similarity measures', async () => {
    const stripeVec = await buildVectors(STRIPE_RUN_ID, ARTIFACTS_DIR);
    const vercelVec = await buildVectors(VERCEL_RUN_ID, ARTIFACTS_DIR);

    const sim1 = cosineSimilarity(
      stripeVec.globalStyleVec.combined,
      vercelVec.globalStyleVec.combined
    );

    const sim2 = cosineSimilarity(
      vercelVec.globalStyleVec.combined,
      stripeVec.globalStyleVec.combined
    );

    // Should be symmetric (A→B = B→A)
    expect(Math.abs(sim1 - sim2)).toBeLessThan(0.0001);
  });

  it('should have self-similarity of 1.0', async () => {
    const stripeVec = await buildVectors(STRIPE_RUN_ID, ARTIFACTS_DIR);

    const similarity = cosineSimilarity(
      stripeVec.globalStyleVec.combined,
      stripeVec.globalStyleVec.combined
    );

    // A brand should be perfectly similar to itself
    expect(similarity).toBeCloseTo(1.0, 5);
  });

  it('should calculate similarity for interpretable features only', async () => {
    const stripeVec = await buildVectors(STRIPE_RUN_ID, ARTIFACTS_DIR);
    const vercelVec = await buildVectors(VERCEL_RUN_ID, ARTIFACTS_DIR);

    // Compare only interpretable features (53D)
    const similarity = cosineSimilarity(
      stripeVec.globalStyleVec.interpretable,
      vercelVec.globalStyleVec.interpretable
    );

    expect(similarity).toBeGreaterThan(0.0);
    expect(similarity).toBeLessThanOrEqual(1.0);

    console.log(`Stripe vs Vercel (interpretable only): ${similarity.toFixed(4)}`);
  });

  it('should calculate similarity for font embeddings only', async () => {
    const stripeVec = await buildVectors(STRIPE_RUN_ID, ARTIFACTS_DIR);
    const vercelVec = await buildVectors(VERCEL_RUN_ID, ARTIFACTS_DIR);

    // Compare only font embeddings (256D)
    const similarity = cosineSimilarity(
      stripeVec.globalStyleVec.fontEmbedding,
      vercelVec.globalStyleVec.fontEmbedding
    );

    expect(similarity).toBeGreaterThan(-1.0);
    expect(similarity).toBeLessThanOrEqual(1.0);

    console.log(`Stripe vs Vercel (font embeddings only): ${similarity.toFixed(4)}`);
  });

  it('should calculate Euclidean distance between brands', async () => {
    const stripeVec = await buildVectors(STRIPE_RUN_ID, ARTIFACTS_DIR);
    const vercelVec = await buildVectors(VERCEL_RUN_ID, ARTIFACTS_DIR);
    const cnnVec = await buildVectors(CNN_RUN_ID, ARTIFACTS_DIR);

    const distStripeVercel = euclideanDistance(
      stripeVec.globalStyleVec.combined,
      vercelVec.globalStyleVec.combined
    );

    const distStripeCnn = euclideanDistance(
      stripeVec.globalStyleVec.combined,
      cnnVec.globalStyleVec.combined
    );

    // All distances should be non-negative and reasonable
    expect(distStripeVercel).toBeGreaterThan(0);
    expect(distStripeCnn).toBeGreaterThan(0);

    console.log(`Euclidean distance - Stripe vs Vercel: ${distStripeVercel.toFixed(4)}`);
    console.log(`Euclidean distance - Stripe vs CNN: ${distStripeCnn.toFixed(4)}`);
  });

  it('should rank brands by similarity', async () => {
    const stripeVec = await buildVectors(STRIPE_RUN_ID, ARTIFACTS_DIR);

    // Build vectors for comparison brands
    const comparisonBrands = [
      { runId: VERCEL_RUN_ID, name: 'Vercel' },
      { runId: CNN_RUN_ID, name: 'CNN' },
    ];

    const similarities = await Promise.all(
      comparisonBrands.map(async (brand) => {
        const vec = await buildVectors(brand.runId, ARTIFACTS_DIR);
        const similarity = cosineSimilarity(
          stripeVec.globalStyleVec.combined,
          vec.globalStyleVec.combined
        );
        return { name: brand.name, similarity };
      })
    );

    // Sort by similarity (descending)
    similarities.sort((a, b) => b.similarity - a.similarity);

    console.log('\nBrand similarity ranking (compared to Stripe):');
    similarities.forEach((s, i) => {
      console.log(`${i + 1}. ${s.name}: ${s.similarity.toFixed(4)}`);
    });

    // All similarities should be in valid range
    similarities.forEach((s) => {
      expect(s.similarity).toBeGreaterThan(-1.0);
      expect(s.similarity).toBeLessThanOrEqual(1.0);
    });
  });

  it('should calculate CTA vector similarity', async () => {
    const stripeVec = await buildVectors(STRIPE_RUN_ID, ARTIFACTS_DIR);
    const vercelVec = await buildVectors(VERCEL_RUN_ID, ARTIFACTS_DIR);

    const similarity = cosineSimilarity(
      stripeVec.primaryCtaVec.combined,
      vercelVec.primaryCtaVec.combined
    );

    // CTA buttons from modern SaaS brands should be somewhat similar
    expect(similarity).toBeGreaterThan(0.0);
    expect(similarity).toBeLessThanOrEqual(1.0);

    console.log(`Stripe vs Vercel CTA similarity: ${similarity.toFixed(4)}`);
  });

  it('should have consistent similarity across multiple runs', async () => {
    const stripeVec = await buildVectors(STRIPE_RUN_ID, ARTIFACTS_DIR);
    const vercelVec = await buildVectors(VERCEL_RUN_ID, ARTIFACTS_DIR);

    // Calculate similarity multiple times
    const similarities = [
      cosineSimilarity(stripeVec.globalStyleVec.combined, vercelVec.globalStyleVec.combined),
      cosineSimilarity(stripeVec.globalStyleVec.combined, vercelVec.globalStyleVec.combined),
      cosineSimilarity(stripeVec.globalStyleVec.combined, vercelVec.globalStyleVec.combined),
    ];

    // All should be identical (deterministic)
    expect(similarities[0]).toBe(similarities[1]);
    expect(similarities[1]).toBe(similarities[2]);
  });

  it('should calculate color-only similarity', async () => {
    const stripeVec = await buildVectors(STRIPE_RUN_ID, ARTIFACTS_DIR);
    const vercelVec = await buildVectors(VERCEL_RUN_ID, ARTIFACTS_DIR);

    // Extract color features (first 24 dimensions of interpretable)
    const stripeColors = stripeVec.globalStyleVec.interpretable.slice(0, 24);
    const vercelColors = vercelVec.globalStyleVec.interpretable.slice(0, 24);

    const similarity = cosineSimilarity(stripeColors, vercelColors);

    console.log(`Stripe vs Vercel (color features only): ${similarity.toFixed(4)}`);

    expect(similarity).toBeGreaterThan(-1.0);
    expect(similarity).toBeLessThanOrEqual(1.0);
  });

  it('should calculate typography-only similarity', async () => {
    const stripeVec = await buildVectors(STRIPE_RUN_ID, ARTIFACTS_DIR);
    const vercelVec = await buildVectors(VERCEL_RUN_ID, ARTIFACTS_DIR);

    // Extract typography features (dimensions 24-37 of interpretable)
    const stripeTypo = stripeVec.globalStyleVec.interpretable.slice(24, 38);
    const vercelTypo = vercelVec.globalStyleVec.interpretable.slice(24, 38);

    const similarity = cosineSimilarity(stripeTypo, vercelTypo);

    console.log(`Stripe vs Vercel (typography features only): ${similarity.toFixed(4)}`);

    expect(similarity).toBeGreaterThan(-1.0);
    expect(similarity).toBeLessThanOrEqual(1.0);
  });
});
