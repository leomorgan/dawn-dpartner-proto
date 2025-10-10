# Extraction & Normalization Fix Plan

**Date**: 2025-10-10
**Status**: Planning
**Priority**: HIGH - Critical for vector quality

> **⚠️ CRITICAL UPDATE (2025-10-10)**: Original plan used z-score normalization with population statistics (μ, σ). This approach **does not work** for one-by-one brand ingestion because:
> - Z-score requires knowing population mean/std before normalizing
> - For the first brand, we have no population stats yet
> - Can't compute μ/σ from a single sample
>
> **Updated approach**: Use **fixed min-max bounds** informed by empirical data (p05-p95 percentiles, extended 10-20%). Bounds are frozen, work for first brand and all subsequent brands.

---

## 🎯 Executive Summary

Our analysis revealed **two critical issues**:

1. **Extraction Issues**: Dodgy values (9999px, 33M px radii, 0px fonts) polluting token data
2. **Normalization Issues**: Scattered, inconsistent normalization with hardcoded ranges being destroyed by outliers

**Solution**:
- Fix extraction at source (validate & sanitize tokens)
- Centralize ALL normalization in one place (vector building stage)
- Use **theoretical range normalization** (data-informed fixed bounds, no population stats)
- Apply L2 normalization to final vector

---

## 🔍 Problems Identified

### Problem 1: Dodgy Token Extraction

**Evidence from raw data**:

```
border_radius values:
- radius_max_RAW: [16.0, 33554400.0]  ← 33 MILLION pixels!
- radius_median_RAW: [4.0, 9999.0]    ← 9999 = "infinite" hack

font_size values:
- font_size_min_RAW: [0.0, 16.8]      ← 0px fonts (hidden elements?)

color_count values:
- Range: [1, 12]                       ← Some brands only 1 color?
```

**Root causes**:
1. No validation/sanitization in token extractors
2. Including hidden/invalid elements
3. CSS tricks (9999px, 100vmax) being captured literally
4. No outlier detection at extraction time

**Impact**:
- Garbage in → garbage out
- Outliers destroy normalization ranges
- Vectors encode bugs, not design intent

---

### Problem 2: Scattered, Inconsistent Normalization

**Current state**: Normalization happens in multiple places:

```
❌ Scattered normalization:

1. pipeline/vectors/global-style-vec.ts:
   normalizeLinear(Math.max(...fontSizes), 16, 96)    // Hardcoded max

2. pipeline/vectors/color-encoding-v2.ts:
   normalizeLinear(avgDistance, 0, 50)                 // Hardcoded max

3. pipeline/vectors/utils/math.ts:
   normalizeLog(value, midpoint)                       // Different strategy

4. Feature extractors:
   // Some pre-normalize, some don't
   layoutFeats.verticalRhythmConsistency  // Already [0,1]
```

**Problems**:
- No single source of truth for normalization strategy
- Hardcoded ranges are guesses, not data-driven
- Outliers clamp to 1.0, compressing all normal values
- Can't easily switch normalization strategies
- Violates DRY principle massively

**Impact**:
- Inconsistent feature scaling
- Loss of information from outliers
- Difficult to maintain/debug
- No way to update ranges without touching multiple files

---

## ✅ Proposed Solution

### Architecture: Two-Stage Pipeline

```
┌─────────────────────────────────────────────────────────────────┐
│ STAGE 1: EXTRACTION & VALIDATION                                │
│ Location: pipeline/tokens/, pipeline/vectors/extractors/        │
├─────────────────────────────────────────────────────────────────┤
│ Input:  Raw HTML, CSS, DOM                                      │
│ Output: VALIDATED, RAW tokens (no normalization)                │
│                                                                  │
│ Responsibilities:                                                │
│ - Extract design tokens (fonts, spacing, colors, radii)         │
│ - VALIDATE: Remove invalid values (0px, 9999px, etc)            │
│ - SANITIZE: Cap extreme outliers (>3σ from median)              │
│ - OUTPUT: Clean RAW values (e.g., fontSizes = [12, 16, 24, 48]) │
│                                                                  │
│ ⚠️ NO NORMALIZATION AT THIS STAGE                               │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ STAGE 2: CENTRALIZED NORMALIZATION                              │
│ Location: pipeline/vectors/normalization/ (NEW)                 │
├─────────────────────────────────────────────────────────────────┤
│ Input:  Clean RAW tokens + fixed normalization bounds           │
│ Output: Normalized feature vectors [53D, 256D, 309D]            │
│                                                                  │
│ Responsibilities:                                                │
│ - Load normalization bounds (min, max) from config              │
│ - Apply feature-specific normalization:                         │
│   - Log → Min-Max for skewed features (log first, then scale)  │
│   - Min-Max for symmetric features                              │
│   - Theoretical bounds for color spaces (LCH: 0-100, etc)       │
│ - L2 normalize final vector to unit length                      │
│                                                                  │
│ ⚠️ Bounds are FIXED (data-informed but frozen)                  │
│ ✅ SINGLE SOURCE OF TRUTH FOR ALL NORMALIZATION                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 📋 Implementation Plan

### Phase 1: Fix Extraction & Validation (Week 1)

#### Task 1.1: Create Token Validation Module

**File**: `pipeline/tokens/validation.ts`

```typescript
/**
 * Token validation & sanitization
 * Removes invalid/extreme values at extraction time
 */

interface ValidationRules {
  fontSizes: { min: number; max: number; outlierThreshold: number };
  spacing: { min: number; max: number; outlierThreshold: number };
  borderRadius: { min: number; max: number; outlierThreshold: number };
  // ...
}

const VALIDATION_RULES: ValidationRules = {
  fontSizes: {
    min: 6,      // Below 6px = likely hidden/invalid
    max: 200,    // Above 200px = extreme but valid (hero/display fonts)
    outlierThreshold: 3.5,  // Remove if >3.5σ from median (conservative)
  },
  fontWeights: {
    min: 100,
    max: 900,
    outlierThreshold: 3.5,
  },
  spacing: {
    min: 0,
    max: 500,    // 500px = reasonable max spacing
    outlierThreshold: 3.5,
  },
  borderRadius: {
    min: 0,
    max: 100,    // 100px = reasonable max radius (catches 9999px hack)
    outlierThreshold: 3.5,
  },
  boxShadow: {
    // No min/max for count, just outlier detection
    outlierThreshold: 3.0,
  },
  // ...
};

export function validateTokens(tokens: DesignTokens): DesignTokens {
  return {
    ...tokens,
    typography: {
      ...tokens.typography,
      fontSizes: validateArray(tokens.typography.fontSizes, VALIDATION_RULES.fontSizes),
      fontWeights: validateArray(tokens.typography.fontWeights, VALIDATION_RULES.fontWeights),
    },
    spacing: validateArray(tokens.spacing, VALIDATION_RULES.spacing),
    borderRadius: validateArray(tokens.borderRadius.map(r => parseFloat(r)), VALIDATION_RULES.borderRadius).map(String),
    // ...
  };
}

function validateArray(values: number[], rules: ValidationRule): number[] {
  if (values.length === 0) return [rules.min]; // No values = use min as fallback

  // Step 1: Remove invalid values (below min, above max)
  let valid = values.filter(v => v >= rules.min && v <= rules.max);

  if (valid.length === 0) return [rules.min]; // All invalid = use min as fallback
  if (valid.length === 1) return valid; // Single value = no outlier detection needed

  // Step 2: Remove statistical outliers using Median Absolute Deviation (MAD)
  // MAD is more robust than standard deviation for outlier detection
  const sorted = [...valid].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  const mad = calculateMAD(valid, median);

  // Avoid division by zero if MAD = 0 (all values identical)
  if (mad === 0) return valid;

  valid = valid.filter(v => {
    const zScore = Math.abs(v - median) / (mad * 1.4826);  // MAD → σ conversion factor
    return zScore <= rules.outlierThreshold;
  });

  return valid.length > 0 ? valid : [median];
}

function calculateMAD(values: number[], median: number): number {
  const deviations = values.map(v => Math.abs(v - median));
  const sortedDev = deviations.sort((a, b) => a - b);
  return sortedDev[Math.floor(sortedDev.length / 2)];
}
```

**Integration**: Call `validateTokens()` in `pipeline/tokens/index.ts` before returning tokens.

**Acceptance criteria**:
- ✅ No 0px font sizes
- ✅ No 9999px or 33M px radii
- ✅ Outliers beyond 3σ removed
- ✅ All tokens have at least 1 valid value (with sensible fallbacks)

---

#### Task 1.2: Audit & Fix Token Extractors

**Critical Issues Identified from Raw Data Analysis**:

### 1. **Border Radius Extractor** (`pipeline/tokens/extractors/borders.ts`) - CRITICAL

**Problem**: Values of 9999px and 33554400px (33M!) getting through
```
Empirical data:
- radius_max_RAW: [16.0, 33554400.0]  ← 33 MILLION pixels!
- radius_median_RAW: [4.0, 9999.0]    ← "infinite" hack for fully rounded buttons
```

**Root causes**:
- `border-radius: 9999px` is a common CSS hack for "fully rounded" (should be capped or normalized)
- Very large computed values (33M px) suggest `calc()` overflow or viewport units gone wrong
- Not handling percentage-based radius (`border-radius: 50%`)

**Fixes**:
```typescript
// In pipeline/tokens/extractors/borders.ts

function extractBorderRadius(element: Element): number | null {
  const computed = getComputedStyle(element);
  const radiusStr = computed.borderRadius;

  // Skip if no radius
  if (!radiusStr || radiusStr === '0px') return null;

  // Handle percentage (convert to px based on element dimensions)
  if (radiusStr.includes('%')) {
    const pct = parseFloat(radiusStr);
    const minDim = Math.min(element.offsetWidth, element.offsetHeight);
    return (pct / 100) * minDim;
  }

  // Parse px value
  let radius = parseFloat(radiusStr);

  // Cap "infinite" radius hacks (9999px, 999em, etc.)
  // Anything >100px is effectively fully rounded for most buttons
  if (radius > 100) {
    return 100;  // Cap at 100px
  }

  return radius;
}
```

**Acceptance criteria**:
- ✅ No values >100px in extracted tokens
- ✅ `border-radius: 9999px` → capped to 100px
- ✅ `border-radius: 50%` → converted to px correctly

---

### 2. **Font Extractor** (`pipeline/tokens/extractors/fonts.ts`) - HIGH PRIORITY

**Problem**: Font sizes of 0px getting through
```
Empirical data:
- font_size_min_RAW: [0.0, 16.8]  ← 0px fonts (hidden elements, before/after pseudos)
```

**Root causes**:
- Including hidden elements (`display: none`, `visibility: hidden`, `opacity: 0`)
- Including pseudo-elements (`::before`, `::after`) with 0px fonts
- Not filtering by computed visibility

**Fixes**:
```typescript
// In pipeline/tokens/extractors/fonts.ts

function isVisibleElement(element: Element): boolean {
  const computed = getComputedStyle(element);

  // Check display/visibility
  if (computed.display === 'none') return false;
  if (computed.visibility === 'hidden') return false;
  if (parseFloat(computed.opacity) === 0) return false;

  // Check bounding box (element has actual size)
  const rect = element.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) return false;

  return true;
}

function extractFontSizes(document: Document): number[] {
  const sizes = new Set<number>();

  // Only include visible text elements
  const textElements = document.querySelectorAll('p, h1, h2, h3, h4, h5, h6, span, a, button, li, td, th');

  textElements.forEach(el => {
    if (!isVisibleElement(el)) return;  // Skip hidden

    const computed = getComputedStyle(el);
    const fontSize = parseFloat(computed.fontSize);

    // Only include valid font sizes (>= 6px)
    if (fontSize >= 6) {
      sizes.add(fontSize);
    }
  });

  return Array.from(sizes).sort((a, b) => a - b);
}
```

**Acceptance criteria**:
- ✅ No font sizes <6px in extracted tokens
- ✅ Only visible elements included
- ✅ Hidden/pseudo-elements filtered out

---

### 3. **Spacing Extractor** (`pipeline/tokens/extractors/spacing.ts`) - MEDIUM PRIORITY

**Problem**: Need to verify no invalid spacing values
```
Empirical data shows spacing is mostly clean, but should audit:
- spacing_min_RAW: all 0 (suspicious - should have variety)
```

**Potential issues**:
- Including `margin: auto` or `padding: inherit` as 0
- Not capturing all spacing tokens (only seeing 0 for min)

**Audit checklist**:
- [ ] Are we capturing margin AND padding?
- [ ] Are we excluding `auto`, `inherit`, negative values?
- [ ] Are we including gap (flexbox/grid spacing)?
- [ ] Why is spacing_min always 0? (Expected: 2px, 4px, 8px base spacing)

**Fixes**:
```typescript
// In pipeline/tokens/extractors/spacing.ts

function extractSpacing(document: Document): number[] {
  const spacing = new Set<number>();

  const elements = document.querySelectorAll('*');

  elements.forEach(el => {
    if (!isVisibleElement(el)) return;

    const computed = getComputedStyle(el);

    // Extract margin (exclude auto, negative)
    ['marginTop', 'marginRight', 'marginBottom', 'marginLeft'].forEach(prop => {
      const value = computed[prop];
      if (value && value !== 'auto') {
        const px = parseFloat(value);
        if (px > 0 && px <= 500) {  // Valid range
          spacing.add(px);
        }
      }
    });

    // Extract padding (exclude inherit)
    ['paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft'].forEach(prop => {
      const value = computed[prop];
      if (value && value !== 'inherit') {
        const px = parseFloat(value);
        if (px > 0 && px <= 500) {
          spacing.add(px);
        }
      }
    });

    // Extract gap (flexbox/grid)
    if (computed.gap && computed.gap !== 'normal') {
      const px = parseFloat(computed.gap);
      if (px > 0 && px <= 500) {
        spacing.add(px);
      }
    }
  });

  return Array.from(spacing).sort((a, b) => a - b);
}
```

**Acceptance criteria**:
- ✅ Spacing values include small increments (2px, 4px, 8px)
- ✅ No negative spacing
- ✅ No `auto` or `inherit` parsed as 0

---

### 4. **Color Extractor** (`pipeline/tokens/extractors/colors.ts`) - LOW PRIORITY

**Problem**: Some brands showing only 1 color
```
Empirical data:
- color_count_RAW: [1, 12]  ← Some brands only 1 color?
```

**Potential issues**:
- Over-aggressive de-duplication (rounding LCH too aggressively)
- Not capturing all color sources (backgrounds, borders, shadows)
- Filtering out near-duplicates

**Audit checklist**:
- [ ] Are we extracting from background-color, color, border-color?
- [ ] Are we including box-shadow colors?
- [ ] How are we de-duplicating? (deltaE threshold?)
- [ ] Are we excluding grays/neutrals?

**Acceptance criteria**:
- ✅ Minimum 2-3 colors per brand (even monochrome sites have bg + text)
- ✅ Manual review: colors match brand palette visually

---

**Summary of Actions**:

| Extractor | Priority | Issue | Fix |
|-----------|----------|-------|-----|
| Border Radius | CRITICAL | 9999px, 33M px | Cap at 100px, handle % correctly |
| Font | HIGH | 0px fonts | Filter hidden elements, min 6px |
| Spacing | MEDIUM | All 0 for min | Audit extraction logic |
| Color | LOW | Only 1 color | Review de-duplication |

**Overall Acceptance Criteria**:
- ✅ All extracted tokens pass validation module
- ✅ Manual review of 5 brands shows sensible values
- ✅ Edge cases documented (e.g., how we handle `border-radius: 50%`)
- ✅ Unit tests for each extractor with edge cases

---

### Phase 2: Centralize Normalization (Week 1-2)

#### Task 2.1: Create Normalization Bounds File

**File**: `pipeline/vectors/normalization/normalization-bounds.json`

```json
{
  "version": "1.0.0",
  "computed_from": "45 brands (empirical analysis on 2025-10-10)",
  "approach": "Fixed min-max bounds informed by 5th-95th percentiles",
  "note": "Bounds are FROZEN - work for one-by-one ingestion, no population stats needed",
  "features": {
    "font_size_min": {
      "strategy": "minmax",
      "min": 6,
      "max": 20,
      "note": "From empirical p05=0, p95=16.8 → extended to 6-20px (capture extremes)"
    },
    "font_size_max": {
      "strategy": "log-minmax",
      "min": 20,
      "max": 150,
      "note": "From empirical p05=19.2, p95=94 → extended to 20-150px. Log-normal: apply log first."
    },
    "font_size_range": {
      "strategy": "minmax",
      "min": 0,
      "max": 100,
      "note": "From empirical p05=2.4, p95=86.5 → extended to 0-100px"
    },
    "spacing_min": {
      "strategy": "minmax",
      "min": 0,
      "max": 0,
      "note": "All values 0 (no variance)"
    },
    "spacing_median": {
      "strategy": "log-minmax",
      "min": 16,
      "max": 32,
      "note": "From empirical p05=16, p95=24. Highly skewed (-1.58), use log."
    },
    "spacing_max": {
      "strategy": "minmax",
      "min": 30,
      "max": 50,
      "note": "From empirical p05=32, p95=48 → symmetric distribution"
    },
    "radius_min": {
      "strategy": "log-minmax",
      "min": 2,
      "max": 20,
      "note": "From empirical range 2-9999 (outliers!). After validation, use 2-20px. Highly skewed."
    },
    "radius_median": {
      "strategy": "log-minmax",
      "min": 4,
      "max": 30,
      "note": "From empirical range 4-9999. After validation, use 4-30px. Highly skewed."
    },
    "radius_max": {
      "strategy": "log-minmax",
      "min": 16,
      "max": 200,
      "note": "From empirical range 16-33M (!). After validation, cap at 200px. Highly skewed."
    },
    "color_hero_lightness": {
      "strategy": "absolute",
      "min": 0,
      "max": 100,
      "note": "Theoretical LCH lightness bounds"
    },
    "color_hero_chroma": {
      "strategy": "absolute",
      "min": 0,
      "max": 150,
      "note": "Theoretical LCH chroma bounds (0-150 covers sRGB gamut)"
    }
    // ... all 53 features
  }
}
```

**Generation** (automated script):
1. Use existing `raw-feature-analysis.json` (already computed from 45 brands):
   - Extract p05, p95 for each feature
   - Identify skewness (|skew| > 1.0 = log-minmax)
   - Extend bounds by 10-20% to capture extremes

2. Run `npm run generate:normalization-bounds`
   - Reads `raw-feature-analysis.json`
   - Generates `normalization-bounds.json` with strategy per feature:
     - |skew| > 1.0 → `log-minmax` (log transform, then min-max scale)
     - |skew| ≤ 1.0 → `minmax` (direct min-max scale)
     - LCH/theoretical → `absolute` (fixed theoretical bounds)
   - Validates: all 53 features have valid bounds

3. Manual review & adjustment:
   - Extend bounds if too tight (allow for future outliers)
   - Check for features that should use theoretical bounds
   - Add human-readable notes to JSON

4. Commit to version control with clear version bump

**Why this works for one-by-one ingestion**:
- No population statistics (μ, σ) required
- Bounds are fixed, work for first brand and all subsequent brands
- Informed by empirical data but frozen (not recomputed per brand)
- Captures extreme values via wide percentile-based ranges

**Acceptance criteria**:
- ✅ Bounds computed from empirical 45-brand analysis
- ✅ All 53 features have normalization strategy defined
- ✅ Bounds are wide enough to capture outliers (not just min-max of sample)
- ✅ File is human-readable and documented

---

#### Task 2.2: Create Normalization Module

**File**: `pipeline/vectors/normalization/index.ts`

```typescript
/**
 * Centralized normalization for all features
 * Single source of truth for feature scaling
 * Uses FIXED bounds (not population statistics) - works for one-by-one ingestion
 */

import normalizationBounds from './normalization-bounds.json';

interface FeatureBounds {
  strategy: 'minmax' | 'log-minmax' | 'absolute' | 'circular';
  min: number;
  max: number;
  note?: string;
}

/**
 * Normalize a single feature value using fixed min-max bounds
 *
 * @param value Raw feature value
 * @param featureName Name of feature (must exist in normalization-bounds.json)
 * @returns Normalized value in [0, 1] range
 */
export function normalizeFeature(value: number, featureName: string): number {
  const bounds = normalizationBounds.features[featureName];

  if (!bounds) {
    throw new Error(`No normalization bounds for feature: ${featureName}`);
  }

  switch (bounds.strategy) {
    case 'minmax':
      // Direct min-max scaling to [0, 1]
      return clamp((value - bounds.min) / (bounds.max - bounds.min), 0, 1);

    case 'log-minmax':
      // Log transform first (for skewed distributions), then min-max scale
      const logged = Math.log(value + 1);
      const logMin = Math.log(bounds.min + 1);
      const logMax = Math.log(bounds.max + 1);
      return clamp((logged - logMin) / (logMax - logMin), 0, 1);

    case 'absolute':
      // Theoretical bounds (e.g., LCH lightness 0-100)
      return clamp((value - bounds.min) / (bounds.max - bounds.min), 0, 1);

    case 'circular':
      throw new Error('Use normalizeCircular() for circular features');

    default:
      throw new Error(`Unknown strategy: ${bounds.strategy}`);
  }
}

/**
 * Clamp value to [min, max] range
 */
function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Normalize circular features (hue angles)
 * Returns [cos, sin] pair (already in [-1, 1] range)
 */
export function normalizeCircular(degrees: number): [number, number] {
  const rad = (degrees * Math.PI) / 180;
  return [Math.cos(rad), Math.sin(rad)];
}

/**
 * L2 normalize a vector to unit length
 *
 * @param vector Array of normalized features
 * @returns Unit-length vector
 */
export function l2Normalize(vector: number[]): number[] {
  const norm = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0));

  if (norm === 0) return vector; // Avoid division by zero

  return vector.map(v => v / norm);
}

/**
 * Get feature names in order for a given vector type
 */
export function getFeatureNames(vectorType: 'global' | 'cta'): string[] {
  if (vectorType === 'global') {
    return [
      // Colors (17D)
      'color_palette_avg_distance',
      'color_palette_min_distance',
      // ... all 53 features
    ];
  }
  // ... CTA features
}
```

**Usage in vector builders**:

```typescript
// OLD (in global-style-vec.ts):
interpretable.push(
  normalizeLinear(Math.min(...fontSizes), 8, 20),  // ❌ Hardcoded
  normalizeLinear(Math.max(...fontSizes), 16, 96), // ❌ Hardcoded
);

// NEW:
import { normalizeFeature, l2Normalize } from './normalization';

interpretable.push(
  normalizeFeature(Math.min(...fontSizes), 'font_size_min'),  // ✅ Data-driven
  normalizeFeature(Math.max(...fontSizes), 'font_size_max'),  // ✅ Data-driven
);

// At the end:
const normalized = l2Normalize(interpretable);
```

**Why this approach works**:
- **No population stats** - uses fixed min/max bounds, not μ/σ
- **Works for first brand** - bounds are pre-defined, not computed from data
- **Captures extremes** - bounds informed by p05-p95, extended 10-20%
- **All features in [0,1]** - consistent scaling before L2 normalization
- **Deterministic** - same bounds for all brands, reproducible results

**Acceptance criteria**:
- ✅ All normalization happens in one module
- ✅ Bounds loaded from single JSON file (no population stats)
- ✅ L2 normalization applied to final vector
- ✅ Type-safe (TypeScript errors if feature name doesn't exist)
- ✅ Easy to update (change JSON file, recompute)

---

#### Task 2.3: Refactor Vector Builders

**Files to update**:
1. `pipeline/vectors/global-style-vec.ts`
2. `pipeline/vectors/primary-cta-vec.ts`
3. `pipeline/vectors/color-encoding-v2.ts`

**Changes**:
- Remove all `normalizeLinear()` calls with hardcoded ranges
- Replace with `normalizeFeature(value, 'feature_name')`
- Remove all manual L2 normalization attempts
- Add L2 normalization at final vector assembly

**Before**:
```typescript
// 20 different places with hardcoded ranges
normalizeLinear(value, 0, 100)
normalizeLog(value, 5)
// Manual circular encoding
```

**After**:
```typescript
// Single source of truth
normalizeFeature(value, 'font_size_max')
normalizeCircular(hue)
// Automatic L2 normalization
l2Normalize(interpretable)
```

**Acceptance criteria**:
- ✅ Zero hardcoded normalization ranges in vector builders
- ✅ All features use centralized normalization
- ✅ All vectors L2 normalized before storage
- ✅ Tests pass (unit tests for normalization module)

---

### Phase 3: Testing & Validation (Week 2)

#### Task 3.1: Unit Tests

**File**: `pipeline/vectors/normalization/__tests__/normalization.test.ts`

```typescript
describe('Centralized Normalization', () => {
  describe('normalizeFeature', () => {
    it('applies min-max normalization', () => {
      // font_size_max: bounds [20, 150]
      const result = normalizeFeature(60, 'font_size_max');
      expect(result).toBeCloseTo((60 - 20) / (150 - 20), 2);  // ≈ 0.31
    });

    it('applies log-minmax for skewed features', () => {
      // border_radius_max: bounds [16, 200], log-minmax strategy
      const result = normalizeFeature(100, 'border_radius_max');
      const logged = Math.log(101);
      const logMin = Math.log(17);
      const logMax = Math.log(201);
      expect(result).toBeCloseTo((logged - logMin) / (logMax - logMin), 2);
    });

    it('clamps values outside bounds', () => {
      // font_size_max: bounds [20, 150]
      expect(normalizeFeature(200, 'font_size_max')).toBe(1.0);  // Clamped to max
      expect(normalizeFeature(10, 'font_size_max')).toBe(0.0);   // Clamped to min
    });

    it('throws error for unknown feature', () => {
      expect(() => normalizeFeature(50, 'unknown_feature')).toThrow();
    });
  });

  describe('l2Normalize', () => {
    it('normalizes vector to unit length', () => {
      const vec = [3, 4];  // Length = 5
      const result = l2Normalize(vec);
      expect(result).toEqual([0.6, 0.8]);

      // Check unit length
      const norm = Math.sqrt(result[0]**2 + result[1]**2);
      expect(norm).toBeCloseTo(1.0, 5);
    });
  });
});
```

---

#### Task 3.2: Integration Tests

**Test**: Ingest 3 brands, verify vectors are properly normalized

```typescript
describe('End-to-end vector normalization', () => {
  it('produces L2-normalized vectors with correct dimensions', async () => {
    // Ingest test brands
    await ingestBrand('https://stripe.com');

    // Retrieve vector
    const profile = await getStyleProfile('stripe.com');

    // Check dimensions
    expect(profile.interpretable_vec.length).toBe(53);
    expect(profile.combined_vec.length).toBe(309);

    // Check L2 normalization
    const norm = calculateNorm(profile.interpretable_vec);
    expect(norm).toBeCloseTo(1.0, 3);

    // Check all features in [0, 1] range (before L2 normalization)
    // This is harder to test after L2, but we can verify no NaN/Infinity
    const hasInvalidValues = profile.interpretable_vec.some(v => !isFinite(v));
    expect(hasInvalidValues).toBe(false);
  });
});
```

---

#### Task 3.3: Manual Verification

**Process**:
1. Reset database
2. Ingest 10 diverse brands (Stripe, Apple, CNN, etc.)
3. Run analysis script to verify:
   - No invalid tokens (0px, 9999px)
   - Vectors are L2 normalized (norm ≈ 1.0)
   - Individual features in [0, 1] range (before L2 normalization)
   - Extreme values clamped gracefully (no NaN, no Infinity)
   - Brand similarity makes sense (fintech brands cluster)

4. Document results in `NORMALIZATION_VERIFICATION.md`

**Acceptance criteria**:
- ✅ All 10 brands ingest successfully
- ✅ All vectors have unit length (L2 norm = 1.0)
- ✅ Feature distributions are in [0, 1] range before L2
- ✅ Brand similarity improved vs. old normalization

---

### Phase 4: Migration & Cleanup (Week 2)

#### Task 4.1: Database Migration

**File**: `lib/db/migrations/011_vectors_renormalized.sql`

```sql
-- Vectors need to be recomputed with new normalization
-- Easiest approach: drop and regenerate all vectors

-- Drop existing vectors (keep tokens)
UPDATE style_profiles SET
  interpretable_vec = NULL,
  font_embedding_vec = NULL,
  combined_vec = NULL;

DELETE FROM role_vectors_primarycta;

-- Note: Run full re-ingestion after this migration
```

**Process**:
1. Apply migration
2. Run full re-ingestion with new normalization
3. Verify all vectors regenerated correctly

---

#### Task 4.2: Remove Deprecated Code

**Files to clean up**:
1. `pipeline/vectors/utils/math.ts`:
   - Remove `normalizeLinear()` function (no longer used)
   - Remove `normalizeLog()` function (replaced by normalization module)
   - Remove `normalizeDensityPiecewise()` (no longer used)
   - Keep only statistical functions (mean, std, etc.)

2. Remove hardcoded ranges from:
   - `global-style-vec.ts`
   - `color-encoding-v2.ts`
   - `primary-cta-vec.ts`

**Acceptance criteria**:
- ✅ No more `normalizeLinear(x, min, max)` calls anywhere
- ✅ All normalization goes through centralized module
- ✅ Old utility functions removed or deprecated
- ✅ Code is cleaner and DRY

---

#### Task 4.3: Documentation

**Update files**:
1. `pipeline/vectors/README.md` - explain new normalization approach
2. `pipeline/vectors/normalization/README.md` - how to update population stats
3. `VECTOR_REFACTOR_SUMMARY.md` - append normalization refactor results

**New documentation**:
```markdown
# Vector Normalization

## Overview

All feature normalization happens in `pipeline/vectors/normalization/`.

## Updating Population Statistics

When adding new brands or changing extractors:

1. Ingest 50-100 diverse brands
2. Run: `npm run analyze:features`
3. Review `raw-feature-analysis.json`
4. Update `population-stats.json` with new μ, σ
5. Re-run ingestion to regenerate all vectors

## Adding New Features

1. Add feature extraction to appropriate module
2. Add feature stats to `population-stats.json`
3. Add feature name to `getFeatureNames()` in normalization module
4. Feature automatically normalized using centralized logic
```

---

## 📊 Success Metrics

### Extraction Quality
- ✅ Zero invalid values (0px fonts, 9999px radii) in tokens
- ✅ 100% of tokens pass validation
- ✅ Outlier rate < 5% per feature

### Normalization Quality
- ✅ All vectors L2 normalized (‖v‖ = 1.0 ± 0.01)
- ✅ Individual features in [0, 1] range before L2 normalization
- ✅ Zero hardcoded ranges in codebase (replaced with centralized bounds file)
- ✅ Single source of truth for all normalization

### Code Quality
- ✅ DRY: One normalization module, used everywhere
- ✅ Maintainable: Update one JSON file to change normalization
- ✅ Type-safe: TypeScript errors if feature name missing
- ✅ Tested: >90% code coverage for normalization module

### Vector Quality
- ✅ Brand similarity improved (fintech brands cluster better)
- ✅ Extreme values captured via wide bounds (not lost)
- ✅ Consistent across all vector types (global, CTA)

---

## 🚀 Rollout Plan

### Week 1
- **Mon-Tue**: Task 1.1 - Create validation module
- **Wed**: Task 1.2 - Audit extractors
- **Thu**: Task 2.1 - Generate normalization bounds (from existing 45-brand analysis)
- **Fri**: Task 2.2 - Create normalization module

### Week 2
- **Mon**: Task 2.3 - Refactor vector builders
- **Tue**: Task 3.1-3.2 - Unit & integration tests
- **Wed**: Task 3.3 - Manual verification
- **Thu**: Task 4.1 - Database migration & re-ingestion
- **Fri**: Task 4.2-4.3 - Cleanup & documentation

**Total**: 2 weeks to production-ready normalization

---

## 🔄 Maintenance

### Quarterly
- Re-analyze normalization bounds from latest 100 brands (check if bounds need adjustment)
- Review extraction validation rules (adjust thresholds if needed)
- Audit new edge cases

### Per Feature Addition
- Add feature to normalization-bounds.json
- Add to getFeatureNames()
- Run analysis to determine normalization strategy (minmax vs log-minmax)

### Per Major Release
- Version normalization-bounds.json
- Document breaking changes (if bounds significantly change)
- Provide migration path (regenerate all vectors)

---

## 📝 Answers to Key Questions

### 1. **Why not use z-score normalization with population statistics?**

**Critical flaw identified**: Z-score requires population mean (μ) and standard deviation (σ), but:
- We ingest brands **one-by-one** (not batch)
- For the **first brand**, we have no population stats yet
- Can't compute μ/σ from a single sample

**Solution**: Use **fixed min-max bounds** instead:
- Bounds are pre-defined (informed by empirical data, but frozen)
- Works for first brand and all subsequent brands
- Deterministic and reproducible

### 2. **Should we version normalization-bounds.json?**

**Yes, with semantic versioning:**
- Major version: Breaking changes (feature added/removed, strategy changed, bounds significantly adjusted)
- Minor version: Updated bounds (re-analyzed from new brands, minor adjustments)
- Patch version: Documentation/typo fixes

Track in git with tags: `normalization-bounds-v1.0.0`

### 3. **How to handle cold-start (no empirical data yet)?**

**Bootstrap strategy:**
1. Ship initial `normalization-bounds.v1.0.0.json` using existing 45-brand analysis
2. Bounds are based on p05-p95 percentiles, extended 10-20%
3. Document: "Bounds frozen for consistency, update only if significant new patterns emerge"
4. Provide script: `npm run analyze:bounds` to recompute from new data

### 4. **Should we support multiple normalization strategies per deployment?**

**No, for simplicity:**
- One strategy per `normalization-bounds.json` version
- Easy to A/B test: create `normalization-bounds.v2.0.0.json` with different bounds
- Switch by changing import in normalization module
- Document strategy rationale in JSON comments

### 5. **How to handle features that are already normalized (0-1)?**

**Two approaches:**

**Option A (recommended)**: Don't pre-normalize in extractors
- Extract RAW values only
- Let normalization module handle ALL scaling
- Consistent approach across all features

**Option B**: Mark pre-normalized features
- Set `strategy: 'passthrough'` with bounds [0, 1] in normalization-bounds.json
- Return value unchanged: `return value;`
- Document clearly which features are pre-normalized and why

**Decision**: Use Option A - remove all pre-normalization from extractors for consistency

### 6. **What about features with zero variance (all brands identical)?**

**Handle gracefully:**
```typescript
if (bounds.min === bounds.max) {
  // All brands have same value - return 0.5 (midpoint)
  return 0.5;
}
```

For spacing_min (all values = 0), set bounds [0, 0] and return 0.5 to avoid division by zero.

### 7. **Should we apply L2 normalization to interpretable vector only, or combined vector?**

**Both, but differently:**
- **Interpretable (53D)**: L2 normalize before combining
- **Font embedding (256D)**: Already L2 normalized by OpenAI
- **Combined (309D)**: L2 normalize AFTER concatenating [53D + 256D]

This ensures the combined vector is also unit length for consistent similarity metrics.

### 8. **How to handle new brands with extreme outliers (outside bounds)?**

**Two-stage handling:**
- **Stage 1 (validation)**: Caps extreme outliers >3.5σ from median (removes 9999px, 33M px bugs)
- **Stage 2 (normalization)**: Clamps values outside bounds to [0, 1]

**Example**: If font_size_max = 250px (bounds: 20-150):
- After validation: Still 250px (within reasonable outlier threshold)
- After normalization: Clamped to 1.0

**Result**: Extreme bugs filtered at extraction, moderate outliers gracefully clamped

---

## ✅ Definition of Done

- [ ] All tasks completed and reviewed
- [ ] Unit tests >90% coverage
- [ ] Integration tests pass
- [ ] Manual verification document created
- [ ] Documentation updated
- [ ] Database migrated and re-ingested
- [ ] Old normalization code removed
- [ ] Peer review completed
- [ ] Deployed to staging
- [ ] Verified in production

---

---

## 🎯 Critical Success Factors

### Must-Haves for Success

1. **Data Quality**: 50-100 diverse, high-quality brands for population stats
   - Avoid brand concentration (not all fintech, not all e-commerce)
   - Include outliers intentionally (design-forward brands like Apple, experimental sites)
   - Verify tokens before computing stats

2. **Validation Rigor**: Catch bad data at extraction, not in vectors
   - Conservative outlier thresholds (3.5σ, not 2σ)
   - Comprehensive extractor audit
   - Unit tests for edge cases (0px, 9999px, negative values)

3. **Documentation**: Future maintainers need to understand normalization
   - Why each feature uses its strategy
   - How to update population stats
   - When to regenerate vectors (answer: after stats change)

4. **Backward Compatibility**: Plan for schema evolution
   - Version population-stats.json clearly
   - Provide migration scripts
   - Keep old stats for comparison/rollback

### Common Pitfalls to Avoid

1. **Don't pre-normalize in extractors** - breaks DRY, causes confusion
2. **Don't hardcode ranges in vector builders** - defeats the purpose of centralized approach
3. **Don't skip L2 normalization** - breaks cosine similarity assumptions
4. **Don't forget to regenerate ALL vectors** - after changing normalization bounds
5. **Don't compute bounds from biased sample** - need industry diversity
6. **Don't use z-score normalization** - requires population stats, won't work for one-by-one ingestion

### Quick Wins

1. **Task 1.1 (validation)** - Immediately fixes 9999px bugs, low risk
2. **Task 2.1 (normalization bounds)** - Use existing 45-brand analysis, already have the data!
3. **Task 4.2 (cleanup)** - Removing old code reduces maintenance burden

---

## 📊 Expected Outcomes

### Quantitative Improvements

- **Extraction quality**: 0% invalid values (currently ~5-10% with outliers)
- **Code reduction**: -200 LOC (remove scattered normalization)
- **Maintenance**: 1 file to update (vs 5+ currently)
- **Vector consistency**: 100% L2 normalized (currently mixed)

### Qualitative Improvements

- **Developer experience**: Clear, centralized normalization logic
- **Debugging**: Easy to trace normalization issues to one module
- **Extensibility**: Adding features = update 1 JSON file
- **Confidence**: Data-driven ranges, not guesses

### Brand Similarity Improvements (Expected)

Based on CIEDE2000 improvements (+40% better clustering), expect:
- Fintech brands: 85-90% similarity (currently ~82%)
- Same-industry brands: +5-10pp similarity increase
- Cross-industry: Better separation (less false positives)

---

**Next Steps**: Begin with Task 1.1 (validation module) and Task 2.1 (population stats generation script) in parallel.
