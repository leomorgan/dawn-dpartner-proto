import { describe, it, expect } from '@jest/globals';
import { buildVectors } from '../../pipeline/vectors';
import { join } from 'path';

describe('Vector Build Tests', () => {
  const STRIPE_RUN_ID = '2025-10-09T09-32-42-176Z_adeb7a11_stripe-com';
  const ARTIFACTS_DIR = join(process.cwd(), 'artifacts');

  it('should build vectors for Stripe with correct dimensions', async () => {
    const result = await buildVectors(STRIPE_RUN_ID, ARTIFACTS_DIR);

    // Verify run ID
    expect(result.runId).toBe(STRIPE_RUN_ID);

    // Verify global vector dimensions
    expect(result.globalStyleVec.interpretable.length).toBe(84);
    expect(result.globalStyleVec.fontEmbedding.length).toBe(256);
    expect(result.globalStyleVec.combined.length).toBe(340);

    // Verify CTA vector dimensions
    expect(result.primaryCtaVec.interpretable.length).toBe(24);
    expect(result.primaryCtaVec.combined.length).toBe(24);
  });

  it('should have all feature values in valid range', async () => {
    const result = await buildVectors(STRIPE_RUN_ID, ARTIFACTS_DIR);

    // Check interpretable features (most should be 0-1, some circular encoding -1 to 1)
    const interpretable = Array.from(result.globalStyleVec.interpretable);

    for (let i = 0; i < interpretable.length; i++) {
      const value = interpretable[i];
      const featureName = result.globalStyleVec.metadata.featureNames[i];

      // Circular encoding features (cos/sin) can be -1 to 1
      if (featureName.includes('_cos') || featureName.includes('_sin')) {
        expect(value).toBeGreaterThanOrEqual(-1);
        expect(value).toBeLessThanOrEqual(1);
      } else {
        // All other features should be 0-1
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThanOrEqual(1);
      }
    }

    // Check font embedding (can be any normalized value, typically -1 to 1 for embeddings)
    const fontEmb = Array.from(result.globalStyleVec.fontEmbedding);
    for (const value of fontEmb) {
      expect(Number.isFinite(value)).toBe(true);
      // OpenAI embeddings are typically normalized but can have various ranges
      expect(Math.abs(value)).toBeLessThan(10); // Sanity check
    }
  });

  it('should have no NaN or Infinity values', async () => {
    const result = await buildVectors(STRIPE_RUN_ID, ARTIFACTS_DIR);

    // Check interpretable
    const interpretable = Array.from(result.globalStyleVec.interpretable);
    for (const value of interpretable) {
      expect(Number.isFinite(value)).toBe(true);
      expect(Number.isNaN(value)).toBe(false);
    }

    // Check font embedding
    const fontEmb = Array.from(result.globalStyleVec.fontEmbedding);
    for (const value of fontEmb) {
      expect(Number.isFinite(value)).toBe(true);
      expect(Number.isNaN(value)).toBe(false);
    }

    // Check combined
    const combined = Array.from(result.globalStyleVec.combined);
    for (const value of combined) {
      expect(Number.isFinite(value)).toBe(true);
      expect(Number.isNaN(value)).toBe(false);
    }

    // Check CTA
    const cta = Array.from(result.primaryCtaVec.combined);
    for (const value of cta) {
      expect(Number.isFinite(value)).toBe(true);
      expect(Number.isNaN(value)).toBe(false);
    }
  });

  it('should include fontDescription in metadata', async () => {
    const result = await buildVectors(STRIPE_RUN_ID, ARTIFACTS_DIR);

    expect(result.globalStyleVec.metadata.fontDescription).toBeDefined();
    expect(typeof result.globalStyleVec.metadata.fontDescription).toBe('string');
    expect(result.globalStyleVec.metadata.fontDescription.length).toBeGreaterThan(0);

    // Should contain font family information
    expect(result.globalStyleVec.metadata.fontDescription.toLowerCase()).toMatch(
      /primary typeface|font|typeface/i
    );
  });

  it('should have feature names array matching dimensions', async () => {
    const result = await buildVectors(STRIPE_RUN_ID, ARTIFACTS_DIR);

    // Global interpretable features
    expect(result.globalStyleVec.metadata.featureNames.length).toBe(84);

    // Verify some expected feature names
    const featureNames = result.globalStyleVec.metadata.featureNames;
    expect(featureNames).toContain('brand_color_1_l');
    expect(featureNames).toContain('brand_color_1_c');
    expect(featureNames).toContain('brand_color_1_h_cos');
    expect(featureNames).toContain('brand_color_1_h_sin');
    expect(featureNames).toContain('font_size_min');
    expect(featureNames).toContain('font_weight_max');
    expect(featureNames).toContain('spacing_consistency');
    expect(featureNames).toContain('visual_density');
    expect(featureNames).toContain('radius_median');
    expect(featureNames).toContain('tone_professional_playful');
  });

  it('should have non-zero count metadata', async () => {
    const result = await buildVectors(STRIPE_RUN_ID, ARTIFACTS_DIR);

    expect(result.globalStyleVec.metadata.nonZeroCount).toBeGreaterThan(0);
    expect(result.globalStyleVec.metadata.nonZeroCount).toBeLessThanOrEqual(84);

    // Most features should have values (not all zeros)
    expect(result.globalStyleVec.metadata.nonZeroCount).toBeGreaterThan(50);
  });

  it('should return valid tokens and report', async () => {
    const result = await buildVectors(STRIPE_RUN_ID, ARTIFACTS_DIR);

    // Verify tokens structure
    expect(result.tokens).toBeDefined();
    expect(result.tokens.colors).toBeDefined();
    expect(result.tokens.typography).toBeDefined();
    expect(result.tokens.spacing).toBeDefined();

    // Verify report structure
    expect(result.report).toBeDefined();
    expect(result.report.brandPersonality).toBeDefined();
    expect(result.report.realTokenMetrics).toBeDefined();
  });

  it('should build vectors for multiple brands consistently', async () => {
    const brands = [
      '2025-10-09T09-32-42-176Z_adeb7a11_stripe-com',
      '2025-10-09T09-37-50-903Z_dbf8ecdd_vercel-com'
    ];

    for (const runId of brands) {
      const result = await buildVectors(runId, ARTIFACTS_DIR);

      // Verify dimensions
      expect(result.globalStyleVec.combined.length).toBe(340);
      expect(result.primaryCtaVec.combined.length).toBe(24);

      // Verify no invalid values
      const combined = Array.from(result.globalStyleVec.combined);
      for (const value of combined) {
        expect(Number.isFinite(value)).toBe(true);
      }
    }
  });

  it('should handle color features correctly (first 24 dimensions)', async () => {
    const result = await buildVectors(STRIPE_RUN_ID, ARTIFACTS_DIR);

    const colorFeatures = Array.from(result.globalStyleVec.interpretable.slice(0, 24));

    // First 20 dimensions: 5 colors × 4 features (l, c, h_cos, h_sin)
    for (let i = 0; i < 20; i += 4) {
      const l = colorFeatures[i];
      const c = colorFeatures[i + 1];
      const h_cos = colorFeatures[i + 2];
      const h_sin = colorFeatures[i + 3];

      // L and C should be 0-1
      expect(l).toBeGreaterThanOrEqual(0);
      expect(l).toBeLessThanOrEqual(1);
      expect(c).toBeGreaterThanOrEqual(0);
      expect(c).toBeLessThanOrEqual(1);

      // h_cos and h_sin should be -1 to 1
      expect(h_cos).toBeGreaterThanOrEqual(-1);
      expect(h_cos).toBeLessThanOrEqual(1);
      expect(h_sin).toBeGreaterThanOrEqual(-1);
      expect(h_sin).toBeLessThanOrEqual(1);
    }

    // Last 4 dimensions: color stats
    const colorHarmony = colorFeatures[20];
    const colorSaturationMean = colorFeatures[21];
    const dominantHueCos = colorFeatures[22];
    const dominantHueSin = colorFeatures[23];

    expect(colorHarmony).toBeGreaterThanOrEqual(0);
    expect(colorHarmony).toBeLessThanOrEqual(1);
    expect(colorSaturationMean).toBeGreaterThanOrEqual(0);
    expect(colorSaturationMean).toBeLessThanOrEqual(1);
    expect(dominantHueCos).toBeGreaterThanOrEqual(-1);
    expect(dominantHueCos).toBeLessThanOrEqual(1);
    expect(dominantHueSin).toBeGreaterThanOrEqual(-1);
    expect(dominantHueSin).toBeLessThanOrEqual(1);
  });
});
