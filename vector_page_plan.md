# Vector Visualization Page Plan

## Overview

Create an immersive, visual-first page that decodes the 192D global style vector and 64D CTA vector into human-readable design insights. The page should make the abstract numerical encodings tangible through rich visual representations.

**Route**: `/vectors/[styleProfileId]` or `/vectors/inspect/[runId]`

**Core Principle**: Every dimension in the vector should have a visual counterpart that communicates what that feature means in design language.

---

## Data Architecture

### What We Encode (Source of Truth)

#### Global Style Vector (192D)
**Interpretable Features (64D)**:
- **Color Features (16D)**: primary count, neutral count, palette entropy, contrast pass rate, dominant hue, saturation mean, lightness mean, button diversity, link diversity, background variation, harmony score, coherence
- **Typography Features (16D)**: family count, size range, size count, weight count, lineheight count, coherence
- **Spacing Features (8D)**: scale length, median spacing, consistency
- **Shape Features (8D)**: radius count, radius median, shadow count
- **Brand Personality (16D)**: tone (5D one-hot), energy (4D one-hot), trust level (4D one-hot), confidence (1D)

**Visual Features (128D)**: Zero-padded for MVP (future: CLIP screenshot embeddings)

#### CTA Vector (64D)
**Interpretable Features (24D)**:
- **Color Features (6D)**: bg LCH (L, C, h), fg LCH (L, C, h)
- **Typography Features (4D)**: font size, font weight, casing score
- **Shape Features (6D)**: border radius, stroke width, padding X/Y
- **Interaction Features (4D)**: has hover, hover color shift, hover opacity
- **UX Features (4D)**: contrast ratio, min tap side

**Visual Features (40D)**: Zero-padded for MVP (future: button crop embeddings)

### Data Sources
```typescript
// From database
style_profiles {
  id, capture_id, source_url, tokens_json, style_vec, ux_summary
}
role_vectors_primarycta {
  id, style_profile_id, vec, tokens_json, ux_report, confidence
}

// From artifacts filesystem
artifacts/{runId}/
  - raw/page.png (screenshot)
  - design_tokens.json (full DesignTokens)
  - style_report.json (StyleReport with brandPersonality, realTokenMetrics)
  - cta/ (CTA template artifacts)
```

---

## Visual Design System

### Layout Structure

```
┌─────────────────────────────────────────────────────────────┐
│ Header: [Screenshot Preview] [URL] [Captured At]            │
│         Click to expand fullscreen                          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ ┌─────────────────┐  ┌──────────────────────────────────┐  │
│ │  Navigation      │  │  Main Content Area               │  │
│ │  Sidebar         │  │                                  │  │
│ │                  │  │  [Tab-based sections]            │  │
│ │  • Overview      │  │  - Vector Overview               │  │
│ │  • Colors        │  │  - Color Analysis                │  │
│ │  • Typography    │  │  - Typography Analysis           │  │
│ │  • Spacing       │  │  - Spacing Analysis              │  │
│ │  • Shape         │  │  - Shape Analysis                │  │
│ │  • Brand DNA     │  │  - Brand Personality             │  │
│ │  • CTA Deep Dive │  │  - CTA Vector Breakdown          │  │
│ │  • Similarity    │  │  - Similar Brands                │  │
│ │                  │  │                                  │  │
│ └─────────────────┘  └──────────────────────────────────┘  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Section-by-Section Breakdown

### 1. Header: Contextual Banner
**Purpose**: Immediate visual context of what URL/capture we're inspecting

**Components**:
- **Screenshot thumbnail** (clickable to expand modal, like preview-cta page)
  - Dimensions: Full width, 200px height, object-fit cover
  - Hover: slight zoom effect
  - Click: opens fullscreen modal with scrollable full screenshot
- **Metadata overlay**:
  - Source URL (with external link icon)
  - Capture timestamp (e.g. "Captured 2 hours ago")
  - Run ID (monospace, small, copyable)
- **Quick Actions**:
  - Re-vectorize button
  - Download raw data (JSON)
  - View CTA template (link to /preview-cta/[runId])

**Visual Style**:
- Clean, minimal, white background
- Screenshot has subtle shadow and rounded corners
- Metadata in gray text, well-spaced

---

### 2. Overview Tab
**Purpose**: High-level vector summary and key metrics

**Components**:

#### A. Vector Health Card
- **Global Vector**: 192D (64D interpretable, 128D visual)
  - Show donut chart: 64 active features (green), 128 reserved (gray)
  - Non-zero count badge
  - "Feature Density: 64/192 (33%)"
- **CTA Vector**: 64D (24D interpretable, 40D visual)
  - Show donut chart: 24 active features (blue), 40 reserved (gray)
  - Non-zero count badge
  - "Feature Density: 24/64 (37.5%)"

#### B. Key Design Metrics (4 stat cards)
```
┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐
│ Palette     │ │ Contrast    │ │ Spacing     │ │ Typography  │
│ Entropy     │ │ Pass Rate   │ │ Consistency │ │ Coherence   │
│             │ │             │ │             │ │             │
│   0.73      │ │   94%       │ │   100%      │ │   80%       │
│ ━━━━━━━━━━  │ │ ━━━━━━━━━━  │ │ ━━━━━━━━━━  │ │ ━━━━━━━━━━  │
└─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘
```
- Use color coding: green (>80%), yellow (60-80%), red (<60%)
- Visual progress bars under each metric

#### C. Brand Personality Snapshot
- **Tone**: Bold pill badge with icon
- **Energy**: Energetic (animated sparkle icon)
- **Trust**: Modern (gradient icon)
- **Confidence**: 0.8 → "High confidence" with 4/5 stars

#### D. Feature Heatmap Preview
- Small 8×8 grid representing the 64 interpretable dimensions
- Color intensity = feature value (0-1 normalized)
- Hover shows feature name + value
- Click a cell to jump to that feature's detail

---

### 3. Colors Tab
**Purpose**: Deep dive into color encoding

**Components**:

#### A. Palette Visualization
**Layout**: Grid of color swatches with metadata
```
Primary Colors (4)                    Neutral Colors (2)
┌────┐ ┌────┐ ┌────┐ ┌────┐          ┌────┐ ┌────┐
│    │ │    │ │    │ │    │          │    │ │    │
│ ██ │ │ ██ │ │ ██ │ │ ██ │          │ ██ │ │ ██ │
│    │ │    │ │    │ │    │          │    │ │    │
└────┘ └────┘ └────┘ └────┘          └────┘ └────┘
#016b83 #091723 #ff4f40 #ffffff      #f2f8f3 #000000
```
- Each swatch shows:
  - Large color block
  - Hex code
  - LCH values (L, C, h as small text)
  - Usage context (e.g. "CTA background", "Text")
- Group by: Primary, Neutral, Semantic, Contextual (buttons, links, backgrounds)

#### B. Color Harmony Wheel
- **Visualization**: Circular hue wheel (360°) with saturation/lightness overlay
- Plot all palette colors on the wheel
- Dominant hue highlighted (thick arc)
- Palette type badge (e.g. "Monochromatic", "Analogous")
- Harmony score (0-1) as radial progress

#### C. Contrast Matrix
- **Visualization**: Heatmap grid showing contrast ratios for all color pairs
- Color coded:
  - Green: AA passing (≥4.5:1)
  - Yellow: Large text only (≥3:1)
  - Red: Failing (<3:1)
- Click a cell to see suggested WCAG-compliant alternative

#### D. Encoded Features Table
```
┌──────────────────────────────────────────────────────────────┐
│ Feature Name           │ Raw Value  │ Encoded │ Visualization │
├──────────────────────────────────────────────────────────────┤
│ color_primary_count    │ 4 colors   │ 0.83    │ ████████▒▒    │
│ color_neutral_count    │ 2 colors   │ 0.48    │ ████▒▒▒▒▒▒    │
│ color_palette_entropy  │ Shannon    │ 0.73    │ ███████▒▒▒    │
│ color_contrast_pass_rate│ 94%       │ 0.94    │ █████████▒    │
│ color_dominant_hue     │ 193°       │ 0.54    │ █████▒▒▒▒▒    │ (teal)
│ color_saturation_mean  │ 0.62       │ 0.62    │ ██████▒▒▒▒    │
│ color_lightness_mean   │ 0.45       │ 0.45    │ ████▒▒▒▒▒▒    │
│ color_harmony_score    │ Mono 0.85  │ 0.85    │ ████████▒▒    │
│ ...                    │            │         │               │
└──────────────────────────────────────────────────────────────┘
```

---

### 4. Typography Tab
**Purpose**: Typography feature visualization

**Components**:

#### A. Font Family Showcase
- List each detected font with live preview
```
┌─────────────────────────────────────────────────────────────┐
│ MonzoSansText, sans-serif                                   │
│                                                             │
│ The quick brown fox jumps over the lazy dog                │
│ THE QUICK BROWN FOX JUMPS OVER THE LAZY DOG                │
│ 1234567890 !@#$%^&*()                                       │
│                                                             │
│ Fallback: system-ui, -apple-system, ...                    │
└─────────────────────────────────────────────────────────────┘
```

#### B. Type Scale Visualization
- **Layout**: Staircase of detected font sizes
```
                                        48px ━━━━━━━━━━━━━━━━━
                               32px ━━━━━━━━━━━━━
                      24px ━━━━━━━━━━
             18px ━━━━━━━
    16px ━━━━━
14px ━━━
```
- Show size range: 14px → 48px
- Encoded feature: `typo_size_range = 0.68` (34px range)

#### C. Font Weight Spectrum
- **Visualization**: Horizontal bar with weights plotted
```
Light          Regular         Semibold         Bold
300 ──────────── 400 ──────────── 600 ──────────── 700
     │                    │                 │
   ●                    ●                 ●
```
- Each detected weight shown as dot
- Encoded: `typo_weight_count = 0.63` (3 weights)

#### D. Typography Coherence Gauge
- **Visualization**: Circular gauge (0-100%)
- Current: 80% → "High coherence"
- Reasoning text: "Systematic font usage with consistent hierarchy"

---

### 5. Spacing Tab
**Purpose**: Spatial rhythm visualization

**Components**:

#### A. Spacing Scale Ladder
- **Visualization**: Vertical bars of increasing height
```
┃ 4px
┃━ 8px
┃━━ 12px
┃━━━ 16px
┃━━━━ 24px
┃━━━━━━ 32px
┃━━━━━━━━ 48px
```
- Each bar height proportional to spacing value
- Median highlighted (different color)
- Encoded: `spacing_median = 0.50` (24px)

#### B. Spacing Consistency Score
- **Visualization**: Scatter plot of spacing values
- X-axis: index in spacing array
- Y-axis: spacing value (px)
- Trend line showing consistency
- Score: 100% → "Perfectly systematic"

#### C. Usage Heatmap
- **Visualization**: Grid showing where each spacing value is used
- Categories: padding, margin, gap
- Color intensity = frequency of use

---

### 6. Shape Tab
**Purpose**: Visual style language (borders, shadows, radius)

**Components**:

#### A. Border Radius Samples
- **Visualization**: Rectangle samples with actual border-radius applied
```
┌─────┐  ┏━━━━━┓  ╭─────╮  ⬮
│ 0px │  ┃ 4px ┃  │ 8px │  16px
└─────┘  ┗━━━━━┛  ╰─────╯  (circle)
```
- Each shape rendered with actual CSS
- Median highlighted
- Encoded: `shape_radius_median = 0.25` (8px)

#### B. Shadow Library
- **Visualization**: Cards with actual box-shadow applied
```
┌───────────────┐  ┌───────────────┐  ┌───────────────┐
│ No shadow     │  │ Subtle (s0)   │  │ Medium (s1)   │
│               │  │               │  │               │
└───────────────┘  └───────────────┘  └───────────────┘
                   0 1px 2px rgba     0 4px 8px rgba
```
- Live preview of each shadow
- Show CSS value on hover

---

### 7. Brand DNA Tab
**Purpose**: Personality and brand intelligence visualization

**Components**:

#### A. Personality Radar Chart
- **Visualization**: Radar/spider chart with 3 axes:
  - Tone (5 options): professional → playful → elegant → bold → minimal
  - Energy (4 options): calm → energetic → sophisticated → dynamic
  - Trust (4 options): conservative → modern → innovative → experimental
```
          Bold (1.0)
              ●
             /│\
            / │ \
      Playful─┼─Energetic
          /   │   \
         /    ●    \
    Professional   Modern
```
- Active selection highlighted with solid fill
- One-hot encoding visible: only one dimension per axis is 1.0

#### B. Color Psychology Card
- **Dominant Mood**: "Energetic" (large text)
- **Emotional Response**: Pills for ["exciting", "passionate", "urgent"]
- **Brand Adjectives**: Tag cloud with size = frequency
  - BOLD (largest), dynamic, powerful, subtle, refined

#### C. Confidence Meter
- **Visualization**: Horizontal bar with icon
```
Low ━━━━━━━●━━━ High
         0.8
```
- Interpretation text: "High confidence in brand analysis"

#### D. Spacing Personality
- **Rhythm**: "Comfortable" (badge)
- **Consistency**: "Systematic" (badge)
- Small visual: tight vs generous spacing example

---

### 8. CTA Deep Dive Tab
**Purpose**: Detailed breakdown of the 64D CTA vector

**Components**:

#### A. Primary Button Showcase
- **Visualization**: Live button preview (actual styles)
```
┌──────────────────────────────────────────┐
│                                          │
│        ┏━━━━━━━━━━━━━━━━━━━━┓            │
│        ┃   Get Started      ┃  ← Live   │
│        ┗━━━━━━━━━━━━━━━━━━━━┛            │
│                                          │
│        ┏━━━━━━━━━━━━━━━━━━━━┓            │
│        ┃   Get Started      ┃  ← Hover  │
│        ┗━━━━━━━━━━━━━━━━━━━━┛            │
│                                          │
└──────────────────────────────────────────┘
```
- Rendered with actual extracted styles
- Hover state animation (if detected)
- Dimensions overlay on hover (width × height)

#### B. CTA Color Breakdown (LCH Space)
- **Background Color**: #016b83
  - L: 42 (lightness)
  - C: 35 (chroma/saturation)
  - h: 193° (hue - teal)
  - Visual: Color swatch + LCH cylinder diagram
- **Foreground Color**: #ffffff
  - L: 100, C: 0, h: 0
- **Contrast Ratio**: 4.8:1 (WCAG AA ✓)

#### C. Typography Metrics
- Font size: 16px (encoded: 0.43)
- Font weight: 600 semibold (encoded: 0.50)
- Casing score: 0.15 → "Mostly lowercase" (visual: aAbBcC with 15% highlighted)

#### D. Shape & Spacing
- **Border radius**: 8px (visual: rounded corner demo)
- **Padding**: 12px (Y) × 24px (X)
  - Visual: Box model diagram showing padding
- **Stroke width**: 0 (no border)
- **Min tap target**: 40px (Mobile accessibility ✓)

#### E. Interaction Features
- **Has hover**: Yes ✓
- **Hover color shift**: Yes → #004e60 (darker teal)
- **Hover opacity**: None
- **Hover transform**: None

#### F. 24D Feature Table
```
┌──────────────────────────────────────────────────────────┐
│ Dimension  │ Feature Name        │ Value  │ Normalized │
├──────────────────────────────────────────────────────────┤
│ 0          │ cta_bg_L            │ 42     │ 0.42       │
│ 1          │ cta_bg_C            │ 35     │ 0.35       │
│ 2          │ cta_bg_h            │ 193°   │ 0.54       │
│ 3          │ cta_fg_L            │ 100    │ 1.00       │
│ 4          │ cta_fg_C            │ 0      │ 0.00       │
│ 5          │ cta_fg_h            │ 0°     │ 0.00       │
│ 6          │ cta_font_size       │ 16px   │ 0.43       │
│ 7          │ cta_font_weight     │ 600    │ 0.50       │
│ ...        │                     │        │            │
└──────────────────────────────────────────────────────────┘
```

---

### 9. Similarity Tab
**Purpose**: Show similar brands based on vector distance

**Components**:

#### A. Nearest Neighbors (k-NN)
- Query database for 10 nearest style_profiles by L2 distance
- **Visualization**: Grid of cards
```
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
│ [Screenshot]    │ │ [Screenshot]    │ │ [Screenshot]    │
│                 │ │                 │ │                 │
│ stripe.com      │ │ revolut.com     │ │ square.com      │
│ Distance: 1.24  │ │ Distance: 1.89  │ │ Distance: 2.15  │
│ 92% similar     │ │ 87% similar     │ │ 81% similar     │
└─────────────────┘ └─────────────────┘ └─────────────────┘
```
- Each card:
  - Thumbnail screenshot (clickable → opens that vector page)
  - URL
  - L2 distance (raw value)
  - Similarity % (calculated as `1 - distance/max_distance`)
  - "View Details" button

#### B. Distance Breakdown
- For the #1 nearest neighbor, show dimension-by-dimension comparison
```
Feature                 This Site    Similar Site    Diff
color_primary_count     0.83         0.75            +0.08
color_dominant_hue      0.54 (teal)  0.52 (teal)     +0.02
typo_family_count       0.69         0.69            0.00
...
```
- Highlight features with largest differences (red) and closest matches (green)

#### C. Visual Comparison
- Side-by-side screenshots
- Overlaid color palettes
- Button style comparison

---

## Technical Implementation

### API Routes

#### 1. `/api/vectors/[styleProfileId]`
**GET**: Fetch vector data for visualization
```typescript
Response: {
  styleProfile: {
    id, source_url, tokens_json, style_vec (192D array), ux_summary
  },
  ctaVector: {
    id, vec (64D array), tokens_json, confidence, ux_report
  },
  capture: {
    runId, screenshot_uri, dom_uri, captured_at
  },
  artifacts: {
    designTokens: DesignTokens,
    styleReport: StyleReport,
    ctaTemplateHtml: string
  }
}
```

#### 2. `/api/vectors/similar/[styleProfileId]`
**GET**: Find k nearest neighbors
```typescript
Query params: ?k=10
Response: {
  neighbors: Array<{
    id, source_url, distance, similarity_percent,
    screenshot_uri, tokens_preview
  }>
}
```

#### 3. `/api/vectors/list`
**GET**: List all vectorized captures (for browsing page)
```typescript
Query params: ?page=1&limit=20
Response: {
  profiles: Array<{
    id, source_url, screenshot_uri, captured_at,
    has_cta_vector, confidence
  }>,
  total, page, pages
}
```

### Components to Build

1. **`/app/vectors/[styleProfileId]/page.tsx`**
   - Main vector visualization page
   - Tab-based navigation
   - Uses client components for interactive visualizations

2. **`/components/vectors/ColorPaletteViz.tsx`**
   - Reusable color swatch grid
   - Color harmony wheel (use canvas or SVG)

3. **`/components/vectors/HeatmapGrid.tsx`**
   - Generic heatmap for feature values
   - Hover tooltips with feature names

4. **`/components/vectors/RadarChart.tsx`**
   - Brand personality spider chart
   - SVG-based, interactive

5. **`/components/vectors/ButtonShowcase.tsx`**
   - Renders actual button with styles from tokens
   - Hover state preview

6. **`/components/vectors/FeatureTable.tsx`**
   - Sortable, filterable table for vector dimensions
   - Color-coded by value intensity

7. **`/components/vectors/SimilarityCard.tsx`**
   - Reusable card for nearest neighbor results

8. **`/components/vectors/ScreenshotModal.tsx`**
   - Reuse pattern from preview-cta page
   - Fullscreen image zoom

### Database Queries

```typescript
// lib/db/queries.ts additions

export async function getVectorProfile(styleProfileId: string) {
  const result = await query(`
    SELECT
      sp.*,
      c.run_id, c.screenshot_uri, c.dom_uri, c.captured_at, c.source_url,
      rc.id as cta_id, rc.vec as cta_vec, rc.tokens_json as cta_tokens,
      rc.confidence as cta_confidence, rc.ux_report as cta_ux_report
    FROM style_profiles sp
    JOIN captures c ON c.id = sp.capture_id
    LEFT JOIN role_vectors_primarycta rc ON rc.style_profile_id = sp.id
    WHERE sp.id = $1
  `, [styleProfileId]);

  return result.rows[0];
}

export async function findNearestStyleProfiles(
  referenceProfileId: string,
  limit: number = 10
) {
  // Already implemented in queries.ts
}
```

---

## User Flow

1. **Entry Point**: User lands from:
   - `/vectors` (browse all vectorized captures)
   - After batch vectorization (link in success message)
   - From CTA preview page ("View Vector Analysis" button)

2. **Navigation**:
   - Click screenshot → fullscreen modal
   - Sidebar tabs → switch between analysis sections
   - Click similar brand card → navigate to that brand's vector page
   - "Re-vectorize" → runs storage pipeline again, refreshes page

3. **Interactions**:
   - Hover over color swatches → see LCH values
   - Hover over feature table cells → see detailed tooltip
   - Click feature name → scroll to visual representation
   - Click "Download JSON" → get raw vector data

---

## Visual Design Principles

1. **Make numbers tangible**: Every encoded value (0.0-1.0) should have a visual representation (bar, circle, color intensity)

2. **Color coding consistency**:
   - Feature values: gradient from blue (0) to purple (1)
   - Quality scores: green (good), yellow (medium), red (poor)
   - Vector types: Global (teal), CTA (orange)

3. **Hierarchy**:
   - Large: actual visual samples (buttons, colors, fonts)
   - Medium: charts and graphs
   - Small: numerical tables and metadata

4. **Interactivity**:
   - Hover shows details
   - Click navigates or expands
   - Everything copyable (hex codes, feature values)

5. **Responsiveness**:
   - Desktop-first (complex visualizations)
   - Tablet: stacked sections
   - Mobile: simplified views, scrollable tables

---

## Success Metrics

**User should be able to answer**:
- What colors define this brand?
- How bold vs minimal is the design?
- What makes this CTA button effective?
- Which other brands have similar design DNA?
- Are there any accessibility issues?
- How systematic is the design system?

**Visual outputs should communicate**:
- "This is a bold, energetic brand with a teal accent color"
- "The spacing is very systematic (100% consistency)"
- "The CTA button has excellent contrast (4.8:1) and hover states"
- "Similar to Stripe and Revolut in design language"

---

## Future Enhancements (Post-MVP)

1. **Visual Embeddings (128D + 40D)**:
   - Replace zero-padding with CLIP embeddings of screenshots
   - Show actual screenshot crops for visual features
   - Similarity search by visual appearance

2. **Animation Playback**:
   - Record and playback actual hover/focus interactions
   - Show micro-animations from captured site

3. **Comparative View**:
   - Side-by-side comparison of 2+ brands
   - Diff highlighting for vector dimensions

4. **Export & Sharing**:
   - Generate shareable report PDF
   - Public URL for vector visualization (no auth)

5. **Search & Filter**:
   - Search by brand personality traits
   - Filter by color palette type
   - Range queries on specific dimensions

6. **Time Series**:
   - Track how a brand's vector evolves over time
   - Plot dimension changes across captures

---

## Implementation Priority

### Phase 1: Core Foundation (MVP)
1. `/vectors/[styleProfileId]/page.tsx` route with header + screenshot
2. Overview tab (vector health, key metrics)
3. Colors tab (palette + harmony wheel)
4. CTA Deep Dive tab (button showcase + metrics)
5. Basic styling (Tailwind, shadcn/ui components)

### Phase 2: Advanced Visualizations
6. Typography tab (font showcase, type scale)
7. Spacing tab (ladder, consistency gauge)
8. Shape tab (radius samples, shadows)
9. Brand DNA tab (radar chart, personality cards)

### Phase 3: Discovery & Comparison
10. Similarity tab (k-NN results, comparison)
11. `/vectors` browse page (list all captures)
12. Search & filter functionality

### Phase 4: Polish
13. Animations and transitions
14. Mobile responsive layouts
15. Export/download features
16. Performance optimization (lazy loading, virtualization)
