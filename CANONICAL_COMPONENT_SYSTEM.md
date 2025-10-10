# Canonical Component System - Technical Planning Document

**Status:** Draft v1.0
**Date:** 2025-10-10
**Objective:** Evolve from single-component capture (primaryCTA) to a structured, extensible canonical component system

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Current Architecture Analysis](#2-current-architecture-analysis)
3. [Target Architecture](#3-target-architecture)
4. [Repository Reorganization](#4-repository-reorganization)
5. [Component Registry System](#5-component-registry-system)
6. [Database Schema Design](#6-database-schema-design)
7. [Backend Pipeline Architecture](#7-backend-pipeline-architecture)
8. [Frontend Display System](#8-frontend-display-system)
9. [Implementation Phases](#9-implementation-phases)
10. [Testing & Validation Strategy](#10-testing--validation-strategy)
11. [Migration Path](#11-migration-path)
12. [Open Questions & Decisions](#12-open-questions--decisions-needed)
13. [Success Criteria](#13-success-criteria)
14. [Next Steps](#14-next-steps)

---

## 1. Executive Summary

### Current State
- ✅ Single component type: **PrimaryCTA** (buttons)
- ✅ 26D interpretable vector with color, typography, shape, interaction, UX features
- ✅ LLM-based classification (primary vs secondary)
- ✅ Dedicated `role_vectors_primarycta` table
- ✅ Working similarity search and frontend display

### Target State
- 🎯 **5 canonical component types**: Button, Input, Card, Hero, NavBar
- 🎯 Plugin-style architecture - components can be enabled/disabled independently
- 🎯 Shared extraction patterns + component-specific logic
- 🎯 Unified frontend framework with component-specific renderers
- 🎯 Token-first approach with fallback to raw values
- 🎯 One-by-one activation strategy for incremental rollout

### Design Principles
1. **Token-first**: Reference design tokens wherever possible (`source: "token"`)
2. **Incremental**: Build skeleton → enable components one-by-one
3. **Consistent patterns**: Reuse extraction/vectorization/storage logic
4. **Extensible**: Easy to add new component types
5. **Pragmatic**: Start simple, add complexity as needed

---

## 2. Current Architecture Analysis

### 2.1 PrimaryCTA Flow (Current)

```
1. CAPTURE (pipeline/capture)
   └─> DOM + computed styles → ComputedStyleNode[]

2. TOKEN EXTRACTION (pipeline/tokens/index.ts)
   ├─> analyzeButtonVariant() → extract button properties
   ├─> classifyButtonsWithLLM() → semantic classification
   └─> DesignTokens.buttons.variants[]

3. VECTOR BUILDING (pipeline/vectors/primary-cta-vec.ts)
   ├─> buildPrimaryCtaVec()
   ├─> 26D: 8D colors + 4D typography + 6D shape + 4D interaction + 4D UX
   └─> L2-normalized Float32Array

4. STORAGE (pipeline/storage/index.ts)
   ├─> storeVectors()
   ├─> INSERT INTO role_vectors_primarycta
   └─> tokens_json (JSONB), vec (VECTOR(26)), ux_report (JSONB)

5. API (app/api/vectors/nearest-ctas/route.ts)
   └─> Cosine similarity search

6. FRONTEND (app/vectors/[styleProfileId]/page.tsx)
   └─> Display in "CTA" tab
```

### 2.2 Key Files & Responsibilities

| File | Responsibility | Lines of Code |
|------|----------------|---------------|
| `pipeline/tokens/index.ts` | Button extraction | ~100 lines (button logic) |
| `pipeline/tokens/button-classifier.ts` | LLM classification | ~163 lines |
| `pipeline/vectors/primary-cta-vec.ts` | Vector building | ~210 lines |
| `pipeline/storage/index.ts` | DB writes | ~50 lines (CTA logic) |
| `lib/db/schema.sql` | Table definition | ~20 lines |
| `app/api/vectors/nearest-ctas/route.ts` | API endpoint | ~100 lines |

### 2.3 Patterns to Extract & Reuse

**✅ Good patterns (reusable):**
- LLM-based semantic classification with fallback heuristics
- Token reference structure (`{ source, value, fallback }`)
- Interpretable feature vectors with named dimensions
- L2 normalization for cosine similarity
- `role_vectors_{type}` table naming convention
- JSONB storage for flexible metadata

**⚠️ Patterns to improve:**
- Button extraction is embedded in monolithic `analyzeStyles()` function
- No abstraction for component types
- Hard to add new components without modifying core files
- Frontend display is component-specific, not generalized

---

## 3. Target Architecture

### 3.1 High-Level Design

```
┌─────────────────────────────────────────────────────────────┐
│                    COMPONENT REGISTRY                        │
│  - Enabled components: [Button, Input, Card, Hero, NavBar]  │
│  - Each component: extractor → classifier → vectorizer      │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                   UNIFIED PIPELINE                           │
│  1. CAPTURE (unchanged)                                      │
│  2. TOKEN EXTRACTION (component-specific extractors)         │
│  3. CLASSIFICATION (component-specific classifiers)          │
│  4. VECTORIZATION (component-specific vectors)               │
│  5. STORAGE (component-specific tables)                      │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                      DATABASE                                │
│  - role_vectors_button (26D)                                 │
│  - role_vectors_input (TBD)                                  │
│  - role_vectors_card (TBD)                                   │
│  - role_vectors_hero (TBD)                                   │
│  - role_vectors_navbar (TBD)                                 │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                   FRONTEND FRAMEWORK                         │
│  - ComponentDisplay registry                                 │
│  - Generic similarity search UI                              │
│  - Component-specific renderers                              │
└─────────────────────────────────────────────────────────────┘
```

### 3.2 Core Abstractions

#### ComponentDefinition Interface

```typescript
interface ComponentDefinition {
  type: ComponentType;  // "button" | "input" | "card" | "hero" | "navbar"
  enabled: boolean;

  // Extraction: DOM → CanonicalSpec
  extractor: (nodes: ComputedStyleNode[], tokens: DesignTokens) => CanonicalSpec[];

  // Classification: CanonicalSpec[] → variants
  classifier?: (specs: CanonicalSpec[]) => ClassificationResult;

  // Vectorization: CanonicalSpec → FeatureVector
  vectorizer: (spec: CanonicalSpec, tokens: DesignTokens, report: StyleReport) => {
    interpretable: Float32Array;
    combined: Float32Array;
    metadata: Record<string, any>;
  };

  // Storage: table name + column schema
  storage: {
    tableName: string;        // "role_vectors_button"
    vectorDimension: number;  // 26, 32, etc.
    schema: TableSchema;
  };

  // Frontend: display component
  display: {
    renderer: React.ComponentType<{ spec: CanonicalSpec }>;
    tabLabel: string;
  };
}
```

#### TokenRef (from planning doc)

```typescript
type TokenRef<T = string | number> = {
  source: "token" | "computed" | "raw";
  value: T;
  fallback?: T;
};
```

#### Base CanonicalSpec (shared fields)

```typescript
interface BaseCanonicalSpec {
  type: ComponentType;
  representativeNodeId: string;
  clusterId: string;

  // Core styling (present on most components)
  radius?: TokenRef<number>;
  elevation?: TokenRef<string>;
  palette: {
    bg: TokenRef<string>;
    fg: TokenRef<string>;
    border?: TokenRef<string>;
  };

  // Typography
  typography?: {
    family: TokenRef<string>;
    weight: TokenRef<number>;
    size: TokenRef<number>;
    lineHeight: TokenRef<number | string>;
  };

  // Spacing
  padding?: { x: TokenRef<number>; y: TokenRef<number> };
  gap?: TokenRef<number>;
}
```

---

## 4. Repository Reorganization

### 4.1 Current Structure (Simplified)

```
pipeline/
├── tokens/
│   ├── index.ts (monolithic - 2000+ lines)
│   └── button-classifier.ts
├── vectors/
│   ├── primary-cta-vec.ts
│   ├── global-style-vec.ts
│   └── types.ts
└── storage/
    └── index.ts

lib/db/
├── schema.sql
└── queries.ts

app/api/
└── vectors/
    ├── [styleProfileId]/route.ts
    └── nearest-ctas/route.ts
```

### 4.2 Target Structure (Proposed)

```
pipeline/
├── components/              # NEW: Component definitions
│   ├── registry.ts          # Component registry + enable/disable
│   ├── types.ts             # Shared interfaces
│   │
│   ├── button/              # Button component
│   │   ├── index.ts         # Component definition
│   │   ├── extractor.ts     # DOM → ButtonCanonical
│   │   ├── classifier.ts    # LLM classification (moved from tokens/)
│   │   ├── vectorizer.ts    # ButtonCanonical → 26D vector
│   │   └── spec.ts          # TypeScript types for ButtonCanonical
│   │
│   ├── input/               # Input component (NEW)
│   │   ├── index.ts
│   │   ├── extractor.ts
│   │   ├── classifier.ts
│   │   ├── vectorizer.ts
│   │   └── spec.ts
│   │
│   ├── card/                # Card component (NEW)
│   │   └── ...
│   │
│   ├── hero/                # Hero component (NEW)
│   │   └── ...
│   │
│   └── navbar/              # NavBar component (NEW)
│       └── ...
│
├── tokens/
│   ├── index.ts             # REFACTORED: Core token extraction (colors, typography, spacing)
│   ├── color-*.ts           # Color-related modules (existing)
│   └── utils.ts             # Shared utilities
│
├── vectors/
│   ├── global-style-vec.ts  # UNCHANGED
│   ├── normalization.ts     # UNCHANGED
│   └── utils.ts             # UNCHANGED
│
└── storage/
    ├── index.ts             # REFACTORED: Orchestrates all components
    └── component-storage.ts # NEW: Generic component storage logic

lib/db/
├── schema.sql               # UPDATED: Add new role_vectors_* tables
├── migrations/              # Incremental migrations
│   └── 012_add_component_tables.sql
└── queries.ts               # UPDATED: Component-specific queries

app/
├── api/
│   └── vectors/
│       ├── [styleProfileId]/route.ts  # UPDATED: Return all components
│       └── nearest/
│           ├── buttons/route.ts       # Renamed from nearest-ctas
│           ├── inputs/route.ts        # NEW
│           ├── cards/route.ts         # NEW
│           └── ...
│
└── vectors/[styleProfileId]/
    ├── page.tsx             # UPDATED: Generic component tabs
    └── components/          # NEW: Component-specific renderers
        ├── ButtonDisplay.tsx
        ├── InputDisplay.tsx
        ├── CardDisplay.tsx
        └── ...
```

### 4.3 Key Changes

**Benefits:**
- ✅ **Modularity**: Each component is self-contained
- ✅ **Discoverability**: Easy to find button-related code
- ✅ **Extensibility**: Add new components without touching existing ones
- ✅ **Maintainability**: Smaller files, clearer responsibilities
- ✅ **Testing**: Can test components in isolation

**Migration notes:**
- Move `button-classifier.ts` → `pipeline/components/button/classifier.ts`
- Move `primary-cta-vec.ts` → `pipeline/components/button/vectorizer.ts`
- Extract button logic from `tokens/index.ts` → `button/extractor.ts`

---

## 5. Component Registry System

### 5.1 Registry Implementation

**File:** `pipeline/components/registry.ts`

```typescript
import type { ComponentDefinition } from './types';
import { buttonComponent } from './button';
import { inputComponent } from './input';
import { cardComponent } from './card';
import { heroComponent } from './hero';
import { navbarComponent } from './navbar';

export const COMPONENT_REGISTRY: Record<ComponentType, ComponentDefinition> = {
  button: buttonComponent,
  input: inputComponent,
  card: cardComponent,
  hero: heroComponent,
  navbar: navbarComponent,
};

// Feature flags - enable components one by one
export const ENABLED_COMPONENTS: ComponentType[] = [
  'button',   // ✅ Already implemented
  // 'input',  // 🚧 Next to implement
  // 'card',   // 🚧 Then this
  // 'hero',   // 🚧 Then this
  // 'navbar', // 🚧 Finally this
];

export function getEnabledComponents(): ComponentDefinition[] {
  return ENABLED_COMPONENTS.map(type => COMPONENT_REGISTRY[type]);
}

export function isComponentEnabled(type: ComponentType): boolean {
  return ENABLED_COMPONENTS.includes(type);
}
```

### 5.2 Component Definition Example (Button)

**File:** `pipeline/components/button/index.ts`

```typescript
import type { ComponentDefinition } from '../types';
import { extractButtons } from './extractor';
import { classifyButtons } from './classifier';
import { vectorizeButton } from './vectorizer';
import { ButtonDisplay } from '@/app/vectors/[styleProfileId]/components/ButtonDisplay';

export const buttonComponent: ComponentDefinition = {
  type: 'button',
  enabled: true,

  extractor: extractButtons,
  classifier: classifyButtons,
  vectorizer: vectorizeButton,

  storage: {
    tableName: 'role_vectors_button',
    vectorDimension: 26,
    schema: {
      vec: 'VECTOR(26)',
      tokens_json: 'JSONB',
      variant: 'TEXT',  // primary, secondary, tertiary, etc.
      ux_report: 'JSONB',
      confidence: 'REAL',
    },
  },

  display: {
    renderer: ButtonDisplay,
    tabLabel: 'Buttons',
  },
};
```

### 5.3 Unified Pipeline Integration

**File:** `pipeline/storage/index.ts` (refactored)

```typescript
import { getEnabledComponents } from '../components/registry';

export async function storeVectors(runId: string): Promise<StorageResult> {
  // ... existing setup ...

  const enabledComponents = getEnabledComponents();

  for (const component of enabledComponents) {
    console.log(`📦 Processing ${component.type} components...`);

    // 1. Extract
    const specs = component.extractor(nodes, tokens);

    // 2. Classify (if applicable)
    const classified = component.classifier
      ? component.classifier(specs)
      : { primary: specs };

    // 3. Vectorize
    const vectors = classified.primary.map(spec =>
      component.vectorizer(spec, tokens, report)
    );

    // 4. Store
    await storeComponentVectors(
      component.storage.tableName,
      styleProfileId,
      vectors,
      component.type
    );
  }

  // ... rest of function ...
}
```

---

## 6. Database Schema Design

### 6.1 Role Vectors Tables (Pattern)

Each component gets its own `role_vectors_{type}` table following this pattern:

```sql
CREATE TABLE role_vectors_{type} (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  style_profile_id UUID REFERENCES style_profiles(id) ON DELETE CASCADE,

  -- Vector (dimension varies by component)
  vec VECTOR({N}) NOT NULL,

  -- Canonical spec (flexible JSONB)
  spec_json JSONB NOT NULL,

  -- Component-specific metadata
  variant TEXT,              -- e.g., "primary" | "secondary" for buttons

  -- UX/quality metrics
  ux_report JSONB,
  confidence REAL CHECK (confidence >= 0 AND confidence <= 1),

  -- Provenance
  representative_node_id TEXT,
  cluster_id TEXT,

  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_role_vectors_{type}_profile
  ON role_vectors_{type}(style_profile_id);

CREATE INDEX idx_role_vectors_{type}_variant
  ON role_vectors_{type}(variant);
```

### 6.2 Specific Tables

#### Button (already exists, needs migration)

```sql
-- Rename role_vectors_primarycta → role_vectors_button
ALTER TABLE role_vectors_primarycta RENAME TO role_vectors_button;

-- Add new columns
ALTER TABLE role_vectors_button
  ADD COLUMN spec_json JSONB,
  ADD COLUMN variant TEXT DEFAULT 'primary',
  ADD COLUMN representative_node_id TEXT,
  ADD COLUMN cluster_id TEXT;

-- Rename tokens_json for consistency
ALTER TABLE role_vectors_button
  RENAME COLUMN tokens_json TO spec_json;
```

#### Input (new)

```sql
CREATE TABLE role_vectors_input (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  style_profile_id UUID REFERENCES style_profiles(id) ON DELETE CASCADE,

  vec VECTOR(32) NOT NULL,  -- TBD: dimension
  spec_json JSONB NOT NULL,

  variant TEXT,  -- "text" | "email" | "password" | "search" | "textarea" | "select"
  kind TEXT,     -- More granular classification

  ux_report JSONB,
  confidence REAL,
  representative_node_id TEXT,
  cluster_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

#### Card, Hero, NavBar (similar pattern)

### 6.3 Migration Strategy

**File:** `lib/db/migrations/012_add_component_tables.sql`

```sql
-- Migration: Add component tables for canonical component system
-- Phase 1: Migrate existing button table
-- Phase 2-5: Add new component tables (one per phase)

-- === PHASE 1: Button ===
-- (migration shown above)

-- === PHASE 2: Input (initially commented out) ===
-- CREATE TABLE role_vectors_input (...);

-- === PHASE 3: Card ===
-- CREATE TABLE role_vectors_card (...);

-- === PHASE 4: Hero ===
-- CREATE TABLE role_vectors_hero (...);

-- === PHASE 5: NavBar ===
-- CREATE TABLE role_vectors_navbar (...);
```

---

## 7. Backend Pipeline Architecture

### 7.1 Token Extraction (Component-Specific)

Each component implements its own `extractor.ts`:

**Example:** `pipeline/components/button/extractor.ts`

```typescript
export function extractButtons(
  nodes: ComputedStyleNode[],
  tokens: DesignTokens
): ButtonCanonical[] {
  const candidates = nodes.filter(isButtonLike);

  return candidates.map(node => ({
    type: 'button',
    variant: inferVariant(node, tokens),  // Heuristic, refined by classifier
    shape: inferShape(node),
    radius: extractRadius(node, tokens),
    elevation: extractElevation(node, tokens),
    typography: extractTypography(node, tokens),
    padding: extractPadding(node, tokens),
    palette: extractPalette(node, tokens),
    icon: detectIcons(node),
    constraints: {
      minContrastAA: calculateContrast(node) >= 4.5,
      minTapTargetPx: toTokenRef(44, 'raw'),
    },
    representativeNodeId: node.id,
    clusterId: `btn_${hash(node)}`,
  }));
}

function isButtonLike(node: ComputedStyleNode): boolean {
  return (
    node.tagName === 'button' ||
    node.tagName === 'a' ||
    node.attributes?.role === 'button' ||
    (node.tagName === 'input' && /button|submit/.test(node.attributes?.type || ''))
  );
}

function extractRadius(node: ComputedStyleNode, tokens: DesignTokens): TokenRef<number> {
  const rawRadius = parseFloat(node.styles.borderRadius) || 0;

  // Try to match to a token
  const matchingToken = tokens.shape.radius.find(r =>
    Math.abs(r.value - rawRadius) < 2  // 2px tolerance
  );

  return matchingToken
    ? { source: 'token', value: matchingToken.id }
    : { source: 'raw', value: rawRadius };
}
```

### 7.2 Classification (Component-Specific)

**Example:** `pipeline/components/button/classifier.ts` (refactored from existing)

```typescript
export async function classifyButtons(
  specs: ButtonCanonical[]
): Promise<ClassificationResult> {
  // Same LLM logic as current button-classifier.ts
  // But works with ButtonCanonical instead of raw button data

  const response = await llm.classify({
    components: specs.map(s => ({
      text: s.typography.textContent,
      backgroundColor: resolveTokenRef(s.palette.bg),
      prominence: s.constraints.prominence,
    })),
    types: ['primary', 'secondary', 'tertiary', 'ghost'],
  });

  return {
    primary: response.primary.map(idx => specs[idx]),
    secondary: response.secondary.map(idx => specs[idx]),
    tertiary: response.tertiary?.map(idx => specs[idx]) || [],
  };
}
```

### 7.3 Vectorization (Component-Specific)

**Example:** `pipeline/components/button/vectorizer.ts` (refactored from primary-cta-vec.ts)

```typescript
export function vectorizeButton(
  spec: ButtonCanonical,
  tokens: DesignTokens,
  report: StyleReport
): {
  interpretable: Float32Array;
  combined: Float32Array;
  metadata: { featureNames: string[]; nonZeroCount: number };
} {
  const interpretable: number[] = [];
  const featureNames: string[] = [];

  // === 8D Colors ===
  const bgLCH = hexToLCH(resolveTokenRef(spec.palette.bg));
  const fgLCH = hexToLCH(resolveTokenRef(spec.palette.fg));
  // ... (existing logic from primary-cta-vec.ts)

  // === 4D Typography ===
  interpretable.push(
    normalizeFeature(resolveTokenRef(spec.typography.size), 'button_font_size'),
    normalizeFeature(resolveTokenRef(spec.typography.weight), 'button_font_weight'),
    spec.typography.casingScore || 0,
    0  // reserved
  );

  // ... rest of features ...

  return {
    interpretable: Float32Array.from(interpretable),
    combined: l2Normalize(interpretable),
    metadata: { featureNames, nonZeroCount: interpretable.filter(x => x !== 0).length },
  };
}
```

### 7.4 Storage (Unified Logic)

**File:** `pipeline/storage/component-storage.ts` (new)

```typescript
export async function storeComponentVectors(
  tableName: string,
  styleProfileId: string,
  vectors: ComponentVector[],
  componentType: ComponentType
): Promise<void> {
  for (const vector of vectors) {
    await client.query(
      `INSERT INTO ${tableName} (
        style_profile_id, vec, spec_json, variant, ux_report, confidence,
        representative_node_id, cluster_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT (style_profile_id, representative_node_id)
      DO UPDATE SET
        vec = EXCLUDED.vec,
        spec_json = EXCLUDED.spec_json,
        variant = EXCLUDED.variant,
        ux_report = EXCLUDED.ux_report`,
      [
        styleProfileId,
        floatArrayToPgVector(vector.combined),
        JSON.stringify(vector.spec),
        vector.variant,
        JSON.stringify(vector.uxReport),
        vector.confidence,
        vector.spec.representativeNodeId,
        vector.spec.clusterId,
      ]
    );
  }
}
```

---

## 8. Frontend Display System

### 8.1 Generic Component Display

**File:** `app/vectors/[styleProfileId]/page.tsx` (refactored)

```typescript
'use client';

import { COMPONENT_REGISTRY, ENABLED_COMPONENTS } from '@/pipeline/components/registry';

export default function VectorPage() {
  const [activeTab, setActiveTab] = useState('overview');
  const [data, setData] = useState<VectorData | null>(null);

  const componentTabs = ENABLED_COMPONENTS.map(type => ({
    id: type,
    label: COMPONENT_REGISTRY[type].display.tabLabel,
    Component: COMPONENT_REGISTRY[type].display.renderer,
  }));

  return (
    <div>
      {/* Tab navigation */}
      <div className="flex gap-6">
        <button onClick={() => setActiveTab('overview')}>Overview</button>
        <button onClick={() => setActiveTab('similarity')}>Similarity</button>

        {componentTabs.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'overview' && <OverviewTab data={data} />}
      {activeTab === 'similarity' && <SimilarityTab data={data} />}

      {componentTabs.map(tab => (
        activeTab === tab.id && (
          <tab.Component key={tab.id} specs={data?.components[tab.id] || []} />
        )
      ))}
    </div>
  );
}
```

### 8.2 Component-Specific Renderers

**File:** `app/vectors/[styleProfileId]/components/ButtonDisplay.tsx`

```typescript
export function ButtonDisplay({ specs }: { specs: ButtonCanonical[] }) {
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Buttons</h2>

      {/* Group by variant */}
      {['primary', 'secondary', 'tertiary', 'ghost'].map(variant => {
        const variantButtons = specs.filter(s => s.variant === variant);
        if (variantButtons.length === 0) return null;

        return (
          <div key={variant} className="border rounded-lg p-6">
            <h3 className="text-lg font-semibold mb-4 capitalize">{variant} Buttons</h3>

            <div className="grid grid-cols-2 gap-4">
              {variantButtons.map((spec, i) => (
                <ButtonCard key={i} spec={spec} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ButtonCard({ spec }: { spec: ButtonCanonical }) {
  const bgColor = resolveTokenRef(spec.palette.bg);
  const fgColor = resolveTokenRef(spec.palette.fg);

  return (
    <div className="border rounded p-4">
      {/* Visual preview */}
      <div
        className="rounded p-3 text-center font-medium mb-4"
        style={{
          backgroundColor: bgColor,
          color: fgColor,
          borderRadius: `${resolveTokenRef(spec.radius)}px`,
        }}
      >
        {spec.typography.textContent || 'Button Text'}
      </div>

      {/* Metadata */}
      <dl className="text-sm space-y-1">
        <div><dt className="font-medium">Variant:</dt><dd>{spec.variant}</dd></div>
        <div><dt className="font-medium">Shape:</dt><dd>{spec.shape}</dd></div>
        <div><dt className="font-medium">Contrast:</dt><dd>{spec.constraints.minContrastAA ? 'AA ✓' : 'Fail'}</dd></div>
      </dl>

      {/* Token references */}
      <details className="mt-4">
        <summary className="cursor-pointer text-sm text-gray-600">Token References</summary>
        <pre className="text-xs mt-2 bg-gray-50 p-2 rounded overflow-auto">
          {JSON.stringify(spec, null, 2)}
        </pre>
      </details>
    </div>
  );
}
```

---

## 9. Implementation Phases

### Phase 0: Foundation (Week 1)

**Goal:** Refactor existing code to support component system

**Tasks:**
1. ✅ Create `pipeline/components/` directory structure
2. ✅ Move button logic into `pipeline/components/button/`
   - `extractor.ts` - Extract from `tokens/index.ts`
   - `classifier.ts` - Move `button-classifier.ts`
   - `vectorizer.ts` - Move `primary-cta-vec.ts`
   - `spec.ts` - Define `ButtonCanonical` type
   - `index.ts` - Component definition
3. ✅ Create component registry (`registry.ts`)
4. ✅ Refactor `storage/index.ts` to use registry
5. ✅ Migrate `role_vectors_primarycta` → `role_vectors_button`
6. ✅ Update frontend to use component registry
7. ✅ Test that existing button functionality still works

**Success criteria:**
- All tests pass
- No regression in button capture/display
- Code is more modular and extensible

---

### Phase 1: Input Component (Week 2)

**Goal:** Add second component type to validate architecture

**Spec:** `InputCanonical` (from planning doc)
- Variants: text, email, password, search, textarea, select
- Features: ~32D (colors, typography, borders, states, icons)

**Tasks:**
1. Define `InputCanonical` type in `components/input/spec.ts`
2. Implement `extractor.ts` - find input-like elements
3. Implement `classifier.ts` - classify input types (text/email/etc.)
4. Implement `vectorizer.ts` - 32D feature vector
5. Add `CREATE TABLE role_vectors_input` migration
6. Enable in registry: `ENABLED_COMPONENTS.push('input')`
7. Create `InputDisplay.tsx` frontend component
8. Add API endpoint: `app/api/vectors/nearest/inputs/route.ts`
9. Test on 5-10 sites, validate extraction quality

**Success criteria:**
- Inputs correctly extracted from test sites
- Variants properly classified (text, email, password, etc.)
- Frontend displays inputs grouped by variant
- Similarity search works

---

### Phase 2: Card Component (Week 3)

**Goal:** Test with composite component (contains text + media + actions)

**Spec:** `CardCanonical`
- Variants: default, elevated, outlined, mediaTop, mediaLeft
- Features: ~28D (layout, media, actions, etc.)

**Tasks:**
1. Define `CardCanonical` type
2. Implement extraction (detect card patterns: border + padding + content grouping)
3. Implement classification (variant detection based on elevation, media position)
4. Implement vectorization
5. Database table + migration
6. Frontend display
7. Test on e-commerce/blog sites

**Success criteria:**
- Cards detected with reasonable accuracy
- Media position correctly identified
- Card variants classified

---

### Phase 3: Hero Component (Week 4)

**Goal:** Test with complex composite (contains buttons, images, text hierarchy)

**Spec:** `HeroCanonical`
- Layouts: textLeft-mediaRight, textRight-mediaLeft, textOnly, mediaBehind
- Density: compact, comfortable, spacious
- Features: ~35D

**Tasks:**
1. Define `HeroCanonical` type
2. Implement extraction (detect hero sections - typically first major content block)
3. Implement classification (layout patterns, density)
4. Implement vectorization
5. Database table + migration
6. Frontend display (with embedded button/image rendering)
7. Test on marketing sites

**Challenges:**
- Hero detection can be ambiguous
- May need heuristics: viewport height, background image, CTA presence
- Composite nature requires linking to button components

---

### Phase 4: NavBar Component (Week 5)

**Goal:** Test with persistent UI element (always present, consistent across pages)

**Spec:** `NavBarCanonical`
- Layouts: logo-left-links-right, centered, split, logo-center
- Behaviors: sticky, transparent-on-top
- Features: ~22D

**Tasks:**
1. Define `NavBarCanonical` type
2. Implement extraction (detect `<nav>` or `role="navigation"` at top of page)
3. Implement classification (layout patterns, sticky behavior)
4. Implement vectorization
5. Database table + migration
6. Frontend display
7. Test across all captured sites

**Challenges:**
- Detecting sticky behavior (requires analyzing CSS position/z-index)
- Logo detection (image vs text)
- CTA button extraction (reference existing button component)

---

### Phase 5: Cross-Component Features (Week 6)

**Goal:** Add advanced features now that all components are captured

**Tasks:**
1. **Component composition analysis**
   - Detect which buttons appear in heroes
   - Detect which buttons appear in navbars
   - Build composition graph

2. **Variant clustering**
   - Within each component type, cluster similar variants
   - E.g., group all "rounded primary buttons" together

3. **Quality scoring**
   - Accessibility scores (contrast, tap target)
   - Design system consistency (token usage)
   - Best practices compliance

4. **Bulk similarity search**
   - "Find sites with similar button systems"
   - "Find sites with similar card layouts"

---

## 10. Testing & Validation Strategy

### 10.1 Unit Tests

Each component module should have tests:

**Example:** `pipeline/components/button/__tests__/extractor.test.ts`

```typescript
describe('button extractor', () => {
  it('should extract button elements', () => {
    const nodes = [
      { tagName: 'button', styles: { ... } },
      { tagName: 'a', styles: { ... } },
      { tagName: 'div', attributes: { role: 'button' } },
    ];

    const buttons = extractButtons(nodes, mockTokens);
    expect(buttons).toHaveLength(3);
  });

  it('should map to token references', () => {
    const button = extractButtons([mockButtonNode], mockTokens)[0];
    expect(button.radius.source).toBe('token');
    expect(button.radius.value).toBe('radius.md');
  });
});
```

### 10.2 Integration Tests

Test full pipeline for each component:

**Example:** `tests/integration/button-pipeline.test.ts`

```typescript
describe('button pipeline', () => {
  it('should extract, classify, vectorize, and store buttons', async () => {
    const runId = await captureTestSite('https://stripe.com');
    const tokens = await extractTokens(runId);
    const vectors = await buildVectors(runId);

    expect(vectors.components.button).toBeDefined();
    expect(vectors.components.button.length).toBeGreaterThan(0);

    const stored = await storeVectors(runId);
    expect(stored.componentStats.button.count).toBeGreaterThan(0);
  });
});
```

### 10.3 Validation Sites

Curated set of sites for testing each component:

| Component | Test Sites |
|-----------|-----------|
| Button | stripe.com, github.com, vercel.com |
| Input | airbnb.com, booking.com (search forms) |
| Card | pinterest.com, amazon.com (product cards) |
| Hero | apple.com, tesla.com (large hero sections) |
| NavBar | All sites (navbar is universal) |

### 10.4 Quality Metrics

Track these metrics for each component:

- **Extraction recall**: % of actual components detected
- **Extraction precision**: % of detected components that are correct
- **Classification accuracy**: % correctly classified variants
- **Token mapping rate**: % of values successfully mapped to tokens
- **Vector quality**: Cosine similarity for known duplicates should be >0.9

---

## 11. Migration Path

### 11.1 Backward Compatibility

**Database:**
- Keep `role_vectors_primarycta` table until migration complete
- Create view for backward compatibility:

```sql
CREATE VIEW role_vectors_primarycta AS
SELECT * FROM role_vectors_button WHERE variant = 'primary';
```

**API:**
- Keep `/api/vectors/nearest-ctas` endpoint
- Proxy to new `/api/vectors/nearest/buttons?variant=primary`

### 11.2 Migration Checklist

**Phase 0 (Foundation):**
- [ ] Create component directory structure
- [ ] Refactor button code into component module
- [ ] Create component registry
- [ ] Update storage pipeline
- [ ] Migrate database table
- [ ] Update frontend
- [ ] Run full test suite
- [ ] Deploy to staging
- [ ] Validate on production snapshot

**For each new component (Phases 1-4):**
- [ ] Define spec types
- [ ] Implement extractor
- [ ] Implement classifier
- [ ] Implement vectorizer
- [ ] Write unit tests
- [ ] Create database table
- [ ] Update storage pipeline
- [ ] Create frontend display
- [ ] Create API endpoint
- [ ] Write integration tests
- [ ] Test on validation sites
- [ ] Enable in registry
- [ ] Deploy to staging
- [ ] Monitor quality metrics
- [ ] Deploy to production

---

## 12. Open Questions & Decisions Needed

### 12.1 Architecture Decisions

1. **Token resolution strategy**:
   - Should we pre-resolve all `TokenRef` values before storage?
   - Or store token IDs and resolve at render time?
   - **Recommendation:** Store both - token ID + resolved value for flexibility

2. **Component nesting**:
   - How do we handle buttons inside heroes?
   - Store references? Duplicate data?
   - **Recommendation:** Store composition graph separately

3. **Variant vs Type**:
   - Is "ghost button" a variant or a type?
   - **Recommendation:** Variant (type=button, variant=ghost)

### 12.2 Feature Vector Decisions

1. **Dimensionality**:
   - Fixed dimension per component? Or variable?
   - **Recommendation:** Fixed per component type, reserve dimensions for future

2. **CLIP embeddings**:
   - Planning doc mentions visual embeddings
   - Do we want to add CLIP for visual similarity?
   - **Recommendation:** Phase 6 - after all components implemented

3. **Normalization**:
   - Global normalization across all sites?
   - Per-site normalization?
   - **Recommendation:** Per-feature normalization strategies (defined in `normalization.ts`)

### 12.3 Validation Questions

1. **Component detection accuracy**:
   - What's acceptable precision/recall?
   - **Recommendation:** >80% precision, >70% recall for Phase 1

2. **Classification confidence threshold**:
   - When to fallback to heuristics?
   - **Recommendation:** LLM confidence <0.5 triggers fallback

---

## 13. Success Criteria

### 13.1 Technical Metrics

- ✅ All 5 component types extracting with >80% precision
- ✅ Token mapping rate >60% (increasing over time)
- ✅ Vector similarity for known duplicates >0.9
- ✅ Pipeline runtime <2 minutes per site (all components)
- ✅ Database size manageable (<1GB for 1000 sites)
- ✅ Frontend responsive (<2s load time for component tabs)

### 13.2 Developer Experience

- ✅ Adding new component takes <1 week
- ✅ Component modules are <500 lines each
- ✅ Clear separation of concerns
- ✅ Good test coverage (>70%)
- ✅ Documentation for each component

### 13.3 User Experience

- ✅ Component tabs load smoothly
- ✅ Visual previews match source sites
- ✅ Token references visible and helpful
- ✅ Similarity search returns relevant results
- ✅ Clear variant labeling

---

## 14. Next Steps

**Immediate (this week):**
1. Review this document with team
2. Get approval on architecture
3. Start Phase 0 implementation

**Short-term (next 2 weeks):**
1. Complete Phase 0 refactoring
2. Begin Phase 1 (Input component)

**Medium-term (next 6 weeks):**
1. Complete Phases 1-4 (all component types)
2. Launch to production with 5 component types

**Long-term (Q1 2026):**
1. Phase 5: Cross-component features
2. Phase 6: Advanced features (CLIP, clustering, etc.)
3. Scale to 10,000+ sites

---

**End of Technical Planning Document**
