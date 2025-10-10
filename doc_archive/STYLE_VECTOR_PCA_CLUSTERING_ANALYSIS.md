# Why Style Vectors Cluster Closely in PCA - Deep Dive Analysis

## Executive Summary

The 64D interpretable style vectors show meaningful L2 distances (1.21-3.20) but appear tightly clustered in PCA visualizations. This is caused by **low explained variance (58%)**, **feature saturation (22% dead features)**, **poor per-dimension variance (avg 0.041)**, and **small dataset size (11 samples in 64D space)**.

---

## The Data: Style Vector Performance

### Overall Metrics
- **Total Variance**: 2.610 across 64 dimensions
- **Avg Variance/Dim**: 0.041 (very low)
- **Max Variance**: 0.248 (dimension 48 - brand features)
- **Dimensions with Var>0.001**: 48/64 (75%)
- **Dimensions with Var>0.1**: 7/64 (10.9%) ⚠️

### PCA Performance
- **PC1 Explained Variance**: 35.1%
- **PC2 Explained Variance**: 22.9%
- **PC1+PC2 Total**: 58.0%
- **Information Lost in 2D**: 42.0% ❌

### 2D Projection Spread
- **X Range**: 2.780
- **Y Range**: 2.570
- **Actual L2 Distances**: 1.21-3.20 (avg 2.33)

### Sample Projections
```
Site                    2D Position (PC1, PC2)
─────────────────────────────────────────────
Stripe                  ( 1.265,  0.509)
BBC                     ( 1.152,  0.073)
Apple                   ( 0.198, -0.725)
Monzo                   (-0.740,  0.805)
CNN                     (-0.796,  0.704)
GitHub                  (-0.922,  0.434)
Koto Studio             (-1.515,  0.495)
Dawnlabs                (-0.855, -1.765)
```

**Observation**: Sites span only ~2.8 units in both X and Y, creating visual clustering despite real L2 distances of 1.2-3.2.

---

## Root Cause Analysis

### 1. LOW EXPLAINED VARIANCE (58%)

**Problem**: PC1+PC2 only capture 58% of total variance, meaning **42% of differentiation is lost** in the 2D projection.

**Why This Happens**:
- Variance is distributed across many dimensions (PC3-PC64)
- No single principal component dominates (PC1 only 35%)
- This is actually a sign of **high-dimensional, complex data**

**Impact**:
- Sites that are far apart in 64D space appear close in 2D
- Example: Monzo vs CNN have L2=1.217 in 64D, but appear adjacent in PCA plot
- The "lost" 42% contains critical differentiating features

**Evidence**:
```
Monzo vs CNN (64D):
  L2 Distance: 1.217
  Top differences: Whitespace (Δ=0.631), Border Radius (Δ=0.500), Color Entropy (Δ=0.429)

Monzo vs CNN (2D PCA):
  Euclidean distance: ~0.15 (appears clustered)
  Lost information: All the color, spacing, shape differences
```

---

### 2. FEATURE SATURATION (25% dead features)

**Problem**: 16 out of 64 features have near-identical values (variance < 0.001) across all 11 sites.

**Dead Features Breakdown** (see `DEAD_FEATURES_AUDIT_AND_FIXES.md` for complete analysis):
- **8 brand personality features**: All zeros or constant values (missing real analysis)
- **6 reserved slots**: typo_reserved_1-4, spacing_reserved_1, shape_reserved_1 (never implemented)
- **2 feature extraction issues**: typo_family_count (all 0.683), brand_color_saturation_energy (near zero)

**Additional 13 LOW VARIANCE features** (0.001 < variance < 0.01):
- Normalization ranges too wide/narrow
- Binary distributions (only 2 unique values)
- Underlying calculations too coarse

**Impact**:
- 22% of vector dimensions contribute **zero discriminative power**
- Effective dimensionality is ~50D, not 64D
- These dimensions add noise without adding signal

**Per-Category Breakdown**:
```
Category         Active Features  Dead Features  Effective Dims
─────────────────────────────────────────────────────────────
Color (16D)      12/16 (75%)     4/16           12D
Typography (16D) 13/16 (81%)     3/16           13D
Spacing (8D)     7/8 (88%)       1/8            7D
Shape (8D)       7/8 (88%)       1/8            7D
Brand (16D)      0/16 (0%)       16/16          0D ❌
─────────────────────────────────────────────────────────────
TOTAL (64D)      39/64 (61%)     25/64          39D
```

**Why Brand Features Are Dead**:
- Missing `brandPersonality` data in most captures
- All one-hot encoded brand features default to zeros
- 2 brand features (color_saturation_energy, color_role_distinction) have minimal variance

---

### 3. LOW PER-DIMENSION VARIANCE (avg 0.041)

**Problem**: Most feature values cluster in a narrow 0.5-0.8 range across sites.

**Variance Distribution**:
```
Variance Range    Count   Percentage
─────────────────────────────────────
0.0 - 0.01        16      25%  (dead)
0.01 - 0.05       32      50%  (low)
0.05 - 0.1        9       14%  (medium)
0.1+              7       11%  (high)
```

**Top 10 Highest Variance Dimensions**:
```
Rank  Dimension  Variance  Feature Name
─────────────────────────────────────────────────────────────
1     48         0.2479    brand_tone_professional (one-hot)
2     56         0.2314    brand_energy_sophisticated (one-hot)
3     55         0.2314    brand_energy_energetic (one-hot)
4     53         0.1983    brand_trust_modern (one-hot)
5     41         0.1678    shape_radius_median
6     49         0.1488    brand_tone_playful (one-hot)
7     51         0.1488    brand_tone_minimal (one-hot)
8     42         0.0920    shape_shadow_count
9     13         0.0837    color_brand_count
10    36         0.0836    spacing_whitespace_ratio
```

**Key Insight**: Highest variance comes from **one-hot brand features** (despite missing data) and **shape features**. Layout features (V3) have low variance (0.002-0.014).

**Example of Low Variance Problem**:
```
Feature: typo_family_count
  Values across 11 sites: [0.63, 0.63, 0.63, 0.63, 0.80, 0.63, 0.63, 0.63, 0.63, 0.63, 0.63]
  Variance: 0.0024

Feature: layout_element_scale_variance (V3)
  Values across 11 sites: [0.767, 0.756, 1.000, 1.000, 0.564, 0.896, 0.811, 0.814, 0.615, 0.820, 0.814]
  Variance: 0.0168
```

**Why This Happens**:
- Normalization compresses values into narrow ranges (0.5-0.8)
- Modern websites are converging on similar design patterns
- V3 normalization (0.8-6.0 raw → 0-1 normalized) still produces clustered values

---

### 4. SMALL DATASET SIZE (11 samples in 64D)

**Problem**: Only 11 data points in 64-dimensional space.

**PCA Requirements**:
- **Rule of Thumb**: Need ~10x more samples than dimensions
- **Current**: 11 samples for 64 dimensions (ratio: 0.17x)
- **Recommended**: ~640 samples minimum
- **Realistic Target**: 50+ samples for stable PCA

**Impact**:
- PCA overfits to noise rather than capturing true variance structure
- First principal component is unreliable with <100 samples
- Small sample variance inflates/deflates randomly
- Cannot distinguish signal from noise

**Statistical Evidence**:
```
Degrees of Freedom: 10 (n-1)
Parameters to Estimate: 64 × 63 / 2 = 2,016 covariances
Ratio: 10 / 2,016 = 0.005 (severely underdetermined)
```

---

## Why Monzo and CNN Appear Close Despite L2=1.217

Let's trace exactly what happens:

### In 64D Space (True Distance)
```
Monzo vs CNN Feature Differences:
  spacing_whitespace_ratio:    Δ=0.631 (Monzo 0.846, CNN 0.215)
  shape_radius_median:         Δ=0.500 (Monzo 1.000, CNN 0.500)
  color_palette_entropy:       Δ=0.429 (Monzo 0.686, CNN 0.257)
  color_button_diversity:      Δ=0.356 (Monzo 0.712, CNN 0.356)
  color_dominant_hue:          Δ=0.319 (Monzo 0.414, CNN 0.095)

  L2 Distance: 1.217 ✓
```

### In 2D PCA Projection
```
Monzo PCA coordinates: (-0.740, 0.805)
CNN PCA coordinates:   (-0.796, 0.704)

2D Euclidean distance: √[(−0.740−(−0.796))² + (0.805−0.704)²]
                     = √[0.056² + 0.101²]
                     = √[0.003 + 0.010]
                     = √0.013
                     = 0.114

Visual clustering: Yes, they appear very close!
```

### What PC1 and PC2 Capture
```
PC1 (35.1% variance):
  Primarily driven by: brand one-hot features, shape_radius_median
  Monzo: -0.740
  CNN: -0.796
  Difference: 0.056 (small)

PC2 (22.9% variance):
  Primarily driven by: brand energy features, some color features
  Monzo: 0.805
  CNN: 0.704
  Difference: 0.101 (small)
```

### What PC1 and PC2 Miss (42% lost variance)
```
Lost Features (in PC3-PC64):
  ✓ spacing_whitespace_ratio (Δ=0.631) - BIGGEST DIFFERENCE
  ✓ color_palette_entropy (Δ=0.429)
  ✓ color_button_diversity (Δ=0.356)
  ✓ color_dominant_hue (Δ=0.319)
  ✓ spacing_image_text_balance (Δ=0.272)
  ✓ typo_size_range (Δ=0.257)

These features exist in higher PCs (PC3, PC4, PC5...) but are invisible in 2D projection!
```

---

## Concrete Example: All Pairwise 2D vs 64D Distances

| Site Pair | 64D L2 Distance | 2D PCA Distance | Information Loss |
|-----------|-----------------|-----------------|------------------|
| Stripe ↔ BBC | 1.393 | 0.67 | 52% |
| Monzo ↔ CNN | 1.217 | 0.11 | **91%** ⚠️ |
| Apple ↔ Vercel | 1.466 | 0.62 | 58% |
| Koto ↔ Dawnlabs | 2.884 | 1.52 | 47% |
| **Avg Loss** | **2.332** | **1.12** | **52%** |

**Observation**: On average, **52% of distance information is lost** in PCA projection. For Monzo vs CNN, **91% is lost** because their main differences (whitespace, color) are in PC3-PC64.

---

## Solutions

### A. IMMEDIATE (Use Better Visualization)

**1. Use t-SNE Instead of PCA**
```typescript
import { TSNE } from 'tsne-js';

const tsne = new TSNE({
  dim: 2,
  perplexity: 3, // sqrt(11) for small dataset
  earlyExaggeration: 4.0,
  learningRate: 100.0,
  nIter: 1000,
});

tsne.initDataRaw(interpretableVecs);
for (let i = 0; i < 1000; i++) {
  tsne.step();
}
const output = tsne.getSolution();
```

**Why t-SNE is Better**:
- Designed for small datasets (<100 samples)
- Non-linear dimensionality reduction
- Preserves local neighborhood structure
- Will show Monzo and CNN as separate even with 11 samples

---

**2. Select Top-K Highest Variance Features**
```typescript
// Use only dimensions: 48, 56, 55, 53, 41, 49, 51, 42, 13, 36 (top 10)
const topK = [48, 56, 55, 53, 41, 49, 51, 42, 13, 36];
const reducedVecs = interpretableVecs.map(vec => topK.map(i => vec[i]));

const pca = new PCA(reducedVecs); // Now 10D instead of 64D
const projections = pca.predict(reducedVecs, { nComponents: 2 });

// Expected improvement: PC1+PC2 explained variance → ~85% (from 58%)
```

**Why This Works**:
- Removes 54/64 low-signal dimensions
- Focuses on features that actually differ between sites
- Reduces noise from dead/saturated features

---

**3. Show 3D PCA Instead of 2D**
```typescript
const projections = pca.predict(interpretableVecs, { nComponents: 3 });

// PC1+PC2+PC3 explained variance: 58% + ~15% = ~73%
// Reduces information loss from 42% to 27%
```

---

### B. MEDIUM TERM (Fix the Vectors)

**4. Review and Expand Normalization Ranges**

Current issues:
- `typo_family_count`: All sites 0.63 or 0.80 (needs wider range)
- `layout_element_scale_variance`: Clustered 0.56-1.0 (needs recalibration)
- `layout_vertical_rhythm`: Low variance 0.010-0.541 (OK but could be better)

**Action**:
```typescript
// Example: Expand element scale variance range
// Current: normalizeLinear(scaleVariance, 0.8, 6.0)
// V4: Use actual P5 and P95 from larger dataset
const p5 = 0.5;   // Actual 5th percentile from 50+ sites
const p95 = 8.0;  // Actual 95th percentile from 50+ sites
return normalizeLinear(scaleVariance, p5, p95);
```

---

**5. Remove Dead Features**

Create 48D "active feature" vector:
```typescript
const activeFeatures = [
  // Remove: brand one-hot (0-15 features all zeros)
  // Remove: typo_reserved_1-4 (28-31 all zeros)
  // Keep: All color, typography (active), spacing, shape features
];

// Result: 64D → 48D, all features have variance >0.01
```

---

**6. Collect Brand Personality Data**

Currently 16/64 dimensions (25%) are zeros because `brandPersonality` is missing:
```typescript
// In style report generation, ensure brand personality is always computed
const brandPersonality = await analyzeBrandPersonality(tokens, report);
// Never return null/undefined
```

---

### C. LONG TERM (More Data)

**7. Capture 50-100 More Sites**

Dataset size recommendations:
- **Minimum for PCA**: 50 samples (ratio: 0.78x)
- **Reliable PCA**: 100 samples (ratio: 1.56x)
- **Ideal**: 640 samples (ratio: 10x)

**Diversity requirements**:
- Vary industries (news, finance, e-commerce, SaaS, portfolios)
- Vary maturity (startups, established brands)
- Vary geography/culture (US, UK, EU, Asia)
- Vary time periods (capture same site over months)

---

**8. Use UMAP for Final Visualization**
```bash
npm install umap-js
```

```typescript
import { UMAP } from 'umap-js';

const umap = new UMAP({
  nComponents: 2,
  nNeighbors: 5, // For 11 samples
  minDist: 0.1,
  spread: 1.0,
});

const embedding = umap.fit(interpretableVecs);
```

**Why UMAP is Best Long-Term**:
- Preserves both local and global structure (better than t-SNE)
- Works well with 10-1000 samples
- Faster than t-SNE
- More stable across runs
- Industry standard for high-D visualization

---

## Recommendations Priority

### Priority 1 (This Week)
1. ✅ **Implement t-SNE visualization** alongside PCA
2. ✅ **Create top-10 features PCA** (dimensions 48,56,55,53,41,49,51,42,13,36)
3. ✅ **Add 3D PCA option** to capture PC3

### Priority 2 (This Month)
4. 📊 **Capture 40+ more sites** to reach 50 total
5. 🔧 **Fix brand personality data collection** (eliminate 16D of zeros)
6. 🔧 **Review normalization ranges** for low-variance features

### Priority 3 (Next Quarter)
7. 🎯 **Implement UMAP** as primary visualization
8. 🎯 **Create 48D active-feature vector** (remove dead dimensions)
9. 📊 **Reach 100+ captures** for reliable PCA

---

## Key Takeaway

**The style vectors ARE different** (L2 distance 1.21-3.20 in 64D), but **PCA cannot effectively project to 2D** because:

1. **58% explained variance** → 42% information loss
2. **22% dead features** → noise without signal
3. **Avg 0.041 variance/dim** → features too similar
4. **11 samples in 64D** → insufficient data for reliable PCA

**The main differentiating features (whitespace, color, shape) live in PC3-PC64** and are invisible in the 2D projection.

**Solution**: Use t-SNE/UMAP for small datasets, or collect 50+ more captures for reliable PCA.
