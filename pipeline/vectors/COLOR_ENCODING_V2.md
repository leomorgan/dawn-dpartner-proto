# Color Encoding v2 - CIEDE2000 Perceptual Distance Encoding

## Overview

This module replaces the old positional LCH encoding (20D) with a new CIEDE2000-based perceptual encoding (17D). The new encoding is order-invariant, perceptually meaningful, and properly handles light/dark mode differences.

## Key Improvements over v1

| Aspect | v1 (Old) | v2 (New) |
|--------|----------|----------|
| **Dimensions** | 20D | 17D (smaller, more focused) |
| **Distance Metric** | Euclidean LCH | CIEDE2000 (perceptually accurate) |
| **Brand Palette** | Positional (brandColors[0], [1], [2]) | Relational (pairwise distances) |
| **Order Invariance** | No (order matters) | Yes (hero = max chroma) |
| **Semantic Colors** | Mixed encoding | Absolute + relational |
| **Light/Dark Mode** | Not distinguished | Properly encoded (bg/text lightness) |

## Architecture (17 Dimensions)

### 1. Brand Palette Relationships (3D)

Encodes how colors in the brand palette relate to each other, not their absolute positions.

- **Dim 0**: Average pairwise CIEDE2000 distance (palette cohesion)
  - Range: 0-50 → [0, 1]
  - Low = tight palette (monochromatic), High = diverse palette
- **Dim 1**: Minimum pairwise distance (tightest two colors)
  - Range: 0-30 → [0, 1]
  - Detects near-duplicate colors
- **Dim 2**: Maximum pairwise distance (furthest two colors)
  - Range: 0-80 → [0, 1]
  - Measures palette span

**Order Invariance**: Pairwise distances are symmetric, so order doesn't matter.

### 2. Semantic Color Relationships (4D)

Encodes how semantic colors (background, text, CTA, hero) relate to each other.

- **Dim 3**: Background-text CIEDE2000 distance
  - Range: 0-100 → [0, 1]
  - Measures contrast (accessibility proxy)
- **Dim 4**: CTA-background CIEDE2000 distance
  - Range: 0-80 → [0, 1]
  - Measures CTA prominence
- **Dim 5**: CTA-text CIEDE2000 distance
  - Range: 0-100 → [0, 1]
  - Measures CTA vs text differentiation
- **Dim 6**: Hero-background CIEDE2000 distance
  - Range: 0-80 → [0, 1]
  - Measures brand color vs background

### 3. Background Absolute (2D)

Background color must be encoded absolutely because light vs dark mode matters.

- **Dim 7**: Background lightness (L)
  - Range: 0-100 → [0, 1]
  - Low = dark mode, High = light mode
- **Dim 8**: Background chroma (C)
  - Range: 0-30 → [0, 1]
  - Measures background tint amount (usually low)

### 4. Text Absolute (1D)

Text color must be encoded absolutely for light/dark mode.

- **Dim 9**: Text lightness (L)
  - Range: 0-100 → [0, 1]
  - Low = dark text (light mode), High = light text (dark mode)

### 5. Hero Brand Color Absolute (4D)

The "hero" color is the most saturated brand color (order-invariant selection).

- **Dim 10**: Hero lightness (L)
  - Range: 0-100 → [0, 1]
- **Dim 11**: Hero chroma (C)
  - Range: 0-150 → [0, 1]
  - Measures saturation intensity
- **Dim 12**: Hero hue cosine
  - Range: -1 to 1 (circular encoding)
  - Handles hue circularity (0° = 360°)
- **Dim 13**: Hero hue sine
  - Range: -1 to 1 (circular encoding)

### 6. CTA Color (3D)

Call-to-action color encoding with relationship to hero color.

- **Dim 14**: CTA lightness (L)
  - Range: 0-100 → [0, 1]
- **Dim 15**: CTA chroma (C)
  - Range: 0-150 → [0, 1]
- **Dim 16**: CTA-hero CIEDE2000 distance
  - Range: 0-50 → [0, 1]
  - Measures if CTA uses brand color or different color

## Implementation Details

### Brand Palette Construction

```typescript
const palette: string[] = [
  ...tokens.colors.brandColors,    // Vibrant (chroma > 50)
  ...tokens.colors.accentColors,   // Muted (chroma 20-50)
].slice(0, 5);

// Fallback if empty
if (palette.length === 0) {
  palette.push(...tokens.colors.primary);
}
```

### Hero Color Selection (Order-Invariant)

```typescript
function findHeroColor(brandPalette: string[]): Lch | null {
  let maxChroma = -1;
  let heroColor: Lch | null = null;

  for (const hex of brandPalette) {
    const color = parseColor(hex);
    const chroma = getChroma(color);
    if (chroma > maxChroma) {
      maxChroma = chroma;
      heroColor = color;
    }
  }

  return heroColor;
}
```

**Why Order-Invariant?**: Always selects the most saturated color, regardless of array order.

### CIEDE2000 Distance Calculation

```typescript
import { calculateDeltaE2000 } from './utils/color-math';

const distance = calculateDeltaE2000(color1, color2);
// Returns 0-100 range (typically 0-80 for real colors)
```

### Pairwise Distance Matrix

```typescript
function calculatePairwiseDistances(palette: string[]): number[] {
  const distances: number[] = [];
  const parsed = palette.map(parseColor);

  for (let i = 0; i < parsed.length; i++) {
    for (let j = i + 1; j < parsed.length; j++) {
      distances.push(calculateDeltaE2000(parsed[i], parsed[j]));
    }
  }

  return distances;
}
```

## Usage Example

```typescript
import { encodePaletteFeatures, getColorFeatureNames } from './color-encoding-v2';

// Extract design tokens from capture
const tokens = await extractDesignTokens(capture);

// Encode color features
const colorFeatures = encodePaletteFeatures(tokens);
// Returns: [0.43, 0.53, 0.38, 0.80, 0.60, 0.31, ...]

// Get feature names for debugging
const names = getColorFeatureNames();
// Returns: ['color_palette_avg_distance', 'color_palette_min_distance', ...]

// Use in vector embedding
const globalVec = [
  ...colorFeatures,           // 17D color
  ...spacingFeatures,         // ??D spacing
  ...typographyFeatures,      // ??D typography
  // ... etc
];
```

## Testing & Validation

### Test Coverage

- ✅ Returns exactly 17 features
- ✅ All features normalized to [0, 1] (except hue cos/sin in [-1, 1])
- ✅ Order-invariant (same encoding regardless of brandColors order)
- ✅ Differentiates different brands (Stripe vs Airbnb)
- ✅ Handles empty brand palette gracefully (fallback to primary)
- ✅ Handles single brand color (pairwise distances = 0)
- ✅ Encodes semantic relationships correctly (bg-text contrast)
- ✅ Encodes light mode vs dark mode differently (bg/text lightness)

### Run Tests

```bash
npm test -- color-encoding-v2.test.ts
```

## Migration from v1

### Changes Required

1. **Replace import**:
   ```typescript
   // Old
   import { encodeBrandColors } from './color-encoding';

   // New
   import { encodePaletteFeatures } from './color-encoding-v2';
   ```

2. **Update vector builder**:
   ```typescript
   // Old (20D)
   const colorFeatures = encodeBrandColors(tokens);

   // New (17D)
   const colorFeatures = encodePaletteFeatures(tokens);
   ```

3. **Update dimension indices** in any code that references specific color dimensions.

### Breaking Changes

- **Dimension count**: 20D → 17D (affects total vector size)
- **Dimension semantics**: Positional → Relational (affects interpretation)
- **Feature order**: Different order of features

## Edge Cases Handled

### Empty Brand Palette

```typescript
// If no brand/accent colors, falls back to primary colors
const palette = brandColors.length > 0 ? brandColors : primaryColors;
```

### Single Color Palette

```typescript
// Pairwise distances return [0] to avoid empty array
if (palette.length < 2) return [0];
```

### Missing Semantic Colors

```typescript
// Fallback values prevent NaN
const bgTextDist = bg && text ? calculateDeltaE2000(bg, text) : 50;
```

### Zero-Chroma Hero

```typescript
// If all brand colors are grayscale, picks the "least gray" one
const heroC = normalizeLinear(hero ? getChroma(hero) : 75, 0, 150);
```

## Performance

- **Time Complexity**: O(n²) for pairwise distances (n ≤ 5, so max 10 comparisons)
- **Space Complexity**: O(n) for palette storage
- **Typical Runtime**: < 1ms for 5-color palette

## Future Improvements

- [ ] Add variance checking during encoding (detect dead dimensions)
- [ ] Add optional WCAG contrast metric (not just CIEDE2000)
- [ ] Support custom normalization ranges via config
- [ ] Add palette "temperature" metric (warm vs cool hues)
- [ ] Add palette "harmony" score (complementary, analogous, etc.)

## References

- **CIEDE2000**: Sharma et al. (2005) - "The CIEDE2000 Color-Difference Formula"
- **LCH Color Space**: CIE L*C*h° (cylindrical representation of CIELAB)
- **Culori Library**: https://culorjs.org/ (color parsing and conversion)

---

**Version**: 2.0.0
**Author**: Vector Systems Architect
**Last Updated**: 2025-10-10
