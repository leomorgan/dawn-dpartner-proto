# Multi-Tier Color Classification Refactor Plan

**Date**: 2025-10-02
**Scope**: Complete pipeline refactor to implement 4-tier color classification
**Estimated Effort**: Medium (3-4 hours of focused work)

---

## Table of Contents

1. [Overview](#overview)
2. [New Color System Architecture](#new-color-system-architecture)
3. [Type System Changes](#type-system-changes)
4. [Pipeline Changes by Module](#pipeline-changes-by-module)
5. [Vector System Changes](#vector-system-changes)
6. [Migration Strategy](#migration-strategy)
7. [Testing Plan](#testing-plan)
8. [Rollout Steps](#rollout-steps)

---

## Overview

### Current System (Binary)

```typescript
colors: {
  primary: string[];   // chroma >= 10 (max 6)
  neutral: string[];   // chroma < 10 (max 4)
}
```

**Problems**:
- ❌ Hard limit of 4 neutrals causes all sites to converge
- ❌ Threshold of 10 is too low (includes muted brand colors as "primary")
- ❌ Doesn't capture nuance of "tinted neutrals" vs "pure neutrals"
- ❌ Doesn't distinguish "vibrant brand" vs "muted brand" colors

### New System (Multi-Tier)

```typescript
colors: {
  // === New 4-tier system ===
  foundation: string[];      // chroma < 5  (pure neutrals: #fff, #000, grays)
  tintedNeutrals: string[];  // chroma 5-20 (subtle tints: #f6f9fc, slate blues)
  accentColors: string[];    // chroma 20-50 (muted brand: navy, forest green)
  brandColors: string[];     // chroma > 50 (vibrant: Stripe purple, Monzo coral)

  // === Backward compatibility ===
  primary: string[];         // = accentColors + brandColors
  neutral: string[];         // = foundation + tintedNeutrals

  // === Unchanged ===
  semantic: { text, background, cta, accent, muted };
  contextual: { buttons, links, backgrounds, borders };
}
```

**Benefits**:
- ✅ Captures full spectrum of color usage
- ✅ Backward compatible (keep primary/neutral)
- ✅ More nuanced vector features
- ✅ Better matches designer mental models
- ✅ Enables new features (e.g., "find brands with muted palettes")

---

## New Color System Architecture

### Classification Algorithm

```typescript
interface ColorClassification {
  foundation: string[];      // Pure structural colors
  tintedNeutrals: string[];  // Subtle background tints
  accentColors: string[];    // Muted brand identity
  brandColors: string[];     // Vibrant brand identity
}

function classifyColorsByTier(colors: string[]): ColorClassification {
  const toLch = converter('lch');

  const foundation: string[] = [];
  const tintedNeutrals: string[] = [];
  const accentColors: string[] = [];
  const brandColors: string[] = [];

  for (const colorHex of colors) {
    const parsed = parse(colorHex);
    if (!parsed) continue;

    const lch = toLch(parsed);
    const chroma = lch.c ?? 0;
    const lightness = lch.l ?? 0;

    // Foundation: Pure blacks, whites, grays
    if (chroma < 5 || lightness < 5 || lightness > 95) {
      foundation.push(colorHex);
    }
    // Brand colors: Vibrant, high saturation
    else if (chroma > 50) {
      brandColors.push(colorHex);
    }
    // Accent colors: Muted brand identity
    else if (chroma > 20) {
      accentColors.push(colorHex);
    }
    // Tinted neutrals: Subtle background tints
    else {
      tintedNeutrals.push(colorHex);
    }
  }

  return { foundation, tintedNeutrals, accentColors, brandColors };
}
```

### Threshold Rationale

| Tier | Chroma Range | Examples | Purpose |
|------|--------------|----------|---------|
| **Foundation** | 0-5 | `#ffffff`, `#000000`, `#3a3a3a` | Core structural colors |
| **Tinted Neutrals** | 5-20 | `#f6f9fc`, `#425466`, `#c9d0c6` | Subtle backgrounds, muted text |
| **Accent Colors** | 20-50 | `#0a2540`, `#425466`, `#efa82e` | Muted brand colors, secondary |
| **Brand Colors** | 50+ | `#635bff`, `#ff4f40`, `#0000ee` | Primary brand identity, CTAs |

**Validation with Real Data**:

```
Stripe:
  Foundation:     #ffffff (0.0), #3a3a3a (0.0), #f6f9fc (1.9)
  Tinted:         #adbdcc (10.1), #425466 (13.3)
  Accent:         #0a2540 (20.6), #3f4b66 (17.5)
  Brand:          #635bff (91.6), #efa82e (71.1)

Monzo:
  Foundation:     #000000 (0.0), #ffffff (0.0), #f2f8f3 (3.2)
  Tinted:         #c9d0c6 (5.6), #091723 (10.6), #012433 (15.7)
  Accent:         —
  Brand:          #0000ee (124.5), #ff4f40 (82.5), #f64d3f (79.6)
```

---

## Type System Changes

### Phase 1: Extend DesignTokens Interface

**File**: `pipeline/tokens/index.ts`

```typescript
export interface DesignTokens {
  colors: {
    // === NEW: 4-tier classification ===
    foundation: string[];       // Pure neutrals (chroma < 5)
    tintedNeutrals: string[];   // Subtle tints (chroma 5-20)
    accentColors: string[];     // Muted brand (chroma 20-50)
    brandColors: string[];      // Vibrant brand (chroma > 50)

    // === DEPRECATED (keep for backward compat) ===
    /** @deprecated Use foundation + tintedNeutrals instead */
    primary: string[];
    /** @deprecated Use accentColors + brandColors instead */
    neutral: string[];

    // === UNCHANGED ===
    semantic: {
      text: string;
      background: string;
      cta: string;
      accent: string;
      muted: string;
    };
    contextual: {
      buttons: string[];
      links: string[];
      backgrounds: string[];
      borders: string[];
    };
  };
  // ... rest unchanged
}
```

### Phase 2: Update StyleReport Interfaces

**File**: `pipeline/tokens/index.ts`

```typescript
export interface ColorHarmonyAnalysis {
  paletteType: 'monochromatic' | 'analogous' | 'complementary' | 'triadic' | 'complex';
  harmonyScore: number;
  dominantHue: number;
  saturationRange: { min: number; max: number; avg: number };
  lightnessRange: { min: number; max: number; avg: number };

  // === NEW: Per-tier statistics ===
  tierDistribution: {
    foundation: number;       // Count
    tintedNeutrals: number;
    accentColors: number;
    brandColors: number;
  };

  // === NEW: Tier-specific metrics ===
  brandColorSaturation: number;  // Avg chroma of brand colors
  accentColorSaturation: number; // Avg chroma of accent colors
  neutralTint: number;           // Avg chroma of tinted neutrals (0-20)
}
```

---

## Pipeline Changes by Module

### 1. Token Extraction (`pipeline/tokens/index.ts`)

**Location**: Lines 785-817

#### Current Code
```typescript
// Separate primary and neutral colors based on saturation
const toLch = converter('lch');
const primaryColors: string[] = [];
const neutralColors: string[] = [];

for (const colorHex of topColors) {
  const parsed = parse(colorHex);
  if (!parsed) continue;

  const lch = toLch(parsed);
  const chroma = lch.c ?? 0;

  if (chroma < 10) {
    neutralColors.push(colorHex);
  } else {
    primaryColors.push(colorHex);
  }
}

// Hard limits
primaryColors.splice(6);
neutralColors.splice(4);
```

#### New Code
```typescript
// Classify colors into 4 tiers
const toLch = converter('lch');
const foundation: string[] = [];
const tintedNeutrals: string[] = [];
const accentColors: string[] = [];
const brandColors: string[] = [];

for (const colorHex of topColors) {
  const parsed = parse(colorHex);
  if (!parsed) continue;

  const lch = toLch(parsed);
  const chroma = lch.c ?? 0;
  const lightness = lch.l ?? 0;

  // Foundation: Pure blacks, whites, grays
  if (chroma < 5 || lightness < 5 || lightness > 95) {
    foundation.push(colorHex);
  }
  // Brand colors: Vibrant, high saturation
  else if (chroma > 50) {
    brandColors.push(colorHex);
  }
  // Accent colors: Muted brand identity
  else if (chroma > 20) {
    accentColors.push(colorHex);
  }
  // Tinted neutrals: Subtle background tints
  else {
    tintedNeutrals.push(colorHex);
  }
}

// Adaptive limits (no hard caps on neutrals!)
foundation.splice(8);        // Max 8 pure neutrals
tintedNeutrals.splice(6);    // Max 6 tinted neutrals
accentColors.splice(6);      // Max 6 accent colors
brandColors.splice(4);       // Max 4 brand colors

// Backward compatibility: derive primary/neutral
const primaryColors = [...accentColors, ...brandColors];
const neutralColors = [...foundation, ...tintedNeutrals];

// Ensure minimum counts for backward compat
if (neutralColors.length === 0 && primaryColors.length > 0) {
  neutralColors.push(primaryColors.pop()!);
}
if (primaryColors.length === 0 && neutralColors.length > 0) {
  primaryColors.push(neutralColors.pop()!);
}
```

**Impact**:
- ✅ Fixes hardcoded neutral count
- ✅ Better classification accuracy
- ✅ Backward compatible

---

### 2. Token Return Object (`pipeline/tokens/index.ts`)

**Location**: Lines 1009-1051

#### Update Return Statement
```typescript
return {
  colors: {
    // === NEW: 4-tier system ===
    foundation,
    tintedNeutrals,
    accentColors,
    brandColors,

    // === BACKWARD COMPAT ===
    primary: primaryColors,
    neutral: neutralColors,

    // === UNCHANGED ===
    semantic: {
      text: mostCommonText,
      background: mostCommonBg,
      cta: ctaColor,
      accent: accentColor,
      muted: mutedColor,
    },
    contextual: {
      buttons: topButtonColors,
      links: topLinkColors,
      backgrounds: topBackgroundVariations,
      borders: topBorderColors,
    },
  },
  // ... rest unchanged
};
```

---

### 3. Color Harmony Analysis (`pipeline/tokens/index.ts`)

**Location**: Lines 1323-1388

#### Extend `analyzeColorHarmony` Function

```typescript
function analyzeColorHarmony(tokens: DesignTokens): ColorHarmonyAnalysis {
  // ... existing code for paletteType, harmonyScore, etc.

  // === NEW: Calculate tier distribution ===
  const tierDistribution = {
    foundation: tokens.colors.foundation.length,
    tintedNeutrals: tokens.colors.tintedNeutrals.length,
    accentColors: tokens.colors.accentColors.length,
    brandColors: tokens.colors.brandColors.length,
  };

  // === NEW: Tier-specific saturation metrics ===
  const brandColorSaturation = calculateAvgChroma(tokens.colors.brandColors);
  const accentColorSaturation = calculateAvgChroma(tokens.colors.accentColors);
  const neutralTint = calculateAvgChroma(tokens.colors.tintedNeutrals);

  return {
    paletteType,
    harmonyScore,
    dominantHue,
    saturationRange,
    lightnessRange,
    tierDistribution,        // NEW
    brandColorSaturation,    // NEW
    accentColorSaturation,   // NEW
    neutralTint,             // NEW
  };
}

// === NEW: Helper function ===
function calculateAvgChroma(colors: string[]): number {
  if (colors.length === 0) return 0;

  const toLch = converter('lch');
  const chromas = colors.map(c => {
    const lch = toLch(parse(c));
    return (lch.c ?? 0) / 150; // Normalize to 0-1
  });

  return chromas.reduce((sum, c) => sum + c, 0) / chromas.length;
}
```

---

### 4. Vector Building (`pipeline/vectors/global-style-vec.ts`)

**Location**: Lines 20-81

#### Option A: Keep Current Dimensions (Minimal Change)

```typescript
// === Color Features (16D) ===

// Primary color count (now = accent + brand)
featureNames.push('color_primary_count');
interpretable.push(normalizeLog(tokens.colors.primary.length, 5));

// Neutral color count (now = foundation + tinted)
featureNames.push('color_neutral_count');
interpretable.push(normalizeLog(tokens.colors.neutral.length, 5));

// ... rest unchanged
```

**Result**: Backward compatible, uses derived primary/neutral

---

#### Option B: Expand to 4 Tiers (Recommended)

```typescript
// === Color Features (20D) - EXPANDED ===

// Foundation color count (log-normalized)
featureNames.push('color_foundation_count');
interpretable.push(normalizeLog(tokens.colors.foundation.length, 5));

// Tinted neutral count (log-normalized)
featureNames.push('color_tinted_neutral_count');
interpretable.push(normalizeLog(tokens.colors.tintedNeutrals.length, 4));

// Accent color count (log-normalized)
featureNames.push('color_accent_count');
interpretable.push(normalizeLog(tokens.colors.accentColors.length, 4));

// Brand color count (log-normalized)
featureNames.push('color_brand_count');
interpretable.push(normalizeLog(tokens.colors.brandColors.length, 3));

// Palette entropy (now uses all 4 tiers)
const paletteEntropy = calculatePaletteEntropy([
  ...tokens.colors.foundation,
  ...tokens.colors.tintedNeutrals,
  ...tokens.colors.accentColors,
  ...tokens.colors.brandColors,
]);
featureNames.push('color_palette_entropy');
interpretable.push(paletteEntropy);

// Contrast pass rate (unchanged)
featureNames.push('color_contrast_pass_rate');
interpretable.push(report.contrastResults.aaPassRate);

// === NEW: Tier-specific metrics ===

// Brand color saturation (avg chroma of brand colors)
const brandSat = report.realTokenMetrics?.colorHarmony?.brandColorSaturation ?? 0.5;
featureNames.push('color_brand_saturation');
interpretable.push(brandSat);

// Accent color saturation (avg chroma of accent colors)
const accentSat = report.realTokenMetrics?.colorHarmony?.accentColorSaturation ?? 0.5;
featureNames.push('color_accent_saturation');
interpretable.push(accentSat);

// Neutral tint (avg chroma of tinted neutrals)
const neutralTint = report.realTokenMetrics?.colorHarmony?.neutralTint ?? 0;
featureNames.push('color_neutral_tint');
interpretable.push(neutralTint);

// Dominant hue (unchanged)
const dominantHue = report.realTokenMetrics?.colorHarmony?.dominantHue ?? 0;
featureNames.push('color_dominant_hue');
interpretable.push(normalizeLinear(dominantHue, 0, 360));

// Saturation mean (unchanged)
const satMean = report.realTokenMetrics?.colorHarmony?.saturationRange?.avg ?? 0.5;
featureNames.push('color_saturation_mean');
interpretable.push(satMean);

// Lightness mean (unchanged)
const lightMean = report.realTokenMetrics?.colorHarmony?.lightnessRange?.avg ?? 0.5;
featureNames.push('color_lightness_mean');
interpretable.push(lightMean);

// Button color diversity (unchanged)
featureNames.push('color_button_diversity');
interpretable.push(normalizeLog(tokens.colors.contextual.buttons.length, 3));

// Link color diversity (unchanged)
featureNames.push('color_link_diversity');
interpretable.push(normalizeLog(tokens.colors.contextual.links.length, 3));

// Background variation (unchanged)
featureNames.push('color_background_variation');
interpretable.push(normalizeLog(tokens.colors.contextual.backgrounds.length, 4));

// Harmony score (unchanged)
const harmonyScore = report.realTokenMetrics?.colorHarmony?.harmonyScore ?? 0.5;
featureNames.push('color_harmony_score');
interpretable.push(harmonyScore);

// Color coherence (unchanged)
const colorCoherence = report.realTokenMetrics?.brandCoherence?.colorHarmony ?? 0.5;
featureNames.push('color_coherence');
interpretable.push(colorCoherence);

// Reserved (0D) - repurposed for new features
// No reserved dimensions needed!
```

**New Vector Structure**:
- Color Features: **16D → 20D** (+4 dimensions)
  - Added: foundation_count, tinted_count, accent_count, brand_count (+4)
  - Added: brand_saturation, accent_saturation, neutral_tint (+3)
  - Removed: primary_count, neutral_count (-2)
  - Removed: color_reserved_1 through color_reserved_4 (-4)
  - Net change: +1 dimension, but better utilization

**Total Vector Size**: 64D → 65D (or keep at 64D by using 1 less reserved elsewhere)

---

#### Option C: Hybrid (Backward Compatible + New Features)

```typescript
// === Color Features (20D) ===

// KEEP: Primary/neutral for backward compat
featureNames.push('color_primary_count');
interpretable.push(normalizeLog(tokens.colors.primary.length, 5));

featureNames.push('color_neutral_count');
interpretable.push(normalizeLog(tokens.colors.neutral.length, 5));

// ... existing features ...

// USE RESERVED SLOTS for new tier metrics
featureNames.push('color_foundation_count');  // was: color_reserved_1
interpretable.push(normalizeLog(tokens.colors.foundation.length, 5));

featureNames.push('color_brand_count');       // was: color_reserved_2
interpretable.push(normalizeLog(tokens.colors.brandColors.length, 3));

featureNames.push('color_brand_saturation');  // was: color_reserved_3
const brandSat = report.realTokenMetrics?.colorHarmony?.brandColorSaturation ?? 0.5;
interpretable.push(brandSat);

featureNames.push('color_neutral_tint');      // was: color_reserved_4
const neutralTint = report.realTokenMetrics?.colorHarmony?.neutralTint ?? 0;
interpretable.push(neutralTint);
```

**Result**: Keeps 64D vector size, backward compatible, adds 4 new features

---

### 5. Styling Module (`pipeline/styling/index.ts`)

**Impact**: Low - only uses `tokens.colors.primary[0]` for brand color

**Required Changes**:

```typescript
// BEFORE
const brandColor = tokens.colors.primary[0];

// AFTER (use brand colors, fallback to accent)
const brandColor = tokens.colors.brandColors[0] ||
                   tokens.colors.accentColors[0] ||
                   tokens.colors.primary[0];
```

**Files to Update**:
- `pipeline/styling/index.ts` - Update brand color selection
- `pipeline/codegen/index.ts` - Update color variable generation
- `pipeline/cta-template/index.ts` - Update CTA color selection

---

### 6. Tailwind Config Generation (`pipeline/tokens/index.ts`)

**Location**: Lines 1543-1672

**Required Changes**:

```typescript
function generateTailwindConfig(tokens: DesignTokens): string {
  // Enhanced color configuration
  const colors = {
    // === NEW: 4-tier system ===
    foundation: tokens.colors.foundation.reduce((acc, color, idx) => {
      acc[`${(idx + 1) * 100}`] = color;
      return acc;
    }, {} as Record<string, string>),

    tinted: tokens.colors.tintedNeutrals.reduce((acc, color, idx) => {
      acc[`${(idx + 1) * 100}`] = color;
      return acc;
    }, {} as Record<string, string>),

    accent: tokens.colors.accentColors.reduce((acc, color, idx) => {
      acc[`${(idx + 1) * 100}`] = color;
      return acc;
    }, {} as Record<string, string>),

    brand: tokens.colors.brandColors.reduce((acc, color, idx) => {
      acc[`${(idx + 1) * 100}`] = color;
      return acc;
    }, {} as Record<string, string>),

    // === KEEP: Backward compat (deprecated) ===
    'brand-legacy': tokens.colors.primary.reduce((acc, color, idx) => {
      acc[`${(idx + 1) * 100}`] = color;
      return acc;
    }, {} as Record<string, string>),

    // ... rest unchanged
  };

  // ... rest of function
}
```

**Generated CSS Classes**:
```css
/* New tier-based classes */
.bg-foundation-100
.bg-tinted-200
.bg-accent-300
.bg-brand-400

/* Legacy (still works) */
.bg-brand-legacy-100
```

---

## Vector System Changes

### Vector Dimension Allocation

#### Current Allocation (64D)
```
Color:       16D (2 counts + 9 metrics + 4 reserved + 1 entropy)
Typography:  16D (5 metrics + 10 reserved + 1 coherence)
Spacing:      8D (2 metrics + 5 reserved + 1 consistency)
Shape:        8D (2 metrics + 5 reserved + 1 count)
Brand:       16D (13 personality + 2 reserved + 1 confidence)
```

#### Proposed Allocation - Option B (65D)
```
Color:       20D (4 tier counts + 3 tier saturation + 9 metrics + 3 context + 1 entropy)
Typography:  16D (unchanged)
Spacing:      8D (unchanged)
Shape:        8D (unchanged)
Brand:       16D (unchanged)
TOTAL:       68D (need to reduce by 4)
```

**Solution**: Remove 4 reserved dimensions from other categories:
```
Color:       20D (+4 from color_reserved)
Typography:  14D (-2 reserved)
Spacing:      7D (-1 reserved)
Shape:        7D (-1 reserved)
Brand:       16D (unchanged)
TOTAL:       64D ✅
```

#### Proposed Allocation - Option C (64D, Recommended)
```
Color:       16D (2 legacy counts + 4 new tier metrics + 9 existing + 1 entropy)
  - color_primary_count (legacy, derived)
  - color_neutral_count (legacy, derived)
  - color_foundation_count (NEW, replaces reserved_1)
  - color_brand_count (NEW, replaces reserved_2)
  - color_brand_saturation (NEW, replaces reserved_3)
  - color_neutral_tint (NEW, replaces reserved_4)
  - ... 9 existing metrics unchanged

Typography:  16D (unchanged)
Spacing:      8D (unchanged)
Shape:        8D (unchanged)
Brand:       16D (unchanged)
TOTAL:       64D ✅ No dimension change!
```

---

## Migration Strategy

### Phase 1: Type System (Week 1, Day 1)
1. ✅ Extend `DesignTokens` interface with new tier fields
2. ✅ Mark `primary` and `neutral` as `@deprecated`
3. ✅ Update `ColorHarmonyAnalysis` interface
4. ✅ Run `npm run build:pipeline` to check for type errors

### Phase 2: Token Extraction (Week 1, Day 1-2)
1. ✅ Implement 4-tier classification algorithm
2. ✅ Derive backward-compatible `primary` and `neutral`
3. ✅ Update color harmony analysis to include tier metrics
4. ✅ Test on 5 diverse sites, verify correct classification

### Phase 3: Vector System (Week 1, Day 2-3)
1. ✅ Choose Option C (hybrid approach, 64D maintained)
2. ✅ Update `global-style-vec.ts` to use reserved slots
3. ✅ Add tier-specific features: foundation_count, brand_count, etc.
4. ✅ Test vector building, verify 64D maintained
5. ✅ Re-run vectorization on 5 sites, check diversity

### Phase 4: Downstream Consumers (Week 1, Day 3-4)
1. ✅ Update `styling/index.ts` to use `brandColors` first
2. ✅ Update `codegen/index.ts` color variable generation
3. ✅ Update `cta-template/index.ts` CTA color selection
4. ✅ Update Tailwind config generation
5. ✅ Test end-to-end pipeline on 1 site

### Phase 5: Testing & Validation (Week 1, Day 4-5)
1. ✅ Run full pipeline on 10 diverse sites
2. ✅ Verify vector diversity improved
3. ✅ Check color classification accuracy manually
4. ✅ Validate backward compatibility (old code still works)
5. ✅ Update tests if needed

### Phase 6: Documentation (Week 1, Day 5)
1. ✅ Document new color tier system
2. ✅ Update API docs with migration guide
3. ✅ Create visual examples of color classification
4. ✅ Update VECTOR_BUGS.md with new evaluation

---

## Testing Plan

### Unit Tests

**File**: `tests/unit/color-classification.spec.ts` (new)

```typescript
import { classifyColorsByTier } from '@/pipeline/tokens';

describe('Color Classification', () => {
  test('pure neutrals classified as foundation', () => {
    const colors = ['#ffffff', '#000000', '#888888'];
    const result = classifyColorsByTier(colors);

    expect(result.foundation).toContain('#ffffff');
    expect(result.foundation).toContain('#000000');
    expect(result.tintedNeutrals).toHaveLength(0);
  });

  test('vibrant colors classified as brand', () => {
    const colors = ['#635bff', '#ff4f40']; // Stripe purple, Monzo coral
    const result = classifyColorsByTier(colors);

    expect(result.brandColors).toContain('#635bff');
    expect(result.brandColors).toContain('#ff4f40');
  });

  test('muted colors classified as accent', () => {
    const colors = ['#0a2540']; // Navy (chroma=20.6)
    const result = classifyColorsByTier(colors);

    expect(result.accentColors).toContain('#0a2540');
  });

  test('tinted neutrals classified correctly', () => {
    const colors = ['#f6f9fc', '#c9d0c6']; // Light blue-gray, light gray-green
    const result = classifyColorsByTier(colors);

    expect(result.tintedNeutrals).toContain('#f6f9fc');
    expect(result.tintedNeutrals).toContain('#c9d0c6');
  });

  test('backward compatibility: primary = accent + brand', () => {
    const tokens = extractTokens(runId);

    expect(tokens.colors.primary).toEqual([
      ...tokens.colors.accentColors,
      ...tokens.colors.brandColors
    ]);
  });

  test('backward compatibility: neutral = foundation + tinted', () => {
    const tokens = extractTokens(runId);

    expect(tokens.colors.neutral).toEqual([
      ...tokens.colors.foundation,
      ...tokens.colors.tintedNeutrals
    ]);
  });
});
```

### Integration Tests

**File**: `tests/integration/vector-diversity.spec.ts`

```typescript
import { buildVectors } from '@/pipeline/vectors';

describe('Vector Diversity with Multi-Tier Colors', () => {
  const testSites = [
    '2025-10-01T16-54-12-101Z_nc929z99_stripe-com_cta',
    '2025-10-02T11-11-11-854Z_5cb904fa_monzo-com',
    '2025-10-02T11-12-03-223Z_9b8d1b6f_fifa-com',
    '2025-09-27T09-55-16-007Z_gmeihphr_airbnb-com_cta',
    '2025-10-02T11-12-57-769Z_e96683a7_dawnlabs-co'
  ];

  test('foundation count varies across sites', async () => {
    const vectors = await Promise.all(
      testSites.map(id => buildVectors(id))
    );

    const foundationCounts = vectors.map(v =>
      v.tokens.colors.foundation.length
    );

    const uniqueCounts = new Set(foundationCounts);
    expect(uniqueCounts.size).toBeGreaterThan(1); // Not all the same!
  });

  test('brand count varies across sites', async () => {
    const vectors = await Promise.all(
      testSites.map(id => buildVectors(id))
    );

    const brandCounts = vectors.map(v =>
      v.tokens.colors.brandColors.length
    );

    const uniqueCounts = new Set(brandCounts);
    expect(uniqueCounts.size).toBeGreaterThan(1);
  });

  test('neutral count NO LONGER hardcoded', async () => {
    const vectors = await Promise.all(
      testSites.map(id => buildVectors(id))
    );

    const neutralCounts = vectors.map(v =>
      v.tokens.colors.neutral.length
    );

    const uniqueCounts = new Set(neutralCounts);

    // BEFORE: uniqueCounts.size === 1 (all had 4)
    // AFTER: uniqueCounts.size > 1
    expect(uniqueCounts.size).toBeGreaterThan(1);
  });

  test('vector dimension count unchanged', async () => {
    const result = await buildVectors(testSites[0]);

    expect(result.globalStyleVec.interpretable.length).toBe(64);
    expect(result.globalStyleVec.combined.length).toBe(192);
  });
});
```

### Manual Testing Checklist

```markdown
- [ ] Run token extraction on Stripe
  - [ ] Verify foundation contains #ffffff, #000000
  - [ ] Verify brandColors contains #635bff (purple)
  - [ ] Verify accentColors contains muted colors
  - [ ] Count each tier, ensure reasonable distribution

- [ ] Run token extraction on 5 diverse sites
  - [ ] Verify neutral count varies (not all 4)
  - [ ] Check foundation count varies
  - [ ] Check brand count varies

- [ ] Run vector building on all 5 sites
  - [ ] Verify 64D maintained
  - [ ] Check color_neutral_count varies (not all 0.6712)
  - [ ] Check new features (foundation_count, brand_saturation) have values

- [ ] Test backward compatibility
  - [ ] Old code using tokens.colors.primary still works
  - [ ] Old code using tokens.colors.neutral still works
  - [ ] Vector queries using old dimension names still work

- [ ] Test Tailwind generation
  - [ ] New classes (.bg-foundation-100) generated
  - [ ] Old classes (.bg-brand-100) still work
  - [ ] Safelist includes new color names

- [ ] End-to-end test
  - [ ] Capture → Tokens → Vectors → Storage pipeline works
  - [ ] Generated components use correct colors
  - [ ] No TypeScript errors
```

---

## Frontend Changes

### Overview

The frontend vector visualization page (`app/vectors/[styleProfileId]/page.tsx`) currently displays only the binary primary/neutral color system. With the multi-tier refactor, we need to update the UI to showcase all 4 tiers while maintaining backward compatibility.

### Current Implementation

**File**: `app/vectors/[styleProfileId]/page.tsx` (lines 351-417)

```typescript
function ColorsTab({ tokens, report }: any) {
  return (
    <div className="space-y-6">
      {/* Primary Colors */}
      <div className="bg-white rounded-lg border p-6">
        <h3 className="text-lg font-semibold mb-4">Primary Colors</h3>
        <div className="grid grid-cols-6 gap-4">
          {tokens.colors.primary.map((color: string, i: number) => (
            <ColorSwatch key={i} color={color} label={`Primary ${i + 1}`} />
          ))}
        </div>
      </div>

      {/* Neutral Colors */}
      <div className="bg-white rounded-lg border p-6">
        <h3 className="text-lg font-semibold mb-4">Neutral Colors</h3>
        <div className="grid grid-cols-4 gap-4">
          {tokens.colors.neutral.map((color: string, i: number) => (
            <ColorSwatch key={i} color={color} label={`Neutral ${i + 1}`} />
          ))}
        </div>
      </div>
    </div>
  );
}
```

**Issues**:
- ❌ Only shows binary classification
- ❌ Doesn't expose nuanced tier information
- ❌ Grid layout assumes fixed color counts (6 primary, 4 neutral)

---

### New Implementation

**File**: `app/vectors/[styleProfileId]/page.tsx` (lines 351-417 - full replacement)

```typescript
function ColorsTab({ tokens, report }: any) {
  const hasNewTiers = tokens.colors.foundation !== undefined;

  return (
    <div className="space-y-6">
      {/* === NEW: Multi-Tier Display === */}
      {hasNewTiers && (
        <>
          {/* Brand Colors - Vibrant Identity */}
          {tokens.colors.brandColors.length > 0 && (
            <div className="bg-white rounded-lg border p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">Brand Colors</h3>
                <span className="text-sm text-gray-500">
                  Vibrant identity (chroma &gt; 50)
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-4">
                {tokens.colors.brandColors.map((color: string, i: number) => (
                  <ColorSwatch
                    key={i}
                    color={color}
                    label={`Brand ${i + 1}`}
                    showChroma={true}
                  />
                ))}
              </div>
              {tokens.colors.brandColors.length === 0 && (
                <p className="text-sm text-gray-400 italic">No vibrant brand colors detected</p>
              )}
            </div>
          )}

          {/* Accent Colors - Muted Brand Identity */}
          {tokens.colors.accentColors.length > 0 && (
            <div className="bg-white rounded-lg border p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">Accent Colors</h3>
                <span className="text-sm text-gray-500">
                  Muted brand (chroma 20-50)
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-4">
                {tokens.colors.accentColors.map((color: string, i: number) => (
                  <ColorSwatch
                    key={i}
                    color={color}
                    label={`Accent ${i + 1}`}
                    showChroma={true}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Tinted Neutrals - Subtle Backgrounds */}
          {tokens.colors.tintedNeutrals.length > 0 && (
            <div className="bg-white rounded-lg border p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">Tinted Neutrals</h3>
                <span className="text-sm text-gray-500">
                  Subtle tints (chroma 5-20)
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-4">
                {tokens.colors.tintedNeutrals.map((color: string, i: number) => (
                  <ColorSwatch
                    key={i}
                    color={color}
                    label={`Tinted ${i + 1}`}
                    showChroma={true}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Foundation - Pure Neutrals */}
          {tokens.colors.foundation.length > 0 && (
            <div className="bg-white rounded-lg border p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">Foundation Colors</h3>
                <span className="text-sm text-gray-500">
                  Pure neutrals (chroma &lt; 5)
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-4">
                {tokens.colors.foundation.map((color: string, i: number) => (
                  <ColorSwatch
                    key={i}
                    color={color}
                    label={`Foundation ${i + 1}`}
                    showChroma={true}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Tier Distribution Stats */}
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg border border-blue-200 p-6">
            <h3 className="text-lg font-semibold mb-4">Color Tier Distribution</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <StatBox
                label="Brand Colors"
                value={tokens.colors.brandColors.length}
                color="bg-purple-500"
              />
              <StatBox
                label="Accent Colors"
                value={tokens.colors.accentColors.length}
                color="bg-blue-500"
              />
              <StatBox
                label="Tinted Neutrals"
                value={tokens.colors.tintedNeutrals.length}
                color="bg-gray-400"
              />
              <StatBox
                label="Foundation"
                value={tokens.colors.foundation.length}
                color="bg-gray-600"
              />
            </div>

            {/* Tier-Specific Metrics */}
            {report.realTokenMetrics?.colorHarmony && (
              <div className="mt-6 pt-6 border-t border-blue-200">
                <h4 className="text-sm font-medium text-gray-700 mb-3">Tier Metrics</h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
                  <MetricCard
                    label="Brand Saturation"
                    value={(report.realTokenMetrics.colorHarmony.brandColorSaturation * 100).toFixed(0)}
                    unit="%"
                    description="Avg chroma of brand colors"
                  />
                  <MetricCard
                    label="Accent Saturation"
                    value={(report.realTokenMetrics.colorHarmony.accentColorSaturation * 100).toFixed(0)}
                    unit="%"
                    description="Avg chroma of accent colors"
                  />
                  <MetricCard
                    label="Neutral Tint"
                    value={(report.realTokenMetrics.colorHarmony.neutralTint * 100).toFixed(0)}
                    unit="%"
                    description="Avg chroma of tinted neutrals"
                  />
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* === LEGACY: Backward Compatibility === */}
      {!hasNewTiers && (
        <>
          {/* Primary Colors (Legacy) */}
          <div className="bg-white rounded-lg border p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Primary Colors</h3>
              <span className="text-xs text-yellow-600 bg-yellow-50 px-2 py-1 rounded">
                Legacy
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-4">
              {tokens.colors.primary.map((color: string, i: number) => (
                <ColorSwatch key={i} color={color} label={`Primary ${i + 1}`} />
              ))}
            </div>
          </div>

          {/* Neutral Colors (Legacy) */}
          <div className="bg-white rounded-lg border p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Neutral Colors</h3>
              <span className="text-xs text-yellow-600 bg-yellow-50 px-2 py-1 rounded">
                Legacy
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-4">
              {tokens.colors.neutral.map((color: string, i: number) => (
                <ColorSwatch key={i} color={color} label={`Neutral ${i + 1}`} />
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// === NEW: Helper Components ===

function StatBox({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex items-center space-x-3">
      <div className={`w-3 h-3 rounded-full ${color}`} />
      <div>
        <p className="text-2xl font-bold text-gray-900">{value}</p>
        <p className="text-xs text-gray-600">{label}</p>
      </div>
    </div>
  );
}

function MetricCard({
  label,
  value,
  unit,
  description,
}: {
  label: string;
  value: string;
  unit: string;
  description: string;
}) {
  return (
    <div className="bg-white rounded-lg p-3 border border-gray-200">
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className="text-xl font-bold text-gray-900">
        {value}
        <span className="text-sm font-normal text-gray-500">{unit}</span>
      </p>
      <p className="text-xs text-gray-400 mt-1">{description}</p>
    </div>
  );
}
```

---

### Enhanced ColorSwatch Component

**File**: `app/vectors/[styleProfileId]/page.tsx` (add to existing ColorSwatch)

```typescript
function ColorSwatch({
  color,
  label,
  showChroma = false,
}: {
  color: string;
  label: string;
  showChroma?: boolean;
}) {
  const [showDetails, setShowDetails] = React.useState(false);

  // Calculate chroma if needed
  const chromaValue = showChroma ? calculateChroma(color) : null;

  return (
    <div
      className="group relative"
      onMouseEnter={() => setShowDetails(true)}
      onMouseLeave={() => setShowDetails(false)}
    >
      <div
        className="w-full h-20 rounded-lg border-2 border-gray-200 shadow-sm transition-transform group-hover:scale-105"
        style={{ backgroundColor: color }}
      />
      <div className="mt-2 text-center">
        <p className="text-xs font-medium text-gray-700">{label}</p>
        <p className="text-xs text-gray-500 font-mono">{color}</p>
        {showChroma && chromaValue !== null && (
          <p className="text-xs text-gray-400">
            C: {chromaValue.toFixed(1)}
          </p>
        )}
      </div>

      {/* Hover Details */}
      {showDetails && (
        <div className="absolute z-10 bottom-full mb-2 left-1/2 transform -translate-x-1/2 bg-gray-900 text-white text-xs rounded-lg p-2 shadow-lg whitespace-nowrap">
          <p className="font-mono">{color}</p>
          {chromaValue !== null && (
            <>
              <p className="mt-1 text-gray-300">Chroma: {chromaValue.toFixed(2)}</p>
              <p className="text-gray-300">
                Tier: {getTierName(chromaValue)}
              </p>
            </>
          )}
          <div className="absolute top-full left-1/2 transform -translate-x-1/2 -mt-1">
            <div className="w-2 h-2 bg-gray-900 transform rotate-45" />
          </div>
        </div>
      )}
    </div>
  );
}

// === Helper Functions ===

function calculateChroma(colorHex: string): number {
  try {
    // Use culori to calculate LCH chroma
    const { converter, parse } = require('culori');
    const toLch = converter('lch');
    const parsed = parse(colorHex);
    if (!parsed) return 0;
    const lch = toLch(parsed);
    return lch.c ?? 0;
  } catch (e) {
    return 0;
  }
}

function getTierName(chroma: number): string {
  if (chroma < 5) return 'Foundation';
  if (chroma < 20) return 'Tinted Neutral';
  if (chroma < 50) return 'Accent';
  return 'Brand';
}
```

---

### API Route Changes

**File**: `app/api/vectors/[styleProfileId]/route.ts`

**Status**: ✅ No changes required

The API route simply loads `design_tokens.json` from the filesystem and passes it through. The new tier fields will automatically be included in the response once the token extraction is updated.

```typescript
// No changes needed - already passes through all token fields
const designTokens = JSON.parse(
  await fs.readFile(artifactPath('design_tokens.json'), 'utf-8')
);

return NextResponse.json({
  styleProfileId: params.styleProfileId,
  tokens: designTokens,  // Includes new tier fields automatically
  report: styleReport,
});
```

---

### Visual Design Updates

**UI Hierarchy** (top to bottom):
1. **Brand Colors** (most important) - Purple accent, prominent placement
2. **Accent Colors** - Blue accent
3. **Tinted Neutrals** - Gray accent
4. **Foundation Colors** - Neutral accent, smaller emphasis
5. **Tier Distribution Stats** - Info box with metrics

**Color Coding**:
- Brand: Purple background (`bg-purple-500`)
- Accent: Blue background (`bg-blue-500`)
- Tinted: Light gray (`bg-gray-400`)
- Foundation: Dark gray (`bg-gray-600`)

**Responsive Grids**:
```typescript
// Mobile (< 640px): 2 columns
// Tablet (640-1024px): 4 columns
// Desktop (> 1024px): 6 columns
className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-4"
```

---

### Migration Strategy for Frontend

#### Phase 1: Backward Compatibility (Week 1, Day 3)
1. ✅ Add feature detection: `hasNewTiers = tokens.colors.foundation !== undefined`
2. ✅ Keep legacy display path for old vectors
3. ✅ Add "Legacy" badges to old color displays
4. ✅ Test with both old and new token formats

#### Phase 2: Enhanced Display (Week 1, Day 3)
1. ✅ Implement new 4-tier color sections
2. ✅ Add tier distribution stats
3. ✅ Add tier-specific metrics display
4. ✅ Enhance ColorSwatch with chroma display
5. ✅ Add hover tooltips with tier information

#### Phase 3: Polish (Week 1, Day 4)
1. ✅ Add responsive grid layouts
2. ✅ Add loading states for metric calculations
3. ✅ Add empty states ("No vibrant brand colors detected")
4. ✅ Add visual hierarchy with color coding
5. ✅ Test across devices (mobile, tablet, desktop)

---

### Testing Checklist

```markdown
- [ ] Frontend displays new tiers correctly
  - [ ] Brand colors section shows vibrant colors
  - [ ] Accent colors section shows muted brand colors
  - [ ] Tinted neutrals section shows subtle backgrounds
  - [ ] Foundation section shows pure neutrals

- [ ] Backward compatibility works
  - [ ] Old vectors (without tiers) display legacy view
  - [ ] Legacy badges appear on old vectors
  - [ ] No crashes with old token format

- [ ] Visual design looks good
  - [ ] Responsive grid layouts work on mobile
  - [ ] Color coding is clear and intuitive
  - [ ] Tier distribution stats are readable
  - [ ] Hover tooltips show correct chroma values

- [ ] Metrics display correctly
  - [ ] Brand saturation shows real values
  - [ ] Accent saturation shows real values
  - [ ] Neutral tint shows real values
  - [ ] All percentages are normalized (0-100%)

- [ ] Edge cases handled
  - [ ] Empty tier sections don't break layout
  - [ ] Single-color tiers display correctly
  - [ ] Very long color lists scroll properly
  - [ ] Missing colorHarmony metrics don't crash
```

---

### Files to Update

| File | Lines | Changes | Priority |
|------|-------|---------|----------|
| `app/vectors/[styleProfileId]/page.tsx` | 351-417 | Replace ColorsTab component | P0 |
| `app/vectors/[styleProfileId]/page.tsx` | Add new | Add StatBox component | P0 |
| `app/vectors/[styleProfileId]/page.tsx` | Add new | Add MetricCard component | P0 |
| `app/vectors/[styleProfileId]/page.tsx` | Update | Enhance ColorSwatch with chroma | P1 |
| `app/api/vectors/[styleProfileId]/route.ts` | N/A | No changes needed | P0 |

---

### Expected Results

**Before** (Binary System):
```
┌─────────────────────┐
│ Primary Colors      │
│ [6 color swatches]  │
└─────────────────────┘

┌─────────────────────┐
│ Neutral Colors      │
│ [4 color swatches]  │
└─────────────────────┘
```

**After** (Multi-Tier System):
```
┌─────────────────────────────┐
│ Brand Colors               │
│ Vibrant identity (>50)     │
│ [1-4 color swatches]       │
└─────────────────────────────┘

┌─────────────────────────────┐
│ Accent Colors              │
│ Muted brand (20-50)        │
│ [0-6 color swatches]       │
└─────────────────────────────┘

┌─────────────────────────────┐
│ Tinted Neutrals            │
│ Subtle tints (5-20)        │
│ [0-6 color swatches]       │
└─────────────────────────────┘

┌─────────────────────────────┐
│ Foundation Colors          │
│ Pure neutrals (<5)         │
│ [2-8 color swatches]       │
└─────────────────────────────┘

┌─────────────────────────────┐
│ Color Tier Distribution    │
│ ● Brand: 2  ● Accent: 4    │
│ ● Tinted: 3 ● Foundation: 4│
│                             │
│ Tier Metrics:              │
│ Brand Sat: 68%             │
│ Accent Sat: 28%            │
│ Neutral Tint: 12%          │
└─────────────────────────────┘
```

---

### Example Screenshots

**Stripe.com** (Expected UI):
```
Brand Colors (chroma > 50)
  [#635bff - Vibrant Purple]  [#efa82e - Orange]

Accent Colors (chroma 20-50)
  [#0a2540 - Navy]  [#425466 - Slate]  [#3f4b66 - Dark Slate]

Tinted Neutrals (chroma 5-20)
  [#f6f9fc - Light Blue-Gray]  [#adbdcc - Light Slate]

Foundation Colors (chroma < 5)
  [#ffffff - White]  [#3a3a3a - Dark Gray]
```

**Monzo.com** (Expected UI):
```
Brand Colors (chroma > 50)
  [#0000ee - Pure Blue]  [#ff4f40 - Coral Red]

Accent Colors (chroma 20-50)
  [#012433 - Dark Teal]

Tinted Neutrals (chroma 5-20)
  [#091723 - Very Dark Blue]  [#c9d0c6 - Light Gray-Green]

Foundation Colors (chroma < 5)
  [#000000 - Black]  [#ffffff - White]  [#f2f8f3 - Very Light Green-Gray]
```

---

## Rollout Steps

### Day 1: Foundation Work (2-3 hours)

```bash
# 1. Update type definitions
code pipeline/tokens/index.ts
# - Add foundation, tintedNeutrals, accentColors, brandColors to DesignTokens
# - Mark primary, neutral as @deprecated
# - Update ColorHarmonyAnalysis interface

# 2. Build and verify types
npm run build:pipeline
# Should compile without errors

# 3. Implement classification algorithm
# - Add classifyColorsByTier() function
# - Update analyzeStyles() to use new classification
# - Derive primary/neutral for backward compat

# 4. Test token extraction
npm run tokens -- 2025-10-01T16-54-12-101Z_nc929z99_stripe-com_cta
cat artifacts/.../design_tokens.json | jq '.colors | keys'
# Should see: foundation, tintedNeutrals, accentColors, brandColors, primary, neutral
```

### Day 2: Vector System (2-3 hours)

```bash
# 1. Update vector building (Option C recommended)
code pipeline/vectors/global-style-vec.ts
# - Replace reserved_1-4 with new tier features
# - Add helper function calculateAvgChroma()

# 2. Update color harmony analysis
code pipeline/tokens/index.ts
# - Add tierDistribution calculation
# - Add brandColorSaturation, accentColorSaturation, neutralTint

# 3. Test vector building
npm run build:pipeline
node scripts/test-vectors.js 2025-10-01T16-54-12-101Z_nc929z99_stripe-com_cta
# Verify 64D maintained, new features have values

# 4. Run on all test sites
for site in stripe monzo fifa airbnb dawn; do
  npm run tokens -- <runId>
  node scripts/test-vectors.js <runId>
done
```

### Day 3: Downstream Updates + Frontend (2-3 hours)

```bash
# === Backend Updates (1 hour) ===

# 1. Update styling module
code pipeline/styling/index.ts
# - Use brandColors[0] || accentColors[0] || primary[0]

# 2. Update codegen
code pipeline/codegen/index.ts
# - Update color variable generation

# 3. Update CTA template
code pipeline/cta-template/index.ts
# - Use brand/accent colors

# 4. Update Tailwind generation
code pipeline/tokens/index.ts
# - Add foundation, tinted, accent, brand color scales

# === Frontend Updates (1-2 hours) ===

# 5. Update vector visualization page
code app/vectors/[styleProfileId]/page.tsx
# - Replace ColorsTab component with new 4-tier display
# - Add StatBox component
# - Add MetricCard component
# - Enhance ColorSwatch with chroma display
# - Add feature detection: hasNewTiers = tokens.colors.foundation !== undefined
# - Keep legacy display for backward compatibility

# 6. Test frontend rendering
npm run dev
# Open http://localhost:3000/vectors/<runId>
# - Check new tier sections appear
# - Verify legacy display for old vectors
# - Test responsive grid layouts
# - Verify hover tooltips work
# - Check tier distribution stats

# 7. Test end-to-end
npm run generate -- --url https://stripe.com --prompt "create a pricing page"
# Verify component uses correct colors AND frontend displays correctly
```

### Day 4: Testing & Validation (2-3 hours)

```bash
# 1. Write unit tests
code tests/unit/color-classification.spec.ts

# 2. Write integration tests
code tests/integration/vector-diversity.spec.ts

# 3. Run tests
npm test

# 4. Manual testing with 10 sites
# - Run pipeline on diverse set
# - Verify vector diversity
# - Check color classification accuracy

# 5. Create evaluation report
npm run batch-vector -- <10 URLs>
node scripts/evaluate-vector-diversity.js > VECTOR_EVAL_MULTI_TIER.md
```

### Day 5: Documentation (1 hour)

```bash
# 1. Update main docs
code COLOR_CLASSIFICATION_ANALYSIS.md
# - Add "Implementation Complete" section
# - Document actual results

# 2. Create migration guide
code docs/MIGRATION_MULTI_TIER_COLORS.md

# 3. Update vector bugs analysis
code VECTOR_EVALUATION_POST_FIX.md
# - Mark neutral_count issue as FIXED
# - Update statistics

# 4. Commit changes
git add .
git commit -m "feat: implement multi-tier color classification

- Add foundation, tintedNeutrals, accentColors, brandColors
- Fix hardcoded neutral count (was 4 for all sites)
- Improve vector diversity
- Maintain backward compatibility with primary/neutral
- Add tier-specific vector features

Fixes #<issue>"
```

---

## Risk Assessment

### Low Risk ✅
- Type system changes (backward compatible, @deprecated annotations)
- Vector reserved slot usage (always meant for future features)
- Adaptive limits (removes arbitrary caps)

### Medium Risk ⚠️
- Color classification thresholds (chroma 5, 20, 50)
  - **Mitigation**: Validate with manual inspection of 20+ sites
  - **Rollback**: Easy to adjust thresholds if needed

- Downstream consumers assuming fixed array sizes
  - **Mitigation**: Keep derived primary/neutral arrays
  - **Rollback**: Old code continues to work

### High Risk 🔴
- None identified (backward compatibility maintained throughout)

---

## Success Criteria

### Quantitative
- ✅ Vector diversity: `color_neutral_count` varies across sites (not all 0.6712)
- ✅ Classification accuracy: >90% of colors classified correctly (manual review)
- ✅ No regressions: All existing tests pass
- ✅ Dimension count: Maintain 64D interpretable vector

### Qualitative
- ✅ Color tiers match designer intuition (foundation = structure, brand = identity)
- ✅ Tier distribution makes sense (Stripe vs Airbnb should differ)
- ✅ Code clarity: New classification logic is readable and maintainable
- ✅ Documentation: Migration guide is clear and complete

---

## Appendix A: Code Location Reference

| Module | File | Lines | Changes |
|--------|------|-------|---------|
| Type Definitions | `pipeline/tokens/index.ts` | 33-104 | Add 4 new color arrays |
| Classification | `pipeline/tokens/index.ts` | 785-817 | Replace binary with 4-tier |
| Return Object | `pipeline/tokens/index.ts` | 1009-1051 | Add new tier fields |
| Color Harmony | `pipeline/tokens/index.ts` | 1323-1388 | Add tier metrics |
| Vector Building | `pipeline/vectors/global-style-vec.ts` | 20-81 | Use reserved slots |
| Styling | `pipeline/styling/index.ts` | Various | Use brandColors first |
| Codegen | `pipeline/codegen/index.ts` | Various | Update color vars |
| Tailwind | `pipeline/tokens/index.ts` | 1543-1672 | Add tier color scales |

---

## Appendix B: Example Output

### Before Refactor
```json
{
  "colors": {
    "primary": ["#635bff", "#0a2540", "#425466", "#adbdcc", "#efa82e", "#3f4b66"],
    "neutral": ["#ffffff", "#f6f9fc", "#f6f9fb", "#3a3a3a"]
  }
}
```

### After Refactor
```json
{
  "colors": {
    "foundation": ["#ffffff", "#3a3a3a"],
    "tintedNeutrals": ["#f6f9fc", "#f6f9fb", "#adbdcc"],
    "accentColors": ["#0a2540", "#425466", "#3f4b66", "#efa82e"],
    "brandColors": ["#635bff"],

    "_comment": "Deprecated (backward compat)",
    "primary": ["#0a2540", "#425466", "#3f4b66", "#efa82e", "#635bff"],
    "neutral": ["#ffffff", "#3a3a3a", "#f6f9fc", "#f6f9fb", "#adbdcc"]
  }
}
```

---

**End of Refactor Plan**

**Estimated Total Effort**: 10-14 hours over 5 days
**Complexity**: Medium
**Risk**: Low (backward compatible)
**Impact**: High (fixes major vector diversity issue + improved frontend visualization)

**Key Deliverables**:
- ✅ 4-tier color classification (foundation, tintedNeutrals, accentColors, brandColors)
- ✅ Fixed hardcoded neutral count (was 4 for all sites)
- ✅ Improved vector diversity (color_neutral_count now varies)
- ✅ Backward compatible (primary/neutral still work)
- ✅ Enhanced frontend visualization with tier-specific display
- ✅ Tier-specific metrics (brand saturation, accent saturation, neutral tint)
- ✅ Responsive UI with hover tooltips and distribution stats
