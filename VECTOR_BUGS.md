# Vector Processing Bugs - Critical Issues

**Date**: 2025-10-02
**Status**: 🚨 CRITICAL - 47/64 dimensions are identical across all vectors

## Summary

Analysis of 6 vectorized captures (Stripe, Monzo, FIFA, Airbnb, Dojo, Dawn Labs) reveals that **73% of interpretable vector dimensions are hardcoded or using fallback values** instead of actual computed metrics. This breaks vector similarity search and makes the system unable to distinguish between different brand styles.

## Bugs by Category

### 1. Contrast Calculation (WCAG) - BROKEN

**File**: `pipeline/tokens/index.ts` (calculateContrast function)

**Issue**: All contrast ratios are ~1.0 instead of proper WCAG values

**Evidence**:
```json
{
  "foreground": "#ffffff",
  "background": "#016b83",
  "contrast": 1.004010296674546  // Should be ~4.8:1
}
```

**Expected**: White on teal should be ~4.8:1
**Actual**: 1.004 (essentially no contrast)

**Impact on Vector**:
- `color_contrast_pass_rate` (dim 3) = 0 for all sites
- Should be 0.0-1.0 representing % of AA passing pairs

**Fix Required**: Rewrite `calculateContrast()` using proper WCAG 2.1 formula:
```typescript
// Correct formula:
const L1 = relativeLuminance(lighterColor) + 0.05;
const L2 = relativeLuminance(darkerColor) + 0.05;
const contrast = L1 / L2; // Should be 1-21
```

---

### 2. Color Harmony Analysis - NULL

**File**: `pipeline/tokens/index.ts` (color harmony calculation)

**Issue**: All color harmony metrics are NULL in style_report.json

**Evidence**:
```json
{
  "paletteType": "monochromatic",
  "harmonyScore": null,
  "dominantHue": null,
  "saturationRange": { "min": null, "max": null, "avg": null },
  "lightnessRange": { "min": null, "max": null, "avg": null }
}
```

**Impact on Vector**:
- `color_dominant_hue` (dim 4) = 0 for all (fallback)
- `color_saturation_mean` (dim 5) = 0.5 for all (fallback)
- `color_lightness_mean` (dim 6) = 0.5 for all (fallback)
- `color_harmony_score` (dim 10) = 0.5 for all (fallback)

**Fix Required**: Implement color harmony calculation using culori:
```typescript
import { converter, formatHex } from 'culori';
const toLch = converter('lch');

// Calculate dominant hue by binning and finding mode
const hues = colors.map(c => toLch(c).h);
const dominantHue = findMostCommonHueBin(hues);

// Calculate saturation/lightness stats
const saturations = colors.map(c => toLch(c).c / 100);
const saturationRange = {
  min: Math.min(...saturations),
  max: Math.max(...saturations),
  avg: saturations.reduce((a,b) => a+b) / saturations.length
};
```

---

### 3. Brand Coherence - NULL

**File**: `pipeline/tokens/index.ts`

**Issue**: `brandCoherence.colorHarmony` is NULL

**Evidence**:
```json
{
  "colorHarmony": null,
  "spacingConsistency": 1,
  "typographyCoherence": 0.8,
  "overallCoherence": null
}
```

**Impact on Vector**:
- `color_coherence` (dim 11) = 0.5 for all (fallback)

**Fix Required**: Calculate actual color coherence score based on:
- Palette entropy (lower = more coherent)
- Hue variance (lower = more coherent)
- Harmony type (monochromatic = high coherence)

---

### 4. Brand Personality - Hardcoded

**File**: `pipeline/tokens/index.ts` (brand personality LLM prompt or logic)

**Issue**: All sites get identical brand personality

**Evidence**:
All 6 sites have:
```json
{
  "tone": "bold",
  "energy": "energetic",
  "trustLevel": "modern" (or "innovative"),
  "confidence": 0.8
}
```

**Impact on Vector**:
- `brand_tone_bold` (dim 51) = 1 for all
- `brand_energy_energetic` (dim 54) = 1 for all
- `brand_trust_modern` (dim 59) = 1 for all (Stripe = innovative)
- `brand_confidence` (dim 61) = 0.8 for all

**Expected**: Stripe should be "professional" + "sophisticated", FIFA should be "energetic" + "bold", etc.

**Fix Required**:
1. Check if LLM prompt is too generic
2. Verify LLM is receiving correct color/typography inputs
3. Add diversity to prompt examples
4. Consider using temperature > 0 for more varied outputs

---

### 5. Color Primary/Neutral Count - Same Formula

**Issue**: `color_primary_count` and `color_neutral_count` are identical (0.67118776)

**Evidence**: All 6 sites have dims 0 and 1 = 0.67118776

**Root Cause**: Likely using same normalization on same input
```typescript
// Bug:
interpretable.push(normalizeLog(tokens.colors.primary.length, 5));
interpretable.push(normalizeLog(tokens.colors.neutral.length, 5));
```

If all sites have 4 primary and 2 neutral colors, but the bug is using the same value for both, or the normalization is broken.

**Fix Required**: Debug why primary/neutral counts are identical

---

### 6. Spacing Consistency - Always 1.0

**Issue**: All sites have perfect spacing consistency (1.0)

**Evidence**: Dim 34 = 1.0 for all sites

**Expected**: Real sites have varying consistency (0.6-0.9)

**Fix Required**: Check spacing consistency calculation - likely hardcoded or using wrong metric

---

## Complete List of Broken Dimensions

Out of 64 interpretable dimensions, **47 are identical** (73% broken):

### Color Features (10/16 broken):
- ✅ 0: color_primary_count (0.67118776) - **Same for all**
- ✅ 1: color_neutral_count (0.67118776) - **Same for all**
- ❌ 2: color_palette_entropy (varies)
- ✅ 3: color_contrast_pass_rate (0) - **NULL**
- ✅ 4: color_dominant_hue (0) - **NULL**
- ✅ 5: color_saturation_mean (0.5) - **NULL fallback**
- ✅ 6: color_lightness_mean (0.5) - **NULL fallback**
- ❌ 7: color_button_diversity (varies)
- ❌ 8: color_link_diversity (varies)
- ❌ 9: color_background_variation (varies)
- ✅ 10: color_harmony_score (0.5) - **NULL fallback**
- ✅ 11: color_coherence (0.5) - **NULL fallback**
- ✅ 12-15: color_reserved (0) - **Expected**

### Typography Features (10/16 broken):
- ❌ 16: typo_family_count (varies)
- ❌ 17: typo_size_range (varies)
- ❌ 18: typo_size_count (varies)
- ❌ 19: typo_weight_count (varies)
- ❌ 20: typo_lineheight_count (varies)
- ❌ 21: typo_coherence (varies)
- ✅ 22-31: typo_reserved (0) - **Expected**

### Spacing Features (6/8 broken):
- ❌ 32: spacing_scale_length (varies)
- ❌ 33: spacing_median (varies)
- ✅ 34: spacing_consistency (1.0) - **Suspicious**
- ✅ 35-39: spacing_reserved (0) - **Expected**

### Shape Features (6/8 broken):
- ❌ 40: shape_radius_count (varies)
- ❌ 41: shape_radius_median (varies)
- ❌ 42: shape_shadow_count (varies)
- ✅ 43-47: shape_reserved (0) - **Expected**

### Brand Personality (15/16 broken):
- ✅ 48: brand_tone_professional (0) - **All bold**
- ✅ 49: brand_tone_playful (0) - **All bold**
- ✅ 50: brand_tone_elegant (0) - **All bold**
- ✅ 51: brand_tone_bold (1) - **All bold**
- ✅ 52: brand_tone_minimal (0) - **All bold**
- ✅ 53: brand_energy_calm (0) - **All energetic**
- ✅ 54: brand_energy_energetic (1) - **All energetic**
- ✅ 55: brand_energy_sophisticated (0) - **All energetic**
- ✅ 56: brand_energy_dynamic (0) - **All energetic**
- ✅ 57: brand_trust_conservative (0)
- ❌ 58-59: brand_trust_modern/innovative (varies slightly)
- ✅ 60: brand_trust_experimental (0)
- ✅ 61: brand_confidence (0.8) - **Same for all**
- ✅ 62-63: brand_reserved (0) - **Expected**

## Priority Fix Order

### P0 - Must Fix for MVP:
1. **Contrast calculation** - Completely broken, affects accessibility
2. **Color harmony** - Core color analysis is NULL
3. **Brand personality** - Makes all brands identical

### P1 - Important:
4. **Brand coherence** - Missing key metric
5. **Color count normalization** - Why are primary/neutral identical?
6. **Spacing consistency** - Suspicious that all are 1.0

### P2 - Nice to Have:
7. Add validation that vectors have reasonable variance
8. Add unit tests for vector building
9. Add assertion that identical brands should have distance ~0

## How to Verify Fixes

After fixing each bug, run:

```bash
# Re-vectorize test sites
npm run batch-vector -- https://stripe.com https://airbnb.com https://monzo.com

# Check that vectors are different
PGPASSWORD=dawn psql -h localhost -U dawn -d dawn -c "
SELECT source_url, style_vec FROM style_profiles ORDER BY created_at DESC LIMIT 3;
" | node scripts/check_vector_diversity.js

# Verify similarity search works
# Stripe should be more similar to Dojo (fintech) than to Airbnb (travel)
```

## Expected Vector Differences (After Fixes)

### Stripe vs Airbnb:
- **Tone**: professional vs friendly
- **Energy**: calm vs energetic
- **Dominant hue**: blue (~220°) vs red (~350°)
- **Contrast**: high (AA passing) vs medium
- **Spacing**: tight vs generous

### Monzo vs FIFA:
- **Tone**: bold vs energetic
- **Colors**: teal (#016b83) vs blue (#0a84ff)
- **Typography**: modern sans vs sports sans
- **Saturation**: medium vs high

## Impact on Product

**Current State**: Vector search is broken - all brands look the same to the system

**After Fixes**:
- Similarity search will work correctly
- Can recommend "brands like Stripe" based on actual style DNA
- Can detect outliers (brands with unique styles)
- Can cluster brands by personality/color/typography
