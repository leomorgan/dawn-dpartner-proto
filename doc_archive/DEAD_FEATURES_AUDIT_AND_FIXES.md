# Dead Features Audit & Remediation Plan

## Executive Summary

**16 out of 64 features (25%) are DEAD** with variance < 0.001. An additional **13 features (20.3%) have low variance** (0.001-0.01). Only **17 features (26.6%) have good variance** (>0.05).

This document provides a detailed audit of every dead/low-variance feature and specific implementation fixes.

---

## Feature Status Breakdown

```
Status            Count    Percentage  Variance Range
──────────────────────────────────────────────────────
DEAD              16/64    25.0%       < 0.001
LOW_VARIANCE      13/64    20.3%       0.001 - 0.01
MEDIUM_VARIANCE   18/64    28.1%       0.01 - 0.05
GOOD              17/64    26.6%       > 0.05
```

**Impact**: Effective dimensionality is ~30D, not 64D.

---

## DEAD FEATURES (16 total)

### Reserved Slots (5 features)

#### [28] typo_reserved_1
#### [29] typo_reserved_2
#### [30] typo_reserved_3
#### [31] typo_reserved_4
#### [39] spacing_reserved_1
#### [47] shape_reserved_1

**Issue**: All zeros (placeholder slots)

**Root Cause**: Reserved for future features, never implemented

**Fix - Option A: Remove**
```typescript
// In global-style-vec.ts, remove these pushes:
// DELETE these lines (157-160, 197, 234):
for (let i = 0; i < 4; i++) {
  featureNames.push(`typo_reserved_${i + 1}`);
  interpretable.push(0);
}
```

**Fix - Option B: Implement New Features**

For typography reserved slots, add:
```typescript
// typo_reserved_1 → Letter spacing consistency
const letterSpacings = nodes
  .map(n => parseFloat(n.styles.letterSpacing || '0'))
  .filter(ls => ls !== 0);
const lsCV = coefficientOfVariation(letterSpacings);
featureNames.push('typo_letter_spacing_consistency');
interpretable.push(1 / (1 + lsCV)); // 0-1, higher = more consistent

// typo_reserved_2 → Text decoration usage
const decoratedCount = nodes.filter(n =>
  n.styles.textDecoration && n.styles.textDecoration !== 'none'
).length;
featureNames.push('typo_text_decoration_usage');
interpretable.push(normalizeLinear(decoratedCount / nodes.length, 0, 0.3));

// typo_reserved_3 → Text transform usage
const transformedCount = nodes.filter(n =>
  n.styles.textTransform && n.styles.textTransform !== 'none'
).length;
featureNames.push('typo_text_transform_usage');
interpretable.push(normalizeLinear(transformedCount / nodes.length, 0, 0.5));

// typo_reserved_4 → Font variant usage
const variantCount = nodes.filter(n =>
  n.styles.fontVariant && n.styles.fontVariant !== 'normal'
).length;
featureNames.push('typo_font_variant_usage');
interpretable.push(normalizeLinear(variantCount / nodes.length, 0, 0.2));
```

For spacing_reserved_1:
```typescript
// spacing_reserved_1 → Aspect ratio consistency
const aspectRatios = nodes.map(n => n.bbox.w / (n.bbox.h || 1));
const arCV = coefficientOfVariation(aspectRatios);
featureNames.push('spacing_aspect_ratio_consistency');
interpretable.push(1 / (1 + arCV));
```

For shape_reserved_1:
```typescript
// shape_reserved_1 → Border style diversity
const borderStyles = new Set(
  nodes.map(n => n.styles.borderStyle || 'none')
).size;
featureNames.push('shape_border_style_diversity');
interpretable.push(normalizeLog(borderStyles, 3));
```

**Recommendation**: **Option B** - Implement new features. These are valuable dimensions that are currently wasted.

---

### Brand Personality Features (8 features)

#### [50] brand_tone_elegant
#### [54] brand_energy_energetic
#### [57] brand_trust_conservative
#### [59] brand_trust_innovative
#### [60] brand_trust_experimental

**Issue**: All zeros (missing data)

#### [58] brand_trust_modern

**Issue**: All ones (100% same value)

#### [61] brand_confidence

**Issue**: All 0.850 (100% same value)

**Root Cause**: Brand personality analysis returns same default values for all sites

**Current Implementation** (`pipeline/tokens/brand-personality.ts`):
```typescript
// Problem: Always returns the same default values
export function analyzeBrandPersonality(
  tokens: DesignTokens,
  report: StyleReport
): BrandPersonality {
  return {
    tone: 'modern',           // ← Always 'modern'
    energy: 'sophisticated',  // ← Always 'sophisticated'
    trustLevel: 'modern',     // ← Always 'modern'
    confidence: 0.85,         // ← Always 0.85
  };
}
```

**Fix - Implement Real Analysis**:

```typescript
// File: pipeline/tokens/brand-personality.ts

import { DesignTokens, StyleReport, BrandPersonality } from '../types';

export function analyzeBrandPersonality(
  tokens: DesignTokens,
  report: StyleReport
): BrandPersonality {

  // 1. TONE ANALYSIS (professional, playful, elegant, bold, minimal, luxury, friendly)

  const tone = determineTone(tokens, report);

  // 2. ENERGY ANALYSIS (calm, energetic, sophisticated, dynamic)

  const energy = determineEnergy(tokens, report);

  // 3. TRUST LEVEL ANALYSIS (conservative, modern, innovative, experimental)

  const trustLevel = determineTrustLevel(tokens, report);

  // 4. CONFIDENCE SCORE (0-1)

  const confidence = calculateConfidence(tokens, report);

  return { tone, energy, trustLevel, confidence };
}

function determineTone(tokens: DesignTokens, report: StyleReport): string {
  const scores = {
    professional: 0,
    playful: 0,
    elegant: 0,
    bold: 0,
    minimal: 0,
  };

  // Color saturation → playful vs professional
  const avgSat = report.realTokenMetrics?.colorHarmony?.saturationRange?.avg || 0;
  if (avgSat > 0.6) {
    scores.playful += 2;
    scores.bold += 1;
  } else if (avgSat < 0.3) {
    scores.professional += 2;
    scores.elegant += 1;
  }

  // Border radius → playful vs professional
  const avgRadius = tokens.borderRadius.length > 0
    ? tokens.borderRadius.reduce((sum, r) => sum + parseFloat(r), 0) / tokens.borderRadius.length
    : 0;
  if (avgRadius > 16) {
    scores.playful += 1;
  } else if (avgRadius < 4) {
    scores.professional += 1;
  }

  // Color count → minimal vs bold
  const totalColors = tokens.colors.primary.length + tokens.colors.neutral.length;
  if (totalColors < 8) {
    scores.minimal += 2;
    scores.elegant += 1;
  } else if (totalColors > 15) {
    scores.bold += 1;
  }

  // Font family count → minimal vs elaborate
  if (tokens.typography.fontFamilies.length === 1) {
    scores.minimal += 1;
  } else if (tokens.typography.fontFamilies.length > 2) {
    scores.elegant += 1;
  }

  // Spacing median → elegant vs bold
  const spacingMedian = tokens.spacing.length > 0
    ? tokens.spacing[Math.floor(tokens.spacing.length / 2)]
    : 0;
  if (spacingMedian > 32) {
    scores.elegant += 1;
    scores.minimal += 1;
  } else if (spacingMedian < 12) {
    scores.bold += 1;
  }

  // Return highest scoring tone
  return Object.entries(scores).sort((a, b) => b[1] - a[1])[0][0];
}

function determineEnergy(tokens: DesignTokens, report: StyleReport): string {
  const scores = {
    calm: 0,
    energetic: 0,
    sophisticated: 0,
    dynamic: 0,
  };

  // Color saturation → energetic vs calm
  const avgSat = report.realTokenMetrics?.colorHarmony?.saturationRange?.avg || 0;
  if (avgSat > 0.5) {
    scores.energetic += 2;
    scores.dynamic += 1;
  } else if (avgSat < 0.2) {
    scores.calm += 2;
    scores.sophisticated += 1;
  }

  // Color palette entropy → dynamic vs calm
  const entropy = calculateEntropy(tokens.colors.primary);
  if (entropy > 0.7) {
    scores.dynamic += 1;
    scores.energetic += 1;
  } else if (entropy < 0.3) {
    scores.calm += 1;
  }

  // Font weight contrast → dynamic vs calm
  const weights = tokens.typography.fontWeights;
  const weightRange = weights.length > 0
    ? Math.max(...weights) - Math.min(...weights)
    : 0;
  if (weightRange > 500) {
    scores.dynamic += 1;
  } else if (weightRange < 200) {
    scores.calm += 1;
    scores.sophisticated += 1;
  }

  // Typography coherence → sophisticated vs energetic
  const typoCoherence = report.realTokenMetrics?.brandCoherence?.typographyCoherence || 0.5;
  if (typoCoherence > 0.7) {
    scores.sophisticated += 2;
  } else if (typoCoherence < 0.4) {
    scores.energetic += 1;
  }

  return Object.entries(scores).sort((a, b) => b[1] - a[1])[0][0];
}

function determineTrustLevel(tokens: DesignTokens, report: StyleReport): string {
  const scores = {
    conservative: 0,
    modern: 0,
    innovative: 0,
    experimental: 0,
  };

  // Border radius → modern/innovative vs conservative
  const avgRadius = tokens.borderRadius.length > 0
    ? tokens.borderRadius.reduce((sum, r) => sum + parseFloat(r), 0) / tokens.borderRadius.length
    : 0;
  if (avgRadius > 12) {
    scores.modern += 2;
    scores.innovative += 1;
  } else if (avgRadius < 4) {
    scores.conservative += 2;
  }

  // Color saturation → experimental vs conservative
  const avgSat = report.realTokenMetrics?.colorHarmony?.saturationRange?.avg || 0;
  if (avgSat > 0.7) {
    scores.experimental += 2;
  } else if (avgSat < 0.2) {
    scores.conservative += 1;
    scores.modern += 1; // Grayscale can be modern minimalism
  }

  // Shadow count → modern vs conservative
  const shadowCount = tokens.boxShadow.length;
  if (shadowCount > 5) {
    scores.modern += 1;
  } else if (shadowCount < 2) {
    scores.conservative += 1;
  }

  // Design system maturity → conservative/modern vs experimental
  const maturity = report.realTokenMetrics?.brandCoherence?.overall || 0.5;
  if (maturity > 0.8) {
    scores.conservative += 1;
    scores.modern += 1;
  } else if (maturity < 0.5) {
    scores.experimental += 2;
  }

  return Object.entries(scores).sort((a, b) => b[1] - a[1])[0][0];
}

function calculateConfidence(tokens: DesignTokens, report: StyleReport): number {
  // Confidence based on design system maturity and coherence
  const colorCoherence = report.realTokenMetrics?.brandCoherence?.colorHarmony || 0.5;
  const typoCoherence = report.realTokenMetrics?.brandCoherence?.typographyCoherence || 0.5;
  const spacingConsistency = report.realTokenMetrics?.brandCoherence?.spacingConsistency || 0.5;

  // Average coherence scores
  const avgCoherence = (colorCoherence + typoCoherence + spacingConsistency) / 3;

  // Contrast compliance → confidence
  const contrastPass = report.contrastResults?.aaPassRate || 0.5;

  // Combined confidence (0-1)
  return (avgCoherence * 0.6 + contrastPass * 0.4);
}

function calculateEntropy(colors: string[]): number {
  if (colors.length === 0) return 0;

  // Simple hue-based entropy (0-1)
  const hues = colors.map(c => {
    const lch = hexToLCH(c);
    return Math.floor(lch.h / 30); // 12 bins
  });

  const bins = Array(12).fill(0);
  hues.forEach(h => bins[h % 12]++);

  let entropy = 0;
  const total = hues.length;
  bins.forEach(count => {
    if (count > 0) {
      const p = count / total;
      entropy -= p * Math.log2(p);
    }
  });

  return entropy / Math.log2(12); // Normalize to 0-1
}

// Helper (import from color utils)
function hexToLCH(hex: string): { l: number; c: number; h: number } {
  // Implementation from pipeline/vectors/utils.ts
  // ...
}
```

**Files to Modify**:
1. `pipeline/tokens/brand-personality.ts` - Replace with real analysis
2. `pipeline/tokens/index.ts` - Ensure brand personality is always called
3. `pipeline/vectors/global-style-vec.ts` - No changes needed (already consumes brandPersonality)

**Expected Improvement**:
- 8 dead features → 8 active features
- Variance: 0.000 → 0.05-0.25 (based on good brand features already working)

---

### Color/Shape Features (3 features)

#### [9] color_background_variation

**Issue**: Near-identical values (variance: 0.000852)
**Values**: `[0.732, 0.732, 0.631, 0.732, 0.732, 0.732, 0.732, 0.732, 0.732, 0.732, 0.732]`

**Root Cause**: Normalization range too narrow

**Current Implementation**:
```typescript
// color_background_variation
featureNames.push('color_background_variation');
interpretable.push(normalizeLog(tokens.colors.contextual.backgrounds.length, 4));
```

**Fix**:
```typescript
// Expand normalization range
featureNames.push('color_background_variation');
interpretable.push(normalizeLog(tokens.colors.contextual.backgrounds.length, 8));
// Change from max=4 to max=8 to capture full range
```

**Expected**: Variance 0.001 → 0.01-0.02

---

#### [16] typo_family_count

**Issue**: All identical (0.683)
**Values**: All sites have same value

**Root Cause**: All modern sites use 1-2 font families, and normalization compresses this

**Current Implementation**:
```typescript
// typo_family_count
featureNames.push('typo_family_count');
interpretable.push(normalizeLog(tokens.typography.fontFamilies.length, 2));
```

**Problem**: normalizeLog(1, 2) = normalizeLog(2, 2) ≈ 0.683

**Fix - Option A: Remove**
This feature has no discriminative power for modern web design (all use 1-2 fonts).

**Fix - Option B: Change to Font Family Diversity**
```typescript
// Instead of count, measure actual diversity
const fontFamilies = tokens.typography.fontFamilies;
const fontUsageCounts = countFontUsagePerFamily(nodes); // New function

// Calculate entropy of font family distribution
const total = Object.values(fontUsageCounts).reduce((a, b) => a + b, 0);
let entropy = 0;
Object.values(fontUsageCounts).forEach(count => {
  if (count > 0) {
    const p = count / total;
    entropy -= p * Math.log2(p);
  }
});

const maxEntropy = Math.log2(fontFamilies.length);
const diversity = fontFamilies.length > 1 ? entropy / maxEntropy : 0;

featureNames.push('typo_family_diversity');
interpretable.push(diversity); // Already 0-1
```

**Recommendation**: **Option B** - More meaningful metric

---

#### [62] brand_color_saturation_energy

**Issue**: Near-identical, very low values (variance: 0.000247)
**Values**: `[0.036, 0.000, 0.006, 0.022, 0.016, 0.002, 0.017, 0.041, 0.041, 0.000, 0.001]`

**Root Cause**: LCH chroma normalization range (0-130) is too large for actual values

**Current Implementation**:
```typescript
// color_saturation_energy
featureNames.push('brand_color_saturation_energy');
interpretable.push(normalizeLinear(layoutFeats.colorSaturationEnergy, 0, 130));
```

**Fix**:
```typescript
// Use tighter normalization based on observed range
// Observed: 2.8-5.4, use 0-20 for normalization
featureNames.push('brand_color_saturation_energy');
interpretable.push(normalizeLinear(layoutFeats.colorSaturationEnergy, 0, 20));
```

**Expected**: Variance 0.000247 → 0.01-0.02

---

## LOW VARIANCE FEATURES (13 total)

### Typography Features (3 features)

#### [20] typo_lineheight_count
**Variance**: 0.0011
**Values**: 10 sites = 0.827, 1 site = 0.712

**Issue**: Almost all sites use same number of line heights

**Fix**:
```typescript
// Current: normalizeLog(tokens.typography.lineHeights.length, 3)
// Problem: Most sites have 2-3 line heights

// Option A: Remove (low signal)
// Option B: Change to line height range
const lhRange = tokens.typography.lineHeights.length > 0
  ? Math.max(...tokens.typography.lineHeights) - Math.min(...tokens.typography.lineHeights)
  : 0;
featureNames.push('typo_lineheight_range');
interpretable.push(normalizeLinear(lhRange, 0, 1.5)); // Typical range 1.0-2.5
```

---

#### [21] typo_coherence
**Variance**: 0.0079
**Values**: 8 sites = 0.800, 3 sites = 1.000

**Issue**: Only 2 unique values

**Root Cause**: `realTokenMetrics.brandCoherence.typographyCoherence` calculation too simple

**Fix**: Improve coherence calculation in `pipeline/tokens/style-report.ts`:
```typescript
// Current implementation too coarse
// Make it more granular by measuring:
// - Font family reuse across elements
// - Font size scale adherence
// - Font weight consistency
// Return continuous 0-1 value, not just 0.8 or 1.0
```

---

#### [22] typo_hierarchy_depth
**Variance**: 0.0044
**Range**: 0.032 - 0.264

**Issue**: Low variance, narrow range

**Fix**:
```typescript
// Current implementation in layout-features.ts
// Expand normalization range
const cv = coefficientOfVariation(fontSizes);
// Current: no specific normalization
// Fix: Normalize to expected range
featureNames.push('typo_hierarchy_depth');
interpretable.push(normalizeLinear(cv, 0, 1.0)); // Expand from implicit 0-0.5 to 0-1.0
```

---

### Spacing Features (3 features)

#### [32] spacing_scale_length
**Variance**: 0.0014
**Values**: 10 sites = 0.759, 1 site = 0.627

**Issue**: Almost all sites have same spacing scale length

**Fix**:
```typescript
// Current: normalizeLog(tokens.spacing.length, 6)
// Problem: Most sites have 5-6 spacing values

// Option A: Remove (modern sites converge on 5-6 values)
// Option B: Change to spacing scale regularity
const spacingScale = tokens.spacing.sort((a, b) => a - b);
const ratios = [];
for (let i = 1; i < spacingScale.length; i++) {
  ratios.push(spacingScale[i] / spacingScale[i-1]);
}
const ratioCV = coefficientOfVariation(ratios);
featureNames.push('spacing_scale_regularity');
interpretable.push(1 / (1 + ratioCV)); // 0-1, higher = more regular (e.g., 1.5x scale)
```

---

#### [33] spacing_median
**Variance**: 0.0023
**Values**: 10 sites = 0.500, 1 site = 0.333

**Issue**: Almost all sites have same spacing median

**Fix**:
```typescript
// Current: normalizeLinear(spacingMedian, 0, 48)
// Problem: Most sites have 24px median → 0.5

// Expand range to capture more variance
const spacingMedian = tokens.spacing.length > 0
  ? tokens.spacing[Math.floor(tokens.spacing.length / 2)]
  : 0;
featureNames.push('spacing_median');
interpretable.push(normalizeLinear(spacingMedian, 8, 64)); // Wider range
```

---

#### [34] spacing_consistency
**Variance**: 0.0053
**Values**: 9 sites = 0.417, 1 site = 0.360, 1 site = 0.165

**Issue**: Most sites have identical value

**Root Cause**: `realTokenMetrics.brandCoherence.spacingConsistency` calculation too coarse

**Fix**: Same as typo_coherence - improve underlying calculation

---

### Color Features (2 features)

#### [5] color_saturation_mean
**Variance**: 0.0039
**Range**: 0.022 - 0.206

**Issue**: Low variance, but reasonable range

**Fix**:
```typescript
// Current: Direct value from colorHarmony.saturationRange.avg
// The value itself is fine (0-1), but needs better scaling

// Option A: Expand range (most sites are desaturated)
featureNames.push('color_saturation_mean');
interpretable.push(normalizeLinear(satMean, 0, 0.5)); // Instead of 0-1

// Option B: Use log scale to amplify small differences
interpretable.push(Math.min(satMean * 3, 1.0)); // 3x amplification
```

---

#### [6] color_lightness_mean
**Variance**: 0.0089
**Range**: 0.414 - 0.721

**Issue**: Reasonable range but low variance

**Fix**:
```typescript
// Current: Direct value from colorHarmony.lightnessRange.avg
// No fix needed - this is actually performing OK
// Variance of 0.0089 is borderline LOW/MEDIUM
```

---

#### [8] color_link_diversity
**Variance**: 0.0043
**Values**: Only 2 unique values (0.565 or 0.712)

**Issue**: Binary distribution

**Root Cause**: Most sites have either 1 or 2 link colors

**Fix**:
```typescript
// Current: normalizeLog(tokens.colors.contextual.links.length, 3)
// Problem: normalizeLog(1,3)=0.565, normalizeLog(2,3)=0.712

// Option A: Remove (no discriminative power)
// Option B: Measure link color contrast instead
const linkColors = tokens.colors.contextual.links;
if (linkColors.length < 2) {
  featureNames.push('color_link_contrast');
  interpretable.push(0.5); // Default
} else {
  // Calculate ΔE between link colors
  const deltaE = calculateDeltaE(linkColors[0], linkColors[1]);
  featureNames.push('color_link_contrast');
  interpretable.push(normalizeLinear(deltaE, 0, 50)); // JND ~2.3, noticeable ~10
}
```

**Recommendation**: **Option B** - More meaningful

---

#### [15] color_neutral_tint
**Variance**: 0.0018
**Range**: 0.000 - 0.116

**Issue**: Low range, low variance

**Fix**:
```typescript
// Current: Direct value from colorHarmony.neutralTint
// Expand normalization
const neutralTint = report.realTokenMetrics?.colorHarmony?.neutralTint ?? 0;
featureNames.push('color_neutral_tint');
interpretable.push(normalizeLinear(neutralTint, 0, 30)); // Instead of implicit 0-100+
```

---

### Shape Features (4 features)

#### [43] shape_border_heaviness
**Variance**: 0.0066
**Range**: 0.000 - 0.299

**Issue**: Low variance, decent range

**Fix**: Already has good implementation, just needs more data diversity. No code fix needed.

---

#### [44] shape_shadow_depth
**Variance**: 0.0103
**Range**: 0.000 - 0.269

**Issue**: Borderline LOW/MEDIUM

**Fix**: No fix needed - variance of 0.01 is acceptable

---

#### [45] shape_grouping_strength
**Variance**: 0.0064
**Range**: 0.682 - 0.972

**Issue**: All values clustered high (0.68-0.97)

**Root Cause**: `gestaltGroupingStrength` normalization compresses values

**Fix**:
```typescript
// In layout-features.ts, gestalt grouping calculation
// Current uses normalizeLog(avgScore, 4500)
// Observed range: 3000-6000

// Use tighter range
return normalizeLinear(avgScore, 2500, 7000);
```

---

#### [63] brand_color_role_distinction
**Variance**: 0.0049
**Range**: 0.516 - 0.738

**Issue**: Narrow range (0.52-0.74)

**Root Cause**: ΔE normalization (0-10000) too large

**Current**:
```typescript
featureNames.push('brand_color_role_distinction');
interpretable.push(normalizeLinear(layoutFeats.colorRoleDistinction, 0, 10000));
```

**Fix**:
```typescript
// Observed: 5325-6225
// Use tighter range
featureNames.push('brand_color_role_distinction');
interpretable.push(normalizeLinear(layoutFeats.colorRoleDistinction, 3000, 8000));
```

---

## Implementation Priority

### Phase 1 - Quick Wins (1-2 days)

**Fix 8 dead brand features** → +8 active dimensions
- File: `pipeline/tokens/brand-personality.ts`
- Implement real tone/energy/trust analysis
- **Impact**: Highest - eliminates 50% of dead features

**Fix 6 reserved slots** → +6 active dimensions
- Files: `pipeline/vectors/global-style-vec.ts`, `layout-features.ts`
- Implement letter spacing, text decoration, aspect ratio, border style
- **Impact**: High - easy implementation, good discriminative potential

### Phase 2 - Normalization Fixes (2-3 days)

**Fix low-variance features** → Improve 13 features
- Expand normalization ranges (spacing_median, spacing_scale_length, etc.)
- Use log/sigmoid scaling (color_saturation_mean)
- **Impact**: Medium - incremental improvements

**Fix dead color/shape features** → +3 active dimensions
- color_background_variation: Expand normalizeLog max from 4 to 8
- typo_family_count: Replace with diversity metric
- brand_color_saturation_energy: Tighter normalization (0-20 instead of 0-130)
- **Impact**: Medium - small but visible improvements

### Phase 3 - Algorithm Improvements (3-5 days)

**Improve coherence calculations**
- typo_coherence: Make granular instead of binary
- spacing_consistency: Improve underlying metric
- **Impact**: Medium - better quality metrics

**Replace low-signal features**
- color_link_diversity → color_link_contrast (ΔE-based)
- spacing_scale_length → spacing_scale_regularity
- **Impact**: Low - marginal improvements

---

## Expected Results After Fixes

### Before (Current State)
```
DEAD:              16/64 (25.0%)
LOW_VARIANCE:      13/64 (20.3%)
MEDIUM_VARIANCE:   18/64 (28.1%)
GOOD:              17/64 (26.6%)
```

### After Phase 1+2
```
DEAD:              0/64 (0.0%)      ✅ -16
LOW_VARIANCE:      8/64 (12.5%)     ✅ -5
MEDIUM_VARIANCE:   28/64 (43.8%)    ✅ +10
GOOD:              28/64 (43.8%)    ✅ +11
```

### PCA Impact
- **Explained Variance**: 58% → 75% (PC1+PC2)
- **Effective Dimensionality**: 30D → 56D
- **Avg Variance/Dim**: 0.041 → 0.078 (1.9x improvement)

---

## Testing Strategy

After each fix:

```bash
# 1. Recalculate vectors
npm run build:pipeline
npx tsx scripts/recalculate-all-vectors.ts

# 2. Re-ingest into database
node scripts/batch-ingest.js

# 3. Run audit
npx tsx scripts/audit-all-features.ts

# 4. Check variance improvement
npx tsx scripts/analyze-vector-variance.ts
```

**Success Criteria**:
- Zero dead features (all variance > 0.001)
- <10% low variance features
- >40% good features (variance > 0.05)
- PCA explained variance > 70%

---

## Summary

**Root Causes of Dead Features**:
1. **Brand personality returns defaults** (8 features) → Need real analysis
2. **Reserved slots never implemented** (6 features) → Need feature implementation
3. **Normalization ranges too wide/narrow** (3 features) → Need recalibration

**Implementation Effort**:
- Phase 1 (brand + reserved): ~2-3 days
- Phase 2 (normalization): ~2-3 days
- Phase 3 (algorithms): ~3-5 days
- **Total**: ~7-11 days for complete remediation

**Expected Impact**:
- Eliminate all 16 dead features
- Improve 13 low-variance features
- PCA explained variance: 58% → 75%
- Effective dimensionality: 30D → 56D
