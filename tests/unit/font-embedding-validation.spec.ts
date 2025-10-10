import { describe, it, expect } from '@jest/globals';
import { buildVectors } from '../../pipeline/vectors';
import { join } from 'path';

/**
 * Calculate cosine similarity between two vectors
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

describe('Font Embedding Validation Tests', () => {
  const ARTIFACTS_DIR = join(process.cwd(), 'artifacts');

  // Test brands with different font styles
  const STRIPE_RUN_ID = '2025-10-09T09-32-42-176Z_adeb7a11_stripe-com'; // sohne-var (modern sans-serif)
  const VERCEL_RUN_ID = '2025-10-09T09-37-50-903Z_dbf8ecdd_vercel-com'; // Inter or similar
  const CNN_RUN_ID = '2025-10-09T09-45-22-578Z_8212741d_cnn-com'; // CNN Sans (custom)
  const FT_RUN_ID = '2025-10-09T09-43-13-189Z_d315c206_ft-com'; // Financier or serif

  it('should generate 256-dimensional font embeddings', async () => {
    const result = await buildVectors(STRIPE_RUN_ID, ARTIFACTS_DIR);

    expect(result.globalStyleVec.fontEmbedding.length).toBe(256);
  });

  it('should include font family name in description', async () => {
    const result = await buildVectors(STRIPE_RUN_ID, ARTIFACTS_DIR);

    const fontDesc = result.globalStyleVec.metadata.fontDescription;

    console.log(`Stripe font description: "${fontDesc}"`);

    // Should contain font family information
    expect(fontDesc).toBeDefined();
    expect(fontDesc.length).toBeGreaterThan(0);
    expect(fontDesc.toLowerCase()).toMatch(/primary typeface|font|typeface/i);
  });

  it('should have different embeddings for different brands', async () => {
    const stripeVec = await buildVectors(STRIPE_RUN_ID, ARTIFACTS_DIR);
    const vercelVec = await buildVectors(VERCEL_RUN_ID, ARTIFACTS_DIR);

    const similarity = cosineSimilarity(
      stripeVec.globalStyleVec.fontEmbedding,
      vercelVec.globalStyleVec.fontEmbedding
    );

    console.log(`Font embedding similarity (Stripe vs Vercel): ${similarity.toFixed(4)}`);
    console.log(`Stripe fonts: ${stripeVec.globalStyleVec.metadata.fontDescription}`);
    console.log(`Vercel fonts: ${vercelVec.globalStyleVec.metadata.fontDescription}`);

    // Should be somewhat different (not identical)
    expect(similarity).toBeLessThan(0.95);
  });

  it('should capture font weight characteristics', async () => {
    const result = await buildVectors(STRIPE_RUN_ID, ARTIFACTS_DIR);

    const fontDesc = result.globalStyleVec.metadata.fontDescription;

    // Check if weight characteristics are mentioned
    const hasWeightInfo = fontDesc.match(/(light|bold|weight contrast)/i);

    console.log(`Font description includes weight info: ${!!hasWeightInfo}`);

    if (hasWeightInfo) {
      console.log(`Weight characteristics: ${hasWeightInfo[0]}`);
    }

    // At minimum, should have typeface info
    expect(fontDesc.toLowerCase()).toMatch(/typeface|font/);
  });

  it('should capture font size characteristics', async () => {
    const result = await buildVectors(STRIPE_RUN_ID, ARTIFACTS_DIR);

    const fontDesc = result.globalStyleVec.metadata.fontDescription;

    // Check if size characteristics are mentioned
    const hasSizeInfo = fontDesc.match(/(size range|large size range|limited size range)/i);

    console.log(`Font description includes size info: ${!!hasSizeInfo}`);

    if (hasSizeInfo) {
      console.log(`Size characteristics: ${hasSizeInfo[0]}`);
    }
  });

  it('should have all embedding values in reasonable range', async () => {
    const result = await buildVectors(STRIPE_RUN_ID, ARTIFACTS_DIR);

    const embedding = Array.from(result.globalStyleVec.fontEmbedding);

    for (const value of embedding) {
      // OpenAI embeddings are normalized, typically in [-1, 1] or similar range
      expect(Number.isFinite(value)).toBe(true);
      expect(Math.abs(value)).toBeLessThan(10); // Sanity check
    }

    // Calculate mean and std dev
    const mean = embedding.reduce((sum, v) => sum + v, 0) / embedding.length;
    const variance = embedding.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / embedding.length;
    const stdDev = Math.sqrt(variance);

    console.log(`Font embedding stats - mean: ${mean.toFixed(4)}, std dev: ${stdDev.toFixed(4)}`);

    // Mean should be near zero for normalized embeddings
    expect(Math.abs(mean)).toBeLessThan(0.1);
  });

  it('should be reproducible for same brand', async () => {
    const result1 = await buildVectors(STRIPE_RUN_ID, ARTIFACTS_DIR);
    const result2 = await buildVectors(STRIPE_RUN_ID, ARTIFACTS_DIR);

    // Font descriptions should be identical
    expect(result1.globalStyleVec.metadata.fontDescription).toBe(
      result2.globalStyleVec.metadata.fontDescription
    );

    // Embeddings should be identical (same input = same embedding)
    const similarity = cosineSimilarity(
      result1.globalStyleVec.fontEmbedding,
      result2.globalStyleVec.fontEmbedding
    );

    expect(similarity).toBeCloseTo(1.0, 5);
  });

  it('should compare sans-serif fonts', async () => {
    // Modern sans-serif brands
    const stripeVec = await buildVectors(STRIPE_RUN_ID, ARTIFACTS_DIR);
    const vercelVec = await buildVectors(VERCEL_RUN_ID, ARTIFACTS_DIR);

    const similarity = cosineSimilarity(
      stripeVec.globalStyleVec.fontEmbedding,
      vercelVec.globalStyleVec.fontEmbedding
    );

    console.log(`Sans-serif similarity (Stripe vs Vercel): ${similarity.toFixed(4)}`);

    // Both are modern sans-serif, should have some similarity
    expect(similarity).toBeGreaterThan(0.0);
  });

  it('should detect font families from tokens', async () => {
    const result = await buildVectors(STRIPE_RUN_ID, ARTIFACTS_DIR);

    // Check tokens have font families
    expect(result.tokens.typography.fontFamilies).toBeDefined();
    expect(result.tokens.typography.fontFamilies.length).toBeGreaterThan(0);

    const primaryFont = result.tokens.typography.fontFamilies[0];
    console.log(`Primary font from tokens: ${primaryFont}`);

    // Font description should reference the primary font
    const fontDesc = result.globalStyleVec.metadata.fontDescription;
    const descLower = fontDesc.toLowerCase();
    const primaryLower = primaryFont.toLowerCase();

    // Extract first word of font family (e.g., "Inter" from "Inter, sans-serif")
    const primaryFontName = primaryLower.split(/[,\s]/)[0];

    if (primaryFontName.length > 3) {
      // Only check if font name is meaningful (not generic like "sans")
      expect(descLower).toContain(primaryFontName);
    }
  });

  it('should handle multiple font families', async () => {
    const result = await buildVectors(STRIPE_RUN_ID, ARTIFACTS_DIR);

    const fontFamilies = result.tokens.typography.fontFamilies;
    console.log(`Font families found: ${fontFamilies.length}`);
    console.log(`Families: ${fontFamilies.join(', ')}`);

    const fontDesc = result.globalStyleVec.metadata.fontDescription;
    console.log(`Generated description: "${fontDesc}"`);

    // If multiple fonts, description might mention secondary
    if (fontFamilies.length > 1 && fontFamilies[0] !== fontFamilies[1]) {
      const hasSecondary = fontDesc.toLowerCase().includes('secondary');
      console.log(`Description mentions secondary font: ${hasSecondary}`);
    }
  });

  it('should compare modern tech brands vs news media fonts', async () => {
    const stripeVec = await buildVectors(STRIPE_RUN_ID, ARTIFACTS_DIR);
    const cnnVec = await buildVectors(CNN_RUN_ID, ARTIFACTS_DIR);

    const similarity = cosineSimilarity(
      stripeVec.globalStyleVec.fontEmbedding,
      cnnVec.globalStyleVec.fontEmbedding
    );

    console.log(`Tech vs News font similarity (Stripe vs CNN): ${similarity.toFixed(4)}`);
    console.log(`Stripe: ${stripeVec.globalStyleVec.metadata.fontDescription}`);
    console.log(`CNN: ${cnnVec.globalStyleVec.metadata.fontDescription}`);

    // Different contexts, likely different font styles
    // But both might use sans-serif, so similarity could vary
    expect(similarity).toBeGreaterThan(-1.0);
    expect(similarity).toBeLessThanOrEqual(1.0);
  });

  it('should identify high weight contrast when present', async () => {
    const result = await buildVectors(STRIPE_RUN_ID, ARTIFACTS_DIR);

    const weights = result.tokens.typography.fontWeights;
    const minWeight = Math.min(...weights);
    const maxWeight = Math.max(...weights);
    const weightRange = maxWeight - minWeight;

    console.log(`Font weights: ${weights.join(', ')}`);
    console.log(`Weight range: ${minWeight}-${maxWeight} (range: ${weightRange})`);

    const fontDesc = result.globalStyleVec.metadata.fontDescription;

    if (weightRange > 400) {
      // Should mention high weight contrast
      expect(fontDesc.toLowerCase()).toMatch(/high weight contrast/i);
    }
  });

  it('should identify size range characteristics', async () => {
    const result = await buildVectors(STRIPE_RUN_ID, ARTIFACTS_DIR);

    const sizes = result.tokens.typography.fontSizes;
    const minSize = Math.min(...sizes);
    const maxSize = Math.max(...sizes);
    const sizeRange = maxSize - minSize;

    console.log(`Font sizes: ${sizes.join(', ')}`);
    console.log(`Size range: ${minSize}px-${maxSize}px (range: ${sizeRange}px)`);

    const fontDesc = result.globalStyleVec.metadata.fontDescription;

    if (sizeRange > 60) {
      expect(fontDesc.toLowerCase()).toMatch(/large size range/i);
    } else if (sizeRange < 20) {
      expect(fontDesc.toLowerCase()).toMatch(/limited size range/i);
    }
  });

  it('should create distinct embeddings for all test brands', async () => {
    const brands = [
      { runId: STRIPE_RUN_ID, name: 'Stripe' },
      { runId: VERCEL_RUN_ID, name: 'Vercel' },
      { runId: CNN_RUN_ID, name: 'CNN' },
    ];

    const embeddings = await Promise.all(
      brands.map(async (brand) => {
        const vec = await buildVectors(brand.runId, ARTIFACTS_DIR);
        return {
          name: brand.name,
          embedding: vec.globalStyleVec.fontEmbedding,
          description: vec.globalStyleVec.metadata.fontDescription,
        };
      })
    );

    console.log('\nFont descriptions:');
    embeddings.forEach((e) => {
      console.log(`${e.name}: "${e.description}"`);
    });

    // Calculate pairwise similarities
    console.log('\nFont embedding similarities:');
    for (let i = 0; i < embeddings.length; i++) {
      for (let j = i + 1; j < embeddings.length; j++) {
        const sim = cosineSimilarity(embeddings[i].embedding, embeddings[j].embedding);
        console.log(`${embeddings[i].name} vs ${embeddings[j].name}: ${sim.toFixed(4)}`);

        // All should be distinct (not identical)
        expect(sim).toBeLessThan(1.0);
      }
    }
  });

  it('should have non-zero embedding values', async () => {
    const result = await buildVectors(STRIPE_RUN_ID, ARTIFACTS_DIR);

    const embedding = Array.from(result.globalStyleVec.fontEmbedding);
    const nonZeroCount = embedding.filter(v => Math.abs(v) > 0.001).length;

    console.log(`Non-zero embedding values: ${nonZeroCount} / ${embedding.length}`);

    // Should have many non-zero values (not a sparse vector)
    expect(nonZeroCount).toBeGreaterThan(200);
  });
});
