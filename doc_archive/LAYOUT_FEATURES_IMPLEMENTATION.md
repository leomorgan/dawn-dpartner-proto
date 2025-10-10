# Layout Features Implementation Plan

## Overview
This plan adds 12 new design-focused features to the style vector pipeline to better capture visual density, spacing patterns, and compositional characteristics that differentiate busy designs (CNN, BBC) from minimal designs (Stripe, Monzo, Dawn Labs).

## Goals
1. **Improve vector differentiation** between dense vs minimal designs
2. **Capture perceptual design qualities** that designers actually notice
3. **Maintain deterministic, DOM-extractable features** (no screenshot analysis)
4. **Update frontend to visualize new features** for debugging and validation

---

## Feature Set Summary

### Category A: Spacing & Density (5 features)
| Feature | Design Concept | Expected Range (Dense → Minimal) |
|---------|----------------|----------------------------------|
| Visual Density Score | Content competing for attention | 0.75-0.90 → 0.15-0.35 |
| Whitespace Breathing Ratio | Generous padding vs tight packing | 0.1-0.2 → 0.6-0.9 |
| Padding Consistency | Systematic vs ad-hoc spacing | 0.7-1.2 → 0.15-0.3 |
| Gestalt Grouping Strength | Clear visual grouping | 0.4-0.6 → 0.8-0.95 |
| Border & Container Heaviness | Dividers vs implied divisions | 0.6-0.8 → 0.05-0.15 |

### Category B: Typography & Hierarchy (2 features)
| Feature | Design Concept | Expected Range |
|---------|----------------|----------------|
| Typographic Hierarchy Depth | Size/weight variation for emphasis | 0.8-1.2 → 0.3-0.5 |
| Font Weight Contrast | Bold vs subtle emphasis | 200-400 → 100-200 |

### Category C: Visual Composition (5 features)
| Feature | Design Concept | Expected Range |
|---------|----------------|----------------|
| Compositional Complexity | Fragmented vs unified | 0.75-0.95 → 0.2-0.4 |
| Image-to-Text Balance | Visual vs textual emphasis | 0.3-0.5 → 1.5-3.0 |
| Color Saturation Energy | Vibrant vs muted | 50-70 → 10-30 |
| Shadow & Elevation Depth | Layered vs flat | 0.1-0.3 → 0.4-0.7 |
| Color Role Distinction | Functional color clarity | 15-30 → 50-80 |

**Total new dimensions**: 12 (will utilize reserved slots in existing 192D vector)

---

## Architecture Changes

### Current Vector Structure (192D)
```
[0-15]    Color features (16D)
[16-31]   Typography features (16D) ← 10 reserved slots available
[32-39]   Spacing features (8D) ← 2 reserved slots available
[40-47]   Shape features (8D)
[48-63]   Brand personality (16D)
[64-191]  Visual features / CLIP (128D, currently zero-padded)
```

### New Vector Structure (192D)
```
[0-15]    Color features (16D) + Color Saturation Energy, Color Role Distinction
[16-31]   Typography features (16D) ← add Hierarchy Depth, Font Weight Contrast
[32-39]   Spacing features (8D) ← add Density, Whitespace, Padding Consistency
[40-47]   Shape features (8D) ← add Border Heaviness, Shadow Depth
[48-55]   Layout features (8D) ← NEW CATEGORY for Compositional Complexity, Grouping, Image Balance
[56-63]   Brand personality (16D)
[64-191]  Visual features / CLIP (128D)
```

**Changes**:
- Repurpose 10 reserved typography slots → 8 new features
- Add new "Layout Features" category (8D) → reorganize vector structure
- Shift brand personality from [48-63] to [56-63]

---

## Implementation Plan

### Phase 1: Feature Extraction Module (Backend)

#### Task 1.1: Create `layout-features.ts` extractor
**File**: `/pipeline/vectors/extractors/layout-features.ts`

**Responsibilities**:
- Extract all 12 features from `ComputedStyleNode[]` array
- Implement each feature calculation with clear helper functions
- Return normalized values (0-1 range where applicable)

**Key functions**:
```typescript
export interface LayoutFeatureSet {
  // Spacing & Density
  visualDensityScore: number;
  whitespaceBreathingRatio: number;
  paddingConsistency: number;
  gestaltGroupingStrength: number;
  borderHeaviness: number;

  // Typography
  typographicHierarchyDepth: number;
  fontWeightContrast: number;

  // Visual Composition
  compositionalComplexity: number;
  imageToTextBalance: number;
  colorSaturationEnergy: number;
  shadowElevationDepth: number;
  colorRoleDistinction: number;
}

export function extractLayoutFeatures(
  nodes: ComputedStyleNode[],
  viewport: { width: number; height: number }
): LayoutFeatureSet;
```

**Implementation details**:
- **Visual Density Score**: `(elementCount × avgElementArea) / viewportArea`
- **Whitespace Breathing Ratio**: `avg((padding + margin) / contentSize)` for all containers
- **Padding Consistency**: `1 - (stdDev(paddings) / mean(paddings))` (inverted CoV)
- **Gestalt Grouping Strength**: `(intra-group spacing) / (inter-group spacing)` per container
- **Border Heaviness**: `sum(borderLength × borderWidth) / viewportPerimeter`
- **Typographic Hierarchy Depth**: `stdDev(fontSizes) / mean(fontSizes)`
- **Font Weight Contrast**: `(max(weights) - min(weights)) / 900` normalized
- **Compositional Complexity**: Count distinct visual clusters using bbox proximity
- **Image-to-Text Balance**: `sum(imageArea) / sum(textArea)`
- **Color Saturation Energy**: Area-weighted avg chroma in LCH space
- **Shadow Elevation Depth**: `avg(blur × spread × alpha)` for all box-shadows
- **Color Role Distinction**: Avg perceptual distance (ΔE2000) between CTA, link, text, bg colors

**Dependencies**:
```typescript
import { ComputedStyleNode } from '../../capture';
import { parseColor, calculateDeltaE } from '../utils/color-math';
import { coefficientOfVariation, clamp, normalizeLinear, normalizeLog } from '../utils/math';
```

**Estimated effort**: 6-8 hours

---

#### Task 1.2: Create helper utilities
**File**: `/pipeline/vectors/utils/math.ts`

```typescript
export function coefficientOfVariation(values: number[]): number;
export function normalizeLinear(value: number, min: number, max: number): number;
export function normalizeLog(value: number, midpoint: number): number;
export function clamp(value: number, min: number, max: number): number;
export function calculateStdDev(values: number[]): number;
export function detectClusters(values: number[], k: number): number[][];
```

**File**: `/pipeline/vectors/utils/color-math.ts`

```typescript
import { Lch, formatCss, converter } from 'culori';

export function parseColor(cssColor: string): Lch | null;
export function calculateDeltaE(color1: Lch, color2: Lch): number; // ΔE2000
export function getChroma(color: Lch): number;
export function classifyColorRole(
  node: ComputedStyleNode,
  allNodes: ComputedStyleNode[]
): 'cta' | 'link' | 'text' | 'background' | 'neutral';
```

**Estimated effort**: 3-4 hours

---

#### Task 1.3: Create geometry/grouping utilities
**File**: `/pipeline/vectors/utils/geometry.ts`

```typescript
export interface BBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

export function calculateBBoxArea(bbox: BBox): number;
export function calculateBBoxOverlap(bbox1: BBox, bbox2: BBox): number;
export function detectVisualGroups(nodes: ComputedStyleNode[]): ComputedStyleNode[][];
export function calculateProximityRatio(
  group: ComputedStyleNode[],
  allNodes: ComputedStyleNode[]
): number;
export function isImageElement(node: ComputedStyleNode): boolean;
export function hasTextContent(node: ComputedStyleNode): boolean;
```

**Implementation notes**:
- `detectVisualGroups()`: Use proximity-based clustering (elements within 32px = same group)
- `calculateProximityRatio()`: Measure avg spacing within group vs avg spacing to other groups

**Estimated effort**: 4-5 hours

---

#### Task 1.4: Update `global-style-vec.ts` to integrate new features
**File**: `/pipeline/vectors/global-style-vec.ts`

**Changes**:
1. Add `nodes` and `viewport` parameters to `buildGlobalStyleVec()`
2. Import and call `extractLayoutFeatures()`
3. Map features to vector dimensions
4. Update `featureNames` array with new descriptive names

**Code changes**:
```typescript
// Add parameters
export function buildGlobalStyleVec(
  tokens: StyleTokens,
  report: StyleReport,
  nodes: ComputedStyleNode[], // NEW
  viewport: { width: number; height: number } // NEW
): GlobalStyleVector {
  // Extract new features
  const layoutFeats = extractLayoutFeatures(nodes, viewport);

  // Replace reserved slots (lines ~129-132, ~142-143)
  // Typography category
  featureNames.push('typo_hierarchy_depth');
  interpretable.push(normalizeLinear(layoutFeats.typographicHierarchyDepth, 0, 2));

  featureNames.push('typo_weight_contrast');
  interpretable.push(layoutFeats.fontWeightContrast); // already normalized

  // Spacing category
  featureNames.push('spacing_density_score');
  interpretable.push(layoutFeats.visualDensityScore);

  featureNames.push('spacing_whitespace_ratio');
  interpretable.push(layoutFeats.whitespaceBreathingRatio);

  featureNames.push('spacing_padding_consistency');
  interpretable.push(layoutFeats.paddingConsistency);

  // Shape category
  featureNames.push('shape_border_heaviness');
  interpretable.push(layoutFeats.borderHeaviness);

  featureNames.push('shape_shadow_depth');
  interpretable.push(layoutFeats.shadowElevationDepth);

  // NEW Layout category (insert at position 48, shift brand personality)
  featureNames.push('layout_compositional_complexity');
  interpretable.push(layoutFeats.compositionalComplexity);

  featureNames.push('layout_grouping_strength');
  interpretable.push(layoutFeats.gestaltGroupingStrength);

  featureNames.push('layout_image_text_balance');
  interpretable.push(normalizeLog(layoutFeats.imageToTextBalance, 1.0)); // log scale

  // Color category additions
  featureNames.push('color_saturation_energy');
  interpretable.push(normalizeLinear(layoutFeats.colorSaturationEnergy, 0, 100));

  featureNames.push('color_role_distinction');
  interpretable.push(normalizeLinear(layoutFeats.colorRoleDistinction, 0, 100));

  // ... rest of vector construction
}
```

**Estimated effort**: 2-3 hours

---

#### Task 1.5: Update vector pipeline orchestrator
**File**: `/pipeline/vectors/index.ts`

**Changes**:
1. Read `computed_styles.json` and `meta.json` from artifacts
2. Pass to `buildGlobalStyleVec()`

```typescript
export async function vectorize(runId: string): Promise<VectorResult> {
  const runDir = join(ARTIFACTS_DIR, runId);

  // Existing reads
  const tokens = JSON.parse(await readFile(join(runDir, 'tokens.json'), 'utf8'));
  const report = JSON.parse(await readFile(join(runDir, 'style-report.json'), 'utf8'));

  // NEW: Read raw captured data
  const nodes: ComputedStyleNode[] = JSON.parse(
    await readFile(join(runDir, 'raw', 'computed_styles.json'), 'utf8')
  );
  const meta = JSON.parse(
    await readFile(join(runDir, 'raw', 'meta.json'), 'utf8')
  );

  // Build vector with new data
  const globalStyleVec = buildGlobalStyleVec(
    tokens,
    report,
    nodes,
    meta.viewport
  );

  // ... rest of vectorization
}
```

**Estimated effort**: 1 hour

---

### Phase 2: Testing & Validation

#### Task 2.1: Unit tests for feature extractors
**File**: `/tests/unit/layout-features.spec.ts`

**Test cases**:
```typescript
describe('Layout Features Extraction', () => {
  describe('Visual Density Score', () => {
    it('should score dense layouts (30 elements) as > 0.7', () => {});
    it('should score minimal layouts (5 elements) as < 0.3', () => {});
  });

  describe('Whitespace Breathing Ratio', () => {
    it('should score generous padding (48px avg) as > 0.7', () => {});
    it('should score tight padding (8px avg) as < 0.3', () => {});
  });

  describe('Image-to-Text Balance', () => {
    it('should detect image-heavy layouts (80% image area)', () => {});
    it('should detect text-heavy layouts (80% text area)', () => {});
  });

  // ... test all 12 features
});
```

**Mock data strategy**:
- Create synthetic `ComputedStyleNode[]` arrays representing:
  - Dense layout (CNN-like)
  - Minimal layout (Stripe-like)
  - Image-heavy layout
  - Text-heavy layout

**Estimated effort**: 5-6 hours

---

#### Task 2.2: Integration tests with real captures
**File**: `/tests/integration/vector-differentiation.spec.ts`

**Test approach**:
1. Use existing fixture captures (or create new ones for CNN + Stripe)
2. Run full vectorization pipeline
3. Assert feature values match expected ranges
4. Assert L2 distance between vectors is significant (> 3.0)

```typescript
describe('Vector Differentiation', () => {
  it('should differentiate CNN from Stripe', async () => {
    const cnnVec = await vectorize('cnn-capture-runId');
    const stripeVec = await vectorize('stripe-capture-runId');

    // Assert density features
    expect(cnnVec.features.spacing_density_score).toBeGreaterThan(0.7);
    expect(stripeVec.features.spacing_density_score).toBeLessThan(0.4);

    // Assert whitespace
    expect(cnnVec.features.spacing_whitespace_ratio).toBeLessThan(0.3);
    expect(stripeVec.features.spacing_whitespace_ratio).toBeGreaterThan(0.6);

    // Assert overall distance
    const distance = calculateL2Distance(cnnVec.vector, stripeVec.vector);
    expect(distance).toBeGreaterThan(3.0);
  });
});
```

**Estimated effort**: 4-5 hours

---

#### Task 2.3: Create validation script for manual testing
**File**: `/scripts/validate-layout-features.ts`

**Purpose**: Quick CLI tool to re-vectorize existing captures and inspect new features

```bash
npm run validate:features -- artifacts/cnn-20250102
```

**Output**:
```
Layout Features for artifacts/cnn-20250102:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Visual Density Score:        0.87 [████████▊ ] HIGH
Whitespace Breathing Ratio:  0.19 [█▉        ] LOW
Padding Consistency:         0.68 [██████▊   ] MEDIUM
Gestalt Grouping Strength:   0.42 [████▏     ] WEAK
Border Heaviness:            0.73 [███████▎  ] HIGH
...

Comparison with Stripe:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Feature                      CNN    Stripe   Diff
Visual Density Score         0.87   0.31     +0.56 ✓
Whitespace Breathing Ratio   0.19   0.78     -0.59 ✓
...

L2 Distance: 4.23 (good differentiation)
```

**Estimated effort**: 3-4 hours

---

### Phase 3: Frontend Visualization

#### Task 3.1: Update vector debug UI
**File**: `/app/debug/[runId]/vectors/page.tsx`

**Changes**:
1. Group features by category in UI
2. Add visual indicators for new layout features
3. Show comparisons between multiple runs

**New UI sections**:
```tsx
<FeatureCategoryCard title="Spacing & Density">
  <FeatureBar
    name="Visual Density Score"
    value={vector.spacing_density_score}
    range={[0, 1]}
    labels={['Minimal', 'Dense']}
  />
  <FeatureBar
    name="Whitespace Breathing Ratio"
    value={vector.spacing_whitespace_ratio}
    range={[0, 1]}
    labels={['Tight', 'Generous']}
  />
  {/* ... */}
</FeatureCategoryCard>

<FeatureCategoryCard title="Visual Composition">
  {/* ... */}
</FeatureCategoryCard>

<FeatureCategoryCard title="Typography & Hierarchy">
  {/* ... */}
</FeatureCategoryCard>
```

**Estimated effort**: 4-5 hours

---

#### Task 3.2: Create feature comparison view
**File**: `/app/debug/compare/page.tsx` (NEW)

**Purpose**: Side-by-side comparison of vectors from different captures

**UI mockup**:
```
┌─────────────────────────────────────────────────────────────┐
│ Compare Vectors                                             │
├─────────────────────────────────────────────────────────────┤
│ Select captures:                                            │
│ [CNN (run-123)    ▼]  vs  [Stripe (run-456)    ▼]         │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ Feature                    CNN      Stripe    Difference    │
│ ─────────────────────────────────────────────────────────── │
│ Visual Density             0.87     0.31      +0.56 ✓       │
│ Whitespace Ratio           0.19     0.78      -0.59 ✓       │
│ Padding Consistency        0.68     0.92      -0.24         │
│ ...                                                         │
│                                                             │
│ Overall L2 Distance: 4.23                                   │
│ Cosine Similarity:   0.12                                   │
└─────────────────────────────────────────────────────────────┘
```

**Features**:
- Dropdown to select two run IDs
- Table showing all features side-by-side
- Highlight significant differences (|diff| > 0.3)
- Show distance metrics (L2, cosine)
- Export comparison as JSON/CSV

**Estimated effort**: 6-8 hours

---

#### Task 3.3: Add feature radar chart visualization
**File**: `/app/debug/[runId]/vectors/components/FeatureRadar.tsx` (NEW)

**Purpose**: Visualize feature profile as radar/spider chart

**Implementation**:
```tsx
import { Radar } from 'recharts';

export function FeatureRadar({ vector }: { vector: GlobalStyleVector }) {
  const data = [
    { feature: 'Density', value: vector.spacing_density_score },
    { feature: 'Whitespace', value: vector.spacing_whitespace_ratio },
    { feature: 'Complexity', value: vector.layout_compositional_complexity },
    { feature: 'Grouping', value: vector.layout_grouping_strength },
    { feature: 'Image/Text', value: normalizeToRadar(vector.layout_image_text_balance) },
    { feature: 'Saturation', value: normalizeToRadar(vector.color_saturation_energy) },
  ];

  return (
    <RadarChart width={400} height={400} data={data}>
      <PolarGrid />
      <PolarAngleAxis dataKey="feature" />
      <PolarRadiusAxis domain={[0, 1]} />
      <Radar name="Features" dataKey="value" stroke="#8884d8" fill="#8884d8" fillOpacity={0.6} />
    </RadarChart>
  );
}
```

**Estimated effort**: 3-4 hours

---

#### Task 3.4: Update main debug page with feature highlights
**File**: `/app/debug/[runId]/page.tsx`

**Changes**:
- Add "Layout Features" card to overview
- Show top 3 distinguishing features (highest/lowest values)
- Add visual indicators (icons, colors) for feature categories

**Example card**:
```tsx
<Card>
  <CardHeader>Layout Features</CardHeader>
  <CardContent>
    <div className="space-y-2">
      <FeatureSummary
        icon={<DensityIcon />}
        label="Visual Density"
        value={0.87}
        interpretation="Dense, busy layout"
      />
      <FeatureSummary
        icon={<SpacingIcon />}
        label="Whitespace"
        value={0.19}
        interpretation="Tight spacing"
      />
      <FeatureSummary
        icon={<ImageIcon />}
        label="Image/Text Balance"
        value={0.42}
        interpretation="Text-heavy"
      />
    </div>
  </CardContent>
</Card>
```

**Estimated effort**: 3-4 hours

---

### Phase 4: Documentation & Refinement

#### Task 4.1: Update vector documentation
**File**: `/docs/VECTORS.md` (NEW or update existing)

**Content**:
- Explanation of 192D vector structure
- Description of each feature category
- Detailed explanation of new layout features
- Expected value ranges and interpretations
- Examples comparing different site types

**Estimated effort**: 2-3 hours

---

#### Task 4.2: Add inline code documentation
**Files**: All new TypeScript files

**Requirements**:
- JSDoc comments for all exported functions
- Type annotations for all parameters/returns
- Examples in comments for complex calculations

**Example**:
```typescript
/**
 * Calculates the visual density score, measuring how "busy" a layout feels.
 *
 * Formula: (elementCount × avgElementArea) / viewportArea
 *
 * @param nodes - Array of visible DOM elements with computed styles
 * @param viewport - Viewport dimensions {width, height}
 * @returns Normalized score from 0 (minimal) to 1 (dense)
 *
 * @example
 * const score = calculateVisualDensity(nodes, { width: 1280, height: 720 });
 * // Dense layout (CNN): ~0.85
 * // Minimal layout (Stripe): ~0.32
 */
export function calculateVisualDensity(
  nodes: ComputedStyleNode[],
  viewport: { width: number; height: number }
): number {
  // ...
}
```

**Estimated effort**: 3-4 hours

---

#### Task 4.3: Create runbook for debugging features
**File**: `/docs/DEBUGGING_LAYOUT_FEATURES.md` (NEW)

**Content**:
1. How to validate feature extraction is working
2. Common issues and troubleshooting
3. How to tune normalization ranges
4. How to add new features in the future

**Estimated effort**: 2 hours

---

### Phase 5: End-to-End Testing & Refinement

#### Task 5.1: Capture reference sites
**Captures needed**:
- Dense designs: CNN, BBC, Reddit
- Minimal designs: Stripe, Monzo, Dawn Labs
- Balanced designs: Airbnb, Medium, GitHub

**Script**: `/scripts/capture-reference-sites.ts`

```bash
npm run capture:references
```

**Estimated effort**: 2-3 hours

---

#### Task 5.2: Validate feature ranges
**Process**:
1. Run vectorization on all reference captures
2. Export feature values to CSV
3. Validate ranges match expected values
4. Adjust normalization functions if needed

**Acceptance criteria**:
- Dense sites: `visualDensityScore > 0.7`, `whitespaceRatio < 0.3`
- Minimal sites: `visualDensityScore < 0.4`, `whitespaceRatio > 0.6`
- L2 distance between dense/minimal > 3.0

**Estimated effort**: 4-5 hours

---

#### Task 5.3: Fine-tune normalization
**File**: `/pipeline/vectors/extractors/layout-features.ts`

**Adjustments**:
- Update `normalizeLinear()` min/max ranges based on real data
- Update `normalizeLog()` midpoints
- Ensure features are evenly distributed (avoid clustering at 0 or 1)

**Estimated effort**: 3-4 hours

---

#### Task 5.4: Update existing pipeline tests
**Files**: Various test files

**Changes**:
- Update snapshots with new vector dimensions
- Fix any broken tests due to vector structure changes
- Ensure E2E tests pass with new features

**Estimated effort**: 2-3 hours

---

## Migration Strategy

### Backward Compatibility
**Issue**: Existing vectors in artifacts are 192D but with different feature assignments

**Solution**:
1. Add version field to vector metadata: `{ version: '2.0', features: [...], vector: [...] }`
2. Create migration script: `/scripts/migrate-vectors-v2.ts`
3. Re-vectorize old captures on-demand (don't migrate in place)

**File**: `/pipeline/vectors/global-style-vec.ts`
```typescript
export function buildGlobalStyleVec(...): GlobalStyleVector {
  return {
    version: '2.0', // NEW
    featureNames,
    vector: interpretable.concat(visual),
    metadata: { ... }
  };
}
```

---

## Rollout Plan

### Week 1: Backend Implementation
- **Days 1-2**: Tasks 1.1-1.3 (extractors + utilities)
- **Days 3-4**: Task 1.4-1.5 (integration into pipeline)
- **Day 5**: Task 2.1 (unit tests)

### Week 2: Testing & Frontend
- **Days 1-2**: Tasks 2.2-2.3 (integration tests + validation script)
- **Days 3-5**: Tasks 3.1-3.2 (debug UI + comparison view)

### Week 3: Visualization & Documentation
- **Days 1-2**: Tasks 3.3-3.4 (radar chart + feature highlights)
- **Days 3-4**: Tasks 4.1-4.3 (documentation)
- **Day 5**: Buffer for unexpected issues

### Week 4: E2E Testing & Refinement
- **Days 1-2**: Tasks 5.1-5.2 (reference captures + validation)
- **Days 3-4**: Tasks 5.3-5.4 (normalization tuning + test fixes)
- **Day 5**: Final review and deployment

---

## Success Metrics

### Quantitative
- ✅ L2 distance between CNN and Stripe vectors > 3.0 (currently ~0.5)
- ✅ All 12 features have normalized values in expected ranges
- ✅ Feature extraction completes in < 500ms per capture
- ✅ All unit tests pass (>90% coverage for new code)
- ✅ Integration tests pass with real captures

### Qualitative
- ✅ Designer can look at feature values and understand the design "feel"
- ✅ Debug UI clearly visualizes differences between captures
- ✅ Features are interpretable and actionable for debugging

---

## Risk Mitigation

### Risk 1: Features don't differentiate as expected
**Mitigation**:
- Start with validation script (Task 2.3) EARLY
- Test on reference sites before full integration
- Have 2-3 backup features ready (e.g., text line length variance, element size entropy)

### Risk 2: Performance regression
**Mitigation**:
- Profile feature extraction (target: <500ms)
- Cache intermediate calculations (e.g., visual groups)
- Use early returns for expensive calculations when possible

### Risk 3: Breaking changes to existing pipeline
**Mitigation**:
- Add version field to vectors
- Keep old vector format readable (don't delete old code)
- Test with existing captures before deployment

### Risk 4: Frontend complexity explosion
**Mitigation**:
- Start simple (Task 3.1 basic feature bars)
- Add fancy visualizations (radar chart) last
- Make comparison view optional enhancement

---

## File Structure Summary

### New Files
```
/pipeline/vectors/extractors/
  layout-features.ts           # Main feature extraction logic

/pipeline/vectors/utils/
  math.ts                      # Statistical utilities
  color-math.ts                # Color calculations (ΔE, LCH)
  geometry.ts                  # Bbox, grouping, proximity

/tests/unit/
  layout-features.spec.ts      # Unit tests for extractors

/tests/integration/
  vector-differentiation.spec.ts  # E2E validation

/scripts/
  validate-layout-features.ts  # Manual validation CLI
  capture-reference-sites.ts   # Capture CNN, Stripe, etc.
  migrate-vectors-v2.ts        # Version migration

/app/debug/compare/
  page.tsx                     # Comparison view

/app/debug/[runId]/vectors/components/
  FeatureRadar.tsx            # Radar chart component

/docs/
  VECTORS.md                   # Vector documentation
  DEBUGGING_LAYOUT_FEATURES.md # Debugging guide
```

### Modified Files
```
/pipeline/vectors/
  global-style-vec.ts          # Add new features to vector
  index.ts                     # Pass nodes/viewport to builder

/app/debug/[runId]/vectors/
  page.tsx                     # Enhanced feature visualization

/app/debug/[runId]/
  page.tsx                     # Add layout features card
```

---

## Appendix: Feature Calculation Details

### Visual Density Score
```typescript
function calculateVisualDensity(nodes: ComputedStyleNode[], viewport: Viewport): number {
  const viewportArea = viewport.width * viewport.height;
  const totalElementArea = nodes.reduce((sum, n) => sum + (n.bbox.w * n.bbox.h), 0);
  const densityRatio = totalElementArea / viewportArea;

  // Normalize using log scale (typical: 0.2-1.5)
  return normalizeLog(densityRatio, 0.6); // midpoint at 0.6 = 0.5 score
}
```

### Whitespace Breathing Ratio
```typescript
function calculateWhitespaceBreathing(nodes: ComputedStyleNode[]): number {
  const containerNodes = nodes.filter(n => n.children && n.children.length > 0);

  const ratios = containerNodes.map(node => {
    const contentSize = node.bbox.w * node.bbox.h;
    const padding = parsePadding(node.styles.padding);
    const margin = parseMargin(node.styles.margin);
    const totalSpacing = (padding.total + margin.total) * 4; // approximate area

    return totalSpacing / (contentSize + 1); // avoid div by zero
  });

  const avgRatio = ratios.reduce((sum, r) => sum + r, 0) / ratios.length;
  return clamp(avgRatio, 0, 1); // already normalized
}
```

### Gestalt Grouping Strength
```typescript
function calculateGestaltGrouping(nodes: ComputedStyleNode[]): number {
  const groups = detectVisualGroups(nodes); // proximity-based clustering

  const groupingScores = groups.map(group => {
    const intraSpacing = calculateAvgIntraGroupSpacing(group);
    const interSpacing = calculateAvgInterGroupSpacing(group, nodes);

    return interSpacing / (intraSpacing + 1); // higher = stronger grouping
  });

  const avgScore = groupingScores.reduce((sum, s) => sum + s, 0) / groupingScores.length;
  return normalizeLog(avgScore, 3.0); // typical range: 1-10
}
```

### Color Saturation Energy
```typescript
import { lch, formatCss } from 'culori';

function calculateColorSaturationEnergy(nodes: ComputedStyleNode[]): number {
  const coloredNodes = nodes.filter(n =>
    n.styles.backgroundColor !== 'transparent' || n.styles.color
  );

  let totalChroma = 0;
  let totalArea = 0;

  for (const node of coloredNodes) {
    const bgColor = parseColor(node.styles.backgroundColor);
    const textColor = parseColor(node.styles.color);
    const area = node.bbox.w * node.bbox.h;

    if (bgColor) {
      totalChroma += (bgColor.c || 0) * area;
      totalArea += area;
    }
    if (textColor) {
      totalChroma += (textColor.c || 0) * area * 0.5; // weight text less
      totalArea += area * 0.5;
    }
  }

  const avgChroma = totalChroma / (totalArea || 1);
  return avgChroma; // LCH chroma range: 0-100+
}
```

### Image-to-Text Balance
```typescript
function calculateImageTextBalance(nodes: ComputedStyleNode[]): number {
  let imageArea = 0;
  let textArea = 0;

  for (const node of nodes) {
    const area = node.bbox.w * node.bbox.h;

    if (isImageElement(node)) {
      imageArea += area;
    } else if (hasTextContent(node)) {
      textArea += area;
    }
  }

  const ratio = imageArea / (textArea || 1);
  return ratio; // >1 = image-heavy, <1 = text-heavy
}

function isImageElement(node: ComputedStyleNode): boolean {
  return (
    node.tag === 'img' ||
    node.tag === 'picture' ||
    node.tag === 'video' ||
    (node.styles.backgroundImage && node.styles.backgroundImage !== 'none')
  );
}
```

---

## Total Estimated Effort

| Phase | Tasks | Hours |
|-------|-------|-------|
| Phase 1: Backend Implementation | 1.1-1.5 | 16-21 hours |
| Phase 2: Testing & Validation | 2.1-2.3 | 12-15 hours |
| Phase 3: Frontend Visualization | 3.1-3.4 | 16-21 hours |
| Phase 4: Documentation | 4.1-4.3 | 7-9 hours |
| Phase 5: E2E Testing & Refinement | 5.1-5.4 | 11-15 hours |
| **Total** | | **62-81 hours** |

**Timeline**: 3-4 weeks (assuming 1 developer, 20 hours/week)

**Buffer**: Add 20% for unexpected issues = **75-97 hours total**
