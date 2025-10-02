# Vector Front-End Update Plan

## Overview
Now that we've integrated CLIP visual embeddings (768D) alongside interpretable style embeddings (64D), we need to update the vector visualization UI to showcase this dual-vector system and enable visual comparison between brands through PCA projection.

## Current State Analysis

### Existing Vectors Route (`/vectors/[styleProfileId]`)
- Shows single style profile with tabs: overview, colors, typography, brand, cta
- Displays 192D vector health (now outdated - should show 64D interpretable + 768D visual + 832D combined)
- No visual comparison between brands
- No dimensionality reduction visualization
- Focus is on individual token inspection, not brand-to-brand comparison

### Home Page (`/`)
- Shows list of vectorized captures as clickable cards
- Links to individual `/vectors/[id]` pages
- No aggregate visualization or comparison tools

## Goals

1. **Update Vector Health Display**: Reflect new architecture (64D + 768D + 832D)
2. **Add PCA Visualization**: 2 separate plots for interpretable vs visual embeddings
3. **Enable Brand Comparison**: Interactive scatter plots showing all brands in reduced space
4. **Visual Storytelling**: Make it clear how CLIP captures visual similarity vs token-based similarity

## Proposed Architecture

### Option A: New Dedicated Visualization Route
**Route**: `/vectors` (index page)

**Layout**:
```
┌─────────────────────────────────────────────┐
│  Vector Space Visualization                 │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│                                             │
│  [Style Embeddings (64D → 2D PCA)]         │
│  ┌───────────────────────────────────────┐ │
│  │                                       │ │
│  │    • stripe.com                      │ │
│  │              • monzo.com             │ │
│  │                                       │ │
│  │    • apple.com                       │ │
│  │                       • github.com   │ │
│  │                                       │ │
│  │    • cnn.com                         │ │
│  │                                       │ │
│  └───────────────────────────────────────┘ │
│                                             │
│  [Visual Embeddings (768D → 2D PCA)]       │
│  ┌───────────────────────────────────────┐ │
│  │                                       │ │
│  │    • stripe.com                      │ │
│  │              • monzo.com             │ │
│  │                                       │ │
│  │         • apple.com                  │ │
│  │                                       │ │
│  │    • github.com                      │ │
│  │                       • cnn.com      │ │
│  │                                       │ │
│  └───────────────────────────────────────┘ │
│                                             │
│  [Brand Cards Grid - Click to View Detail] │
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐      │
│  │stripe│ │monzo │ │apple │ │github│      │
│  └──────┘ └──────┘ └──────┘ └──────┘      │
│                                             │
└─────────────────────────────────────────────┘
```

**Features**:
- Two side-by-side PCA scatter plots
- Hover to see brand info
- Click point to navigate to `/vectors/[id]` detail page
- Color code by brand personality tone
- Show distance lines on hover

### Option B: Enhanced Individual Vector Page
**Route**: `/vectors/[styleProfileId]` (enhanced)

Add new "Comparison" tab showing:
- PCA plot with current brand highlighted
- Other brands shown as reference points
- Distance metrics to nearest neighbors

## Technical Implementation

### 1. PCA Computation

**Backend API Route**: `/api/vectors/pca`

```typescript
GET /api/vectors/pca?type=interpretable|visual|combined

Response:
{
  projections: [
    {
      id: string,
      sourceUrl: string,
      x: number,  // PCA component 1
      y: number,  // PCA component 2
      brandTone: string,
      visualModel: string
    },
    ...
  ],
  explainedVariance: [number, number]  // % variance explained by PC1, PC2
}
```

**PCA Libraries**:
- **ml-pca** (npm): Simple PCA for JavaScript
- **@tensorflow/tfjs** (if we want more control)

**Implementation**:
```typescript
import { PCA } from 'ml-pca';

export async function computePCA(vectors: number[][], dimensions: number = 2) {
  const pca = new PCA(vectors);
  const projections = pca.predict(vectors, { nComponents: dimensions });

  return {
    projections: projections.to2DArray(),
    explainedVariance: pca.getExplainedVariance()
  };
}
```

### 2. Visualization Components

**Component**: `<VectorScatterPlot />`

**Tech Stack**:
- **Recharts** (already in project): Simple, declarative React charts
- **Alternative**: D3.js for more control (but heavier)

**Props**:
```typescript
interface VectorScatterPlotProps {
  data: Array<{
    id: string;
    sourceUrl: string;
    x: number;
    y: number;
    brandTone: string;
  }>;
  title: string;
  onPointClick: (id: string) => void;
  highlightedId?: string;
}
```

**Features**:
- Tooltip on hover showing brand name + URL
- Click to navigate to detail page
- Color by brand tone (professional, playful, serious, etc.)
- Axes labeled as "PC1 (X% variance)" and "PC2 (Y% variance)"

### 3. Vector Health Card Update

Update the Overview tab in `/vectors/[styleProfileId]/page.tsx`:

**Old** (line 244-266):
```tsx
<div className="bg-white rounded-lg border p-6">
  <h3 className="text-sm font-semibold text-gray-700 mb-4">Global Style Vector</h3>
  <div className="text-3xl font-bold text-gray-900">192D</div>
  ...
</div>
```

**New**:
```tsx
<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
  {/* Interpretable (Style Tokens) */}
  <div className="bg-white rounded-lg border p-6">
    <h3 className="text-sm font-semibold text-gray-700 mb-4">
      🎨 Style Tokens
    </h3>
    <div className="text-3xl font-bold text-gray-900">64D</div>
    <div className="text-sm text-gray-600">Interpretable embeddings</div>
    ...
  </div>

  {/* Visual (CLIP) */}
  <div className="bg-white rounded-lg border p-6">
    <h3 className="text-sm font-semibold text-gray-700 mb-4">
      👁️ Visual Embedding
    </h3>
    <div className="text-3xl font-bold text-gray-900">768D</div>
    <div className="text-sm text-gray-600">
      CLIP (openai/clip)
    </div>
    ...
  </div>

  {/* Combined */}
  <div className="bg-white rounded-lg border-2 border-blue-500 p-6">
    <h3 className="text-sm font-semibold text-blue-700 mb-4">
      🔀 Combined
    </h3>
    <div className="text-3xl font-bold text-blue-900">832D</div>
    <div className="text-sm text-blue-600">
      L2-normalized hybrid
    </div>
    ...
  </div>
</div>
```

## Recommended Approach

**Phase 1: Update Existing Pages (Low Effort, Immediate Value)**
1. Update vector health cards to show 64D + 768D + 832D
2. Add visual model badge (openai/clip)
3. Add "normalized" indicator

**Phase 2: Add PCA Visualization (Medium Effort, High Value)**
1. Create `/api/vectors/pca` endpoint
2. Create `<VectorScatterPlot>` component using Recharts
3. Add new tab "Comparison" to `/vectors/[id]` page
4. Show 2 plots (style vs visual) with current brand highlighted

**Phase 3: Dedicated Visualization Dashboard (High Effort, Future)**
1. Create `/vectors` index route
2. Full-page dual PCA plots
3. Interactive filtering by brand tone
4. Distance heatmap matrix

## Visual Design Principles

### Color Coding Strategy
- **By Brand Tone**:
  - Professional: Blue (#3b82f6)
  - Playful: Purple (#a855f7)
  - Serious: Gray (#6b7280)
  - Friendly: Green (#10b981)
  - Luxurious: Gold (#f59e0b)

- **Highlight Current**: Bold outline + larger dot
- **Hover State**: Enlarge dot + show tooltip

### Chart Styling
- Clean, minimal axes
- Grid lines at 25% opacity
- Dots: 8px radius, 2px stroke
- Font: Match existing UI (likely Inter or similar)
- Responsive: Stack plots vertically on mobile

### Interactivity
- **Hover**: Tooltip with brand name, URL, distances
- **Click**: Navigate to `/vectors/[id]`
- **Legend**: Color key for brand tones
- **Zoom**: Optional pan/zoom for dense clusters

## Data Requirements

### Query to Fetch All Vectors
```sql
SELECT
  sp.id,
  sp.source_url,
  sp.interpretable_vec,
  sp.visual_vec,
  sp.combined_vec,
  sp.visual_model,
  sp.ux_summary->>'brandPersonality' as brand_tone,
  c.captured_at,
  c.screenshot_uri
FROM style_profiles sp
JOIN captures c ON c.id = sp.capture_id
WHERE sp.visual_vec IS NOT NULL  -- Only include profiles with CLIP embeddings
ORDER BY c.captured_at DESC
```

### PCA Input Format
```typescript
const interpretableVectors = profiles.map(p =>
  JSON.parse(p.interpretable_vec.toString())  // pgvector to array
);

const visualVectors = profiles.map(p =>
  JSON.parse(p.visual_vec.toString())
);
```

## Success Metrics

1. **Visual Clarity**: User can immediately see which brands cluster together
2. **Insight Generation**: Clear difference between style similarity vs visual similarity
3. **Performance**: PCA computation < 100ms for 50 brands
4. **Engagement**: Click-through rate to detail pages increases

## Next Steps

1. **Decision**: Choose Option A (new route) or Option B (enhanced tab)?
2. **Install Dependencies**: `npm install ml-pca recharts` (if not already present)
3. **Create API Route**: `/api/vectors/pca`
4. **Build Component**: `<VectorScatterPlot>`
5. **Wire Up UI**: Add to existing or new route

## Open Questions

1. Should we show all 3 vector types (interpretable, visual, combined) or just interpretable + visual?
2. Do we need real-time PCA or can we cache projections?
3. Should we add filters (by industry, by tone, by date)?
4. Do we want 3D PCA (using plotly) or stick with 2D?

---

**Recommendation**: Start with **Phase 1** (update cards) + **Phase 2** (add Comparison tab to existing detail page) for fastest value delivery. Phase 3 can be future enhancement.
