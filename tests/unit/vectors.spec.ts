import { describe, it, expect } from '@jest/globals';
import { normalizeLinear, normalizeLog, hexToLCH, calculateContrast } from '../../pipeline/vectors/utils';

describe('Vector Utils', () => {
  describe('normalizeLinear', () => {
    it('should normalize values to [0, 1]', () => {
      expect(normalizeLinear(5, 0, 10)).toBeCloseTo(0.5);
      expect(normalizeLinear(0, 0, 10)).toBe(0);
      expect(normalizeLinear(10, 0, 10)).toBe(1);
    });

    it('should clamp out-of-range values', () => {
      expect(normalizeLinear(-5, 0, 10)).toBe(0);
      expect(normalizeLinear(15, 0, 10)).toBe(1);
    });

    it('should handle edge case: min === max', () => {
      expect(normalizeLinear(5, 5, 5)).toBe(0);
    });

    it('should handle negative ranges', () => {
      expect(normalizeLinear(-5, -10, 0)).toBeCloseTo(0.5);
      expect(normalizeLinear(-10, -10, 0)).toBe(0);
      expect(normalizeLinear(0, -10, 0)).toBe(1);
    });

    it('should handle outliers by clamping', () => {
      expect(normalizeLinear(1000, 0, 100)).toBe(1);
      expect(normalizeLinear(-1000, 0, 100)).toBe(0);
    });
  });

  describe('normalizeLog', () => {
    it('should normalize counts with log scale', () => {
      expect(normalizeLog(0, 5)).toBeCloseTo(0);
      // normalizeLog(5, 5) maps to log(6)/log(11) ≈ 0.747, not 0.5
      expect(normalizeLog(5, 5)).toBeGreaterThan(0.5);
      expect(normalizeLog(5, 5)).toBeLessThan(1);
      expect(normalizeLog(100, 5)).toBeLessThanOrEqual(1);
    });

    it('should handle edge case: count = 0', () => {
      expect(normalizeLog(0, 10)).toBe(0);
    });

    it('should handle large counts', () => {
      const result = normalizeLog(10000, 5);
      expect(result).toBeGreaterThan(0);
      expect(result).toBeLessThanOrEqual(1);
    });

    it('should be monotonically increasing', () => {
      const v1 = normalizeLog(1, 5);
      const v2 = normalizeLog(5, 5);
      const v3 = normalizeLog(10, 5);
      expect(v2).toBeGreaterThan(v1);
      expect(v3).toBeGreaterThan(v2);
    });
  });

  describe('hexToLCH', () => {
    it('should convert hex to LCH', () => {
      const lch = hexToLCH('#ff0000');  // red
      expect(lch.l).toBeGreaterThan(0);
      expect(lch.c).toBeGreaterThan(0);
      expect(lch.h).toBeGreaterThanOrEqual(0);
    });

    it('should handle white', () => {
      const lch = hexToLCH('#ffffff');
      expect(lch.l).toBeCloseTo(100, 0);
      expect(lch.c).toBeCloseTo(0, 0);
    });

    it('should handle black', () => {
      const lch = hexToLCH('#000000');
      expect(lch.l).toBeCloseTo(0, 0);
      expect(lch.c).toBeCloseTo(0, 0);
    });

    it('should handle invalid hex', () => {
      const lch = hexToLCH('invalid');
      expect(lch.l).toBe(0);
      expect(lch.c).toBe(0);
      expect(lch.h).toBe(0);
    });

    it('should handle malformed hex', () => {
      const lch1 = hexToLCH('#gg0000');
      expect(lch1.l).toBe(0);
      expect(lch1.c).toBe(0);

      const lch2 = hexToLCH('');
      expect(lch2.l).toBe(0);
      expect(lch2.c).toBe(0);
    });

    it('should handle shorthand hex', () => {
      const lch = hexToLCH('#f00');  // red shorthand
      expect(lch.l).toBeGreaterThan(0);
      expect(lch.c).toBeGreaterThan(0);
    });
  });

  describe('calculateContrast', () => {
    it('should calculate WCAG contrast ratio for black/white', () => {
      const contrast = calculateContrast('#000000', '#ffffff');
      expect(contrast).toBeCloseTo(21, 0);  // max contrast
    });

    it('should be symmetric', () => {
      const c1 = calculateContrast('#ff0000', '#00ff00');
      const c2 = calculateContrast('#00ff00', '#ff0000');
      expect(c1).toBeCloseTo(c2, 5);
    });

    it('should handle same color (minimum contrast)', () => {
      const contrast = calculateContrast('#888888', '#888888');
      expect(contrast).toBeCloseTo(1, 1);
    });

    it('should calculate AA passing contrast', () => {
      // Common passing combinations
      const c1 = calculateContrast('#000000', '#ffffff');
      expect(c1).toBeGreaterThan(4.5);  // AA pass

      const c2 = calculateContrast('#595959', '#ffffff');
      expect(c2).toBeGreaterThan(4.5);  // AA pass
    });

    it('should calculate AA failing contrast', () => {
      // Light gray on white (common failure)
      const contrast = calculateContrast('#cccccc', '#ffffff');
      expect(contrast).toBeLessThan(4.5);  // AA fail
    });

    it('should handle invalid hex gracefully', () => {
      const contrast = calculateContrast('invalid', '#ffffff');
      expect(contrast).toBeGreaterThan(0);
      expect(Number.isFinite(contrast)).toBe(true);
    });

    it('should produce values in valid range', () => {
      const testPairs = [
        ['#000000', '#ffffff'],
        ['#ff0000', '#00ff00'],
        ['#123456', '#abcdef'],
        ['#888888', '#cccccc']
      ];

      testPairs.forEach(([fg, bg]) => {
        const contrast = calculateContrast(fg, bg);
        expect(contrast).toBeGreaterThanOrEqual(1);
        expect(contrast).toBeLessThanOrEqual(21);
      });
    });
  });
});
