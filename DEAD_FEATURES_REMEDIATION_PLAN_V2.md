# Dead Features Remediation Plan V2 (Improved)

## Executive Summary

**Current State**: 16/64 dead features (25%), 13/64 low variance (20.3%)
**Goal**: Zero dead features, <10% low variance, >70% PCA explained variance
**Approach**: Risk-adjusted prioritization with incremental validation

---

## Critical Insight: Not All Fixes Are Equal

### Variance Gain Potential Analysis

Based on audit of existing "good" features (variance >0.05), we can estimate expected gains:

| Fix Type | Example Feature | Current Var | Expected Var | Confidence | Effort |
|----------|----------------|-------------|--------------|------------|--------|
| **Brand personality** | brand_tone_* (working ones) | 0.000 | 0.15-0.25 | HIGH | HIGH |
| **Normalization expansion** | shape_radius_median | 0.001 | 0.05-0.10 | HIGH | LOW |
| **Reserved → Real features** | Unknown (no precedent) | 0.000 | 0.01-0.08 | MEDIUM | MEDIUM |
| **Coherence improvements** | Granular calculations | 0.001-0.008 | 0.02-0.04 | LOW | HIGH |
| **Feature replacement** | link diversity → contrast | 0.004 | 0.03-0.06 | MEDIUM | MEDIUM |

**Key Insight**:
- Brand personality fixes: **High variance gain** (0.15-0.25) per feature × 8 features = **+1.2-2.0 total variance**
- Normalization fixes: **Medium gain** (0.05-0.10) per feature × 6 features = **+0.3-0.6 total variance**
- Reserved slots: **Unknown risk** - could be low variance like typo_family_count

---

## Improved Phase Structure

### Phase 0 - Baseline Measurement (1 day)

**Before ANY fixes**, establish measurement baseline:

```bash
# Create baseline snapshot
npx tsx scripts/audit-all-features.ts > BASELINE_AUDIT.txt
npx tsx scripts/analyze-vector-variance.ts > BASELINE_VARIANCE.txt

# Record current PCA metrics
# - PC1+PC2 explained variance: 58.0%
# - Avg variance/dim: 0.041
# - Total variance: 2.610
```

**Deliverable**: Baseline metrics file for before/after comparison

---

### Phase 1A - High-Impact, Low-Risk Normalization Fixes (0.5 days)

**Focus**: Quick wins with guaranteed variance improvement

#### Fix 1.1: color_background_variation
**File**: `pipeline/vectors/global-style-vec.ts:74`
```typescript
// OLD:
interpretable.push(normalizeLog(tokens.colors.contextual.backgrounds.length, 4));

// NEW:
interpretable.push(normalizeLog(tokens.colors.contextual.backgrounds.length, 8));
```
**Expected**: Variance 0.001 → 0.015 | **Risk**: None | **Time**: 5 min

#### Fix 1.2: brand_color_saturation_energy
**File**: `pipeline/vectors/global-style-vec.ts:274`
```typescript
// OLD:
interpretable.push(normalizeLinear(layoutFeats.colorSaturationEnergy, 0, 130));

// NEW:
interpretable.push(normalizeLinear(layoutFeats.colorSaturationEnergy, 0, 20));
```
**Expected**: Variance 0.0002 → 0.012 | **Risk**: None | **Time**: 5 min

#### Fix 1.3: brand_color_role_distinction
**File**: `pipeline/vectors/global-style-vec.ts:279`
```typescript
// OLD:
interpretable.push(normalizeLinear(layoutFeats.colorRoleDistinction, 0, 10000));

// NEW:
interpretable.push(normalizeLinear(layoutFeats.colorRoleDistinction, 3000, 8000));
```
**Expected**: Variance 0.005 → 0.035 | **Risk**: None | **Time**: 5 min

#### Fix 1.4: spacing_median
**File**: `pipeline/vectors/global-style-vec.ts:172`
```typescript
// OLD:
interpretable.push(normalizeLinear(spacingMedian, 0, 48));

// NEW:
interpretable.push(normalizeLinear(spacingMedian, 8, 64));
```
**Expected**: Variance 0.002 → 0.018 | **Risk**: None | **Time**: 5 min

#### Fix 1.5: shape_grouping_strength (in layout-features)
**File**: `pipeline/vectors/extractors/layout-features.ts:218`
```typescript
// OLD:
return normalizeLog(avgScore, 4500);

// NEW:
return normalizeLinear(avgScore, 2500, 7000);
```
**Expected**: Variance 0.006 → 0.042 | **Risk**: Low | **Time**: 10 min

**Phase 1A Validation**:
```bash
npm run build:pipeline && npx tsx scripts/recalculate-all-vectors.ts
node scripts/batch-ingest.js
npx tsx scripts/audit-all-features.ts

# Check: 5 features should show variance increase
# Expected total variance gain: +0.08
```

**Decision Point**: If variance gains match expectations (±30%), proceed to Phase 1B. Otherwise, debug normalization functions.

---

### Phase 1B - Brand Personality Implementation (2-3 days)

**Critical**: This is highest-impact but also highest-risk. Needs careful implementation and validation.

#### Step 1: Create Scoring Framework (0.5 days)

**File**: `pipeline/tokens/brand-personality.ts`

**New approach** - Use empirical testing with known brands:

```typescript
export interface BrandScores {
  tone: Record<string, number>;
  energy: Record<string, number>;
  trust: Record<string, number>;
  confidence: number;
}

export function calculateBrandScores(
  tokens: DesignTokens,
  report: StyleReport
): BrandScores {
  const scores: BrandScores = {
    tone: { professional: 0, playful: 0, elegant: 0, bold: 0, minimal: 0 },
    energy: { calm: 0, energetic: 0, sophisticated: 0, dynamic: 0 },
    trust: { conservative: 0, modern: 0, innovative: 0, experimental: 0 },
    confidence: 0,
  };

  // SCORING RULES (based on design theory + empirical testing)

  // === TONE SCORING ===

  // Color saturation: High sat = playful/bold, Low sat = professional/elegant
  const avgSat = report.realTokenMetrics?.colorHarmony?.saturationRange?.avg || 0;
  if (avgSat > 0.15) {
    const satScore = (avgSat - 0.15) / 0.35; // Normalize 0.15-0.5 → 0-1
    scores.tone.playful += satScore * 3;
    scores.tone.bold += satScore * 2;
  }
  if (avgSat < 0.15) {
    const desatScore = (0.15 - avgSat) / 0.15; // Normalize 0-0.15 → 1-0
    scores.tone.professional += desatScore * 3;
    scores.tone.elegant += desatScore * 2;
  }

  // Border radius: High radius = playful, Low = professional, Mid-high = elegant
  const avgRadius = tokens.borderRadius.length > 0
    ? tokens.borderRadius.reduce((sum, r) => sum + parseFloat(r), 0) / tokens.borderRadius.length
    : 0;
  if (avgRadius > 20) {
    scores.tone.playful += 2;
  } else if (avgRadius > 8) {
    scores.tone.elegant += 1.5;
    scores.tone.professional += 0.5;
  } else if (avgRadius < 4) {
    scores.tone.professional += 2;
  }

  // Color count: Low = minimal/elegant, High = bold
  const totalColors = tokens.colors.primary.length + tokens.colors.neutral.length;
  if (totalColors < 8) {
    scores.tone.minimal += 3;
    scores.tone.elegant += 1;
  } else if (totalColors > 15) {
    scores.tone.bold += 2;
  } else {
    scores.tone.professional += 1;
  }

  // Whitespace: High = elegant/minimal, Low = bold
  const whitespace = report.realTokenMetrics?.brandCoherence?.spacingConsistency || 0.5;
  if (whitespace > 0.7) {
    scores.tone.elegant += 2;
    scores.tone.minimal += 1;
  } else if (whitespace < 0.3) {
    scores.tone.bold += 2;
  }

  // === ENERGY SCORING ===

  // Saturation (again): High = energetic/dynamic, Low = calm/sophisticated
  if (avgSat > 0.3) {
    scores.energy.energetic += 3;
    scores.energy.dynamic += 2;
  } else if (avgSat < 0.15) {
    scores.energy.calm += 3;
    scores.energy.sophisticated += 2;
  }

  // Color palette entropy: High = dynamic, Low = calm
  const entropy = calculateColorEntropy(tokens.colors.primary);
  if (entropy > 0.6) {
    scores.energy.dynamic += 2;
  } else if (entropy < 0.3) {
    scores.energy.calm += 2;
  }

  // Font weight range: Large = dynamic, Small = calm/sophisticated
  const weights = tokens.typography.fontWeights;
  const weightRange = weights.length > 0 ? Math.max(...weights) - Math.min(...weights) : 0;
  if (weightRange > 500) {
    scores.energy.dynamic += 2;
  } else if (weightRange < 200) {
    scores.energy.calm += 1;
    scores.energy.sophisticated += 2;
  }

  // Shadow count: Many = dynamic, Few = calm
  const shadowCount = tokens.boxShadow.length;
  if (shadowCount > 5) {
    scores.energy.dynamic += 1;
  } else if (shadowCount < 2) {
    scores.energy.calm += 1;
  }

  // === TRUST SCORING ===

  // Border radius (again): High = modern/innovative, Low = conservative
  if (avgRadius > 12) {
    scores.trust.modern += 3;
    scores.trust.innovative += 1;
  } else if (avgRadius > 6) {
    scores.trust.modern += 2;
  } else if (avgRadius < 4) {
    scores.trust.conservative += 3;
  }

  // Saturation (again): Very high = experimental, Low-mid = modern/conservative
  if (avgSat > 0.5) {
    scores.trust.experimental += 3;
  } else if (avgSat < 0.1) {
    scores.trust.conservative += 2;
    scores.trust.modern += 1; // Grayscale minimalism
  } else {
    scores.trust.modern += 1;
  }

  // Design system maturity: High = conservative/modern, Low = experimental
  const maturity = report.realTokenMetrics?.brandCoherence?.overall || 0.5;
  if (maturity > 0.75) {
    scores.trust.modern += 2;
    scores.trust.conservative += 1;
  } else if (maturity < 0.5) {
    scores.trust.experimental += 2;
  }

  // Contrast compliance: High = conservative/modern, Low = experimental
  const contrastPass = report.contrastResults?.aaPassRate || 0.5;
  if (contrastPass > 0.8) {
    scores.trust.modern += 1;
    scores.trust.conservative += 1;
  } else if (contrastPass < 0.5) {
    scores.trust.experimental += 1;
  }

  // === CONFIDENCE SCORE ===

  // Based on coherence + contrast compliance
  const colorCoherence = report.realTokenMetrics?.brandCoherence?.colorHarmony || 0.5;
  const typoCoherence = report.realTokenMetrics?.brandCoherence?.typographyCoherence || 0.5;
  const spacingCoherence = report.realTokenMetrics?.brandCoherence?.spacingConsistency || 0.5;

  const avgCoherence = (colorCoherence + typoCoherence + spacingCoherence) / 3;
  scores.confidence = avgCoherence * 0.6 + contrastPass * 0.4;

  return scores;
}

export function analyzeBrandPersonality(
  tokens: DesignTokens,
  report: StyleReport
): BrandPersonality {
  const scores = calculateBrandScores(tokens, report);

  // Select highest scoring option for each dimension
  const tone = Object.entries(scores.tone).sort((a, b) => b[1] - a[1])[0][0];
  const energy = Object.entries(scores.energy).sort((a, b) => b[1] - a[1])[0][0];
  const trustLevel = Object.entries(scores.trust).sort((a, b) => b[1] - a[1])[0][0];

  return {
    tone,
    energy,
    trustLevel,
    confidence: scores.confidence,
  };
}

function calculateColorEntropy(colors: string[]): number {
  if (colors.length === 0) return 0;

  // Import hexToLCH from utils
  const { hexToLCH } = require('../vectors/utils');

  const hues = colors.map(c => {
    const lch = hexToLCH(c);
    return Math.floor(lch.h / 30); // 12 bins (30° each)
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
```

#### Step 2: Empirical Validation (0.5 days)

**CRITICAL**: Test with known brands before deploying

Create `scripts/validate-brand-personality.ts`:
```typescript
// Test against known brands with expected personalities
const testCases = [
  { site: 'stripe.com', expected: { tone: 'minimal', energy: 'sophisticated', trust: 'modern' } },
  { site: 'monzo.com', expected: { tone: 'playful', energy: 'energetic', trust: 'modern' } },
  { site: 'apple.com', expected: { tone: 'elegant', energy: 'calm', trust: 'modern' } },
  { site: 'fifa.com', expected: { tone: 'bold', energy: 'dynamic', trust: 'modern' } },
  { site: 'koto.studio', expected: { tone: 'elegant', energy: 'sophisticated', trust: 'modern' } },
];

// Calculate accuracy
// If <60% accuracy, revisit scoring rules
```

**Decision Point**: If validation shows <60% accuracy on test brands, iterate on scoring rules before proceeding.

#### Step 3: Deploy & Measure (1 day)

```bash
npm run build:pipeline
npx tsx scripts/recalculate-all-vectors.ts
node scripts/batch-ingest.js
npx tsx scripts/audit-all-features.ts

# Check variance for brand features
# Expected: 8 features with variance 0.000 → 0.08-0.25
```

**Success Criteria**:
- All 8 brand features: variance >0.05
- At least 4 features: variance >0.10
- No regressions in other features
- Total variance increase: +0.6 to +1.5

**If fails**: Roll back and reassess scoring algorithm

---

### Phase 2 - Reserved Slot Implementation (2-3 days)

**Risk**: Unknown variance potential. Could end up like typo_family_count (all same value).

**Mitigation Strategy**: Implement ONE feature first, measure variance, then decide on rest.

#### Step 2.1: Pilot Feature - Letter Spacing Consistency (0.5 days)

**File**: `pipeline/vectors/global-style-vec.ts:157`

```typescript
// BEFORE implementing typo_reserved_1-4, do ONE pilot:

// typo_reserved_1 → Letter spacing consistency (PILOT)
const letterSpacings = nodes
  .map(n => {
    const ls = n.styles.letterSpacing;
    if (!ls || ls === 'normal') return 0;
    // Parse 'px', 'em', etc.
    return parseFloat(ls);
  })
  .filter(ls => ls !== 0);

if (letterSpacings.length < 3) {
  featureNames.push('typo_letter_spacing_consistency');
  interpretable.push(0.5); // Default for insufficient data
} else {
  const lsCV = coefficientOfVariation(letterSpacings);
  featureNames.push('typo_letter_spacing_consistency');
  interpretable.push(1 / (1 + lsCV)); // 0-1, higher = more consistent
}

// Leave typo_reserved_2-4 as zeros for now
for (let i = 1; i < 4; i++) {
  featureNames.push(`typo_reserved_${i + 1}`);
  interpretable.push(0);
}
```

**Validation**:
```bash
npm run build:pipeline && npx tsx scripts/recalculate-all-vectors.ts
node scripts/batch-ingest.js
npx tsx scripts/audit-all-features.ts | grep "typo_letter_spacing"

# Check variance
# If variance <0.01: DO NOT implement remaining reserved slots
# If variance >0.02: Proceed with remaining implementations
```

#### Step 2.2: Conditional Implementation (1-2 days)

**Only if pilot succeeds** (variance >0.02), implement remaining:
- typo_reserved_2: Text decoration usage
- typo_reserved_3: Text transform usage
- typo_reserved_4: (skip - likely low signal)
- spacing_reserved_1: Aspect ratio consistency
- shape_reserved_1: Border style diversity

**Alternative if pilot fails**: Remove all reserved slots (reduce to 58D vector)

---

### Phase 3 - Low-Variance Feature Improvements (1-2 days)

**Focus**: Features with variance 0.001-0.01 that can be improved with normalization tweaks

#### Priority Tier 1 (High Expected Gain)

1. **color_saturation_mean** (var 0.0039)
   - Fix: 3x amplification
   - Expected: 0.004 → 0.025

2. **color_neutral_tint** (var 0.0018)
   - Fix: Tighter normalization (0-30 instead of 0-100+)
   - Expected: 0.002 → 0.015

3. **typo_hierarchy_depth** (var 0.0044)
   - Fix: Expand normalization range
   - Expected: 0.004 → 0.020

#### Priority Tier 2 (Medium Expected Gain)

4. **color_link_diversity → color_link_contrast**
   - Fix: Replace count with ΔE measurement
   - Expected: 0.004 → 0.025

5. **spacing_scale_length → spacing_scale_regularity**
   - Fix: Replace count with ratio CV measurement
   - Expected: 0.001 → 0.015

6. **typo_lineheight_count → typo_lineheight_range**
   - Fix: Replace count with range measurement
   - Expected: 0.001 → 0.018

---

### Phase 4 - Feature Replacement (1-2 days)

**Focus**: Features that are fundamentally low-signal

#### Candidate for Removal: typo_family_count

**Issue**: All modern sites use 1-2 fonts → identical values

**Option A**: Remove (reduce to 63D)

**Option B**: Replace with font family diversity
```typescript
// Measure distribution of font usage, not count
const fontUsage = {};
nodes.forEach(n => {
  const family = n.styles.fontFamily || 'default';
  fontUsage[family] = (fontUsage[family] || 0) + 1;
});

const total = nodes.length;
let entropy = 0;
Object.values(fontUsage).forEach(count => {
  const p = count / total;
  entropy -= p * Math.log2(p);
});

const maxEntropy = Math.log2(Object.keys(fontUsage).length);
const diversity = Object.keys(fontUsage).length > 1 ? entropy / maxEntropy : 0;
```

**Validation**: Implement, measure. If variance still <0.01, remove entirely.

---

## Improved Timeline & Risk Management

### Conservative Estimate (with validation gates)

| Phase | Duration | Cumulative | Variance Gain | Risk |
|-------|----------|------------|---------------|------|
| 0: Baseline | 1 day | 1d | N/A | None |
| 1A: Normalization (5 fixes) | 0.5 days | 1.5d | +0.08 | Low |
| **GATE 1**: Validate gains match expectations | | | | |
| 1B: Brand personality | 2-3 days | 3.5-4.5d | +0.6-1.5 | Medium |
| **GATE 2**: Validate variance >0.05 for all 8 features | | | | |
| 2: Reserved slots (pilot + conditional) | 1-3 days | 4.5-7.5d | +0.06-0.3 | High |
| **GATE 3**: Decide continue vs remove based on pilot | | | | |
| 3: Low-variance improvements | 1-2 days | 5.5-9.5d | +0.1-0.2 | Low |
| 4: Feature replacement | 1-2 days | 6.5-11.5d | +0.02-0.05 | Medium |

**Total**: 6.5-11.5 days (vs original estimate of 7-11 days)

**Key Difference**: Validation gates prevent wasted effort on low-yield features

---

## Success Metrics (Revised)

### Minimum Acceptable Outcome (MAO)
- Dead features: 16 → <5 (>68% reduction)
- Low variance features: 13 → <10 (23% improvement)
- PCA explained variance: 58% → >65% (+7pp)
- Total variance: 2.610 → >3.2 (+23%)

### Target Outcome (TO)
- Dead features: 16 → 0 (100% elimination)
- Low variance features: 13 → <8 (38% improvement)
- PCA explained variance: 58% → >72% (+14pp)
- Total variance: 2.610 → >4.0 (+53%)

### Stretch Goal (SG)
- Dead features: 0
- Low variance features: <5 (<8% of total)
- PCA explained variance: >75%
- Total variance: >4.5 (+72%)

---

## Rollback Strategy

**At each validation gate**:

1. If gains <50% of expected:
   - Rollback change
   - Debug normalization/scoring
   - Retest

2. If gains 50-80% of expected:
   - Keep change
   - Document lower-than-expected performance
   - Proceed with caution

3. If gains >80% of expected:
   - Keep change
   - Proceed confidently to next phase

**Emergency rollback**:
```bash
# Keep git tags at each phase
git tag phase-0-baseline
git tag phase-1a-normalization
git tag phase-1b-brand-personality

# If something breaks
git reset --hard phase-1a-normalization
npm run build:pipeline
npx tsx scripts/recalculate-all-vectors.ts
node scripts/batch-ingest.js
```

---

## Key Improvements Over Original Plan

1. **Validation Gates**: Measure after each phase, decide to proceed/rollback
2. **Risk-Adjusted Prioritization**: High-impact, low-risk fixes first
3. **Pilot Testing**: Test reserved slots before full implementation
4. **Empirical Validation**: Test brand personality against known brands
5. **Conservative Estimates**: Wider time ranges to account for debugging
6. **Success Tiers**: MAO/TO/SG instead of single target
7. **Explicit Rollback Strategy**: How to recover from failures

---

## Appendix A: Brand Personality Scoring Validation

**To validate brand personality implementation**, manually review 11 sites:

| Site | Expected Tone | Expected Energy | Expected Trust |
|------|--------------|-----------------|----------------|
| Stripe | minimal/elegant | sophisticated | modern |
| Monzo | playful | energetic | modern |
| Apple | elegant | calm | modern |
| CNN | professional | dynamic | modern |
| FIFA | bold | energetic | modern |
| GitHub | professional | calm | modern |
| Vercel | minimal | sophisticated | modern |
| Dawnlabs | elegant | sophisticated | modern |
| Koto | elegant | sophisticated | innovative |
| BBC | professional | dynamic | modern |

**After implementation**, run:
```bash
npx tsx scripts/validate-brand-personality.ts
# Should show >60% accuracy on tone/energy/trust
```

If <60% accuracy, scoring rules need revision before deploying to production.

---

## Appendix B: Quick Reference - File Locations

| Feature | File | Line | Type |
|---------|------|------|------|
| color_background_variation | global-style-vec.ts | ~74 | Norm |
| brand_color_saturation_energy | global-style-vec.ts | ~274 | Norm |
| brand_color_role_distinction | global-style-vec.ts | ~279 | Norm |
| spacing_median | global-style-vec.ts | ~172 | Norm |
| shape_grouping_strength | layout-features.ts | ~218 | Norm |
| typo_reserved_1-4 | global-style-vec.ts | ~157 | Impl |
| spacing_reserved_1 | global-style-vec.ts | ~197 | Impl |
| shape_reserved_1 | global-style-vec.ts | ~234 | Impl |
| brand_personality | brand-personality.ts | All | Impl |

Type: Norm = Normalization fix, Impl = Implementation required
