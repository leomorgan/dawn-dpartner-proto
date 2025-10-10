/**
 * Unit tests for color-encoding-v2
 * Tests CIEDE2000-based perceptual encoding
 */

import { encodePaletteFeatures, getColorFeatureNames } from '../color-encoding-v2';
import type { DesignTokens } from '../../tokens';

describe('color-encoding-v2', () => {
  // Mock design tokens for Stripe (purple brand)
  const mockStripeTokens: DesignTokens = {
    colors: {
      brandColors: ['#635bff', '#0a2540'], // Vibrant purple, dark blue
      accentColors: ['#425466'], // Muted blue-gray
      tintedNeutrals: [],
      foundation: [],
      primary: ['#635bff', '#0a2540', '#425466'], // Fallback
      neutral: ['#f6f9fc', '#e3e8ee'],
      semantic: {
        background: '#ffffff',
        text: '#0a2540',
        cta: '#635bff',
        accent: '#425466',
        muted: '#697386',
      },
      contextual: {
        buttons: ['#635bff'],
        links: ['#635bff'],
        backgrounds: ['#ffffff', '#f6f9fc'],
        borders: ['#e3e8ee'],
      },
    },
    typography: {
      fontFamilies: ['Inter', 'sans-serif'],
      fontSizes: [14, 16, 18, 24, 32],
      fontWeights: [400, 500, 600],
      lineHeights: [1.4, 1.5, 1.6],
      letterSpacing: ['0', '-0.01em'],
      textTransforms: ['none', 'uppercase'],
    },
    spacing: [4, 8, 12, 16, 24, 32],
    borderRadius: ['4px', '8px', '12px'],
    boxShadow: ['0 1px 3px rgba(0,0,0,0.1)'],
    buttons: {
      variants: [],
    },
  } as any;

  // Mock design tokens for Airbnb (pink/red brand)
  const mockAirbnbTokens: DesignTokens = {
    colors: {
      brandColors: ['#ff385c', '#e00b41'], // Vibrant pink/red
      accentColors: ['#717171'], // Neutral gray
      tintedNeutrals: [],
      foundation: [],
      primary: ['#ff385c', '#e00b41'],
      neutral: ['#f7f7f7', '#dddddd'],
      semantic: {
        background: '#ffffff',
        text: '#222222',
        cta: '#ff385c',
        accent: '#717171',
        muted: '#999999',
      },
      contextual: {
        buttons: ['#ff385c'],
        links: ['#ff385c'],
        backgrounds: ['#ffffff'],
        borders: ['#dddddd'],
      },
    },
    typography: {
      fontFamilies: ['Circular', 'sans-serif'],
      fontSizes: [12, 14, 16, 18, 24],
      fontWeights: [400, 600, 700],
      lineHeights: [1.3, 1.5],
      letterSpacing: ['0'],
      textTransforms: ['none'],
    },
    spacing: [4, 8, 16, 24, 32],
    borderRadius: ['8px', '12px'],
    boxShadow: ['0 2px 4px rgba(0,0,0,0.1)'],
    buttons: {
      variants: [],
    },
  } as any;

  describe('encodePaletteFeatures', () => {
    it('should return 17 features', () => {
      const features = encodePaletteFeatures(mockStripeTokens);
      expect(features).toHaveLength(17);
    });

    it('should normalize all features to [0, 1] range (except hue cos/sin)', () => {
      const features = encodePaletteFeatures(mockStripeTokens);

      // Dims 0-11, 14-16 should be in [0, 1]
      const nonCircularDims = [
        ...features.slice(0, 12),
        ...features.slice(14, 17),
      ];

      for (const val of nonCircularDims) {
        expect(val).toBeGreaterThanOrEqual(0);
        expect(val).toBeLessThanOrEqual(1);
      }

      // Dims 12-13 are hue cos/sin, should be in [-1, 1]
      expect(features[12]).toBeGreaterThanOrEqual(-1);
      expect(features[12]).toBeLessThanOrEqual(1);
      expect(features[13]).toBeGreaterThanOrEqual(-1);
      expect(features[13]).toBeLessThanOrEqual(1);
    });

    it('should be order-invariant (different order = same encoding)', () => {
      const tokens1 = {
        ...mockStripeTokens,
        colors: {
          ...mockStripeTokens.colors,
          brandColors: ['#635bff', '#0a2540'], // Purple first
        },
      };

      const tokens2 = {
        ...mockStripeTokens,
        colors: {
          ...mockStripeTokens.colors,
          brandColors: ['#0a2540', '#635bff'], // Blue first (reversed)
        },
      };

      const features1 = encodePaletteFeatures(tokens1 as any);
      const features2 = encodePaletteFeatures(tokens2 as any);

      // Hero color features should be identical (hero = most saturated = purple)
      expect(features1[10]).toBeCloseTo(features2[10], 3); // Hero lightness
      expect(features1[11]).toBeCloseTo(features2[11], 3); // Hero chroma
      expect(features1[12]).toBeCloseTo(features2[12], 3); // Hero hue cos
      expect(features1[13]).toBeCloseTo(features2[13], 3); // Hero hue sin

      // Pairwise distances should be identical (order-invariant)
      expect(features1[0]).toBeCloseTo(features2[0], 3); // Avg distance
      expect(features1[1]).toBeCloseTo(features2[1], 3); // Min distance
      expect(features1[2]).toBeCloseTo(features2[2], 3); // Max distance
    });

    it('should differentiate Stripe from Airbnb', () => {
      const stripeFeatures = encodePaletteFeatures(mockStripeTokens);
      const airbnbFeatures = encodePaletteFeatures(mockAirbnbTokens);

      // Hero colors should be different (purple vs pink)
      // Chroma should be similar (both vibrant)
      expect(Math.abs(stripeFeatures[11] - airbnbFeatures[11])).toBeLessThan(0.3);

      // Hue should be very different (purple ~270° vs pink ~350°)
      const stripehue = Math.atan2(stripeFeatures[13], stripeFeatures[12]);
      const airbnbHue = Math.atan2(airbnbFeatures[13], airbnbFeatures[12]);
      const hueDiff = Math.abs(stripehue - airbnbHue);

      // Hue difference should be significant (> 45°)
      expect(hueDiff).toBeGreaterThan(Math.PI / 4);
    });

    it('should handle empty brand palette gracefully', () => {
      const emptyTokens = {
        ...mockStripeTokens,
        colors: {
          ...mockStripeTokens.colors,
          brandColors: [],
          accentColors: [],
        },
      };

      const features = encodePaletteFeatures(emptyTokens as any);

      // Should fallback to primary colors
      expect(features).toHaveLength(17);
      expect(features.every((f) => !isNaN(f))).toBe(true);
    });

    it('should handle single brand color', () => {
      const singleColorTokens = {
        ...mockStripeTokens,
        colors: {
          ...mockStripeTokens.colors,
          brandColors: ['#635bff'],
          accentColors: [],
        },
      };

      const features = encodePaletteFeatures(singleColorTokens as any);

      // Pairwise distances should be 0 (only 1 color)
      expect(features[0]).toBe(0); // Avg distance
      expect(features[1]).toBe(0); // Min distance
      expect(features[2]).toBe(0); // Max distance
    });

    it('should encode semantic relationships correctly', () => {
      const features = encodePaletteFeatures(mockStripeTokens);

      // Background-text distance should be high (white vs dark blue)
      expect(features[3]).toBeGreaterThan(0.5); // Dim 3: bg-text distance

      // CTA-background distance should be moderate (purple vs white)
      expect(features[4]).toBeGreaterThan(0.3); // Dim 4: cta-bg distance

      // Background lightness should be high (white)
      expect(features[7]).toBeGreaterThan(0.9); // Dim 7: bg lightness

      // Text lightness should be low (dark blue)
      expect(features[9]).toBeLessThan(0.3); // Dim 9: text lightness
    });

    it('should encode light mode vs dark mode differently', () => {
      const lightTokens = mockStripeTokens;

      const darkTokens = {
        ...mockStripeTokens,
        colors: {
          ...mockStripeTokens.colors,
          semantic: {
            ...mockStripeTokens.colors.semantic,
            background: '#0a2540', // Dark background
            text: '#ffffff', // Light text
          },
        },
      };

      const lightFeatures = encodePaletteFeatures(lightTokens);
      const darkFeatures = encodePaletteFeatures(darkTokens as any);

      // Background lightness should be inverted
      expect(lightFeatures[7]).toBeGreaterThan(0.9); // Light mode bg = white
      expect(darkFeatures[7]).toBeLessThan(0.2); // Dark mode bg = dark

      // Text lightness should be inverted
      expect(lightFeatures[9]).toBeLessThan(0.3); // Light mode text = dark
      expect(darkFeatures[9]).toBeGreaterThan(0.9); // Dark mode text = white
    });
  });

  describe('getColorFeatureNames', () => {
    it('should return 17 feature names', () => {
      const names = getColorFeatureNames();
      expect(names).toHaveLength(17);
    });

    it('should have descriptive names', () => {
      const names = getColorFeatureNames();

      // Check for key feature names
      expect(names[0]).toContain('palette');
      expect(names[3]).toContain('bg_text');
      expect(names[7]).toContain('bg_lightness');
      expect(names[11]).toContain('hero');
      expect(names[15]).toContain('cta');
    });
  });
});
