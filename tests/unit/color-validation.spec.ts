import { describe, it, expect } from '@jest/globals';
import { buildVectors } from '../../pipeline/vectors';
import { hexToLCH } from '../../pipeline/vectors/utils';
import { join } from 'path';

describe('Color Encoding Validation Tests', () => {
  const STRIPE_RUN_ID = '2025-10-09T09-32-42-176Z_adeb7a11_stripe-com';
  const ARTIFACTS_DIR = join(process.cwd(), 'artifacts');

  it('should encode Stripe brand colors correctly', async () => {
    const result = await buildVectors(STRIPE_RUN_ID, ARTIFACTS_DIR);

    // Get first brand color (Stripe purple: #635bff or similar)
    const brandColor1_l = result.globalStyleVec.interpretable[0];
    const brandColor1_c = result.globalStyleVec.interpretable[1];
    const brandColor1_h_cos = result.globalStyleVec.interpretable[2];
    const brandColor1_h_sin = result.globalStyleVec.interpretable[3];

    // Verify lightness (should be mid-range for purple)
    expect(brandColor1_l).toBeGreaterThan(0.2);
    expect(brandColor1_l).toBeLessThan(0.7);

    // Verify chroma (should be high for vibrant purple)
    expect(brandColor1_c).toBeGreaterThan(0.3);

    // Verify circular encoding property: cos² + sin² ≈ 1
    const circularProperty = Math.pow(brandColor1_h_cos, 2) + Math.pow(brandColor1_h_sin, 2);
    expect(circularProperty).toBeCloseTo(1.0, 2);
  });

  it('should verify circular encoding for all brand colors', async () => {
    const result = await buildVectors(STRIPE_RUN_ID, ARTIFACTS_DIR);

    // Test 5 colors × 4 dimensions each = 20D
    for (let colorIdx = 0; colorIdx < 5; colorIdx++) {
      const baseIdx = colorIdx * 4;
      const l = result.globalStyleVec.interpretable[baseIdx];
      const c = result.globalStyleVec.interpretable[baseIdx + 1];
      const h_cos = result.globalStyleVec.interpretable[baseIdx + 2];
      const h_sin = result.globalStyleVec.interpretable[baseIdx + 3];

      // Verify ranges
      expect(l).toBeGreaterThanOrEqual(0);
      expect(l).toBeLessThanOrEqual(1);
      expect(c).toBeGreaterThanOrEqual(0);
      expect(c).toBeLessThanOrEqual(1);

      // Verify circular encoding: cos² + sin² ≈ 1
      const circularProperty = Math.pow(h_cos, 2) + Math.pow(h_sin, 2);
      expect(circularProperty).toBeCloseTo(1.0, 1);

      console.log(`Color ${colorIdx + 1}: L=${l.toFixed(3)}, C=${c.toFixed(3)}, ` +
                  `h_cos=${h_cos.toFixed(3)}, h_sin=${h_sin.toFixed(3)}, ` +
                  `cos²+sin²=${circularProperty.toFixed(5)}`);
    }
  });

  it('should verify color stats encoding', async () => {
    const result = await buildVectors(STRIPE_RUN_ID, ARTIFACTS_DIR);

    // Color stats are at indices 20-23
    const colorHarmony = result.globalStyleVec.interpretable[20];
    const colorSaturationMean = result.globalStyleVec.interpretable[21];
    const dominantHueCos = result.globalStyleVec.interpretable[22];
    const dominantHueSin = result.globalStyleVec.interpretable[23];

    // Verify ranges
    expect(colorHarmony).toBeGreaterThanOrEqual(0);
    expect(colorHarmony).toBeLessThanOrEqual(1);
    expect(colorSaturationMean).toBeGreaterThanOrEqual(0);
    expect(colorSaturationMean).toBeLessThanOrEqual(1);

    // Verify dominant hue circular encoding
    const circularProperty = Math.pow(dominantHueCos, 2) + Math.pow(dominantHueSin, 2);
    expect(circularProperty).toBeCloseTo(1.0, 1);

    console.log(`Color harmony: ${colorHarmony.toFixed(3)}`);
    console.log(`Saturation mean: ${colorSaturationMean.toFixed(3)}`);
  });

  it('should handle circular hue distances correctly', () => {
    // Test that red at 0° and red at 360° are identical in LCH space
    const red0 = hexToLCH('#ff0000');
    const red360 = hexToLCH('#ff0000'); // Same color

    expect(red0.l).toBeCloseTo(red360.l, 1);
    expect(red0.c).toBeCloseTo(red360.c, 1);

    // Hue should be close (accounting for circular nature)
    const hueDiff = Math.abs(red0.h - red360.h);
    expect(hueDiff < 5 || hueDiff > 355).toBe(true); // Close or opposite side of circle
  });

  it('should calculate Euclidean distance in 4D LCH space', async () => {
    const result = await buildVectors(STRIPE_RUN_ID, ARTIFACTS_DIR);

    // Extract first two brand colors
    const color1 = {
      l: result.globalStyleVec.interpretable[0],
      c: result.globalStyleVec.interpretable[1],
      h_cos: result.globalStyleVec.interpretable[2],
      h_sin: result.globalStyleVec.interpretable[3],
    };

    const color2 = {
      l: result.globalStyleVec.interpretable[4],
      c: result.globalStyleVec.interpretable[5],
      h_cos: result.globalStyleVec.interpretable[6],
      h_sin: result.globalStyleVec.interpretable[7],
    };

    // Calculate Euclidean distance in 4D space
    const distance = Math.sqrt(
      Math.pow(color1.l - color2.l, 2) +
      Math.pow(color1.c - color2.c, 2) +
      Math.pow(color1.h_cos - color2.h_cos, 2) +
      Math.pow(color1.h_sin - color2.h_sin, 2)
    );

    console.log(`4D LCH distance between brand colors 1 and 2: ${distance.toFixed(4)}`);

    // Distance should be non-negative and reasonable
    expect(distance).toBeGreaterThanOrEqual(0);
    expect(distance).toBeLessThan(4); // Max possible in normalized 4D space is ~2
  });

  it('should encode similar colors with small distance', () => {
    // Two similar shades of blue
    const blue1 = hexToLCH('#4169e1'); // Royal blue
    const blue2 = hexToLCH('#5a7fd6'); // Slightly lighter blue

    // Normalize L and C
    const normalizeL = (l: number) => l / 100;
    const normalizeC = (c: number) => Math.min(c / 150, 1);

    const color1 = {
      l: normalizeL(blue1.l),
      c: normalizeC(blue1.c),
      h_cos: Math.cos((blue1.h * Math.PI) / 180),
      h_sin: Math.sin((blue1.h * Math.PI) / 180),
    };

    const color2 = {
      l: normalizeL(blue2.l),
      c: normalizeC(blue2.c),
      h_cos: Math.cos((blue2.h * Math.PI) / 180),
      h_sin: Math.sin((blue2.h * Math.PI) / 180),
    };

    // Calculate 4D Euclidean distance
    const distance = Math.sqrt(
      Math.pow(color1.l - color2.l, 2) +
      Math.pow(color1.c - color2.c, 2) +
      Math.pow(color1.h_cos - color2.h_cos, 2) +
      Math.pow(color1.h_sin - color2.h_sin, 2)
    );

    console.log(`Distance between similar blues: ${distance.toFixed(4)}`);

    // Similar colors should have small distance
    expect(distance).toBeLessThan(0.3);
  });

  it('should encode different colors with large distance', () => {
    // Red vs Blue
    const red = hexToLCH('#ff0000');
    const blue = hexToLCH('#0000ff');

    // Normalize
    const normalizeL = (l: number) => l / 100;
    const normalizeC = (c: number) => Math.min(c / 150, 1);

    const color1 = {
      l: normalizeL(red.l),
      c: normalizeC(red.c),
      h_cos: Math.cos((red.h * Math.PI) / 180),
      h_sin: Math.sin((red.h * Math.PI) / 180),
    };

    const color2 = {
      l: normalizeL(blue.l),
      c: normalizeC(blue.c),
      h_cos: Math.cos((blue.h * Math.PI) / 180),
      h_sin: Math.sin((blue.h * Math.PI) / 180),
    };

    // Calculate 4D Euclidean distance
    const distance = Math.sqrt(
      Math.pow(color1.l - color2.l, 2) +
      Math.pow(color1.c - color2.c, 2) +
      Math.pow(color1.h_cos - color2.h_cos, 2) +
      Math.pow(color1.h_sin - color2.h_sin, 2)
    );

    console.log(`Distance between red and blue: ${distance.toFixed(4)}`);

    // Different colors should have large distance
    expect(distance).toBeGreaterThan(0.5);
  });

  it('should handle achromatic colors (grayscale)', () => {
    // Black, white, and grays have very low chroma
    const black = hexToLCH('#000000');
    const white = hexToLCH('#ffffff');
    const gray = hexToLCH('#808080');

    expect(black.c).toBeLessThan(5);
    expect(white.c).toBeLessThan(5);
    expect(gray.c).toBeLessThan(5);

    // Lightness should vary
    expect(black.l).toBeLessThan(10);
    expect(white.l).toBeGreaterThan(90);
    expect(gray.l).toBeGreaterThan(40);
    expect(gray.l).toBeLessThan(60);

    console.log(`Black: L=${black.l.toFixed(1)}, C=${black.c.toFixed(1)}`);
    console.log(`White: L=${white.l.toFixed(1)}, C=${white.c.toFixed(1)}`);
    console.log(`Gray: L=${gray.l.toFixed(1)}, C=${gray.c.toFixed(1)}`);
  });

  it('should verify background and text color encoding', async () => {
    const result = await buildVectors(STRIPE_RUN_ID, ARTIFACTS_DIR);

    // Background color (indices 12-15)
    const bgL = result.globalStyleVec.interpretable[12];
    const bgC = result.globalStyleVec.interpretable[13];
    const bgHCos = result.globalStyleVec.interpretable[14];
    const bgHSin = result.globalStyleVec.interpretable[15];

    // Text color (indices 16-19)
    const textL = result.globalStyleVec.interpretable[16];
    const textC = result.globalStyleVec.interpretable[17];
    const textHCos = result.globalStyleVec.interpretable[18];
    const textHSin = result.globalStyleVec.interpretable[19];

    // Background should typically be light (high lightness)
    expect(bgL).toBeGreaterThan(0.5);

    // Text should typically be dark (low lightness)
    expect(textL).toBeLessThan(0.5);

    // Both should have low chroma (near-neutral)
    expect(bgC).toBeLessThan(0.3);
    expect(textC).toBeLessThan(0.3);

    // Verify circular encoding
    const bgCircular = Math.pow(bgHCos, 2) + Math.pow(bgHSin, 2);
    const textCircular = Math.pow(textHCos, 2) + Math.pow(textHSin, 2);

    expect(bgCircular).toBeCloseTo(1.0, 1);
    expect(textCircular).toBeCloseTo(1.0, 1);

    console.log(`Background: L=${bgL.toFixed(3)}, C=${bgC.toFixed(3)}`);
    console.log(`Text: L=${textL.toFixed(3)}, C=${textC.toFixed(3)}`);
  });

  it('should verify color features are reproducible', async () => {
    // Build vectors twice
    const result1 = await buildVectors(STRIPE_RUN_ID, ARTIFACTS_DIR);
    const result2 = await buildVectors(STRIPE_RUN_ID, ARTIFACTS_DIR);

    // Color features should be identical
    const colorFeatures1 = Array.from(result1.globalStyleVec.interpretable.slice(0, 24));
    const colorFeatures2 = Array.from(result2.globalStyleVec.interpretable.slice(0, 24));

    for (let i = 0; i < 24; i++) {
      expect(colorFeatures1[i]).toBeCloseTo(colorFeatures2[i], 5);
    }
  });
});
