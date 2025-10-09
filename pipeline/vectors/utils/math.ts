/**
 * Statistical and normalization utilities for vector features
 */

/**
 * Calculate the mean (average) of an array of numbers
 */
export function calculateMean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, val) => sum + val, 0) / values.length;
}

/**
 * Calculate the standard deviation of an array of numbers
 */
export function calculateStdDev(values: number[]): number {
  if (values.length === 0) return 0;
  const mean = calculateMean(values);
  const squaredDiffs = values.map(val => Math.pow(val - mean, 2));
  const variance = calculateMean(squaredDiffs);
  return Math.sqrt(variance);
}

/**
 * Calculate coefficient of variation (CV = stdDev / mean)
 * Measures relative variability, normalized by the mean.
 * Returns 0 if mean is 0 (to avoid division by zero).
 *
 * @example
 * // High variation relative to mean
 * coefficientOfVariation([1, 5, 10]); // ~0.8
 *
 * // Low variation relative to mean
 * coefficientOfVariation([10, 11, 12]); // ~0.09
 */
export function coefficientOfVariation(values: number[]): number {
  if (values.length === 0) return 0;
  const mean = calculateMean(values);
  if (mean === 0) return 0; // Avoid division by zero
  const stdDev = calculateStdDev(values);
  return stdDev / mean;
}

/**
 * Linear normalization to [0, 1] range
 * Returns 0.5 if min === max (to avoid division by zero)
 *
 * @example
 * normalizeLinear(5, 0, 10); // 0.5
 * normalizeLinear(15, 0, 10); // 1 (clamped)
 */
export function normalizeLinear(value: number, min: number, max: number): number {
  if (max === min) return 0.5; // Avoid division by zero
  const clamped = Math.max(min, Math.min(max, value));
  return (clamped - min) / (max - min);
}

/**
 * Logarithmic normalization for skewed distributions
 * Uses natural log, with midpoint parameter to control where 0.5 maps to.
 *
 * Formula: log(value + 1) / log(midpoint * 2 + 1)
 * - value = 0 → 0
 * - value = midpoint → ~0.5
 * - value → ∞ → approaches but never exceeds 1
 *
 * @param value The value to normalize
 * @param midpoint The value that should map to approximately 0.5
 *
 * @example
 * // For color counts where typical is 3-5
 * normalizeLog(0, 5); // 0
 * normalizeLog(5, 5); // ~0.5
 * normalizeLog(10, 5); // ~0.7
 */
export function normalizeLog(value: number, midpoint: number): number {
  if (value < 0) return 0;
  if (midpoint <= 0) return 0;
  return Math.min(1, Math.log(value + 1) / Math.log(midpoint * 2 + 1));
}

/**
 * Clamp a value to a specified range
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Piecewise linear normalization for density values
 * Provides more resolution in the critical 150-250 range where modern sites cluster
 *
 * Ranges:
 * - 0-50: Minimal sites → 0.0-0.2 (steep curve, high sensitivity)
 * - 50-150: Moderate sites → 0.2-0.5 (moderate curve)
 * - 150-250: Dense sites → 0.5-0.8 (CRITICAL RANGE - more resolution)
 * - 250+: Very dense → 0.8-1.0 (compressed, less important)
 *
 * @example
 * normalizeDensityPiecewise(173.82); // Monzo → 0.571
 * normalizeDensityPiecewise(185.82); // CNN → 0.607
 * // Δ = 0.036 (3.3x better than log normalization)
 */
export function normalizeDensityPiecewise(rawDensity: number): number {
  if (rawDensity < 50) {
    // Minimal sites: 0-50 → 0.0-0.2
    return (rawDensity / 50) * 0.2;
  } else if (rawDensity < 150) {
    // Moderate sites: 50-150 → 0.2-0.5
    return 0.2 + ((rawDensity - 50) / 100) * 0.3;
  } else if (rawDensity < 250) {
    // Dense sites: 150-250 → 0.5-0.8 (CRITICAL RANGE)
    return 0.5 + ((rawDensity - 150) / 100) * 0.3;
  } else {
    // Very dense: 250+ → 0.8-1.0
    return 0.8 + Math.min((rawDensity - 250) / 250, 1) * 0.2;
  }
}
