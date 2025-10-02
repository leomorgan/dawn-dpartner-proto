# Layout Features V2: Normalization Fixes + Missing Features

## Executive Summary

**Problem**: Current layout features fail to differentiate between visually distinct sites (Monzo vs CNN) due to:
1. **Normalization issues**: Density and whitespace hit ceiling/floor, losing differentiation
2. **Missing features**: Element scale, vertical rhythm, and grid regularity not captured
3. **Modern web convergence**: All sites use similar patterns (overlapping elements, generous whitespace)

**Solution**:
- Fix density/whitespace normalization using percentile-based scaling
- Add 4 new features to capture element scale, vertical rhythm, grid regularity
- Refactor feature extraction to use two-pass analysis (collect statistics, then normalize)

**Impact**: Expected to improve Monzo vs CNN differentiation from Δ 0.011 → Δ 0.25+ across key features

---

## Part 1: Normalization Fixes

### Issue 1: Density Score (Currently Broken)

#### Current Implementation
```typescript
// File: pipeline/vectors/extractors/layout-features.ts (lines ~94-110)
const totalArea = nodes.reduce((sum, n) => sum + (n.bbox.w * n.bbox.h), 0);
const viewportArea = viewport.width * viewport.height;
const densityRatio = totalArea / viewportArea; // Raw: 173 for Monzo, 185 for CNN

// Normalization (PROBLEMATIC)
return normalizeLog(densityRatio, 250); // Midpoint 250
// Result: 173 → 0.831, 185 → 0.841 (Δ = 0.011) ❌
```

#### Problem Analysis
- **Raw values**: 173.82 vs 185.82 (12-point difference = 6.5% relative)
- **After normalization**: 0.831 vs 0.841 (0.011 difference = 1.3% relative)
- **Information loss**: 80% of signal lost in normalization!
- **Root cause**: Log normalization with midpoint 250 compresses 150-250 range into narrow 0.8-0.9 band

#### Why This Happens
Modern websites have overlapping/stacked elements (sticky headers, modals, overlays):
```
Viewport: 1280 × 720 = 921,600 px²
Elements: Sum of all bbox areas = 160,000,000+ px²
Ratio: 173x (elements cover viewport 173 times over)
```

This is **normal** for modern web design. The issue: our normalization treats 150-250 as "all the same high density."

#### Solution 1A: Percentile-Based Normalization

**Approach**: Collect density values from all known sites, use percentiles for normalization

```typescript
// NEW: Two-pass approach
// Pass 1: Collect statistics (run once on all existing captures)
const densityStats = {
  p10: 45,    // Dawn Labs (minimal)
  p25: 120,   // Apple (moderate)
  p50: 175,   // Monzo/CNN (dense)
  p75: 210,   // Stripe (very dense)
  p90: 280,   // Heavy sites
  p99: 500    // Extreme outliers
};

// Pass 2: Normalize using percentiles
function normalizeDensityPercentile(rawDensity: number): number {
  // Map to 0-1 using IQR (inter-quartile range)
  const min = densityStats.p10;  // 45
  const max = densityStats.p90;  // 280

  return clamp((rawDensity - min) / (max - min), 0, 1);
}

// Example results:
// Monzo: (173.82 - 45) / (280 - 45) = 0.548 ✓
// CNN:   (185.82 - 45) / (280 - 45) = 0.599 ✓
// Δ = 0.051 (4.7x better than current!)
```

**Benefits**:
- Preserves relative differences in the "normal" range (150-250)
- Uses actual data distribution, not arbitrary midpoint
- Robust to outliers (uses p90, not max)

**Drawbacks**:
- Requires initial pass over all captures to collect statistics
- Needs periodic recalibration as web design trends evolve

#### Solution 1B: Piecewise Linear Normalization

**Approach**: Different normalization curves for different ranges

```typescript
function normalizeDensityPiecewise(rawDensity: number): number {
  if (rawDensity < 50) {
    // Minimal sites: 0-50 → 0.0-0.2 (steep curve, high sensitivity)
    return (rawDensity / 50) * 0.2;
  } else if (rawDensity < 150) {
    // Moderate sites: 50-150 → 0.2-0.5 (moderate curve)
    return 0.2 + ((rawDensity - 50) / 100) * 0.3;
  } else if (rawDensity < 250) {
    // Dense sites: 150-250 → 0.5-0.8 (CRITICAL RANGE - more resolution)
    return 0.5 + ((rawDensity - 150) / 100) * 0.3;
  } else {
    // Very dense: 250+ → 0.8-1.0 (compressed, less important)
    return 0.8 + Math.min((rawDensity - 250) / 250, 1) * 0.2;
  }
}

// Example results:
// Monzo: 173.82 → 0.5 + (23.82/100)*0.3 = 0.571 ✓
// CNN:   185.82 → 0.5 + (35.82/100)*0.3 = 0.607 ✓
// Δ = 0.036 (3.3x better than current!)
```

**Benefits**:
- No statistics collection needed
- Provides more resolution in the critical 150-250 range
- Intuitive to tune

**Drawbacks**:
- Arbitrary breakpoints (needs validation)
- Less adaptive to changing web trends

#### Recommendation: Hybrid Approach

Use **piecewise linear** initially (quick win), then migrate to **percentile-based** after collecting statistics.

**Implementation Steps**:
1. Update `normalizeLog()` call in `layout-features.ts` line ~108
2. Replace with `normalizeDensityPiecewise()`
3. Add statistics collection script: `scripts/collect-normalization-stats.ts`
4. After 50+ captures, switch to percentile-based

---

### Issue 2: Whitespace Ratio (Currently Broken)

#### Current Implementation
```typescript
// File: pipeline/vectors/extractors/layout-features.ts (lines ~120-145)
const avgRatio = containers.map(node => {
  const contentSize = node.bbox.w * node.bbox.h;
  const paddingArea = (padding.total + margin.total) * 4; // approximate
  return paddingArea / Math.sqrt(contentSize + 1); // Using sqrt to reduce scale
}).reduce((sum, r) => sum + r, 0) / containers.length;

// Normalization (PROBLEMATIC)
return normalizeLog(avgRatio, 0.05); // Midpoint 0.05

// Result: Both Monzo and CNN → 1.0 (clamped) ❌
```

#### Problem Analysis
- **Raw values**: Likely > 1.0 for both (exceeds normalization range)
- **After normalization**: Both clamped to 1.0
- **Information loss**: 100% of differentiation lost!
- **Root cause**: sqrt(area) approach + log normalization produces values > 1.0

#### Why This Happens
The current calculation doesn't actually measure "whitespace" - it measures padding/margin relative to sqrt(content size), which is a proxy but not accurate.

**True whitespace** = viewport area NOT covered by elements:
```
Viewport: 921,600 px²
Covered by elements: ~920,000 px² (99% coverage from overlapping)
True whitespace: ~1,600 px² (0.17% of viewport)
```

Both modern sites have ~0% true whitespace because of overlapping elements. The difference is **spacing BETWEEN elements**, not total empty area.

#### Solution 2A: Inter-Element Gap Measurement

**Approach**: Measure actual pixel gaps between adjacent elements

```typescript
function calculateWhitespaceBreathing(
  nodes: ComputedStyleNode[],
  viewport: Viewport
): number {
  // Step 1: Sort elements by Y position (top to bottom)
  const sorted = [...nodes].sort((a, b) => a.bbox.y - b.bbox.y);

  // Step 2: Detect horizontal "bands" (elements at similar Y)
  const bands: ComputedStyleNode[][] = [];
  let currentBand: ComputedStyleNode[] = [];
  let lastY = -Infinity;

  for (const node of sorted) {
    if (node.bbox.y - lastY > 20) { // 20px threshold for new band
      if (currentBand.length > 0) bands.push(currentBand);
      currentBand = [node];
    } else {
      currentBand.push(node);
    }
    lastY = node.bbox.y;
  }
  if (currentBand.length > 0) bands.push(currentBand);

  // Step 3: Measure vertical gaps between bands
  const verticalGaps: number[] = [];
  for (let i = 0; i < bands.length - 1; i++) {
    const bandBottom = Math.max(...bands[i].map(n => n.bbox.y + n.bbox.h));
    const nextBandTop = Math.min(...bands[i + 1].map(n => n.bbox.y));
    const gap = nextBandTop - bandBottom;
    if (gap > 0) verticalGaps.push(gap);
  }

  // Step 4: Measure horizontal gaps within bands
  const horizontalGaps: number[] = [];
  for (const band of bands) {
    const sortedByX = [...band].sort((a, b) => a.bbox.x - b.bbox.x);
    for (let i = 0; i < sortedByX.length - 1; i++) {
      const gap = sortedByX[i + 1].bbox.x - (sortedByX[i].bbox.x + sortedByX[i].bbox.w);
      if (gap > 0) horizontalGaps.push(gap);
    }
  }

  // Step 5: Calculate metrics
  const avgVerticalGap = verticalGaps.length > 0
    ? verticalGaps.reduce((a, b) => a + b, 0) / verticalGaps.length
    : 0;
  const avgHorizontalGap = horizontalGaps.length > 0
    ? horizontalGaps.reduce((a, b) => a + b, 0) / horizontalGaps.length
    : 0;

  // Step 6: Combine into single score (weighted toward vertical gaps)
  const combinedGap = (avgVerticalGap * 2 + avgHorizontalGap) / 3;

  return combinedGap;
}

// Normalization
function normalizeWhitespaceGap(avgGap: number): number {
  // Expected ranges from analysis:
  // Minimal: 8-16px gaps
  // Moderate: 16-32px gaps
  // Generous: 32-64px gaps
  // Extremely generous: 64-128px gaps

  return normalizeLinear(avgGap, 8, 128);
}

// Expected results:
// Monzo: 80px avg gap → 0.600 ✓
// CNN: 32px avg gap → 0.200 ✓
// Δ = 0.400 (huge improvement!)
```

**Benefits**:
- Measures actual visual breathing room (what designers perceive)
- Captures vertical rhythm differences (Monzo's big section gaps vs CNN's tight grid)
- No ceiling issues - can differentiate up to 128px gaps

**Drawbacks**:
- More complex calculation (O(n log n) for sorting)
- Requires band detection heuristic

#### Solution 2B: Padding/Margin Statistics

**Approach**: Use actual padding/margin values, not derived metrics

```typescript
function calculateWhitespacePaddingStats(nodes: ComputedStyleNode[]): number {
  const paddingValues: number[] = [];

  for (const node of nodes) {
    const padding = parsePadding(node.styles.padding); // [top, right, bottom, left]
    const margin = parseMargin(node.styles.margin);

    paddingValues.push(...padding, ...margin);
  }

  // Use median instead of mean (more robust to outliers)
  paddingValues.sort((a, b) => a - b);
  const median = paddingValues[Math.floor(paddingValues.length / 2)];

  return median;
}

// Normalization
function normalizeWhitespacePadding(medianPadding: number): number {
  // Expected ranges:
  // Tight: 4-8px
  // Moderate: 8-16px
  // Generous: 16-32px
  // Very generous: 32-64px

  return normalizeLinear(medianPadding, 4, 64);
}
```

**Benefits**:
- Simpler to calculate
- Uses actual CSS values (ground truth)
- Fast performance

**Drawbacks**:
- Doesn't capture compound spacing (margin + padding)
- Misses implicit whitespace from layout

#### Recommendation: Use Gap Measurement (Solution 2A)

Gap measurement captures visual breathing room better than padding statistics.

**Implementation Steps**:
1. Replace `calculateWhitespaceBreathingRatio()` in `layout-features.ts` (lines 120-145)
2. Implement band detection algorithm
3. Measure vertical and horizontal gaps
4. Normalize to 8-128px range

---

## Part 2: New Features to Add

### Feature 13: Element Scale Variance (NEW)

**What it captures**: Difference between large cards (Monzo) vs small thumbnails (CNN)

**Calculation**:
```typescript
function calculateElementScaleVariance(nodes: ComputedStyleNode[]): number {
  const areas = nodes.map(n => n.bbox.w * n.bbox.h);

  // Use coefficient of variation (CV = stdDev / mean)
  const mean = areas.reduce((a, b) => a + b, 0) / areas.length;
  const variance = areas.reduce((sum, a) => sum + Math.pow(a - mean, 2), 0) / areas.length;
  const stdDev = Math.sqrt(variance);
  const cv = stdDev / mean;

  // Also calculate median and IQR for robustness
  const sorted = [...areas].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  const q1 = sorted[Math.floor(sorted.length * 0.25)];
  const q3 = sorted[Math.floor(sorted.length * 0.75)];
  const iqr = q3 - q1;

  // Combine CV and IQR/median ratio
  const iqrRatio = iqr / median;
  const scaleVariance = (cv + iqrRatio) / 2;

  return scaleVariance;
}

// Normalization
function normalizeElementScale(scaleVariance: number): number {
  // Expected ranges:
  // Uniform (grid): 0.2-0.5 CV
  // Moderate: 0.5-1.0 CV
  // High variation: 1.0-2.0 CV

  return normalizeLinear(scaleVariance, 0.2, 2.0);
}

// Expected results:
// Monzo: Large cards + small text = high variance (~1.2) → 0.56 ✓
// CNN: Uniform thumbnails = low variance (~0.4) → 0.11 ✓
// Δ = 0.45 (excellent differentiation!)
```

**Interpretation**:
- Low (0.0-0.3): Uniform grid layout (news sites, galleries)
- Medium (0.3-0.6): Mixed elements (marketing sites)
- High (0.6-1.0): High variation (artistic/portfolio sites)

---

### Feature 14: Vertical Rhythm Consistency (NEW)

**What it captures**: Regular section spacing (CNN grid) vs flowing sections (Monzo)

**Calculation**:
```typescript
function calculateVerticalRhythm(nodes: ComputedStyleNode[]): number {
  // Step 1: Detect horizontal bands
  const bands = detectHorizontalBands(nodes, 20); // 20px Y-threshold

  // Step 2: Calculate Y positions of bands
  const bandYPositions = bands.map(band =>
    Math.min(...band.map(n => n.bbox.y))
  );

  // Step 3: Calculate gaps between consecutive bands
  const gaps: number[] = [];
  for (let i = 0; i < bandYPositions.length - 1; i++) {
    gaps.push(bandYPositions[i + 1] - bandYPositions[i]);
  }

  // Step 4: Calculate consistency (inverse of CV)
  const mean = gaps.reduce((a, b) => a + b, 0) / gaps.length;
  const variance = gaps.reduce((sum, g) => sum + Math.pow(g - mean, 2), 0) / gaps.length;
  const stdDev = Math.sqrt(variance);
  const cv = stdDev / mean;

  // Invert: low CV = high consistency
  const consistency = 1 / (1 + cv);

  return consistency;
}

// Normalization
// Already 0-1 (consistency score)
// 1.0 = perfectly regular spacing
// 0.5 = moderate variation
// 0.0 = chaotic spacing

// Expected results:
// CNN: Regular grid → high consistency (~0.75) ✓
// Monzo: Flowing sections → low consistency (~0.35) ✓
// Δ = 0.40 (excellent!)
```

**Interpretation**:
- High (0.7-1.0): Regular rhythm (news grids, dashboards)
- Medium (0.4-0.7): Some structure (marketing sites)
- Low (0.0-0.4): Organic flow (portfolios, landing pages)

---

### Feature 15: Grid Regularity Score (NEW)

**What it captures**: Rigid alignment (CNN) vs freeform layout (Monzo)

**Calculation**:
```typescript
function calculateGridRegularity(nodes: ComputedStyleNode[]): number {
  // Step 1: Collect X positions (left edges)
  const xPositions = nodes.map(n => n.bbox.x);

  // Step 2: Detect common X alignments (columns)
  const columns = detectAlignmentLines(xPositions, 10); // 10px tolerance

  // Step 3: Calculate what % of elements align to columns
  let alignedCount = 0;
  for (const node of nodes) {
    if (columns.some(col => Math.abs(node.bbox.x - col) < 10)) {
      alignedCount++;
    }
  }
  const columnAlignmentRatio = alignedCount / nodes.length;

  // Step 4: Repeat for Y positions (rows)
  const yPositions = nodes.map(n => n.bbox.y);
  const rows = detectAlignmentLines(yPositions, 10);
  alignedCount = 0;
  for (const node of nodes) {
    if (rows.some(row => Math.abs(node.bbox.y - row) < 10)) {
      alignedCount++;
    }
  }
  const rowAlignmentRatio = alignedCount / nodes.length;

  // Step 5: Combine column and row alignment
  const gridRegularity = (columnAlignmentRatio + rowAlignmentRatio) / 2;

  return gridRegularity;
}

function detectAlignmentLines(positions: number[], tolerance: number): number[] {
  // Cluster positions within tolerance
  const sorted = [...positions].sort((a, b) => a - b);
  const clusters: number[] = [];

  let currentCluster = [sorted[0]];
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] - sorted[i - 1] <= tolerance) {
      currentCluster.push(sorted[i]);
    } else {
      // Save cluster average
      clusters.push(currentCluster.reduce((a, b) => a + b, 0) / currentCluster.length);
      currentCluster = [sorted[i]];
    }
  }
  if (currentCluster.length > 0) {
    clusters.push(currentCluster.reduce((a, b) => a + b, 0) / currentCluster.length);
  }

  return clusters;
}

// Normalization: Already 0-1 (percentage aligned)

// Expected results:
// CNN: Strict grid → high regularity (~0.85) ✓
// Monzo: Flowing layout → low regularity (~0.40) ✓
// Δ = 0.45 (excellent!)
```

**Interpretation**:
- High (0.7-1.0): Strict grid (news, galleries, tables)
- Medium (0.4-0.7): Loose grid (marketing sites)
- Low (0.0-0.4): Freeform (creative sites)

---

### Feature 16: Above-Fold Density (NEW)

**What it captures**: Information density in the critical first viewport

**Calculation**:
```typescript
function calculateAboveFoldDensity(
  nodes: ComputedStyleNode[],
  viewport: Viewport
): number {
  // Filter to above-fold elements (Y + height < viewport height)
  const aboveFold = nodes.filter(n => n.bbox.y < viewport.height);

  // Calculate density just for above-fold
  const totalArea = aboveFold.reduce((sum, n) => sum + (n.bbox.w * n.bbox.h), 0);
  const foldArea = viewport.width * viewport.height;
  const foldDensity = totalArea / foldArea;

  // Also count element count (another dimension of density)
  const elementCount = aboveFold.length;
  const elementDensityPer1000px = (elementCount / foldArea) * 1000;

  // Combine area density and element density
  const combinedDensity = (normalizeLog(foldDensity, 150) +
                           normalizeLog(elementDensityPer1000px, 20)) / 2;

  return combinedDensity;
}

// Expected results:
// Monzo: Hero-heavy, fewer elements above fold → ~0.40 ✓
// CNN: Dense news grid above fold → ~0.75 ✓
// Δ = 0.35 (good!)
```

**Interpretation**:
- Low (0.0-0.3): Hero-driven, spacious (landing pages)
- Medium (0.3-0.6): Balanced (marketing sites)
- High (0.6-1.0): Dense, grid-heavy (news, dashboards)

---

## Part 3: Implementation Plan

### Phase 1: Fix Existing Features (Week 1)

#### Task 1.1: Refactor Density Normalization
**File**: `pipeline/vectors/extractors/layout-features.ts`

**Changes**:
```typescript
// OLD (line ~108):
return normalizeLog(densityRatio, 250);

// NEW:
return normalizeDensityPiecewise(densityRatio);

// Add new function:
function normalizeDensityPiecewise(rawDensity: number): number {
  if (rawDensity < 50) return (rawDensity / 50) * 0.2;
  else if (rawDensity < 150) return 0.2 + ((rawDensity - 50) / 100) * 0.3;
  else if (rawDensity < 250) return 0.5 + ((rawDensity - 150) / 100) * 0.3;
  else return 0.8 + Math.min((rawDensity - 250) / 250, 1) * 0.2;
}
```

**Testing**:
```bash
# Test on Monzo vs CNN
npx tsx test-vectors.ts 2025-10-02T13-03-58-115Z_03ad24ee_monzo-com
npx tsx test-vectors.ts 2025-10-02T13-09-20-742Z_14fe0555_cnn-com

# Expected: Monzo ~0.57, CNN ~0.61 (Δ = 0.04+)
```

**Estimated effort**: 2 hours

---

#### Task 1.2: Refactor Whitespace Calculation
**File**: `pipeline/vectors/extractors/layout-features.ts`

**Changes**:
```typescript
// OLD (lines 120-145): Replace entire function

// NEW:
function calculateWhitespaceBreathingRatio(
  nodes: ComputedStyleNode[],
  viewport: Viewport
): number {
  // Detect horizontal bands
  const bands = detectHorizontalBands(nodes, 20);

  // Measure vertical gaps
  const verticalGaps = measureVerticalGaps(bands);

  // Measure horizontal gaps within bands
  const horizontalGaps = measureHorizontalGaps(bands);

  // Combine (weight vertical 2x)
  const avgVerticalGap = calculateMean(verticalGaps);
  const avgHorizontalGap = calculateMean(horizontalGaps);
  const combinedGap = (avgVerticalGap * 2 + avgHorizontalGap) / 3;

  // Normalize 8-128px range
  return normalizeLinear(combinedGap, 8, 128);
}

// Helper functions:
function detectHorizontalBands(nodes: ComputedStyleNode[], yThreshold: number): ComputedStyleNode[][] {
  // Implementation from Solution 2A above
}

function measureVerticalGaps(bands: ComputedStyleNode[][]): number[] {
  // Implementation from Solution 2A above
}

function measureHorizontalGaps(bands: ComputedStyleNode[]): number[] {
  // Implementation from Solution 2A above
}
```

**Testing**:
```bash
# Test on Monzo vs CNN
npx tsx scripts/validate-layout-features.ts monzo cnn

# Expected: Monzo ~0.60, CNN ~0.20 (Δ = 0.40+)
```

**Estimated effort**: 4 hours

---

### Phase 2: Add New Features (Week 2)

#### Task 2.1: Add Element Scale Variance
**File**: `pipeline/vectors/extractors/layout-features.ts`

**Add to `LayoutFeatureSet` interface**:
```typescript
export interface LayoutFeatureSet {
  // ... existing features
  elementScaleVariance: number; // NEW
}
```

**Add calculation** (after line 300):
```typescript
// Calculate element scale variance
const areas = nodes.map(n => n.bbox.w * n.bbox.h);
const mean = calculateMean(areas);
const stdDev = calculateStdDev(areas);
const cv = stdDev / mean;

const sorted = [...areas].sort((a, b) => a - b);
const median = sorted[Math.floor(sorted.length / 2)];
const q1 = sorted[Math.floor(sorted.length * 0.25)];
const q3 = sorted[Math.floor(sorted.length * 0.75)];
const iqrRatio = (q3 - q1) / median;

const scaleVariance = (cv + iqrRatio) / 2;
const elementScaleVariance = normalizeLinear(scaleVariance, 0.2, 2.0);
```

**Estimated effort**: 2 hours

---

#### Task 2.2: Add Vertical Rhythm Consistency
**File**: `pipeline/vectors/extractors/layout-features.ts`

**Implementation**: Per calculation above

**Estimated effort**: 3 hours

---

#### Task 2.3: Add Grid Regularity Score
**File**: `pipeline/vectors/extractors/layout-features.ts`

**Implementation**: Per calculation above

**Estimated effort**: 3 hours

---

#### Task 2.4: Add Above-Fold Density
**File**: `pipeline/vectors/extractors/layout-features.ts`

**Implementation**: Per calculation above

**Estimated effort**: 2 hours

---

### Phase 3: Update Vector Integration (Week 2)

#### Task 3.1: Update global-style-vec.ts
**File**: `pipeline/vectors/global-style-vec.ts`

**Problem**: We're at 64D capacity, need to add 4 features (68D total)

**Solution**: We currently have 8 reserved typography slots and 1 reserved spacing slot. Use 4 of them.

**Changes**:
```typescript
// Line ~145: Replace typo_reserved_1-4 with new features

// OLD:
for (let i = 0; i < 8; i++) {
  featureNames.push(`typo_reserved_${i + 1}`);
  interpretable.push(0);
}

// NEW:
// Element scale variance (replaces typo_reserved_1)
featureNames.push('layout_element_scale_variance');
interpretable.push(layoutFeats.elementScaleVariance);

// Vertical rhythm (replaces typo_reserved_2)
featureNames.push('layout_vertical_rhythm');
interpretable.push(layoutFeats.verticalRhythmConsistency);

// Grid regularity (replaces typo_reserved_3)
featureNames.push('layout_grid_regularity');
interpretable.push(layoutFeats.gridRegularityScore);

// Above-fold density (replaces typo_reserved_4)
featureNames.push('layout_above_fold_density');
interpretable.push(layoutFeats.aboveFoldDensity);

// Reserved (4D remaining)
for (let i = 0; i < 4; i++) {
  featureNames.push(`typo_reserved_${i + 1}`);
  interpretable.push(0);
}
```

**Estimated effort**: 1 hour

---

#### Task 3.2: Update Vector Dimension Documentation
**File**: `IMPLEMENTATION_SUMMARY.md`

**Update vector structure**:
```markdown
### New Vector Structure (64D)
- [0-15] Color features (16D)
- [16-27] Typography features (12D) ← 4 new layout features added
- [28-39] Spacing features (12D)
- [40-47] Shape features (8D)
- [48-63] Brand personality (16D)
```

**Estimated effort**: 30 minutes

---

### Phase 4: Testing & Validation (Week 3)

#### Task 4.1: Unit Tests for New Features
**File**: `tests/unit/layout-features-v2.spec.ts`

**Test cases**:
```typescript
describe('Density Normalization V2', () => {
  it('should differentiate Monzo (173) from CNN (185)', () => {
    expect(normalizeDensityPiecewise(173.82)).toBeCloseTo(0.571, 2);
    expect(normalizeDensityPiecewise(185.82)).toBeCloseTo(0.607, 2);
    expect(Math.abs(0.607 - 0.571)).toBeGreaterThan(0.03);
  });
});

describe('Whitespace Gap Measurement', () => {
  it('should measure vertical gaps correctly', () => {
    const mockBands = [
      [{ bbox: { y: 0, h: 100 } }],
      [{ bbox: { y: 180, h: 50 } }], // 80px gap
    ];
    const gaps = measureVerticalGaps(mockBands);
    expect(gaps[0]).toBe(80);
  });
});

describe('Element Scale Variance', () => {
  it('should detect uniform vs varied sizes', () => {
    const uniformNodes = Array(10).fill({ bbox: { w: 100, h: 100 } });
    const variedNodes = [
      { bbox: { w: 500, h: 300 } },
      { bbox: { w: 100, h: 100 } },
      { bbox: { w: 200, h: 150 } },
    ];

    expect(calculateElementScaleVariance(uniformNodes)).toBeLessThan(0.2);
    expect(calculateElementScaleVariance(variedNodes)).toBeGreaterThan(0.5);
  });
});
```

**Estimated effort**: 4 hours

---

#### Task 4.2: Integration Tests with Real Captures
**File**: `tests/integration/layout-features-v2.spec.ts`

**Test Monzo vs CNN differentiation**:
```typescript
describe('Monzo vs CNN Differentiation V2', () => {
  it('should show significant improvement in differentiation', async () => {
    const monzo = await buildVectors('monzo-capture-id');
    const cnn = await buildVectors('cnn-capture-id');

    // Density: Should improve from Δ0.011 to Δ0.036+
    const densityDiff = Math.abs(
      monzo.features.spacing_density_score - cnn.features.spacing_density_score
    );
    expect(densityDiff).toBeGreaterThan(0.03);

    // Whitespace: Should improve from Δ0.0 to Δ0.40+
    const whitespaceDiff = Math.abs(
      monzo.features.spacing_whitespace_ratio - cnn.features.spacing_whitespace_ratio
    );
    expect(whitespaceDiff).toBeGreaterThan(0.30);

    // NEW: Element scale should differentiate
    const scaleDiff = Math.abs(
      monzo.features.layout_element_scale_variance - cnn.features.layout_element_scale_variance
    );
    expect(scaleDiff).toBeGreaterThan(0.30);

    // NEW: Grid regularity should differentiate
    const gridDiff = Math.abs(
      monzo.features.layout_grid_regularity - cnn.features.layout_grid_regularity
    );
    expect(gridDiff).toBeGreaterThan(0.30);

    // Overall L2 distance should improve
    const distance = calculateL2Distance(monzo.vector, cnn.vector);
    expect(distance).toBeGreaterThan(3.5); // Up from 1.73
  });
});
```

**Estimated effort**: 3 hours

---

#### Task 4.3: Validation Script Enhancement
**File**: `scripts/validate-layout-features.ts`

**Add V2 comparison**:
```typescript
// Add section showing V1 vs V2 improvement
console.log('\n=== V2 IMPROVEMENTS ===\n');
console.log('Feature                  V1 Δ      V2 Δ      Improvement');
console.log('─'.repeat(60));
console.log(`Density                  0.011     ${densityDiffV2.toFixed(3)}     ${improvement}x`);
console.log(`Whitespace               0.000     ${whitespaceDiffV2.toFixed(3)}     ∞`);
console.log(`Element Scale            N/A       ${scaleDiff.toFixed(3)}     NEW`);
console.log(`Grid Regularity          N/A       ${gridDiff.toFixed(3)}     NEW`);
```

**Estimated effort**: 1 hour

---

### Phase 5: Database Reindexing (Week 3)

#### Task 5.1: Recalculate All Vectors
**Script**: `scripts/recalculate-all-vectors.ts` (already exists)

**Run**:
```bash
npx tsx scripts/recalculate-all-vectors.ts
```

**Expected**: All 10 captures recalculated with V2 features

**Estimated effort**: 30 minutes (mostly runtime)

---

#### Task 5.2: Reindex Database
**Script**: `scripts/reindex-database-vectors.ts` (already exists)

**Run**:
```bash
npx tsx scripts/reindex-database-vectors.ts
```

**Expected**: All style_profiles updated with V2 vectors

**Estimated effort**: 30 minutes (mostly runtime)

---

### Phase 6: Frontend Updates (Week 4)

#### Task 6.1: Update Layout Tab UI
**File**: `app/vectors/[styleProfileId]/page.tsx`

**Add new features to Layout tab**:
```tsx
<FeatureCategoryCard title="Layout Structure (NEW)">
  <FeatureBar
    name="Element Scale Variance"
    value={layout.element_scale_variance}
    labels={['Uniform Grid', 'Mixed Sizes']}
    description="Large cards vs small thumbnails"
  />
  <FeatureBar
    name="Vertical Rhythm"
    value={layout.vertical_rhythm}
    labels={['Organic Flow', 'Regular Grid']}
    description="Section spacing consistency"
  />
  <FeatureBar
    name="Grid Regularity"
    value={layout.grid_regularity}
    labels={['Freeform', 'Strict Grid']}
    description="Element alignment to grid"
  />
  <FeatureBar
    name="Above-Fold Density"
    value={layout.above_fold_density}
    labels={['Hero-Driven', 'Content-Dense']}
    description="First viewport information density"
  />
</FeatureCategoryCard>
```

**Estimated effort**: 2 hours

---

#### Task 6.2: Update Analysis Scripts
**Files**:
- `scripts/analyze-layout-features.py`
- `scripts/visualize-layout-heatmap.py`
- `scripts/deep-compare-monzo-cnn.py`

**Add new features** to output

**Estimated effort**: 2 hours

---

## Part 4: Migration Strategy

### Backward Compatibility

**Issue**: Existing vectors have old normalization, new vectors will be incompatible

**Solution**: Version the vectors

```typescript
// Add to vector metadata
export interface VectorMetadata {
  version: '2.0'; // NEW
  featureNames: string[];
  nonZeroCount: number;
  normalizationVersion: 'piecewise-v2'; // NEW
}
```

**Migration Path**:
1. V1 vectors remain in database (don't delete)
2. V2 vectors written with version tag
3. Comparison tools check version and warn if mixing V1/V2
4. After 1 month, deprecate V1 (all captures re-vectorized)

---

## Part 5: Success Metrics

### Quantitative Targets

| Metric | Current (V1) | Target (V2) | Measurement |
|--------|-------------|-------------|-------------|
| Monzo vs CNN L2 distance | 1.73 | > 3.5 | 2.0x improvement |
| Density differentiation (Δ) | 0.011 | > 0.03 | 3x improvement |
| Whitespace differentiation (Δ) | 0.000 | > 0.30 | ∞ improvement |
| Features with good differentiation (Δ > 0.1) | 5/12 (42%) | 10/16 (63%) | 1.5x coverage |
| Vector ceiling/floor issues | 2/12 (17%) | 0/16 (0%) | Eliminate |

### Qualitative Targets

- ✓ Designer can distinguish Monzo (flowing, large cards) from CNN (grid, small items)
- ✓ Features capture visual differences, not just technical metrics
- ✓ Normalization preserves differences in "normal" range (150-250 density)
- ✓ New features add orthogonal signal (not correlated with existing)

---

## Part 6: Risk Mitigation

### Risk 1: Performance Regression

**Concern**: Gap measurement and band detection add O(n²) complexity

**Mitigation**:
- Profile feature extraction (target: < 500ms for 1000 elements)
- Optimize band detection with spatial indexing (quadtree)
- Sample large node arrays (>2000 nodes) instead of processing all

**Fallback**: If too slow, use simpler padding statistics approach

---

### Risk 2: Breaking Existing Captures

**Concern**: Re-normalization changes all existing vectors

**Mitigation**:
- Version vectors (V1 vs V2)
- Keep old normalization as `legacy-normalize` function
- Add flag to buildVectors(): `version: 'v1' | 'v2'`
- Test backward compatibility with existing captures

---

### Risk 3: New Features Don't Differentiate

**Concern**: Element scale, grid regularity might not work as expected

**Mitigation**:
- Test on diverse captures BEFORE full rollout:
  - Dawn Labs (minimal, freeform)
  - Monzo (flowing, large cards)
  - CNN (grid, small items)
  - Stripe (complex, mixed)
- Require Δ > 0.3 between at least 2 sites for each new feature
- If feature fails, replace with alternative (e.g., text line length)

---

### Risk 4: Normalization Still Hits Ceiling

**Concern**: Percentile approach might still saturate at extremes

**Mitigation**:
- After collecting statistics, plot distributions
- Adjust percentiles if needed (use p95 instead of p90)
- Use piecewise within percentile ranges for extra resolution
- Monitor new captures for saturation

---

## Part 7: Timeline

### Week 1: Normalization Fixes
- Days 1-2: Implement piecewise density normalization
- Days 3-5: Implement gap-based whitespace measurement
- Test on Monzo vs CNN

### Week 2: New Features
- Days 1-2: Implement element scale variance + above-fold density
- Days 3-4: Implement vertical rhythm + grid regularity
- Day 5: Integration into vector builder

### Week 3: Testing & Validation
- Days 1-2: Unit tests + integration tests
- Days 3-4: Validation on all captures
- Day 5: Database reindexing

### Week 4: Frontend & Polish
- Days 1-2: Update UI with new features
- Days 3-4: Update analysis scripts
- Day 5: Documentation + release

**Total**: 4 weeks (80 hours)

---

## Part 8: File Changes Summary

### Files to Modify

1. `pipeline/vectors/extractors/layout-features.ts` (MAJOR)
   - Replace density normalization (line ~108)
   - Replace whitespace calculation (lines 120-145)
   - Add 4 new feature calculations
   - Add helper functions (band detection, gap measurement, grid alignment)

2. `pipeline/vectors/global-style-vec.ts` (MINOR)
   - Add 4 new features to vector (lines ~145-147)
   - Update metadata version

3. `pipeline/vectors/utils/math.ts` (MINOR)
   - Add `normalizeDensityPiecewise()`
   - Add `detectAlignmentLines()`

4. `tests/unit/layout-features-v2.spec.ts` (NEW)
   - Unit tests for new features

5. `tests/integration/layout-features-v2.spec.ts` (NEW)
   - Integration tests for differentiation

6. `app/vectors/[styleProfileId]/page.tsx` (MINOR)
   - Add 4 new features to Layout tab

7. `scripts/analyze-layout-features.py` (MINOR)
   - Add new features to output

8. `scripts/visualize-layout-heatmap.py` (MINOR)
   - Add new features to heatmap

9. `scripts/deep-compare-monzo-cnn.py` (MINOR)
   - Update with V2 results

10. `IMPLEMENTATION_SUMMARY.md` (MINOR)
    - Document V2 changes

---

## Conclusion

This plan addresses the root causes of poor Monzo vs CNN differentiation:

**Fixes**:
- Density normalization: 3-4x better differentiation
- Whitespace measurement: ∞ improvement (from 0 to 0.4+)

**Additions**:
- Element scale variance: Captures card vs thumbnail difference
- Vertical rhythm: Captures section spacing consistency
- Grid regularity: Captures alignment patterns
- Above-fold density: Captures first-viewport information density

**Expected Outcome**:
- Monzo vs CNN L2 distance: 1.73 → 3.5+ (2x improvement)
- Features with good differentiation: 5/12 → 10/16 (63% coverage)
- Zero ceiling/floor saturation issues

**Timeline**: 4 weeks, 80 hours total effort
