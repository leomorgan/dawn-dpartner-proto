# Primary vs Neutral Color Classification - Analysis & Recommendations

## Current Algorithm

### How It Works

**Location**: `pipeline/tokens/index.ts` lines 785-817

```typescript
// 1. Extract top 12 colors by screen area coverage
const topColors = Array.from(colorAreas.entries())
  .sort(([, areaA], [, areaB]) => areaB - areaA)
  .slice(0, 12);

// 2. Classify by LCH chroma (saturation)
const toLch = converter('lch');
for (const colorHex of topColors) {
  const lch = toLch(parsed);
  const chroma = lch.c ?? 0;

  if (chroma < 10) {
    neutralColors.push(colorHex);  // Low saturation = neutral
  } else {
    primaryColors.push(colorHex);  // High saturation = primary
  }
}

// 3. Hard limits
primaryColors.splice(6);  // Max 6 primary
neutralColors.splice(4);  // Max 4 neutral
```

### Classification Criteria

**Neutral Colors** (chroma < 10):
- Grayscale colors (black, white, grays)
- Very desaturated colors (light blues, beiges with minimal chroma)
- **Purpose**: Used for text, backgrounds, borders

**Primary Colors** (chroma >= 10):
- Vibrant brand colors
- Saturated accent colors
- **Purpose**: Brand identity, CTAs, visual interest

---

## Actual Results Analysis

### Stripe (Financial Services)

```
Primary Colors (6):
  #425466  chroma=13.3   (dark slate blue)
  #adbdcc  chroma=10.1   (light slate)
  #0a2540  chroma=20.6   (navy)
  #635bff  chroma=91.6   (vibrant purple - BRAND)
  #3f4b66  chroma=17.5   (slate)
  #efa82e  chroma=71.1   (orange accent)

Neutral Colors (4):
  #f6f9fc  chroma=1.9    (very light blue-gray)
  #ffffff  chroma=0.0    (white)
  #f6f9fb  chroma=1.5    (off-white)
  #3a3a3a  chroma=0.0    (dark gray)
```

**Analysis**:
- ✅ True neutrals correctly identified (whites, grays)
- ⚠️ Some "primary" colors are actually neutral-ish (#425466 has chroma=13.3 but looks like a neutral dark blue)
- ✅ Brand color (#635bff purple) correctly identified as primary

### Monzo (Banking)

```
Primary Colors (6):
  #091723  chroma=10.6   (very dark blue)
  #0000ee  chroma=124.5  (pure blue - BRAND)
  #ff4f40  chroma=82.5   (coral red - BRAND)
  #012433  chroma=15.7   (dark teal)
  #112231  chroma=12.7   (dark blue-gray)
  #f64d3f  chroma=79.6   (bright red)

Neutral Colors (4):
  #000000  chroma=0.0    (black)
  #f2f8f3  chroma=3.2    (very light green-gray)
  #ffffff  chroma=0.0    (white)
  #c9d0c6  chroma=5.6    (light gray-green)
```

**Analysis**:
- ✅ True neutrals correctly identified
- ⚠️ #091723, #012433, #112231 are borderline (chroma 10-15) - these are dark desaturated colors that function as neutrals but technically have slight saturation
- ✅ Brand colors (blue, coral red) correctly identified as primary

---

## Problems with Current Approach

### 1. **Hard Limits Are Arbitrary** 🚨

**Problem**: `neutralColors.splice(4)` means ALL sites get exactly 4 neutrals
- Stripe might actually have 6 neutrals
- Airbnb might only have 2
- The limit forces convergence

**Evidence**: Vector analysis shows `color_neutral_count = 0.6712` for ALL 5 test sites

### 2. **Chroma Threshold of 10 Is Imprecise** ⚠️

**Problem**: Threshold doesn't account for design intent

**Edge Cases**:
- `#091723` (chroma=10.6) - Very dark blue that LOOKS neutral but has slight saturation
- `#adbdcc` (chroma=10.1) - Light slate that could go either way
- `#c9d0c6` (chroma=5.6) - Light gray-green with subtle tint (correctly neutral, but close)

**Issue**: A single threshold can't capture the nuance of "what functions as a neutral vs brand color"

### 3. **Area-Based Ranking Misses Context** ⚠️

**Problem**: Sorting by area coverage doesn't account for **usage context**

Example:
- Black text covers 50% of screen area → classified as neutral ✅
- But what if a brand uses black as a primary brand color (like Chanel)?

### 4. **No Consideration of Color Role** 🚨

**Problem**: Algorithm doesn't distinguish:
- **Foundation neutrals** (white, black, grays) - always neutral
- **Tinted neutrals** (light blues, beiges) - could be neutral or primary depending on brand
- **Dark brand colors** (navy, forest green) - low chroma but still "brand colors"

---

## What Determines Primary vs Neutral? (Design Perspective)

### Neutrals (Functional)

**Purpose**: Structure, readability, backdrop
- Black/white/grays (chroma ≈ 0)
- Very light tints (#f6f9fc) for subtle backgrounds
- Dark desaturated colors for body text

**Characteristics**:
1. Low chroma (< 10)
2. High area coverage (backgrounds, text)
3. Used across many different contexts

### Primary (Brand Identity)

**Purpose**: Brand recognition, visual hierarchy, CTAs
- Vibrant brand colors (Stripe purple, Monzo coral)
- Accent colors for CTAs
- Colors that define brand personality

**Characteristics**:
1. Higher chroma (> 30 typically for true brand colors)
2. Used intentionally (buttons, logos, headers)
3. Memorable and distinctive

### The Gray Area (Tinted Neutrals / Muted Brand Colors)

**Problem**: Colors with chroma 10-30 can be either:
- **Muted brand colors**: Navy (#0a2540, chroma=20.6), Forest green
- **Tinted neutrals**: Slate blue (#425466, chroma=13.3)

**What distinguishes them?**
- **Usage context**: Is it used for structure or identity?
- **Intentionality**: Is it part of the brand color system?
- **Contrast to true neutrals**: Does it stand out from white/gray?

---

## Proposed Improvements

### Option 1: Multi-Tier Classification (Recommended)

Instead of binary primary/neutral, use **4 tiers**:

```typescript
interface ColorPalette {
  foundation: string[];      // Pure neutrals (chroma < 5): #fff, #000, grays
  tintedNeutrals: string[];  // Subtle tints (chroma 5-15): #f6f9fc, #425466
  brandColors: string[];     // Saturated brand (chroma > 30): #635bff, #ff4f40
  accentColors: string[];    // Muted brand (chroma 15-30): #0a2540, #efa82e
}
```

**Algorithm**:
```typescript
function classifyColors(colors: string[]) {
  const foundation = [];
  const tinted = [];
  const brand = [];
  const accent = [];

  for (const color of colors) {
    const lch = toLch(parse(color));
    const chroma = lch.c ?? 0;
    const lightness = lch.l ?? 0;

    // Pure neutrals: very low chroma OR pure black/white
    if (chroma < 5 || (lightness < 5 || lightness > 95)) {
      foundation.push(color);
    }
    // Vibrant brand colors
    else if (chroma > 30) {
      brand.push(color);
    }
    // Muted brand colors
    else if (chroma > 15) {
      accent.push(color);
    }
    // Tinted neutrals
    else {
      tinted.push(color);
    }
  }

  return { foundation, tinted, brand, accent };
}
```

**Benefits**:
- ✅ More nuanced classification
- ✅ Captures "muted brand colors" (navy, forest green)
- ✅ Separates structural neutrals from tinted backgrounds
- ✅ Better matches designer mental models

**Drawbacks**:
- ❌ More complex
- ❌ Need to update vector building code to handle 4 categories

---

### Option 2: Context-Aware Classification

Use **usage patterns** in addition to chroma:

```typescript
function classifyWithContext(colors: ColorWithContext[]) {
  for (const { color, usageContext } of colors) {
    const lch = toLch(parse(color));
    const chroma = lch.c ?? 0;

    // Context signals
    const isTextColor = usageContext.textUsage > usageContext.bgUsage;
    const isButtonColor = usageContext.buttonCount > 0;
    const isBorderOnly = usageContext.borderCount > 10 && usageContext.bgCount < 3;

    // High chroma = always primary
    if (chroma > 30) {
      return 'primary';
    }
    // Used in buttons = treat as primary (even if low chroma)
    else if (isButtonColor && chroma > 10) {
      return 'primary';
    }
    // Very low chroma OR only used for borders/text = neutral
    else if (chroma < 10 || isTextColor || isBorderOnly) {
      return 'neutral';
    }
    // Borderline cases
    else {
      return chroma > 15 ? 'primary' : 'neutral';
    }
  }
}
```

**Benefits**:
- ✅ Uses actual usage data
- ✅ Can identify "dark brand colors" by button usage
- ✅ Better handles edge cases

**Drawbacks**:
- ❌ Requires tracking usage context (already partially done)
- ❌ More complex logic

---

### Option 3: Remove Hard Limits (Simplest Fix)

**Just remove the arbitrary caps**:

```typescript
// BEFORE
primaryColors.splice(6);  // Max 6 primary
neutralColors.splice(4);  // Max 4 neutral

// AFTER
// Let natural distribution determine counts
// OR use adaptive limits based on total colors
const maxPrimary = Math.min(topColors.length * 0.6, 8);
const maxNeutral = Math.min(topColors.length * 0.4, 8);
primaryColors.splice(maxPrimary);
neutralColors.splice(maxNeutral);
```

**Benefits**:
- ✅ Simple fix
- ✅ Allows natural variation
- ✅ Stops the "all sites have 4 neutrals" problem

**Drawbacks**:
- ❌ Doesn't fix the fundamental chroma threshold issue
- ❌ Could lead to very long lists

---

## Recommendation: Hybrid Approach

**Combine Options 1 + 3** for best results:

### Phase 1: Quick Fix (Immediate)
1. Remove hard limit of 4 neutrals → use adaptive limit (6-8)
2. Increase chroma threshold from 10 → 15 (better separates true brand colors)

```typescript
// Stricter threshold for neutrals
if (chroma < 15) {
  neutralColors.push(colorHex);
} else {
  primaryColors.push(colorHex);
}

// Adaptive limits
primaryColors.splice(8);  // Max 8 primary
neutralColors.splice(8);  // Max 8 neutral (up from 4)
```

### Phase 2: Proper Solution (Medium-term)
Implement multi-tier classification:

```typescript
interface DesignTokens {
  colors: {
    foundation: string[];      // chroma < 5
    tintedNeutrals: string[];  // chroma 5-20
    brandColors: string[];     // chroma > 40
    accentColors: string[];    // chroma 20-40
    // Keep for backward compat
    primary: string[];         // = brandColors + accentColors
    neutral: string[];         // = foundation + tintedNeutrals
  }
}
```

**This gives**:
- ✅ Immediate fix for vector diversity
- ✅ Backward compatible (keep primary/neutral)
- ✅ More nuanced data for future features
- ✅ Better matches design system reality

---

## Testing the Improvement

After implementing, test with:

```bash
# Re-run token extraction
npm run tokens -- <runId>

# Check color counts
cat artifacts/<runId>/design_tokens.json | jq '{
  primary: .colors.primary | length,
  neutral: .colors.neutral | length,
  foundation: .colors.foundation | length,
  brand: .colors.brandColors | length
}'

# Verify diversity across sites
# Should see varying neutral counts (2-8) instead of all 4
```

**Expected Results**:
- Stripe: 4-5 neutrals (professional, clean)
- Monzo: 3-4 neutrals (minimal palette)
- Airbnb: 6-7 neutrals (warm, inviting with tinted beiges)
- FIFA: 2-3 neutrals (bold, high contrast)

---

## Appendix: Design System Color Theory

### Industry Standards

**Material Design** (Google):
- Primary color (1)
- Secondary color (1)
- Surface colors (2-3: background, card)
- On-surface colors (2-3: text on different backgrounds)
- **Total: ~8 colors** in core palette

**Tailwind CSS**:
- 9 shades per color
- Typically 1-2 brand colors × 9 shades
- 1 gray scale × 9 shades
- **But only 3-4 colors are "semantic"** (primary, secondary, gray-500, white)

**Real World Observation**:
- **Minimalist brands**: 2-4 colors total (1-2 brand, 2 neutrals)
- **Standard brands**: 6-10 colors (3-4 brand, 3-6 neutrals)
- **Complex brands**: 12+ colors (multi-product lines, accessibility needs)

### Chroma Thresholds in LCH

- **0-5**: Pure neutrals (blacks, whites, grays)
- **5-15**: Subtle tints (light blues, beiges, warm grays)
- **15-40**: Muted colors (navy, forest green, burgundy)
- **40-80**: Vibrant colors (brand colors, CTAs)
- **80-150**: Highly saturated (pure hues, neon colors)

**Recommendation**: Use 15 as threshold, not 10, to better separate structural neutrals from brand colors.
