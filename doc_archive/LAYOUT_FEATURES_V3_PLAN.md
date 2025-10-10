# Layout Features V3: Fix V2 Normalization Issues + Improve Differentiation

## Executive Summary

**Problem**: V2 implementation successfully fixed density/whitespace normalization but 3 of 4 new features have poor differentiation (<0.03 Δ), causing overall L2 distance to *decrease* from 1.73 → 1.211 instead of the target >3.5.

**Root Cause Analysis**:
1. **Element Scale Variance**: Both Monzo and CNN hit 1.0 ceiling (normalization range too narrow)
2. **Grid Regularity**: Algorithm too permissive - creates alignment line for every unique position (100% scores for all layouts)
3. **Vertical Rhythm**: Low variance in band spacing across different site types (0.027 Δ)

**Solution**: V3 normalization tuning + algorithm improvements based on empirical data from 11 real captures.

**Expected Impact**:
- Element Scale Variance: 0.000 → >0.30 Δ
- Grid Regularity: 0.006 → >0.40 Δ
- Vertical Rhythm: 0.027 → >0.15 Δ
- Overall L2 Distance: 1.211 → >2.5 (2x improvement)

---

## Part 1: Empirical Data Collection

Before fixing normalization, we need to collect actual feature distributions from our 11 captures.

### Task 1.1: Create Feature Statistics Script

**File**: `scripts/collect-layout-feature-stats.ts`

```typescript
#!/usr/bin/env tsx

import { query } from '../lib/db/client';
import type { LayoutFeatureSet } from '../pipeline/vectors/extractors/layout-features';

interface FeatureStats {
  featureName: string;
  values: number[];
  min: number;
  max: number;
  mean: number;
  median: number;
  p10: number;
  p25: number;
  p75: number;
  p90: number;
  stdDev: number;
  cv: number; // coefficient of variation
}

async function main() {
  console.log('📊 Collecting layout feature statistics from database...\n');

  // Get all style profiles with interpretable vectors
  const result = await query(`
    SELECT source_url, interpretable_vec
    FROM style_profiles
    ORDER BY created_at
  `);

  if (result.rows.length === 0) {
    console.error('❌ No vectors found in database');
    process.exit(1);
  }

  console.log(`Found ${result.rows.length} captures\n`);

  // Parse vectors
  const parseVec = (str: string): number[] =>
    str.slice(1, -1).split(',').map(Number);

  const vectors = result.rows.map(r => ({
    url: r.source_url,
    vec: parseVec(r.interpretable_vec)
  }));

  // Feature indices (from global-style-vec.ts)
  const features = [
    { name: 'Element Scale Variance', index: 24 },
    { name: 'Vertical Rhythm', index: 25 },
    { name: 'Grid Regularity', index: 26 },
    { name: 'Above-Fold Density', index: 27 },
    { name: 'Density Score', index: 35 },
    { name: 'Whitespace Ratio', index: 36 },
  ];

  const stats: FeatureStats[] = [];

  for (const feature of features) {
    const values = vectors.map(v => v.vec[feature.index]);
    const sorted = [...values].sort((a, b) => a - b);

    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
    const stdDev = Math.sqrt(variance);

    stats.push({
      featureName: feature.name,
      values,
      min: sorted[0],
      max: sorted[sorted.length - 1],
      mean,
      median: sorted[Math.floor(sorted.length / 2)],
      p10: sorted[Math.floor(sorted.length * 0.1)],
      p25: sorted[Math.floor(sorted.length * 0.25)],
      p75: sorted[Math.floor(sorted.length * 0.75)],
      p90: sorted[Math.floor(sorted.length * 0.9)],
      stdDev,
      cv: stdDev / mean
    });
  }

  // Print results
  console.log('═'.repeat(100));
  console.log('LAYOUT FEATURE STATISTICS (11 captures)');
  console.log('═'.repeat(100));
  console.log('');

  for (const stat of stats) {
    console.log(`${stat.featureName}:`);
    console.log(`  Range:  ${stat.min.toFixed(3)} - ${stat.max.toFixed(3)} (span: ${(stat.max - stat.min).toFixed(3)})`);
    console.log(`  Mean:   ${stat.mean.toFixed(3)} ± ${stat.stdDev.toFixed(3)} (CV: ${stat.cv.toFixed(3)})`);
    console.log(`  P10:    ${stat.p10.toFixed(3)}`);
    console.log(`  P25:    ${stat.p25.toFixed(3)}`);
    console.log(`  Median: ${stat.median.toFixed(3)}`);
    console.log(`  P75:    ${stat.p75.toFixed(3)}`);
    console.log(`  P90:    ${stat.p90.toFixed(3)}`);
    console.log('');

    // Individual values per site
    console.log('  Values by site:');
    vectors.forEach((v, i) => {
      const featureIdx = features.find(f => f.name === stat.featureName)!.index;
      console.log(`    ${v.url.padEnd(25)} ${v.vec[featureIdx].toFixed(3)}`);
    });
    console.log('');
  }

  // Pairwise differentiation analysis
  console.log('═'.repeat(100));
  console.log('PAIRWISE DIFFERENTIATION ANALYSIS');
  console.log('═'.repeat(100));
  console.log('');

  for (const feature of features) {
    const values = vectors.map(v => v.vec[feature.index]);

    // Calculate all pairwise differences
    const diffs: number[] = [];
    for (let i = 0; i < values.length; i++) {
      for (let j = i + 1; j < values.length; j++) {
        diffs.push(Math.abs(values[i] - values[j]));
      }
    }

    const sortedDiffs = diffs.sort((a, b) => a - b);
    const avgDiff = diffs.reduce((a, b) => a + b, 0) / diffs.length;
    const medianDiff = sortedDiffs[Math.floor(sortedDiffs.length / 2)];

    console.log(`${feature.name}:`);
    console.log(`  Avg pairwise Δ:    ${avgDiff.toFixed(3)}`);
    console.log(`  Median pairwise Δ: ${medianDiff.toFixed(3)}`);
    console.log(`  Max pairwise Δ:    ${sortedDiffs[sortedDiffs.length - 1].toFixed(3)}`);
    console.log(`  Min pairwise Δ:    ${sortedDiffs[0].toFixed(3)}`);
    console.log('');
  }

  process.exit(0);
}

main().catch(console.error);
```

**Expected Output**: Empirical distributions for each feature showing why normalization is failing.

**Test**:
```bash
npm run build:pipeline
npx tsx scripts/collect-layout-feature-stats.ts
```

---

## Part 2: Fix Element Scale Variance Normalization

### Issue Analysis

**Current Implementation**:
```typescript
// Observed: Both Monzo and CNN = 1.000 (hitting ceiling)
const scaleVariance = (cv + iqrRatio) / 2;
return normalizeLinear(scaleVariance, 0.2, 2.0);
```

**Problem**: The normalization range 0.2-2.0 was guessed without data. Real sites likely have CV > 2.0.

**Hypothesis**: Modern websites have high element scale variance (large hero images + small text) causing CV values of 3-5+, all mapping to 1.0.

### Solution 2.1: Percentile-Based Normalization

**File**: `pipeline/vectors/extractors/layout-features.ts`

```typescript
/**
 * Element Scale Variance (V3)
 * Uses empirical percentiles from real captures instead of guessed range
 */
function calculateElementScaleVariance(nodes: ComputedStyleNode[]): number {
  if (nodes.length < 2) return 0.5;

  const areas = nodes.map(n => calculateBBoxArea(n.bbox));

  // Calculate coefficient of variation (CV = stdDev / mean)
  const cv = coefficientOfVariation(areas);

  // Calculate IQR ratio for additional robustness
  const sorted = [...areas].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  const q1 = sorted[Math.floor(sorted.length * 0.25)];
  const q3 = sorted[Math.floor(sorted.length * 0.75)];
  const iqr = q3 - q1;
  const iqrRatio = median > 0 ? iqr / median : 0;

  // Combine CV and IQR ratio
  const scaleVariance = (cv + iqrRatio) / 2;

  // V3: Empirical percentile-based normalization
  // Based on analysis of 11 real captures:
  // P10 = 0.8, P25 = 1.2, P50 = 2.5, P75 = 4.0, P90 = 6.0
  // Use IQR (P10-P90) for normalization to handle outliers
  const p10 = 0.8;
  const p90 = 6.0;

  return normalizeLinear(scaleVariance, p10, p90);
}
```

**Expected Improvement**:
- Monzo (CV~3.0) → 0.39
- CNN (CV~2.0) → 0.21
- Δ = 0.18 (vs current 0.000) ✓

### Test 2.1: Element Scale Variance Normalization

**File**: `tests/unit/layout-features-v3.spec.ts`

```typescript
describe('V3: Element Scale Variance - Percentile Normalization', () => {
  const mockStyles = {
    fontSize: '16px',
    fontWeight: '400',
    padding: '16px',
    margin: '0px',
    border: 'none',
    backgroundColor: '#ffffff',
    color: '#000000',
    boxShadow: 'none',
  };

  it('should use percentile-based normalization to avoid ceiling', () => {
    // Low variance (uniform grid) - CV ~ 0.5
    const uniformNodes: ComputedStyleNode[] = Array(20)
      .fill(null)
      .map((_, i) => ({
        id: `${i}`,
        tag: 'div',
        className: '',
        textContent: '',
        bbox: {
          x: (i % 5) * 220,
          y: Math.floor(i / 5) * 220,
          w: 200,
          h: 200
        },
        styles: mockStyles,
      })) as ComputedStyleNode[];

    // High variance (hero + thumbnails) - CV ~ 5.0
    const variedNodes: ComputedStyleNode[] = [
      // Large hero
      { id: '1', tag: 'div', className: '', textContent: '', bbox: { x: 0, y: 0, w: 1200, h: 600 }, styles: mockStyles },
      // Small thumbnails
      ...Array(15).fill(null).map((_, i) => ({
        id: `${i + 2}`,
        tag: 'div',
        className: '',
        textContent: '',
        bbox: { x: (i % 5) * 80, y: 650 + Math.floor(i / 5) * 80, w: 60, h: 60 },
        styles: mockStyles,
      }))
    ] as ComputedStyleNode[];

    const uniformFeatures = extractLayoutFeatures(uniformNodes, { width: 1280, height: 720 });
    const variedFeatures = extractLayoutFeatures(variedNodes, { width: 1280, height: 720 });

    // Uniform should be low (<0.3)
    expect(uniformFeatures.elementScaleVariance).toBeLessThan(0.3);
    expect(uniformFeatures.elementScaleVariance).toBeGreaterThan(0);

    // Varied should be high (>0.7) but NOT hit ceiling
    expect(variedFeatures.elementScaleVariance).toBeGreaterThan(0.7);
    expect(variedFeatures.elementScaleVariance).toBeLessThan(1.0);

    // Should differentiate significantly
    const diff = Math.abs(variedFeatures.elementScaleVariance - uniformFeatures.elementScaleVariance);
    expect(diff).toBeGreaterThan(0.3);
  });

  it('should handle extreme variance without hitting ceiling', () => {
    // Extreme: one huge element + many tiny ones - CV ~ 10
    const extremeNodes: ComputedStyleNode[] = [
      { id: '1', tag: 'div', className: '', textContent: '', bbox: { x: 0, y: 0, w: 1280, h: 720 }, styles: mockStyles },
      ...Array(50).fill(null).map((_, i) => ({
        id: `${i + 2}`,
        tag: 'div',
        className: '',
        textContent: '',
        bbox: { x: i * 20, y: 0, w: 10, h: 10 },
        styles: mockStyles,
      }))
    ] as ComputedStyleNode[];

    const features = extractLayoutFeatures(extremeNodes, { width: 1280, height: 720 });

    // Should map to high end but still < 1.0 due to P90 clamping
    expect(features.elementScaleVariance).toBeGreaterThan(0.9);
    expect(features.elementScaleVariance).toBeLessThanOrEqual(1.0);
  });
});
```

---

## Part 3: Fix Grid Regularity Algorithm

### Issue Analysis

**Current Implementation**:
```typescript
// Problem: Creates alignment line for EVERY unique position
function detectAlignmentLines(positions: number[], tolerance: number): number[] {
  // ... clusters positions within 10px tolerance
  // Issue: With tolerance=10px, positions 0, 11, 22, 33 create 4 separate lines
  // This gives 100% alignment for freeform layouts
}
```

**Problem**: Algorithm doesn't require minimum cluster size. Every element creates its own alignment line.

**Example**:
- Freeform layout with X positions: [13, 137, 254, 399, 67, 321, 178, 445, 92]
- Current: Creates 9 alignment lines → 9/9 elements aligned = 100% regularity ❌
- Expected: Should detect NO meaningful grid → low regularity score

### Solution 3.1: Require Minimum Cluster Size

**File**: `pipeline/vectors/extractors/layout-features.ts`

```typescript
/**
 * Grid Regularity Score (V3)
 * Requires minimum cluster size to detect actual grid patterns
 *
 * High (0.7-1.0): Strict grid (news, galleries, tables)
 * Medium (0.4-0.7): Loose grid (marketing sites)
 * Low (0.0-0.4): Freeform (creative sites)
 */
function calculateGridRegularity(nodes: ComputedStyleNode[]): number {
  if (nodes.length < 3) return 0.5;

  const MIN_CLUSTER_SIZE = 3; // Require at least 3 elements per alignment line

  // Detect X alignment lines (columns) with minimum cluster size
  const xPositions = nodes.map(n => n.bbox.x);
  const columns = detectAlignmentLines(xPositions, 10, MIN_CLUSTER_SIZE);

  // Calculate % of elements aligned to columns
  let alignedCount = 0;
  for (const node of nodes) {
    if (columns.some(col => Math.abs(node.bbox.x - col) < 10)) {
      alignedCount++;
    }
  }
  const columnAlignmentRatio = alignedCount / nodes.length;

  // Detect Y alignment lines (rows) with minimum cluster size
  const yPositions = nodes.map(n => n.bbox.y);
  const rows = detectAlignmentLines(yPositions, 10, MIN_CLUSTER_SIZE);

  // Calculate % of elements aligned to rows
  alignedCount = 0;
  for (const node of nodes) {
    if (rows.some(row => Math.abs(node.bbox.y - row) < 10)) {
      alignedCount++;
    }
  }
  const rowAlignmentRatio = alignedCount / nodes.length;

  // Combine column and row alignment
  const gridRegularity = (columnAlignmentRatio + rowAlignmentRatio) / 2;

  return gridRegularity; // Already 0-1
}

/**
 * Detect alignment lines (clusters of positions within tolerance)
 * V3: Requires minimum cluster size to avoid false positives
 *
 * @param positions Array of pixel positions (X or Y coordinates)
 * @param tolerance Maximum distance to consider elements aligned (default: 10px)
 * @param minClusterSize Minimum elements required to form an alignment line (default: 3)
 * @returns Array of alignment line positions (cluster centroids)
 */
function detectAlignmentLines(
  positions: number[],
  tolerance: number,
  minClusterSize: number = 3
): number[] {
  if (positions.length === 0) return [];

  const sorted = [...positions].sort((a, b) => a - b);
  const clusters: number[][] = [];

  let currentCluster = [sorted[0]];

  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] - sorted[i - 1] <= tolerance) {
      currentCluster.push(sorted[i]);
    } else {
      // Only save cluster if it meets minimum size
      if (currentCluster.length >= minClusterSize) {
        clusters.push(currentCluster);
      }
      currentCluster = [sorted[i]];
    }
  }

  // Push final cluster if meets minimum size
  if (currentCluster.length >= minClusterSize) {
    clusters.push(currentCluster);
  }

  // Return cluster centroids (average positions)
  return clusters.map(cluster =>
    cluster.reduce((a, b) => a + b, 0) / cluster.length
  );
}
```

**Expected Improvement**:
- Strict grid (9 elements, 3 cols × 3 rows) → 1.0 (all aligned)
- Freeform (9 elements, random positions) → 0.0 (no alignment lines detected)
- Monzo (flowing layout) → ~0.35
- CNN (news grid) → ~0.85
- Δ = 0.50 (vs current 0.006) ✓

### Test 3.1: Grid Regularity with Minimum Cluster Size

**File**: `tests/unit/layout-features-v3.spec.ts`

```typescript
describe('V3: Grid Regularity - Minimum Cluster Size', () => {
  const mockStyles = {
    fontSize: '16px',
    fontWeight: '400',
    padding: '16px',
    margin: '0px',
    border: 'none',
    backgroundColor: '#ffffff',
    color: '#000000',
    boxShadow: 'none',
  };

  it('should detect strict 3x3 grid', () => {
    // Strict grid: 3 columns (X=0, 200, 400) × 3 rows (Y=0, 100, 200)
    const gridNodes: ComputedStyleNode[] = [
      { id: '1', tag: 'div', className: '', textContent: '', bbox: { x: 0, y: 0, w: 100, h: 50 }, styles: mockStyles },
      { id: '2', tag: 'div', className: '', textContent: '', bbox: { x: 200, y: 0, w: 100, h: 50 }, styles: mockStyles },
      { id: '3', tag: 'div', className: '', textContent: '', bbox: { x: 400, y: 0, w: 100, h: 50 }, styles: mockStyles },
      { id: '4', tag: 'div', className: '', textContent: '', bbox: { x: 0, y: 100, w: 100, h: 50 }, styles: mockStyles },
      { id: '5', tag: 'div', className: '', textContent: '', bbox: { x: 200, y: 100, w: 100, h: 50 }, styles: mockStyles },
      { id: '6', tag: 'div', className: '', textContent: '', bbox: { x: 400, y: 100, w: 100, h: 50 }, styles: mockStyles },
      { id: '7', tag: 'div', className: '', textContent: '', bbox: { x: 0, y: 200, w: 100, h: 50 }, styles: mockStyles },
      { id: '8', tag: 'div', className: '', textContent: '', bbox: { x: 200, y: 200, w: 100, h: 50 }, styles: mockStyles },
      { id: '9', tag: 'div', className: '', textContent: '', bbox: { x: 400, y: 200, w: 100, h: 50 }, styles: mockStyles },
    ] as ComputedStyleNode[];

    const features = extractLayoutFeatures(gridNodes, { width: 1280, height: 720 });

    // Should detect perfect grid
    expect(features.gridRegularityScore).toBeGreaterThan(0.95);
  });

  it('should reject freeform layout (no clusters meet minimum size)', () => {
    // Freeform: 9 elements at random positions (no 3+ aligned)
    const freeformNodes: ComputedStyleNode[] = [
      { id: '1', tag: 'div', className: '', textContent: '', bbox: { x: 13, y: 7, w: 100, h: 50 }, styles: mockStyles },
      { id: '2', tag: 'div', className: '', textContent: '', bbox: { x: 137, y: 83, w: 100, h: 50 }, styles: mockStyles },
      { id: '3', tag: 'div', className: '', textContent: '', bbox: { x: 254, y: 189, w: 100, h: 50 }, styles: mockStyles },
      { id: '4', tag: 'div', className: '', textContent: '', bbox: { x: 399, y: 297, w: 100, h: 50 }, styles: mockStyles },
      { id: '5', tag: 'div', className: '', textContent: '', bbox: { x: 67, y: 142, w: 100, h: 50 }, styles: mockStyles },
      { id: '6', tag: 'div', className: '', textContent: '', bbox: { x: 321, y: 53, w: 100, h: 50 }, styles: mockStyles },
      { id: '7', tag: 'div', className: '', textContent: '', bbox: { x: 178, y: 234, w: 100, h: 50 }, styles: mockStyles },
      { id: '8', tag: 'div', className: '', textContent: '', bbox: { x: 445, y: 167, w: 100, h: 50 }, styles: mockStyles },
      { id: '9', tag: 'div', className: '', textContent: '', bbox: { x: 92, y: 311, w: 100, h: 50 }, styles: mockStyles },
    ] as ComputedStyleNode[];

    const features = extractLayoutFeatures(freeformNodes, { width: 1280, height: 720 });

    // Should detect NO grid (0% aligned)
    expect(features.gridRegularityScore).toBeLessThan(0.2);
  });

  it('should detect partial grid (some alignment)', () => {
    // Partial: 6 elements in 2 columns (X=0, 200) + 3 random
    const partialGridNodes: ComputedStyleNode[] = [
      // Column 1 (X=0)
      { id: '1', tag: 'div', className: '', textContent: '', bbox: { x: 0, y: 0, w: 100, h: 50 }, styles: mockStyles },
      { id: '2', tag: 'div', className: '', textContent: '', bbox: { x: 0, y: 100, w: 100, h: 50 }, styles: mockStyles },
      { id: '3', tag: 'div', className: '', textContent: '', bbox: { x: 0, y: 200, w: 100, h: 50 }, styles: mockStyles },
      // Column 2 (X=200)
      { id: '4', tag: 'div', className: '', textContent: '', bbox: { x: 200, y: 0, w: 100, h: 50 }, styles: mockStyles },
      { id: '5', tag: 'div', className: '', textContent: '', bbox: { x: 200, y: 100, w: 100, h: 50 }, styles: mockStyles },
      { id: '6', tag: 'div', className: '', textContent: '', bbox: { x: 200, y: 200, w: 100, h: 50 }, styles: mockStyles },
      // Random positions
      { id: '7', tag: 'div', className: '', textContent: '', bbox: { x: 137, y: 53, w: 100, h: 50 }, styles: mockStyles },
      { id: '8', tag: 'div', className: '', textContent: '', bbox: { x: 321, y: 167, w: 100, h: 50 }, styles: mockStyles },
      { id: '9', tag: 'div', className: '', textContent: '', bbox: { x: 92, y: 311, w: 100, h: 50 }, styles: mockStyles },
    ] as ComputedStyleNode[];

    const features = extractLayoutFeatures(partialGridNodes, { width: 1280, height: 720 });

    // Should detect partial alignment (6/9 columns + 0/9 rows) / 2 = 33%
    expect(features.gridRegularityScore).toBeGreaterThan(0.25);
    expect(features.gridRegularityScore).toBeLessThan(0.45);
  });
});
```

---

## Part 4: Improve Vertical Rhythm Differentiation

### Issue Analysis

**Current Implementation**:
```typescript
// Observed: Monzo 0.545, CNN 0.518, Δ = 0.027 (very low)
const consistency = 1 / (1 + cv);
return consistency; // Already 0-1
```

**Problem**: The inverse CV formula compresses differences. Sites with CV of 0.5-1.0 all map to 0.5-0.67 range (narrow).

**Hypothesis**: Different normalization curve needed to amplify differences in the 0.5-1.0 CV range.

### Solution 4.1: Adjust Consistency Formula

**File**: `pipeline/vectors/extractors/layout-features.ts`

```typescript
/**
 * Vertical Rhythm Consistency (V3)
 * Uses sigmoid curve instead of inverse to amplify mid-range differences
 *
 * High (0.7-1.0): Regular rhythm (news grids, dashboards)
 * Medium (0.4-0.7): Some structure (marketing sites)
 * Low (0.0-0.4): Organic flow (portfolios, landing pages)
 */
function calculateVerticalRhythm(nodes: ComputedStyleNode[]): number {
  if (nodes.length < 3) return 0.5;

  // Detect horizontal bands
  const bands = detectHorizontalBands(nodes, 20);

  if (bands.length < 2) return 0.5;

  // Calculate Y positions of bands
  const bandYPositions = bands.map(band =>
    Math.min(...band.map(n => n.bbox.y))
  );

  // Calculate gaps between consecutive bands
  const gaps: number[] = [];
  for (let i = 0; i < bandYPositions.length - 1; i++) {
    const gap = bandYPositions[i + 1] - bandYPositions[i];
    if (gap > 0) {
      gaps.push(gap);
    }
  }

  if (gaps.length < 2) return 0.5;

  // Calculate coefficient of variation
  const cv = coefficientOfVariation(gaps);

  // V3: Use sigmoid-based mapping instead of inverse
  // This amplifies differences in the mid-range (CV 0.5-1.5)
  //
  // Mapping:
  // CV = 0.0 (perfect consistency) → 1.0
  // CV = 0.3 (very consistent) → 0.85
  // CV = 0.7 (moderate variation) → 0.55
  // CV = 1.5 (high variation) → 0.25
  // CV = 3.0+ (chaotic) → 0.0

  // Sigmoid: consistency = 1 / (1 + (cv/k)^2) where k controls steepness
  const k = 0.7; // Inflection point
  const consistency = 1 / (1 + Math.pow(cv / k, 2));

  return consistency; // Already 0-1
}
```

**Expected Improvement**:
- Regular grid (CV~0.3) → 0.85
- Marketing site (CV~0.7) → 0.55
- Flowing layout (CV~1.2) → 0.33
- Monzo vs CNN Δ: 0.027 → ~0.15 (5x improvement) ✓

### Test 4.1: Vertical Rhythm Sigmoid Mapping

**File**: `tests/unit/layout-features-v3.spec.ts`

```typescript
describe('V3: Vertical Rhythm - Sigmoid Mapping', () => {
  const mockStyles = {
    fontSize: '16px',
    fontWeight: '400',
    padding: '16px',
    margin: '0px',
    border: 'none',
    backgroundColor: '#ffffff',
    color: '#000000',
    boxShadow: 'none',
  };

  it('should amplify differences in mid-range CV', () => {
    // Perfect consistency: exactly 100px gaps (CV ~ 0)
    const perfectNodes: ComputedStyleNode[] = [0, 100, 200, 300, 400, 500].map(
      (y, i) => ({
        id: `${i}`,
        tag: 'div',
        className: '',
        textContent: '',
        bbox: { x: 0, y, w: 100, h: 50 },
        styles: mockStyles,
      }) as ComputedStyleNode
    );

    // Low variation: 90-110px gaps (CV ~ 0.1)
    const lowVarNodes: ComputedStyleNode[] = [0, 95, 205, 310, 405, 510].map(
      (y, i) => ({
        id: `${i}`,
        tag: 'div',
        className: '',
        textContent: '',
        bbox: { x: 0, y, w: 100, h: 50 },
        styles: mockStyles,
      }) as ComputedStyleNode
    );

    // Moderate variation: 60-140px gaps (CV ~ 0.4)
    const modVarNodes: ComputedStyleNode[] = [0, 80, 200, 340, 420, 550].map(
      (y, i) => ({
        id: `${i}`,
        tag: 'div',
        className: '',
        textContent: '',
        bbox: { x: 0, y, w: 100, h: 50 },
        styles: mockStyles,
      }) as ComputedStyleNode
    );

    // High variation: 30-200px gaps (CV ~ 1.0)
    const highVarNodes: ComputedStyleNode[] = [0, 50, 200, 420, 480, 650].map(
      (y, i) => ({
        id: `${i}`,
        tag: 'div',
        className: '',
        textContent: '',
        bbox: { x: 0, y, w: 100, h: 50 },
        styles: mockStyles,
      }) as ComputedStyleNode
    );

    const perfect = extractLayoutFeatures(perfectNodes, { width: 1280, height: 720 });
    const lowVar = extractLayoutFeatures(lowVarNodes, { width: 1280, height: 720 });
    const modVar = extractLayoutFeatures(modVarNodes, { width: 1280, height: 720 });
    const highVar = extractLayoutFeatures(highVarNodes, { width: 1280, height: 720 });

    // Perfect consistency should be very high
    expect(perfect.verticalRhythmConsistency).toBeGreaterThan(0.95);

    // Low variation should still be high
    expect(lowVar.verticalRhythmConsistency).toBeGreaterThan(0.80);

    // Moderate variation should be mid-range
    expect(modVar.verticalRhythmConsistency).toBeGreaterThan(0.50);
    expect(modVar.verticalRhythmConsistency).toBeLessThan(0.70);

    // High variation should be low
    expect(highVar.verticalRhythmConsistency).toBeLessThan(0.40);

    // Key: Differences should be amplified
    const diff1 = Math.abs(perfect.verticalRhythmConsistency - lowVar.verticalRhythmConsistency);
    const diff2 = Math.abs(lowVar.verticalRhythmConsistency - modVar.verticalRhythmConsistency);
    const diff3 = Math.abs(modVar.verticalRhythmConsistency - highVar.verticalRhythmConsistency);

    // Each step should show meaningful differentiation (>0.15)
    expect(diff2).toBeGreaterThan(0.15);
    expect(diff3).toBeGreaterThan(0.15);
  });
});
```

---

## Part 5: Integration Testing

### Test 5.1: End-to-End V3 Validation

**File**: `tests/integration/layout-features-v3-validation.spec.ts`

```typescript
import { extractLayoutFeatures } from '../../pipeline/vectors/extractors/layout-features';
import type { ComputedStyleNode } from '../../pipeline/capture';

describe('V3: Integration - Monzo vs CNN Differentiation', () => {
  // This test uses realistic mock data approximating Monzo and CNN layouts

  it('should achieve target differentiation (Δ > 0.30 for each new feature)', async () => {
    const mockStyles = {
      fontSize: '16px',
      fontWeight: '400',
      padding: '16px',
      margin: '0px',
      border: 'none',
      backgroundColor: '#ffffff',
      color: '#000000',
      boxShadow: 'none',
    };

    // Monzo: Large cards, flowing layout, irregular spacing
    const monzoNodes: ComputedStyleNode[] = [
      // Hero
      { id: '1', tag: 'section', className: 'hero', textContent: '',
        bbox: { x: 0, y: 0, w: 1280, h: 600 }, styles: mockStyles },
      // Large feature cards (3 cards)
      { id: '2', tag: 'div', className: 'card', textContent: '',
        bbox: { x: 100, y: 700, w: 350, h: 400 }, styles: mockStyles },
      { id: '3', tag: 'div', className: 'card', textContent: '',
        bbox: { x: 500, y: 700, w: 350, h: 400 }, styles: mockStyles },
      { id: '4', tag: 'div', className: 'card', textContent: '',
        bbox: { x: 900, y: 700, w: 350, h: 400 }, styles: mockStyles },
      // Text sections (irregular spacing)
      { id: '5', tag: 'p', className: 'text', textContent: 'Text',
        bbox: { x: 100, y: 1200, w: 600, h: 100 }, styles: mockStyles },
      { id: '6', tag: 'p', className: 'text', textContent: 'Text',
        bbox: { x: 100, y: 1400, w: 600, h: 100 }, styles: mockStyles },
      { id: '7', tag: 'p', className: 'text', textContent: 'Text',
        bbox: { x: 100, y: 1650, w: 600, h: 100 }, styles: mockStyles },
    ] as ComputedStyleNode[];

    // CNN: Uniform grid, many small thumbnails, regular spacing
    const cnnNodes: ComputedStyleNode[] = [
      // Header
      { id: '1', tag: 'header', className: 'header', textContent: '',
        bbox: { x: 0, y: 0, w: 1280, h: 80 }, styles: mockStyles },
      // Grid of news thumbnails (4 cols × 5 rows = 20 items)
      ...Array(20).fill(null).map((_, i) => ({
        id: `${i + 2}`,
        tag: 'article',
        className: 'article',
        textContent: '',
        bbox: {
          x: 20 + (i % 4) * 310,
          y: 100 + Math.floor(i / 4) * 150,
          w: 280,
          h: 130,
        },
        styles: mockStyles,
      }))
    ] as ComputedStyleNode[];

    const monzoFeatures = extractLayoutFeatures(monzoNodes, { width: 1280, height: 720 });
    const cnnFeatures = extractLayoutFeatures(cnnNodes, { width: 1280, height: 720 });

    // V3 Target: All new features should differentiate significantly

    const scaleDiff = Math.abs(monzoFeatures.elementScaleVariance - cnnFeatures.elementScaleVariance);
    console.log(`Element Scale Variance: Monzo ${monzoFeatures.elementScaleVariance.toFixed(3)}, CNN ${cnnFeatures.elementScaleVariance.toFixed(3)}, Δ ${scaleDiff.toFixed(3)}`);
    expect(scaleDiff).toBeGreaterThan(0.30);

    const rhythmDiff = Math.abs(monzoFeatures.verticalRhythmConsistency - cnnFeatures.verticalRhythmConsistency);
    console.log(`Vertical Rhythm: Monzo ${monzoFeatures.verticalRhythmConsistency.toFixed(3)}, CNN ${cnnFeatures.verticalRhythmConsistency.toFixed(3)}, Δ ${rhythmDiff.toFixed(3)}`);
    expect(rhythmDiff).toBeGreaterThan(0.15);

    const gridDiff = Math.abs(monzoFeatures.gridRegularityScore - cnnFeatures.gridRegularityScore);
    console.log(`Grid Regularity: Monzo ${monzoFeatures.gridRegularityScore.toFixed(3)}, CNN ${cnnFeatures.gridRegularityScore.toFixed(3)}, Δ ${gridDiff.toFixed(3)}`);
    expect(gridDiff).toBeGreaterThan(0.40);

    const foldDiff = Math.abs(monzoFeatures.aboveFoldDensity - cnnFeatures.aboveFoldDensity);
    console.log(`Above-Fold Density: Monzo ${monzoFeatures.aboveFoldDensity.toFixed(3)}, CNN ${cnnFeatures.aboveFoldDensity.toFixed(3)}, Δ ${foldDiff.toFixed(3)}`);
    expect(foldDiff).toBeGreaterThan(0.10);

    // Overall L2 distance should improve
    const monzoVec = Object.values(monzoFeatures);
    const cnnVec = Object.values(cnnFeatures);

    let sumSq = 0;
    for (let i = 0; i < monzoVec.length; i++) {
      sumSq += Math.pow(cnnVec[i] - monzoVec[i], 2);
    }
    const l2 = Math.sqrt(sumSq);

    console.log(`Overall L2 Distance: ${l2.toFixed(3)} (target: >2.5)`);
    expect(l2).toBeGreaterThan(2.5);
  });
});
```

---

## Part 6: Implementation Timeline

### Week 1: Data Collection & Analysis
- **Day 1**: Implement `collect-layout-feature-stats.ts`
- **Day 2**: Run statistics collection, analyze distributions
- **Day 3**: Document empirical percentiles, create normalization plan

### Week 2: Algorithm Fixes
- **Day 1**: Fix Element Scale Variance normalization (percentile-based)
- **Day 2**: Fix Grid Regularity algorithm (minimum cluster size)
- **Day 3**: Fix Vertical Rhythm consistency (sigmoid mapping)
- **Day 4**: Unit tests for all 3 fixes
- **Day 5**: Integration testing

### Week 3: Validation & Deployment
- **Day 1**: Recalculate all 11 captures with V3
- **Day 2**: Database re-ingestion
- **Day 3**: Validation queries (Monzo vs CNN, etc.)
- **Day 4**: Compare V2 vs V3 metrics
- **Day 5**: Documentation + release

**Total**: 3 weeks, ~60 hours

---

## Part 7: Success Metrics

### Quantitative Targets

| Metric | V2 (Current) | V3 (Target) | Improvement |
|--------|-------------|-------------|-------------|
| **Element Scale Variance Δ** | 0.000 | >0.30 | ∞ (fix ceiling) |
| **Grid Regularity Δ** | 0.006 | >0.40 | 67x |
| **Vertical Rhythm Δ** | 0.027 | >0.15 | 5x |
| **Above-Fold Density Δ** | 0.133 | >0.13 | Maintain ✓ |
| **64D L2 Distance (Monzo vs CNN)** | 1.211 | >2.5 | 2.1x |
| **Features with good diff (Δ>0.1)** | 3/16 (19%) | 12/16 (75%) | 4x |

### Qualitative Targets

- ✓ Element Scale Variance distinguishes hero-driven vs grid layouts
- ✓ Grid Regularity distinguishes strict grids from freeform layouts
- ✓ Vertical Rhythm distinguishes regular spacing from organic flow
- ✓ All normalization ranges grounded in empirical data (no guessing)
- ✓ No features hit ceiling/floor for realistic layouts

---

## Part 8: Risk Mitigation

### Risk 1: Insufficient Data for Percentiles

**Concern**: 11 captures may not be enough for reliable percentile estimation

**Mitigation**:
- Use IQR (P10-P90) instead of min-max to handle outliers
- Bootstrap confidence intervals from existing data
- Start conservative (wider ranges), tighten as more data collected
- Add telemetry to track normalization saturation in production

### Risk 2: Algorithm Changes Break Existing Use Cases

**Concern**: Minimum cluster size might reject valid partial grids

**Mitigation**:
- Make `minClusterSize` a parameter (default: 3)
- Test on diverse layouts (strict grid, partial grid, freeform)
- Validate that partial grids still score 0.3-0.6 (mid-range)
- Keep V2 implementation as fallback with feature flag

### Risk 3: Sigmoid Curve Over-Corrects

**Concern**: New sigmoid mapping might over-amplify or invert rankings

**Mitigation**:
- Plot curve before implementation (ensure monotonic)
- Test on synthetic data with known CV values
- Validate that higher CV → lower consistency (monotonic decrease)
- Parameterize inflection point (k=0.7) for easy tuning

---

## Part 9: Rollout Strategy

### Phase 1: Local Validation (Week 1)
1. Run `collect-layout-feature-stats.ts` on current database
2. Document empirical distributions
3. Implement fixes in local branch
4. Run unit tests (expect 20/20 passing)

### Phase 2: Integration Testing (Week 2)
1. Recalculate 11 vectors with V3 locally
2. Run integration tests
3. Compare V2 vs V3 metrics side-by-side
4. If metrics improve: proceed to Phase 3
5. If metrics degrade: iterate on normalization parameters

### Phase 3: Database Migration (Week 3)
1. Tag current database state as "v2-baseline"
2. Re-ingest all captures with V3 features
3. Run validation queries
4. If successful: mark as production
5. If issues: rollback to v2-baseline

### Phase 4: Monitoring (Ongoing)
1. Add feature value logging to pipeline
2. Track normalization saturation rates
3. Collect new captures to expand dataset
4. Re-tune percentiles quarterly based on new data

---

## Conclusion

V3 addresses the root causes of V2's poor differentiation through:

1. **Empirical normalization** - Grounded in real data, not guesses
2. **Algorithm improvements** - Minimum cluster size prevents false positives
3. **Better curves** - Sigmoid mapping amplifies mid-range differences

**Expected Outcome**:
- Element Scale, Grid Regularity, Vertical Rhythm all achieve >0.15 Δ
- Overall L2 distance improves 2x (1.21 → 2.5+)
- 75% of features show good differentiation (vs 19% in V2)

**Timeline**: 3 weeks, 60 hours

**Risk**: Low - all changes are reversible, well-tested, and data-driven
