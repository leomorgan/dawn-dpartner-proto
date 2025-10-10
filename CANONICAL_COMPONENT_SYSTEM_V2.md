# Canonical Component System - Technical Implementation Guide

**Status:** Draft v2.0
**Date:** 2025-10-10
**Objective:** Evolve from single-component capture (primaryCTA) to a structured, extensible canonical component system

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Current Architecture Analysis](#2-current-architecture-analysis)
3. [Target Architecture](#3-target-architecture)
4. [Component Specifications](#4-component-specifications)
5. [Repository Reorganization](#5-repository-reorganization)
6. [Component Registry System](#6-component-registry-system)
7. [Database Schema Design](#7-database-schema-design)
8. [Backend Pipeline Architecture](#8-backend-pipeline-architecture)
9. [Frontend Display System](#9-frontend-display-system)
10. [Detailed Implementation Plan](#10-detailed-implementation-plan)
11. [Testing & Validation Strategy](#11-testing--validation-strategy)
12. [Migration Path & Rollback](#12-migration-path--rollback)
13. [Performance & Monitoring](#13-performance--monitoring)
14. [Risk Assessment & Mitigation](#14-risk-assessment--mitigation)
15. [Open Questions & Decisions](#15-open-questions--decisions)
16. [Success Criteria](#16-success-criteria)

---

## 1. Executive Summary

### 1.1 Core Architecture Principle

**IMPORTANT: One Capture, Multiple Component Extractions**

The system follows a **capture-once, analyze-many** approach:

1. **CAPTURE PHASE** (once per site)
   - Playwright browser automation captures DOM + computed styles
   - Output: `artifacts/<runId>/computed-nodes.json` + `artifacts/<runId>/screenshot.png`
   - This is the **single source of truth** for all component analysis

2. **ANALYSIS PHASE** (multiple component extractors)
   - **All component extractors** read from the **same captured artifacts**
   - Each extractor (button, input, card, hero, navbar) analyzes the `ComputedStyleNode[]` independently
   - No need to re-capture the site for each component type
   - Enables efficient parallel processing and incremental rollout

**Example Flow:**
```
1. Capture stripe.com → artifacts/run_abc123/computed-nodes.json
2. Extract buttons from computed-nodes.json → ButtonCanonical[]
3. Extract inputs from computed-nodes.json → InputCanonical[]
4. Extract cards from computed-nodes.json → CardCanonical[]
   ... (all from the same capture)
```

This architecture ensures:
- ✅ **Performance**: Capture once, not 5 times
- ✅ **Consistency**: All components see the same DOM state
- ✅ **Extensibility**: Add new component types without re-capturing
- ✅ **Efficiency**: Can process components in parallel

### 1.2 Current State
- ✅ Single component type: **PrimaryCTA** (buttons)
- ✅ 26D interpretable vector with color, typography, shape, interaction, UX features
- ✅ LLM-based classification (primary vs secondary)
- ✅ Dedicated `role_vectors_primarycta` table
- ✅ Working similarity search and frontend display
- ✅ ~210 lines of vector building code
- ✅ Token extraction embedded in 2000+ line monolithic file

### 1.3 Target State
- 🎯 **5 canonical component types**: Button (Primary CTA, Secondary CTA), Input, Card, Hero, NavBar
- 🎯 **First implementation**: Primary CTA Button + Secondary CTA Button as separate canonical types
- 🎯 Plugin-style architecture - components can be enabled/disabled independently
- 🎯 Shared extraction patterns + component-specific logic
- 🎯 Unified frontend framework with component-specific renderers
- 🎯 Token-first approach with fallback to raw values
- 🎯 One-by-one activation strategy for incremental rollout
- 🎯 <500 lines per component module
- 🎯 >70% test coverage per component

### 1.4 Design Principles
1. **Capture-once, analyze-many**: Single capture supports all component extractions
2. **Token-first**: Reference design tokens wherever possible (`source: "token"`)
3. **Incremental**: Build skeleton → enable components one-by-one
4. **Consistent patterns**: Reuse extraction/vectorization/storage logic
5. **Extensible**: Easy to add new component types (target: <1 week per new component)
6. **Pragmatic**: Start simple, add complexity as needed
7. **Observable**: Instrument everything for debugging and monitoring
8. **Safe**: Clean slate migrations, fast iteration

### 1.5 Alignment with Project Vision

This refactor directly supports the **Dawn** mission of making design computable:

- **Capturing design knowledge**: Each canonical component encodes specific design patterns
- **Encoding as vectors**: Feature vectors enable similarity search and style matching
- **Synthesis**: Component library becomes the foundation for generating new designs
- **Brand consistency**: Token-first approach preserves brand style across generations

---

## 2. Current Architecture Analysis

### 2.1 PrimaryCTA Flow (Current)

```
1. CAPTURE (pipeline/capture) - ONCE PER SITE
   └─> DOM + computed styles → ComputedStyleNode[]
   └─> Time: ~5-10s per page
   └─> Output: artifacts/<runId>/computed-nodes.json
   └─> ⚠️  This artifact is reused for ALL component extractions

2. TOKEN EXTRACTION (pipeline/tokens/index.ts)
   ├─> Reads: artifacts/<runId>/computed-nodes.json
   ├─> analyzeButtonVariant() → extract button properties
   ├─> classifyButtonsWithLLM() → semantic classification
   └─> DesignTokens.buttons.variants[]
   └─> Time: ~2-5s (includes LLM call)
   └─> Output: artifacts/<runId>/tokens.json

3. VECTOR BUILDING (pipeline/vectors/primary-cta-vec.ts)
   ├─> Reads: artifacts/<runId>/computed-nodes.json + tokens.json
   ├─> buildPrimaryCtaVec()
   ├─> 26D: 8D colors + 4D typography + 6D shape + 4D interaction + 4D UX
   └─> L2-normalized Float32Array
   └─> Time: ~100-200ms
   └─> Output: In-memory vectors

4. STORAGE (pipeline/storage/index.ts)
   ├─> storeVectors()
   ├─> INSERT INTO role_vectors_primarycta
   └─> tokens_json (JSONB), vec (VECTOR(26)), ux_report (JSONB)
   └─> Time: ~500ms-1s (per site)
   └─> Output: PostgreSQL rows

5. API (app/api/vectors/nearest-ctas/route.ts)
   └─> Cosine similarity search
   └─> Time: ~50-200ms per query
   └─> Output: JSON response

6. FRONTEND (app/vectors/[styleProfileId]/page.tsx)
   └─> Display in "CTA" tab
   └─> Time: ~100-300ms render
   └─> Output: React components

KEY INSIGHT: Steps 2-4 can be run multiple times on the same captured artifacts
            without re-running step 1 (capture).
```

### 2.2 Key Files & Responsibilities

| File | Responsibility | Lines of Code | Complexity |
|------|----------------|---------------|------------|
| `pipeline/tokens/index.ts` | Button extraction | ~2000 (100 button) | High (monolithic) |
| `pipeline/tokens/button-classifier.ts` | LLM classification | ~163 | Medium |
| `pipeline/vectors/primary-cta-vec.ts` | Vector building | ~210 | Medium |
| `pipeline/storage/index.ts` | DB writes | ~400 (50 CTA) | Medium |
| `lib/db/schema.sql` | Table definition | ~20 | Low |
| `app/api/vectors/nearest-ctas/route.ts` | API endpoint | ~100 | Low |
| `app/vectors/[styleProfileId]/page.tsx` | Frontend display | ~300 | Medium |

**Total: ~3,293 lines** for single component type

### 2.3 Patterns to Extract & Reuse

**✅ Good patterns (reusable):**
- LLM-based semantic classification with fallback heuristics
- Token reference structure (`{ source, value, fallback }`)
- Interpretable feature vectors with named dimensions
- L2 normalization for cosine similarity
- `role_vectors_{type}` table naming convention
- JSONB storage for flexible metadata
- Artifact-based debugging (save intermediate outputs)
- Color space transformations (sRGB → LCH)
- WCAG contrast checking

**⚠️ Patterns to improve:**
- Button extraction is embedded in monolithic `analyzeStyles()` function
- No abstraction for component types
- Hard to add new components without modifying core files
- Frontend display is component-specific, not generalized
- No instrumentation for performance tracking
- Error handling is inconsistent
- No retry logic for LLM calls
- Test coverage is sparse

---

## 3. Target Architecture

### 3.1 High-Level Design

```
┌─────────────────────────────────────────────────────────────┐
│                    CAPTURE (ONCE)                            │
│  Playwright → ComputedStyleNode[] + screenshot               │
│  Output: artifacts/<runId>/computed-nodes.json               │
│  Time: ~5-10s per site                                       │
└─────────────────────────────────────────────────────────────┘
                              ↓
                   (All components read from same artifacts)
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                    COMPONENT REGISTRY                        │
│  - Enabled components: [Button, Input, Card, Hero, NavBar]  │
│  - Each component: extractor → classifier → vectorizer      │
│  - Feature flags for incremental rollout                     │
│  - All read from same captured artifacts                     │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                   UNIFIED PIPELINE                           │
│  1. ✅ CAPTURE (once per site)              ~5-10s           │
│  2. TOKEN EXTRACTION (reads artifacts)      ~2-5s            │
│                                                               │
│  For each enabled component (can run in parallel):           │
│  3. EXTRACTION (reads artifacts)            ~200-600ms       │
│  4. CLASSIFICATION (LLM or heuristic)       ~1-3s per type   │
│  5. VECTORIZATION (feature engineering)     ~100-500ms       │
│  6. STORAGE (database write)                ~500ms-1s        │
│                                                               │
│  Total target: <20s for all 5 components                     │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                      DATABASE                                │
│  - role_vectors_button (26D)            ~100KB per site      │
│  - role_vectors_input (32D)             ~120KB per site      │
│  - role_vectors_card (28D)              ~110KB per site      │
│  - role_vectors_hero (35D)              ~130KB per site      │
│  - role_vectors_navbar (22D)            ~90KB per site       │
│  Total: ~550KB per site × 1000 sites = ~550MB                │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                   FRONTEND FRAMEWORK                         │
│  - ComponentDisplay registry                                 │
│  - Generic similarity search UI                              │
│  - Component-specific renderers                              │
│  - Real-time preview generation                              │
└─────────────────────────────────────────────────────────────┘

KEY ADVANTAGES:
✅ Capture once, analyze many times
✅ Can process components in parallel
✅ Can enable/disable components without re-capture
✅ Can add new component types retroactively
```

### 3.2 Core Abstractions

#### ComponentDefinition Interface

```typescript
/**
 * Defines a canonical component type with its extraction, classification,
 * vectorization, storage, and display logic.
 */
interface ComponentDefinition<TSpec extends BaseCanonicalSpec = BaseCanonicalSpec> {
  // Identity
  type: ComponentType;  // "button" | "input" | "card" | "hero" | "navbar"
  enabled: boolean;
  version: string;      // Semantic versioning for backward compatibility

  // Extraction: DOM → CanonicalSpec
  extractor: ComponentExtractor<TSpec>;

  // Classification: CanonicalSpec[] → variants (optional)
  classifier?: ComponentClassifier<TSpec>;

  // Vectorization: CanonicalSpec → FeatureVector
  vectorizer: ComponentVectorizer<TSpec>;

  // Storage: table name + column schema
  storage: ComponentStorageConfig;

  // Frontend: display component
  display: ComponentDisplayConfig<TSpec>;

  // Metadata for debugging and monitoring
  metadata: {
    featureDimensions: number;
    averageExtractionsPerPage: number;
    estimatedProcessingTimeMs: number;
  };
}

/**
 * Extracts component instances from captured DOM nodes
 */
type ComponentExtractor<TSpec> = (
  nodes: ComputedStyleNode[],
  tokens: DesignTokens,
  context: ExtractionContext
) => ExtractionResult<TSpec>;

/**
 * Classifies component specs into semantic variants
 */
type ComponentClassifier<TSpec> = (
  specs: TSpec[],
  context: ClassificationContext
) => Promise<ClassificationResult<TSpec>>;

/**
 * Converts canonical spec to feature vector
 */
type ComponentVectorizer<TSpec> = (
  spec: TSpec,
  tokens: DesignTokens,
  report: StyleReport,
  context: VectorizationContext
) => VectorizationResult;

/**
 * Storage configuration for database persistence
 */
interface ComponentStorageConfig {
  tableName: string;        // "role_vectors_button"
  vectorDimension: number;  // 26, 32, etc.
  schema: TableSchema;
  indexes: IndexDefinition[];
  constraints: ConstraintDefinition[];
}

/**
 * Display configuration for frontend rendering
 */
interface ComponentDisplayConfig<TSpec> {
  renderer: React.ComponentType<ComponentDisplayProps<TSpec>>;
  tabLabel: string;
  icon?: React.ComponentType;
  sortOrder: number;        // Tab display order
}

// Supporting types

interface ExtractionContext {
  runId: string;
  url: string;
  viewport: { width: number; height: number };
  timestamp: Date;
}

interface ExtractionResult<TSpec> {
  specs: TSpec[];
  metadata: {
    candidatesFound: number;
    candidatesFiltered: number;
    extractionTimeMs: number;
    warnings: string[];
  };
}

interface ClassificationContext {
  llmProvider: 'openai' | 'anthropic';
  confidenceThreshold: number;
  fallbackToHeuristics: boolean;
}

interface ClassificationResult<TSpec> {
  variants: Record<string, TSpec[]>;
  metadata: {
    classificationTimeMs: number;
    llmCalls: number;
    confidenceScores: Record<string, number>;
    fallbackUsed: boolean;
  };
}

interface VectorizationContext {
  normalizationBounds: NormalizationBounds;
  featureFlags: Record<string, boolean>;
}

interface VectorizationResult {
  interpretable: Float32Array;
  combined: Float32Array;
  metadata: {
    featureNames: string[];
    nonZeroCount: number;
    normalizationApplied: boolean;
    vectorizationTimeMs: number;
  };
}
```

#### TokenRef (Token Reference System)

```typescript
/**
 * References a design token or raw value with fallback
 */
type TokenRef<T = string | number> = {
  source: 'token' | 'computed' | 'raw';
  value: T;
  tokenId?: string;      // ID in design token system
  fallback?: T;          // Fallback if token not found
  confidence?: number;   // Match confidence (0-1)
};

/**
 * Helper to create token references
 */
function toTokenRef<T>(
  value: T,
  source: TokenRef<T>['source'],
  tokenId?: string,
  confidence?: number
): TokenRef<T> {
  return {
    source,
    value,
    ...(tokenId && { tokenId }),
    ...(confidence && { confidence }),
  };
}

/**
 * Resolve token reference to concrete value
 */
function resolveTokenRef<T>(
  ref: TokenRef<T>,
  tokens?: DesignTokens
): T {
  if (ref.source === 'token' && ref.tokenId && tokens) {
    const resolved = tokens.findById(ref.tokenId);
    if (resolved) return resolved.value as T;
  }
  return ref.fallback ?? ref.value;
}

/**
 * Try to match raw value to design token
 */
function matchToToken<T>(
  rawValue: T,
  tokenSet: DesignToken<T>[],
  tolerance: number = 0
): TokenRef<T> {
  for (const token of tokenSet) {
    if (typeof rawValue === 'number' && typeof token.value === 'number') {
      if (Math.abs(rawValue - token.value) <= tolerance) {
        return toTokenRef(token.value, 'token', token.id, 1.0);
      }
    } else if (rawValue === token.value) {
      return toTokenRef(token.value, 'token', token.id, 1.0);
    }
  }
  return toTokenRef(rawValue, 'raw');
}
```

#### Base CanonicalSpec (Shared Fields)

```typescript
/**
 * Base interface for all canonical component specs
 */
interface BaseCanonicalSpec {
  // Identity
  type: ComponentType;
  representativeNodeId: string;
  clusterId: string;
  version: string;

  // Provenance
  sourceUrl: string;
  captureTimestamp: Date;

  // Core styling (present on most components)
  radius?: TokenRef<number>;
  elevation?: TokenRef<string>;

  palette: {
    bg: TokenRef<string>;
    fg: TokenRef<string>;
    border?: TokenRef<string>;
    accent?: TokenRef<string>;
  };

  // Typography (when text is present)
  typography?: {
    family: TokenRef<string>;
    weight: TokenRef<number>;
    size: TokenRef<number>;
    lineHeight: TokenRef<number | string>;
    letterSpacing?: TokenRef<number>;
    textContent?: string;
    textTransform?: 'uppercase' | 'lowercase' | 'capitalize' | 'none';
  };

  // Spacing
  padding?: {
    x: TokenRef<number>;
    y: TokenRef<number>
  };
  margin?: {
    x: TokenRef<number>;
    y: TokenRef<number>
  };
  gap?: TokenRef<number>;

  // Dimensions
  dimensions?: {
    width: TokenRef<number | string>;
    height: TokenRef<number | string>;
    minWidth?: TokenRef<number>;
    minHeight?: TokenRef<number>;
    aspectRatio?: number;
  };

  // Metadata
  metadata?: {
    confidence: number;          // Overall extraction confidence
    warnings: string[];          // Extraction warnings
    features: Record<string, any>; // Component-specific features
  };
}
```

---

## 4. Component Specifications

### 4.1 Button Components (Primary & Secondary CTA)

**IMPORTANT**: Primary CTA and Secondary CTA are implemented as **separate canonical component types**, not just variants.

This design decision is intentional because:
- ✅ Primary and Secondary CTAs have **different semantic roles** in a design system
- ✅ They are **independently searchable** (search for "primary CTAs like Stripe")
- ✅ They have **different UX constraints** (primary must pass AAA contrast, secondary AA)
- ✅ Enables **role-specific similarity search** and retrieval

#### 4.1.1 Primary CTA Button

```typescript
interface PrimaryCtaButtonCanonical extends BaseCanonicalSpec {
  type: 'primary-cta-button';

  // Shape characteristics
  shape: 'rectangle' | 'rounded' | 'pill' | 'circle' | 'square';

  // Icon presence
  icon?: {
    position: 'left' | 'right' | 'only';
    size: TokenRef<number>;
    name?: string;
  };

  // Interaction states
  states?: {
    hover?: Partial<ButtonCanonical['palette']>;
    active?: Partial<ButtonCanonical['palette']>;
    disabled?: Partial<ButtonCanonical['palette']>;
    focus?: {
      outlineColor?: TokenRef<string>;
      outlineWidth?: TokenRef<number>;
      outlineOffset?: TokenRef<number>;
    };
  };

  // Constraints & accessibility (PRIMARY CTA SPECIFIC)
  constraints: {
    minContrastAAA: boolean;       // PRIMARY CTAs MUST pass AAA contrast (7:1) - higher standard
    minTapTargetPx: TokenRef<number>;  // Minimum 44px
    hasAccessibleLabel: boolean;
    prominence: number;            // Visual weight (0-1) - should be highest on page
  };

  // Features for vectorization
  features: {
    borderWidth: TokenRef<number>;
    hasOutline: boolean;
    hasShadow: boolean;            // Primary CTAs often have shadows
    shadowIntensity?: number;
    textCasing: 'upper' | 'lower' | 'title' | 'sentence';
    casingScore: number;           // 0=lowercase, 1=uppercase
    isHighestProminence: boolean;  // Should be most prominent CTA on page
  };
}

// Vector dimensions: 26D
// - 8D colors (bg/fg LCH)
// - 4D typography (size, weight, casing, reserved)
// - 6D shape (radius, aspect ratio, padding x/y, border, reserved)
// - 4D interaction (shadow, outline, hover, reserved)
// - 4D UX (contrast AAA, tap target, prominence, highest prominence flag)
```

#### 4.1.2 Secondary CTA Button

```typescript
interface SecondaryCtaButtonCanonical extends BaseCanonicalSpec {
  type: 'secondary-cta-button';

  // Shape characteristics
  shape: 'rectangle' | 'rounded' | 'pill' | 'circle' | 'square';

  // Icon presence
  icon?: {
    position: 'left' | 'right' | 'only';
    size: TokenRef<number>;
    name?: string;
  };

  // Interaction states
  states?: {
    hover?: Partial<SecondaryCtaButtonCanonical['palette']>;
    active?: Partial<SecondaryCtaButtonCanonical['palette']>;
    disabled?: Partial<SecondaryCtaButtonCanonical['palette']>;
    focus?: {
      outlineColor?: TokenRef<string>;
      outlineWidth?: TokenRef<number>;
      outlineOffset?: TokenRef<number>;
    };
  };

  // Constraints & accessibility (SECONDARY CTA SPECIFIC)
  constraints: {
    minContrastAA: boolean;        // Secondary CTAs must pass AA contrast (4.5:1) - lower standard
    minTapTargetPx: TokenRef<number>;  // Minimum 44px
    hasAccessibleLabel: boolean;
    prominence: number;            // Visual weight (0-1) - should be lower than primary
  };

  // Features for vectorization
  features: {
    borderWidth: TokenRef<number>;
    hasOutline: boolean;           // Secondary CTAs often outlined
    hasShadow: boolean;
    shadowIntensity?: number;
    textCasing: 'upper' | 'lower' | 'title' | 'sentence';
    casingScore: number;
    isSubordinateToPrimary: boolean;  // Should be visually subordinate to primary CTA
  };
}

// Vector dimensions: 26D (same as primary for consistency)
// - 8D colors (bg/fg LCH)
// - 4D typography (size, weight, casing, reserved)
// - 6D shape (radius, aspect ratio, padding x/y, border, reserved)
// - 4D interaction (shadow, outline, hover, reserved)
// - 4D UX (contrast AA, tap target, prominence, subordinate flag)
```

**Key Differences Between Primary and Secondary CTA:**

| Aspect | Primary CTA | Secondary CTA |
|--------|-------------|---------------|
| **Semantic Role** | Main conversion action | Alternative action |
| **Contrast** | Must pass AAA (7:1) | Must pass AA (4.5:1) |
| **Prominence** | Highest on page | Subordinate to primary |
| **Visual Treatment** | Usually solid fill, shadow | Usually outline, ghost, or subtle fill |
| **Database Table** | `role_vectors_primary_cta_button` | `role_vectors_secondary_cta_button` |
| **Component Type** | `'primary-cta-button'` | `'secondary-cta-button'` |
| **Typical Count per Page** | 1-3 | 2-5 |

**Implementation Priority:**
1. **Phase 0**: Refactor existing button code → Primary CTA Button
2. **Phase 1**: Add Secondary CTA Button (validates architecture)
3. **Phase 2**: Add Input component
4. **Phase 3**: Add Card component
5. **Phase 4**: Add Hero component
6. **Phase 5**: Add NavBar component
```

### 4.2 Input Component (Phase 2)

```typescript
interface InputCanonical extends BaseCanonicalSpec {
  type: 'input';

  // Variant classification
  variant: 'text' | 'email' | 'password' | 'search' | 'tel' | 'url' | 'number' | 'date' | 'time' | 'textarea' | 'select';

  // Visual style
  style: 'outlined' | 'filled' | 'underlined' | 'borderless';

  // Size variants
  size: 'small' | 'medium' | 'large';

  // Label & placeholder
  label?: {
    text: string;
    position: 'top' | 'left' | 'floating' | 'inline';
    typography: BaseCanonicalSpec['typography'];
  };

  placeholder?: {
    text: string;
    color: TokenRef<string>;
  };

  // Icons & adornments
  adornments?: {
    start?: {
      type: 'icon' | 'text';
      content: string;
      color: TokenRef<string>;
    };
    end?: {
      type: 'icon' | 'text';
      content: string;
      color: TokenRef<string>;
    };
  };

  // State styles
  states: {
    default: {
      palette: BaseCanonicalSpec['palette'];
      borderWidth: TokenRef<number>;
    };
    focus: {
      palette: BaseCanonicalSpec['palette'];
      borderWidth: TokenRef<number>;
      outlineColor?: TokenRef<string>;
      outlineWidth?: TokenRef<number>;
    };
    error?: {
      palette: BaseCanonicalSpec['palette'];
      borderWidth: TokenRef<number>;
      message?: string;
    };
    disabled?: {
      palette: BaseCanonicalSpec['palette'];
      opacity: number;
    };
  };

  // Constraints & accessibility
  constraints: {
    minContrastAA: boolean;
    hasAccessibleLabel: boolean;
    autoCompleteType?: string;
    required: boolean;
    minHeight: TokenRef<number>;  // Minimum 44px touch target
  };

  // Features for vectorization
  features: {
    hasLabel: boolean;
    hasPlaceholder: boolean;
    hasStartAdornment: boolean;
    hasEndAdornment: boolean;
    isMultiline: boolean;
    characterCount?: number;
  };
}

// Vector dimensions: 32D
// - 12D colors (bg/fg/border default + focus + error LCH)
// - 4D typography (size, weight, line height, letter spacing)
// - 8D shape (radius, border width default/focus, padding x/y, height, aspect)
// - 4D adornments (has label, placeholder, start/end icons)
// - 4D UX (contrast, accessible label, required, reserved)
```

### 4.3 Card Component (Phase 3)

```typescript
interface CardCanonical extends BaseCanonicalSpec {
  type: 'card';

  // Variant classification
  variant: 'default' | 'elevated' | 'outlined' | 'filled';

  // Layout patterns
  layout: 'vertical' | 'horizontal' | 'grid';

  // Media configuration
  media?: {
    type: 'image' | 'video' | 'illustration' | 'icon';
    position: 'top' | 'left' | 'right' | 'background';
    aspectRatio: number;
    dimensions: {
      width: TokenRef<number | string>;
      height: TokenRef<number | string>;
    };
    objectFit: 'cover' | 'contain' | 'fill';
  };

  // Content sections
  content: {
    header?: {
      title: string;
      subtitle?: string;
      typography: BaseCanonicalSpec['typography'];
    };
    body?: {
      text: string;
      maxLines?: number;  // Clamping
      typography: BaseCanonicalSpec['typography'];
    };
    footer?: {
      elements: Array<'button' | 'link' | 'metadata' | 'tags'>;
    };
  };

  // Interaction
  clickable: boolean;
  hoverEffect?: 'lift' | 'highlight' | 'scale' | 'none';

  // Constraints
  constraints: {
    minContrastAA: boolean;
    aspectRatioMaintained: boolean;
    imageLoaded: boolean;
  };

  // Features for vectorization
  features: {
    hasMedia: boolean;
    mediaPosition: number;        // Encoded position
    hasHeader: boolean;
    hasBody: boolean;
    hasFooter: boolean;
    contentDensity: number;       // 0-1 (sparse to dense)
    hierarchyDepth: number;       // Number of nested levels
  };
}

// Vector dimensions: 28D
// - 8D colors (bg/fg/border/accent LCH)
// - 4D typography (title size/weight, body size/weight)
// - 8D layout (aspect ratio, padding, gap, media position, content density)
// - 4D elevation (shadow depth, border width, z-index, reserved)
// - 4D content (has media, header, body, footer)
```

### 4.4 Hero Component (Phase 4)

```typescript
interface HeroCanonical extends BaseCanonicalSpec {
  type: 'hero';

  // Layout patterns
  layout: 'text-left-media-right' | 'text-right-media-left' | 'text-center' | 'media-background' | 'full-bleed';

  // Density/spacing
  density: 'compact' | 'comfortable' | 'spacious';

  // Content hierarchy
  content: {
    headline: {
      text: string;
      typography: BaseCanonicalSpec['typography'];
      level: 1 | 2;  // h1 or h2
    };
    subheadline?: {
      text: string;
      typography: BaseCanonicalSpec['typography'];
    };
    body?: {
      text: string;
      typography: BaseCanonicalSpec['typography'];
      maxLines?: number;
    };
    cta?: {
      buttons: Array<{
        text: string;
        variant: ButtonCanonical['variant'];
        componentId: string;  // Reference to button component
      }>;
      arrangement: 'horizontal' | 'vertical' | 'stacked';
    };
  };

  // Media configuration
  media?: {
    type: 'image' | 'video' | 'animation';
    position: 'left' | 'right' | 'background' | 'top' | 'bottom';
    treatment: 'full-width' | 'contained' | 'overflow' | 'floating';
    dimensions: {
      width: TokenRef<number | string>;
      height: TokenRef<number | string>;
    };
    overlay?: {
      color: TokenRef<string>;
      opacity: number;
    };
  };

  // Layout metrics
  layout: {
    viewport Height: number;      // % of viewport height
    columnRatio?: number;         // Text:media ratio (e.g., 60:40)
    alignment: 'start' | 'center' | 'end';
  };

  // Constraints
  constraints: {
    minContrastAA: boolean;
    headlineContrastAAA: boolean;  // Higher standard for headlines
    responsiveBreakpoints: number;  // How many breakpoints defined
    mediaLoaded: boolean;
  };

  // Features for vectorization
  features: {
    hasMedia: boolean;
    mediaPosition: number;         // Encoded position
    hasSubheadline: boolean;
    hasBody: boolean;
    ctaCount: number;
    textAlignment: number;         // Encoded alignment
    verticalAlignment: number;     // Encoded v-align
    backgroundTreatment: number;   // Encoded treatment
  };
}

// Vector dimensions: 35D
// - 12D colors (bg/fg/headline/subheadline/overlay LCH)
// - 6D typography (headline size/weight, subheadline size/weight, body size/weight)
// - 8D layout (viewport %, column ratio, alignment, density, reserved)
// - 5D media (has media, position, treatment, aspect ratio, reserved)
// - 4D UX (contrast, CTA count, hierarchy depth, reserved)
```

### 4.5 NavBar Component (Phase 5)

```typescript
interface NavBarCanonical extends BaseCanonicalSpec {
  type: 'navbar';

  // Layout patterns
  layout: 'logo-left-links-right' | 'centered' | 'split' | 'logo-center';

  // Behavior
  behavior: {
    sticky: boolean;
    transparent: boolean;
    transparentOnTop: boolean;  // Transparent until scroll
    collapsible: boolean;        // Mobile hamburger menu
  };

  // Logo
  logo?: {
    type: 'image' | 'text' | 'svg';
    position: 'left' | 'center' | 'right';
    dimensions: {
      width: TokenRef<number>;
      height: TokenRef<number>;
    };
  };

  // Navigation links
  links: {
    count: number;
    arrangement: 'horizontal' | 'vertical' | 'mega-menu';
    items: Array<{
      text: string;
      level: 'primary' | 'secondary' | 'tertiary';
      hasDropdown: boolean;
    }>;
    typography: BaseCanonicalSpec['typography'];
    activeIndicator?: {
      type: 'underline' | 'background' | 'pill' | 'none';
      color: TokenRef<string>;
    };
  };

  // CTA buttons
  cta?: Array<{
    text: string;
    variant: ButtonCanonical['variant'];
    componentId: string;  // Reference to button component
  }>;

  // Visual style
  backdrop: {
    blur: boolean;
    blurAmount?: TokenRef<number>;
    opacity: number;
    hasBorder: boolean;
    borderPosition: 'bottom' | 'top' | 'both' | 'none';
  };

  // Constraints
  constraints: {
    minContrastAA: boolean;
    minHeightPx: TokenRef<number>;  // Minimum 56px
    stickyImplemented: boolean;
    mobileOptimized: boolean;
  };

  // Features for vectorization
  features: {
    hasLogo: boolean;
    logoPosition: number;          // Encoded position
    linkCount: number;
    hasMegaMenu: boolean;
    hasBackdropBlur: boolean;
    isSticky: boolean;
    isTransparent: boolean;
    ctaCount: number;
  };
}

// Vector dimensions: 22D
// - 8D colors (bg/fg/link/active LCH)
// - 4D typography (link size/weight, logo size/weight)
// - 4D layout (height, logo position, link arrangement, reserved)
// - 3D behavior (sticky, transparent, blur)
// - 3D content (link count, CTA count, has mega menu)
```

---

## 5. Repository Reorganization

### 5.1 Current Structure (Simplified)

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

### 5.2 Target Structure (Proposed)

```
pipeline/
├── components/                    # NEW: Component definitions
│   ├── registry.ts                # Component registry + enable/disable
│   ├── types.ts                   # Shared interfaces
│   ├── utils.ts                   # Shared utilities
│   │
│   ├── button/                    # Button component
│   │   ├── index.ts               # Component definition (exports buttonComponent)
│   │   ├── extractor.ts           # DOM → ButtonCanonical (~200 lines)
│   │   ├── classifier.ts          # LLM classification (~163 lines)
│   │   ├── vectorizer.ts          # ButtonCanonical → 26D vector (~210 lines)
│   │   ├── spec.ts                # TypeScript types for ButtonCanonical
│   │   ├── __tests__/
│   │   │   ├── extractor.test.ts
│   │   │   ├── classifier.test.ts
│   │   │   └── vectorizer.test.ts
│   │   └── README.md              # Component documentation
│   │
│   ├── input/                     # Input component (NEW)
│   │   ├── index.ts               # Component definition
│   │   ├── extractor.ts           # DOM → InputCanonical (~250 lines)
│   │   ├── classifier.ts          # Input type classification (~150 lines)
│   │   ├── vectorizer.ts          # InputCanonical → 32D vector (~240 lines)
│   │   ├── spec.ts                # TypeScript types for InputCanonical
│   │   ├── __tests__/
│   │   │   ├── extractor.test.ts
│   │   │   ├── classifier.test.ts
│   │   │   └── vectorizer.test.ts
│   │   └── README.md
│   │
│   ├── card/                      # Card component (NEW)
│   │   ├── index.ts               # Component definition
│   │   ├── extractor.ts           # DOM → CardCanonical (~300 lines)
│   │   ├── classifier.ts          # Card variant classification (~180 lines)
│   │   ├── vectorizer.ts          # CardCanonical → 28D vector (~220 lines)
│   │   ├── spec.ts                # TypeScript types for CardCanonical
│   │   ├── __tests__/
│   │   │   ├── extractor.test.ts
│   │   │   ├── classifier.test.ts
│   │   │   └── vectorizer.test.ts
│   │   └── README.md
│   │
│   ├── hero/                      # Hero component (NEW)
│   │   ├── index.ts               # Component definition
│   │   ├── extractor.ts           # DOM → HeroCanonical (~280 lines)
│   │   ├── classifier.ts          # Hero layout classification (~160 lines)
│   │   ├── vectorizer.ts          # HeroCanonical → 35D vector (~260 lines)
│   │   ├── spec.ts                # TypeScript types for HeroCanonical
│   │   ├── __tests__/
│   │   │   ├── extractor.test.ts
│   │   │   ├── classifier.test.ts
│   │   │   └── vectorizer.test.ts
│   │   └── README.md
│   │
│   └── navbar/                    # NavBar component (NEW)
│       ├── index.ts               # Component definition
│       ├── extractor.ts           # DOM → NavBarCanonical (~220 lines)
│       ├── classifier.ts          # NavBar layout classification (~140 lines)
│       ├── vectorizer.ts          # NavBarCanonical → 22D vector (~200 lines)
│       ├── spec.ts                # TypeScript types for NavBarCanonical
│       ├── __tests__/
│       │   ├── extractor.test.ts
│       │   ├── classifier.test.ts
│       │   └── vectorizer.test.ts
│       └── README.md
│
├── tokens/
│   ├── index.ts                   # REFACTORED: Core token extraction (colors, typography, spacing)
│   ├── color-extraction.ts        # Color clustering and palette generation
│   ├── color-harmony.ts           # Color harmony analysis
│   ├── color-utils.ts             # Color space conversions (sRGB ↔ LCH)
│   ├── typography-extraction.ts   # Font family, size, weight analysis
│   ├── spacing-extraction.ts      # Padding, margin, gap analysis
│   ├── shape-extraction.ts        # Border radius, elevation analysis
│   └── utils.ts                   # Shared utilities
│
├── vectors/
│   ├── global-style-vec.ts        # UNCHANGED: Global style vector (56D interpretable)
│   ├── normalization.ts           # UNCHANGED: Feature normalization
│   ├── normalization-bounds.json  # UNCHANGED: Normalization bounds
│   └── utils.ts                   # UNCHANGED: Vector utilities
│
└── storage/
    ├── index.ts                   # REFACTORED: Orchestrates all components
    ├── component-storage.ts       # NEW: Generic component storage logic
    └── migration-utils.ts         # NEW: Migration helpers

lib/db/
├── schema.sql                     # UPDATED: Add new role_vectors_* tables
├── migrations/                    # Incremental migrations
│   ├── 012_add_component_system_foundation.sql
│   ├── 013_migrate_button_table.sql
│   ├── 014_add_input_table.sql
│   ├── 015_add_card_table.sql
│   ├── 016_add_hero_table.sql
│   └── 017_add_navbar_table.sql
└── queries.ts                     # UPDATED: Component-specific queries

app/
├── api/
│   └── vectors/
│       ├── [styleProfileId]/route.ts  # UPDATED: Return all components
│       └── nearest/
│           ├── buttons/route.ts       # Renamed from nearest-ctas
│           ├── inputs/route.ts        # NEW
│           ├── cards/route.ts         # NEW
│           ├── heroes/route.ts        # NEW
│           └── navbars/route.ts       # NEW
│
└── vectors/[styleProfileId]/
    ├── page.tsx                       # UPDATED: Generic component tabs
    └── components/                    # NEW: Component-specific renderers
        ├── ButtonDisplay.tsx          # ~150 lines
        ├── InputDisplay.tsx           # NEW (~180 lines)
        ├── CardDisplay.tsx            # NEW (~200 lines)
        ├── HeroDisplay.tsx            # NEW (~220 lines)
        ├── NavBarDisplay.tsx          # NEW (~160 lines)
        └── shared/
            ├── ComponentCard.tsx      # Shared card component
            ├── TokenBadge.tsx         # Token reference badge
            └── FeatureList.tsx        # Feature list display

tests/
├── unit/
│   └── components/
│       ├── button/
│       ├── input/
│       ├── card/
│       ├── hero/
│       └── navbar/
├── integration/
│   ├── button-pipeline.test.ts
│   ├── input-pipeline.test.ts
│   ├── card-pipeline.test.ts
│   ├── hero-pipeline.test.ts
│   └── navbar-pipeline.test.ts
└── fixtures/
    ├── mock-buttons.json
    ├── mock-inputs.json
    ├── mock-cards.json
    ├── mock-heroes.json
    └── mock-navbars.json
```

### 5.3 File Size Budget

Target maximum file sizes to maintain readability and testability:

| File Type | Max Lines | Rationale |
|-----------|-----------|-----------|
| `extractor.ts` | 300 | Complex DOM traversal logic |
| `classifier.ts` | 200 | LLM prompts + response parsing |
| `vectorizer.ts` | 300 | Feature extraction + normalization |
| `spec.ts` | 150 | Type definitions only |
| `index.ts` | 100 | Component definition + exports |
| Test files | 400 | Multiple test cases per file |
| Display components | 250 | React rendering logic |

**Total per component: ~1,500-2,000 lines** (5x improvement over current monolithic approach)

---

## 6. Component Registry System

### 6.1 Registry Implementation

**File:** `pipeline/components/registry.ts`

```typescript
import type { ComponentDefinition, ComponentType } from './types';
import { buttonComponent } from './button';
import { inputComponent } from './input';
import { cardComponent } from './card';
import { heroComponent } from './hero';
import { navbarComponent } from './navbar';

/**
 * Central registry of all canonical components
 */
export const COMPONENT_REGISTRY: Record<ComponentType, ComponentDefinition> = {
  button: buttonComponent,
  input: inputComponent,
  card: cardComponent,
  hero: heroComponent,
  navbar: navbarComponent,
};

/**
 * Feature flags - enable components one by one for incremental rollout
 *
 * IMPORTANT: Only add components here after:
 * 1. Database migration is complete
 * 2. Unit tests are passing
 * 3. Integration tests are passing
 * 4. Manual QA on test sites
 */
export const ENABLED_COMPONENTS: ComponentType[] = [
  'button',   // ✅ Phase 0 complete
  // 'input',  // 🚧 Phase 1 in progress
  // 'card',   // 🚧 Phase 2 planned
  // 'hero',   // 🚧 Phase 3 planned
  // 'navbar', // 🚧 Phase 4 planned
];

/**
 * Get all enabled component definitions
 */
export function getEnabledComponents(): ComponentDefinition[] {
  return ENABLED_COMPONENTS.map(type => COMPONENT_REGISTRY[type]);
}

/**
 * Check if a component type is enabled
 */
export function isComponentEnabled(type: ComponentType): boolean {
  return ENABLED_COMPONENTS.includes(type);
}

/**
 * Get a specific component definition
 * @throws Error if component type is invalid
 */
export function getComponent(type: ComponentType): ComponentDefinition {
  const component = COMPONENT_REGISTRY[type];
  if (!component) {
    throw new Error(`Unknown component type: ${type}`);
  }
  return component;
}

/**
 * Get component metadata for monitoring/debugging
 */
export function getComponentMetadata() {
  return {
    totalComponents: Object.keys(COMPONENT_REGISTRY).length,
    enabledComponents: ENABLED_COMPONENTS.length,
    disabledComponents: Object.keys(COMPONENT_REGISTRY).length - ENABLED_COMPONENTS.length,
    components: Object.entries(COMPONENT_REGISTRY).map(([type, def]) => ({
      type,
      enabled: ENABLED_COMPONENTS.includes(type as ComponentType),
      version: def.version,
      dimensions: def.metadata.featureDimensions,
      estimatedProcessingTimeMs: def.metadata.estimatedProcessingTimeMs,
    })),
  };
}
```

### 6.2 Component Definition Example (Button)

**File:** `pipeline/components/button/index.ts`

```typescript
import type { ComponentDefinition } from '../types';
import { extractButtons } from './extractor';
import { classifyButtons } from './classifier';
import { vectorizeButton } from './vectorizer';
import { ButtonDisplay } from '@/app/vectors/[styleProfileId]/components/ButtonDisplay';
import { FiMousePointer } from 'react-icons/fi';

/**
 * Button component definition
 *
 * Captures primary/secondary/tertiary CTAs and other button variants.
 * Uses LLM-based classification to determine semantic role.
 *
 * Features:
 * - 26D interpretable vector
 * - WCAG AA/AAA contrast checking
 * - Token-first color/typography mapping
 * - State variants (hover, active, disabled, focus)
 */
export const buttonComponent: ComponentDefinition = {
  type: 'button',
  enabled: true,
  version: '1.0.0',

  extractor: extractButtons,
  classifier: classifyButtons,
  vectorizer: vectorizeButton,

  storage: {
    tableName: 'role_vectors_button',
    vectorDimension: 26,
    schema: {
      vec: 'VECTOR(26)',
      spec_json: 'JSONB',
      variant: 'TEXT',  // primary, secondary, tertiary, ghost, link
      ux_report: 'JSONB',
      confidence: 'REAL',
      representative_node_id: 'TEXT',
      cluster_id: 'TEXT',
    },
    indexes: [
      { name: 'idx_button_profile', columns: ['style_profile_id'] },
      { name: 'idx_button_variant', columns: ['variant'] },
      { name: 'idx_button_vec', type: 'ivfflat', columns: ['vec'], options: 'lists = 100' },
    ],
    constraints: [
      { type: 'check', expression: 'confidence >= 0 AND confidence <= 1' },
      { type: 'not_null', columns: ['vec', 'spec_json'] },
    ],
  },

  display: {
    renderer: ButtonDisplay,
    tabLabel: 'Buttons',
    icon: FiMousePointer,
    sortOrder: 1,
  },

  metadata: {
    featureDimensions: 26,
    averageExtractionsPerPage: 8,
    estimatedProcessingTimeMs: 1500,
  },
};
```

### 6.3 Unified Pipeline Integration

**File:** `pipeline/storage/index.ts` (refactored)

```typescript
import { getEnabledComponents } from '../components/registry';
import { storeComponentVectors } from './component-storage';
import type { StorageResult, ProcessingStats } from './types';

/**
 * Store vectors for all enabled components
 *
 * This is the main orchestration function that:
 * 1. Iterates through enabled components
 * 2. Extracts canonical specs
 * 3. Classifies variants (if applicable)
 * 4. Vectorizes specs
 * 5. Stores in database
 *
 * @param runId - Unique run identifier
 * @returns Storage result with stats for each component
 */
export async function storeVectors(runId: string): Promise<StorageResult> {
  const startTime = Date.now();

  // Load artifacts
  const nodes = await loadComputedNodes(runId);
  const tokens = await loadDesignTokens(runId);
  const report = await loadStyleReport(runId);
  const styleProfileId = await getStyleProfileId(runId);

  console.log(`📦 Starting vector storage for ${runId}`);
  console.log(`   Found ${nodes.length} DOM nodes`);
  console.log(`   Design tokens: ${Object.keys(tokens).length} categories`);

  const enabledComponents = getEnabledComponents();
  const componentStats: Record<string, ProcessingStats> = {};
  const errors: Array<{ component: string; error: Error }> = [];

  // Process each enabled component
  for (const component of enabledComponents) {
    const componentStartTime = Date.now();

    try {
      console.log(`\n📦 Processing ${component.type} components...`);

      // 1. Extract canonical specs
      const extractionResult = component.extractor(nodes, tokens, {
        runId,
        url: report.sourceUrl,
        viewport: report.viewport,
        timestamp: new Date(),
      });

      console.log(`   Found ${extractionResult.specs.length} ${component.type} candidates`);
      console.log(`   Extraction time: ${extractionResult.metadata.extractionTimeMs}ms`);

      if (extractionResult.metadata.warnings.length > 0) {
        console.warn(`   ⚠️  Warnings:`, extractionResult.metadata.warnings);
      }

      // 2. Classify (if classifier exists)
      let classifiedSpecs = extractionResult.specs;
      let classificationMetadata = null;

      if (component.classifier) {
        const classificationResult = await component.classifier(
          extractionResult.specs,
          {
            llmProvider: process.env.INTENT_PROVIDER as 'openai' | 'anthropic',
            confidenceThreshold: 0.5,
            fallbackToHeuristics: true,
          }
        );

        // Flatten variants (take all variants, prioritize primary)
        classifiedSpecs = [
          ...(classificationResult.variants.primary || []),
          ...(classificationResult.variants.secondary || []),
          ...(classificationResult.variants.tertiary || []),
        ];

        classificationMetadata = classificationResult.metadata;

        console.log(`   Classified into ${Object.keys(classificationResult.variants).length} variants`);
        console.log(`   Classification time: ${classificationMetadata.classificationTimeMs}ms`);
        console.log(`   LLM calls: ${classificationMetadata.llmCalls}`);
        console.log(`   Fallback used: ${classificationMetadata.fallbackUsed}`);
      }

      // 3. Vectorize
      const vectors = [];
      const vectorizationStartTime = Date.now();

      for (const spec of classifiedSpecs) {
        const vectorResult = component.vectorizer(spec, tokens, report, {
          normalizationBounds: await loadNormalizationBounds(),
          featureFlags: {},
        });

        vectors.push({
          spec,
          combined: vectorResult.combined,
          interpretable: vectorResult.interpretable,
          metadata: vectorResult.metadata,
          variant: (spec as any).variant,
          confidence: classificationMetadata?.confidenceScores[(spec as any).variant] ?? 1.0,
        });
      }

      const vectorizationTimeMs = Date.now() - vectorizationStartTime;
      console.log(`   Vectorized ${vectors.length} ${component.type}s`);
      console.log(`   Vectorization time: ${vectorizationTimeMs}ms`);

      // 4. Store in database
      const storageStartTime = Date.now();

      await storeComponentVectors(
        component.storage.tableName,
        styleProfileId,
        vectors,
        component.type
      );

      const storageTimeMs = Date.now() - storageStartTime;
      console.log(`   Stored ${vectors.length} vectors in ${storageTimeMs}ms`);

      // Track stats
      const componentTimeMs = Date.now() - componentStartTime;
      componentStats[component.type] = {
        candidatesFound: extractionResult.metadata.candidatesFound,
        candidatesFiltered: extractionResult.metadata.candidatesFiltered,
        specsExtracted: extractionResult.specs.length,
        vectorsStored: vectors.length,
        extractionTimeMs: extractionResult.metadata.extractionTimeMs,
        classificationTimeMs: classificationMetadata?.classificationTimeMs ?? 0,
        vectorizationTimeMs,
        storageTimeMs,
        totalTimeMs: componentTimeMs,
        warnings: extractionResult.metadata.warnings,
      };

      console.log(`   ✅ ${component.type} complete in ${componentTimeMs}ms`);

    } catch (error) {
      console.error(`   ❌ Error processing ${component.type}:`, error);
      errors.push({ component: component.type, error: error as Error });

      // Continue processing other components
      componentStats[component.type] = {
        candidatesFound: 0,
        candidatesFiltered: 0,
        specsExtracted: 0,
        vectorsStored: 0,
        extractionTimeMs: 0,
        classificationTimeMs: 0,
        vectorizationTimeMs: 0,
        storageTimeMs: 0,
        totalTimeMs: Date.now() - componentStartTime,
        warnings: [(error as Error).message],
      };
    }
  }

  const totalTimeMs = Date.now() - startTime;
  const totalVectorsStored = Object.values(componentStats).reduce(
    (sum, stats) => sum + stats.vectorsStored,
    0
  );

  console.log(`\n✅ All components processed in ${totalTimeMs}ms`);
  console.log(`   Total vectors stored: ${totalVectorsStored}`);

  if (errors.length > 0) {
    console.warn(`\n⚠️  ${errors.length} component(s) failed:`);
    errors.forEach(({ component, error }) => {
      console.warn(`   - ${component}: ${error.message}`);
    });
  }

  return {
    runId,
    styleProfileId,
    componentStats,
    totalVectorsStored,
    totalTimeMs,
    errors: errors.length > 0 ? errors : undefined,
  };
}
```

---

## 7. Database Schema Design

### 7.1 Role Vectors Tables (Pattern)

Each component gets its own `role_vectors_{type}` table following this pattern:

```sql
-- Template for all role_vectors_{type} tables
CREATE TABLE role_vectors_{type} (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  style_profile_id UUID NOT NULL REFERENCES style_profiles(id) ON DELETE CASCADE,

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
  representative_node_id TEXT NOT NULL,
  cluster_id TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  -- Ensure uniqueness per style profile + node
  UNIQUE(style_profile_id, representative_node_id)
);

-- Standard indexes for all tables
CREATE INDEX idx_role_vectors_{type}_profile
  ON role_vectors_{type}(style_profile_id);

CREATE INDEX idx_role_vectors_{type}_variant
  ON role_vectors_{type}(variant)
  WHERE variant IS NOT NULL;

CREATE INDEX idx_role_vectors_{type}_created
  ON role_vectors_{type}(created_at DESC);

-- Vector similarity search index (IVFFlat for speed/accuracy tradeoff)
CREATE INDEX idx_role_vectors_{type}_vec
  ON role_vectors_{type}
  USING ivfflat (vec vector_cosine_ops)
  WITH (lists = 100);

-- Trigger to update updated_at timestamp
CREATE TRIGGER update_role_vectors_{type}_updated_at
  BEFORE UPDATE ON role_vectors_{type}
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
```

### 7.2 Specific Table Definitions

#### 7.2.1 Button Table (Migration from existing)

**File:** `lib/db/migrations/013_migrate_button_table.sql`

```sql
-- Migration: Migrate role_vectors_primarycta to role_vectors_button
-- This migration is backward compatible and can be rolled back

BEGIN;

-- Step 1: Rename table
ALTER TABLE role_vectors_primarycta RENAME TO role_vectors_button;

-- Step 2: Add new columns (with defaults for existing rows)
ALTER TABLE role_vectors_button
  ADD COLUMN IF NOT EXISTS variant TEXT DEFAULT 'primary',
  ADD COLUMN IF NOT EXISTS representative_node_id TEXT,
  ADD COLUMN IF NOT EXISTS cluster_id TEXT,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- Step 3: Migrate data
-- Populate representative_node_id from tokens_json if available
UPDATE role_vectors_button
SET representative_node_id = COALESCE(
  tokens_json->>'representativeNodeId',
  tokens_json->>'nodeId',
  id::text
)
WHERE representative_node_id IS NULL;

-- Step 4: Rename tokens_json to spec_json for consistency
ALTER TABLE role_vectors_button
  RENAME COLUMN tokens_json TO spec_json;

-- Step 5: Make representative_node_id NOT NULL now that it's populated
ALTER TABLE role_vectors_button
  ALTER COLUMN representative_node_id SET NOT NULL;

-- Step 6: Add unique constraint
ALTER TABLE role_vectors_button
  ADD CONSTRAINT uq_button_profile_node
  UNIQUE (style_profile_id, representative_node_id);

-- Step 7: Update indexes
DROP INDEX IF EXISTS idx_role_vectors_primarycta_profile;
CREATE INDEX idx_role_vectors_button_profile
  ON role_vectors_button(style_profile_id);

CREATE INDEX idx_role_vectors_button_variant
  ON role_vectors_button(variant)
  WHERE variant IS NOT NULL;

CREATE INDEX idx_role_vectors_button_created
  ON role_vectors_button(created_at DESC);

-- Recreate vector index with better parameters
DROP INDEX IF EXISTS idx_role_vectors_primarycta_vec;
CREATE INDEX idx_role_vectors_button_vec
  ON role_vectors_button
  USING ivfflat (vec vector_cosine_ops)
  WITH (lists = 100);

-- Step 8: Add trigger for updated_at
CREATE TRIGGER update_role_vectors_button_updated_at
  BEFORE UPDATE ON role_vectors_button
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Step 9: Create backward-compatible view
CREATE OR REPLACE VIEW role_vectors_primarycta AS
SELECT
  id,
  style_profile_id,
  vec,
  spec_json as tokens_json,
  variant,
  ux_report,
  confidence,
  representative_node_id,
  cluster_id,
  created_at
FROM role_vectors_button
WHERE variant = 'primary';

COMMIT;

-- Rollback script (save for emergencies)
-- BEGIN;
-- DROP VIEW IF EXISTS role_vectors_primarycta;
-- ALTER TABLE role_vectors_button RENAME TO role_vectors_primarycta;
-- ALTER TABLE role_vectors_primarycta RENAME COLUMN spec_json TO tokens_json;
-- ALTER TABLE role_vectors_primarycta DROP COLUMN IF EXISTS variant;
-- ALTER TABLE role_vectors_primarycta DROP COLUMN IF EXISTS representative_node_id;
-- ALTER TABLE role_vectors_primarycta DROP COLUMN IF EXISTS cluster_id;
-- ALTER TABLE role_vectors_primarycta DROP COLUMN IF EXISTS updated_at;
-- COMMIT;
```

#### 7.2.2 Input Table (New)

**File:** `lib/db/migrations/014_add_input_table.sql`

```sql
-- Migration: Add role_vectors_input table for input component system

BEGIN;

CREATE TABLE role_vectors_input (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  style_profile_id UUID NOT NULL REFERENCES style_profiles(id) ON DELETE CASCADE,

  -- 32D vector
  vec VECTOR(32) NOT NULL,

  -- Canonical spec
  spec_json JSONB NOT NULL,

  -- Variant classification
  variant TEXT,  -- text | email | password | search | tel | url | number | date | time | textarea | select
  style TEXT,    -- outlined | filled | underlined | borderless
  size TEXT,     -- small | medium | large

  -- UX metrics
  ux_report JSONB,
  confidence REAL CHECK (confidence >= 0 AND confidence <= 1),

  -- Provenance
  representative_node_id TEXT NOT NULL,
  cluster_id TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  -- Constraints
  UNIQUE(style_profile_id, representative_node_id)
);

-- Indexes
CREATE INDEX idx_role_vectors_input_profile
  ON role_vectors_input(style_profile_id);

CREATE INDEX idx_role_vectors_input_variant
  ON role_vectors_input(variant)
  WHERE variant IS NOT NULL;

CREATE INDEX idx_role_vectors_input_style
  ON role_vectors_input(style)
  WHERE style IS NOT NULL;

CREATE INDEX idx_role_vectors_input_created
  ON role_vectors_input(created_at DESC);

CREATE INDEX idx_role_vectors_input_vec
  ON role_vectors_input
  USING ivfflat (vec vector_cosine_ops)
  WITH (lists = 100);

-- Trigger
CREATE TRIGGER update_role_vectors_input_updated_at
  BEFORE UPDATE ON role_vectors_input
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Add comment for documentation
COMMENT ON TABLE role_vectors_input IS
  'Stores 32D feature vectors for input components (text, email, password, etc.)';

COMMIT;
```

#### 7.2.3 Card Table (New)

**File:** `lib/db/migrations/015_add_card_table.sql`

```sql
-- Migration: Add role_vectors_card table for card component system

BEGIN;

CREATE TABLE role_vectors_card (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  style_profile_id UUID NOT NULL REFERENCES style_profiles(id) ON DELETE CASCADE,

  -- 28D vector
  vec VECTOR(28) NOT NULL,

  -- Canonical spec
  spec_json JSONB NOT NULL,

  -- Variant classification
  variant TEXT,  -- default | elevated | outlined | filled
  layout TEXT,   -- vertical | horizontal | grid

  -- UX metrics
  ux_report JSONB,
  confidence REAL CHECK (confidence >= 0 AND confidence <= 1),

  -- Provenance
  representative_node_id TEXT NOT NULL,
  cluster_id TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  -- Constraints
  UNIQUE(style_profile_id, representative_node_id)
);

-- Indexes
CREATE INDEX idx_role_vectors_card_profile
  ON role_vectors_card(style_profile_id);

CREATE INDEX idx_role_vectors_card_variant
  ON role_vectors_card(variant)
  WHERE variant IS NOT NULL;

CREATE INDEX idx_role_vectors_card_layout
  ON role_vectors_card(layout)
  WHERE layout IS NOT NULL;

CREATE INDEX idx_role_vectors_card_created
  ON role_vectors_card(created_at DESC);

CREATE INDEX idx_role_vectors_card_vec
  ON role_vectors_card
  USING ivfflat (vec vector_cosine_ops)
  WITH (lists = 100);

-- Trigger
CREATE TRIGGER update_role_vectors_card_updated_at
  BEFORE UPDATE ON role_vectors_card
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Add comment
COMMENT ON TABLE role_vectors_card IS
  'Stores 28D feature vectors for card components (product cards, blog cards, etc.)';

COMMIT;
```

#### 7.2.4 Hero Table (New)

**File:** `lib/db/migrations/016_add_hero_table.sql`

```sql
-- Migration: Add role_vectors_hero table for hero component system

BEGIN;

CREATE TABLE role_vectors_hero (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  style_profile_id UUID NOT NULL REFERENCES style_profiles(id) ON DELETE CASCADE,

  -- 35D vector
  vec VECTOR(35) NOT NULL,

  -- Canonical spec
  spec_json JSONB NOT NULL,

  -- Layout classification
  layout TEXT,   -- text-left-media-right | text-right-media-left | text-center | media-background | full-bleed
  density TEXT,  -- compact | comfortable | spacious

  -- UX metrics
  ux_report JSONB,
  confidence REAL CHECK (confidence >= 0 AND confidence <= 1),

  -- Provenance
  representative_node_id TEXT NOT NULL,
  cluster_id TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  -- Constraints
  UNIQUE(style_profile_id, representative_node_id)
);

-- Indexes
CREATE INDEX idx_role_vectors_hero_profile
  ON role_vectors_hero(style_profile_id);

CREATE INDEX idx_role_vectors_hero_layout
  ON role_vectors_hero(layout)
  WHERE layout IS NOT NULL;

CREATE INDEX idx_role_vectors_hero_density
  ON role_vectors_hero(density)
  WHERE density IS NOT NULL;

CREATE INDEX idx_role_vectors_hero_created
  ON role_vectors_hero(created_at DESC);

CREATE INDEX idx_role_vectors_hero_vec
  ON role_vectors_hero
  USING ivfflat (vec vector_cosine_ops)
  WITH (lists = 100);

-- Trigger
CREATE TRIGGER update_role_vectors_hero_updated_at
  BEFORE UPDATE ON role_vectors_hero
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Add comment
COMMENT ON TABLE role_vectors_hero IS
  'Stores 35D feature vectors for hero sections (landing page heroes, above-the-fold content)';

COMMIT;
```

#### 7.2.5 NavBar Table (New)

**File:** `lib/db/migrations/017_add_navbar_table.sql`

```sql
-- Migration: Add role_vectors_navbar table for navbar component system

BEGIN;

CREATE TABLE role_vectors_navbar (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  style_profile_id UUID NOT NULL REFERENCES style_profiles(id) ON DELETE CASCADE,

  -- 22D vector
  vec VECTOR(22) NOT NULL,

  -- Canonical spec
  spec_json JSONB NOT NULL,

  -- Layout classification
  layout TEXT,  -- logo-left-links-right | centered | split | logo-center

  -- Behavior flags
  is_sticky BOOLEAN DEFAULT false,
  is_transparent BOOLEAN DEFAULT false,
  has_backdrop_blur BOOLEAN DEFAULT false,

  -- UX metrics
  ux_report JSONB,
  confidence REAL CHECK (confidence >= 0 AND confidence <= 1),

  -- Provenance
  representative_node_id TEXT NOT NULL,
  cluster_id TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  -- Constraints
  UNIQUE(style_profile_id, representative_node_id)
);

-- Indexes
CREATE INDEX idx_role_vectors_navbar_profile
  ON role_vectors_navbar(style_profile_id);

CREATE INDEX idx_role_vectors_navbar_layout
  ON role_vectors_navbar(layout)
  WHERE layout IS NOT NULL;

CREATE INDEX idx_role_vectors_navbar_sticky
  ON role_vectors_navbar(is_sticky)
  WHERE is_sticky = true;

CREATE INDEX idx_role_vectors_navbar_created
  ON role_vectors_navbar(created_at DESC);

CREATE INDEX idx_role_vectors_navbar_vec
  ON role_vectors_navbar
  USING ivfflat (vec vector_cosine_ops)
  WITH (lists = 100);

-- Trigger
CREATE TRIGGER update_role_vectors_navbar_updated_at
  BEFORE UPDATE ON role_vectors_navbar
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Add comment
COMMENT ON TABLE role_vectors_navbar IS
  'Stores 22D feature vectors for navigation bar components';

COMMIT;
```

### 7.3 Migration Utilities

**File:** `pipeline/storage/migration-utils.ts`

```typescript
import { Pool } from 'pg';

/**
 * Check if a table exists in the database
 */
export async function tableExists(pool: Pool, tableName: string): Promise<boolean> {
  const result = await pool.query(
    `SELECT EXISTS (
      SELECT FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_name = $1
    )`,
    [tableName]
  );
  return result.rows[0].exists;
}

/**
 * Get row count for a table
 */
export async function getTableRowCount(pool: Pool, tableName: string): Promise<number> {
  const result = await pool.query(`SELECT COUNT(*) as count FROM ${tableName}`);
  return parseInt(result.rows[0].count, 10);
}

/**
 * Validate table schema matches expected definition
 */
export async function validateTableSchema(
  pool: Pool,
  tableName: string,
  expectedColumns: Record<string, string>
): Promise<{ valid: boolean; missingColumns: string[]; extraColumns: string[] }> {
  const result = await pool.query(
    `SELECT column_name, data_type
     FROM information_schema.columns
     WHERE table_name = $1`,
    [tableName]
  );

  const actualColumns = new Set(result.rows.map(r => r.column_name));
  const expectedCols = new Set(Object.keys(expectedColumns));

  const missingColumns = Array.from(expectedCols).filter(col => !actualColumns.has(col));
  const extraColumns = Array.from(actualColumns).filter(col => !expectedCols.has(col));

  return {
    valid: missingColumns.length === 0 && extraColumns.length === 0,
    missingColumns,
    extraColumns,
  };
}

/**
 * Run migration with rollback support
 */
export async function runMigrationSafe(
  pool: Pool,
  name: string,
  upSql: string,
  downSql: string
): Promise<void> {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    console.log(`Running migration: ${name}`);
    await client.query(upSql);

    // Record migration
    await client.query(
      `INSERT INTO schema_migrations (name, applied_at) VALUES ($1, NOW())
       ON CONFLICT (name) DO NOTHING`,
      [name]
    );

    await client.query('COMMIT');
    console.log(`✅ Migration ${name} complete`);

  } catch (error) {
    await client.query('ROLLBACK');
    console.error(`❌ Migration ${name} failed:`, error);

    console.log(`Attempting rollback...`);
    try {
      await client.query('BEGIN');
      await client.query(downSql);
      await client.query('COMMIT');
      console.log(`✅ Rollback successful`);
    } catch (rollbackError) {
      console.error(`❌ Rollback failed:`, rollbackError);
      throw new Error(`Migration and rollback both failed. Manual intervention required.`);
    }

    throw error;

  } finally {
    client.release();
  }
}
```

---

## 8. Backend Pipeline Architecture

### 8.1 Shared Extraction Utilities

**File:** `pipeline/components/utils.ts`

```typescript
import type { ComputedStyleNode, DesignTokens, TokenRef } from './types';

/**
 * Calculate WCAG contrast ratio between two colors
 */
export function calculateContrast(color1: string, color2: string): number {
  // Implementation using colorjs.io
  const lum1 = relativeLuminance(color1);
  const lum2 = relativeLuminance(color2);
  const lighter = Math.max(lum1, lum2);
  const darker = Math.min(lum1, lum2);
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Check if a node is visible (has non-zero dimensions)
 */
export function isVisible(node: ComputedStyleNode): boolean {
  return (
    node.boundingBox &&
    node.boundingBox.width > 0 &&
    node.boundingBox.height > 0 &&
    parseFloat(node.styles.opacity || '1') > 0 &&
    node.styles.display !== 'none' &&
    node.styles.visibility !== 'hidden'
  );
}

/**
 * Extract numeric value from CSS string (e.g., "16px" → 16)
 */
export function parseNumeric(value: string | undefined, fallback: number = 0): number {
  if (!value) return fallback;
  const parsed = parseFloat(value);
  return isNaN(parsed) ? fallback : parsed;
}

/**
 * Match raw value to design token with tolerance
 */
export function matchToToken<T extends string | number>(
  rawValue: T,
  tokens: Array<{ id: string; value: T }>,
  tolerance: number = 0,
  compareFn?: (a: T, b: T) => boolean
): TokenRef<T> {
  for (const token of tokens) {
    const isMatch = compareFn
      ? compareFn(rawValue, token.value)
      : typeof rawValue === 'number' && typeof token.value === 'number'
      ? Math.abs(rawValue - token.value) <= tolerance
      : rawValue === token.value;

    if (isMatch) {
      return {
        source: 'token',
        value: token.value,
        tokenId: token.id,
        confidence: 1.0,
      };
    }
  }

  return {
    source: 'raw',
    value: rawValue,
  };
}

/**
 * Hash node for cluster ID generation
 */
export function hashNode(node: ComputedStyleNode): string {
  const key = [
    node.tagName,
    node.styles.backgroundColor,
    node.styles.color,
    node.styles.borderRadius,
    node.styles.padding,
    node.textContent?.substring(0, 20),
  ].join('|');

  // Simple hash (use crypto.createHash in production)
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    const char = key.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(36);
}

/**
 * Extract typography from computed styles
 */
export function extractTypography(
  node: ComputedStyleNode,
  tokens: DesignTokens
): BaseCanonicalSpec['typography'] {
  return {
    family: matchToToken(
      node.styles.fontFamily || 'sans-serif',
      tokens.typography.families,
      0,
      (a, b) => a.split(',')[0].trim().toLowerCase() === b.split(',')[0].trim().toLowerCase()
    ),
    weight: matchToToken(
      parseNumeric(node.styles.fontWeight, 400),
      tokens.typography.weights,
      50 // Tolerance: 350-450 → 400
    ),
    size: matchToToken(
      parseNumeric(node.styles.fontSize, 16),
      tokens.typography.sizes,
      2 // Tolerance: 14-18 → 16
    ),
    lineHeight: matchToToken(
      node.styles.lineHeight || '1.5',
      tokens.typography.lineHeights,
      0.1
    ),
    letterSpacing: matchToToken(
      parseNumeric(node.styles.letterSpacing, 0),
      tokens.typography.letterSpacings || [],
      0.05
    ),
    textContent: node.textContent,
    textTransform: (node.styles.textTransform as any) || 'none',
  };
}

/**
 * Extract padding from computed styles
 */
export function extractPadding(
  node: ComputedStyleNode,
  tokens: DesignTokens
): { x: TokenRef<number>; y: TokenRef<number> } {
  const paddingLeft = parseNumeric(node.styles.paddingLeft, 0);
  const paddingRight = parseNumeric(node.styles.paddingRight, 0);
  const paddingTop = parseNumeric(node.styles.paddingTop, 0);
  const paddingBottom = parseNumeric(node.styles.paddingBottom, 0);

  const x = (paddingLeft + paddingRight) / 2;
  const y = (paddingTop + paddingBottom) / 2;

  return {
    x: matchToToken(x, tokens.spacing.values, 2),
    y: matchToToken(y, tokens.spacing.values, 2),
  };
}

/**
 * Extract border radius from computed styles
 */
export function extractRadius(
  node: ComputedStyleNode,
  tokens: DesignTokens
): TokenRef<number> {
  // Average all four corners
  const topLeft = parseNumeric(node.styles.borderTopLeftRadius, 0);
  const topRight = parseNumeric(node.styles.borderTopRightRadius, 0);
  const bottomLeft = parseNumeric(node.styles.borderBottomLeftRadius, 0);
  const bottomRight = parseNumeric(node.styles.borderBottomRightRadius, 0);

  const avgRadius = (topLeft + topRight + bottomLeft + bottomRight) / 4;

  return matchToToken(avgRadius, tokens.shape.radius, 2);
}

/**
 * Extract elevation/shadow from computed styles
 */
export function extractElevation(
  node: ComputedStyleNode,
  tokens: DesignTokens
): TokenRef<string> {
  const boxShadow = node.styles.boxShadow;
  if (!boxShadow || boxShadow === 'none') {
    return { source: 'raw', value: 'none' };
  }

  // Try to match to elevation token
  return matchToToken(
    boxShadow,
    tokens.elevation?.values || [],
    0,
    (a, b) => normalizeShadow(a) === normalizeShadow(b)
  );
}

/**
 * Normalize shadow string for comparison
 */
function normalizeShadow(shadow: string): string {
  return shadow
    .replace(/\s+/g, ' ')
    .replace(/rgba?\([^)]+\)/g, 'COLOR')
    .trim();
}

/**
 * Detect icons in node (simple heuristic)
 */
export function detectIcons(node: ComputedStyleNode): { hasIcon: boolean; position?: 'left' | 'right' | 'only' } {
  // Check for common icon patterns
  const hasIconClass = /icon|svg|fa-|material-icons/i.test(node.className || '');
  const hasChildSvg = node.children?.some(child => child.tagName === 'svg');
  const hasIconChild = node.children?.some(child =>
    /icon|svg|fa-|material-icons/i.test(child.className || '')
  );

  if (!hasIconClass && !hasChildSvg && !hasIconChild) {
    return { hasIcon: false };
  }

  // Determine position (simplified)
  const children = node.children || [];
  if (children.length === 1 && (hasChildSvg || hasIconChild)) {
    return { hasIcon: true, position: 'only' };
  }

  const firstChildIsIcon = children[0] && /icon|svg/i.test(children[0].tagName || children[0].className || '');
  const lastChildIsIcon = children[children.length - 1] && /icon|svg/i.test(
    children[children.length - 1].tagName || children[children.length - 1].className || ''
  );

  if (firstChildIsIcon) return { hasIcon: true, position: 'left' };
  if (lastChildIsIcon) return { hasIcon: true, position: 'right' };

  return { hasIcon: true };
}
```

### 8.2 Component Extractor Pattern (Button Example)

**File:** `pipeline/components/button/extractor.ts`

```typescript
import type { ComputedStyleNode, DesignTokens, ButtonCanonical, ExtractionContext, ExtractionResult } from '../types';
import {
  isVisible,
  extractTypography,
  extractPadding,
  extractRadius,
  extractElevation,
  extractPalette,
  detectIcons,
  hashNode,
  calculateContrast,
} from '../utils';

/**
 * Extract button components from DOM nodes
 *
 * Detects buttons based on:
 * - Semantic HTML (<button>, <a>, <input type="button|submit">)
 * - ARIA roles (role="button")
 * - Visual heuristics (looks like a button)
 *
 * @param nodes - All captured DOM nodes
 * @param tokens - Extracted design tokens
 * @param context - Extraction context (runId, URL, etc.)
 * @returns Extraction result with button specs and metadata
 */
export function extractButtons(
  nodes: ComputedStyleNode[],
  tokens: DesignTokens,
  context: ExtractionContext
): ExtractionResult<ButtonCanonical> {
  const startTime = Date.now();
  const warnings: string[] = [];

  // Step 1: Find button-like candidates
  const candidates = nodes.filter(isButtonLike);
  console.log(`   Found ${candidates.length} button candidates`);

  // Step 2: Filter out invalid candidates
  const validCandidates = candidates.filter(node => {
    // Must be visible
    if (!isVisible(node)) return false;

    // Must have minimum dimensions (at least 16x16)
    if (!node.boundingBox || node.boundingBox.width < 16 || node.boundingBox.height < 16) {
      warnings.push(`Button too small: ${node.id} (${node.boundingBox?.width}x${node.boundingBox?.height})`);
      return false;
    }

    // Must have text content or icon
    const hasText = (node.textContent || '').trim().length > 0;
    const hasIcon = detectIcons(node).hasIcon;
    if (!hasText && !hasIcon) {
      warnings.push(`Button has no text or icon: ${node.id}`);
      return false;
    }

    return true;
  });

  console.log(`   ${validCandidates.length} valid buttons after filtering`);

  // Step 3: Extract canonical specs
  const specs: ButtonCanonical[] = validCandidates.map(node => {
    const typography = extractTypography(node, tokens);
    const palette = extractPalette(node, tokens);
    const padding = extractPadding(node, tokens);
    const radius = extractRadius(node, tokens);
    const elevation = extractElevation(node, tokens);
    const icon = detectIcons(node);

    // Calculate contrast
    const contrast = calculateContrast(
      resolveTokenRef(palette.bg),
      resolveTokenRef(palette.fg)
    );

    // Infer shape
    const shape = inferShape(node, radius);

    // Infer variant (heuristic, will be refined by classifier)
    const variant = inferVariant(node, palette, elevation);

    // Extract states (if available)
    const states = extractStates(node, tokens);

    // Calculate prominence score
    const prominence = calculateProminence(node, palette, elevation);

    const spec: ButtonCanonical = {
      type: 'button',
      version: '1.0.0',
      representativeNodeId: node.id,
      clusterId: `btn_${hashNode(node)}`,
      sourceUrl: context.url,
      captureTimestamp: context.timestamp,

      variant,
      shape,

      palette,
      typography,
      padding,
      radius,
      elevation,

      icon: icon.hasIcon ? {
        position: icon.position || 'left',
        size: { source: 'raw', value: 16 }, // TODO: detect actual icon size
      } : undefined,

      states,

      constraints: {
        minContrastAA: contrast >= 4.5,
        minContrastAAA: contrast >= 7.0,
        minTapTargetPx: {
          source: 'raw',
          value: Math.min(node.boundingBox.width, node.boundingBox.height),
        },
        hasAccessibleLabel: hasAccessibleLabel(node),
        prominence,
      },

      features: {
        borderWidth: {
          source: 'raw',
          value: parseNumeric(node.styles.borderWidth, 0),
        },
        hasOutline: (node.styles.outline || 'none') !== 'none',
        hasShadow: (node.styles.boxShadow || 'none') !== 'none',
        shadowIntensity: calculateShadowIntensity(node.styles.boxShadow),
        textCasing: inferTextCasing(typography.textContent),
        casingScore: calculateCasingScore(typography.textContent),
      },

      metadata: {
        confidence: 1.0, // Will be updated by classifier
        warnings: [],
        features: {},
      },
    };

    return spec;
  });

  const extractionTimeMs = Date.now() - startTime;

  return {
    specs,
    metadata: {
      candidatesFound: candidates.length,
      candidatesFiltered: candidates.length - validCandidates.length,
      extractionTimeMs,
      warnings,
    },
  };
}

/**
 * Check if a node looks like a button
 */
function isButtonLike(node: ComputedStyleNode): boolean {
  // Semantic HTML
  if (node.tagName === 'button') return true;
  if (node.tagName === 'a' && node.attributes?.href) return true;
  if (node.tagName === 'input' && /button|submit|reset/i.test(node.attributes?.type || '')) return true;

  // ARIA role
  if (node.attributes?.role === 'button') return true;

  // Visual heuristics (be conservative)
  const hasClickListener = node.attributes?.onclick || node.attributes?.['data-testid']?.includes('button');
  const hasButtonClass = /btn|button|cta/i.test(node.className || '');
  const looksLikeButton = hasClickListener || hasButtonClass;

  if (looksLikeButton) {
    // Additional checks to avoid false positives
    const hasBorder = parseNumeric(node.styles.borderWidth, 0) > 0;
    const hasBackground = node.styles.backgroundColor && node.styles.backgroundColor !== 'transparent';
    const hasPadding = parseNumeric(node.styles.paddingLeft, 0) > 4 || parseNumeric(node.styles.paddingTop, 0) > 4;

    return hasBorder || hasBackground || hasPadding;
  }

  return false;
}

/**
 * Infer button shape from radius and dimensions
 */
function inferShape(node: ComputedStyleNode, radius: TokenRef<number>): ButtonCanonical['shape'] {
  const radiusValue = resolveTokenRef(radius);
  const width = node.boundingBox.width;
  const height = node.boundingBox.height;
  const aspectRatio = width / height;

  if (radiusValue >= Math.min(width, height) / 2) {
    // Fully rounded
    return aspectRatio > 1.5 ? 'pill' : 'circle';
  }

  if (aspectRatio >= 0.9 && aspectRatio <= 1.1) {
    return 'square';
  }

  return radiusValue > 8 ? 'rounded' : 'rectangle';
}

/**
 * Infer button variant (heuristic, will be refined by LLM classifier)
 */
function inferVariant(
  node: ComputedStyleNode,
  palette: BaseCanonicalSpec['palette'],
  elevation: TokenRef<string>
): ButtonCanonical['variant'] {
  const bgValue = resolveTokenRef(palette.bg);
  const hasShadow = resolveTokenRef(elevation) !== 'none';
  const hasBackground = bgValue !== 'transparent' && bgValue !== 'rgba(0,0,0,0)';
  const hasBorder = parseNumeric(node.styles.borderWidth, 0) > 0;

  if (!hasBackground && !hasBorder) return 'ghost';
  if (!hasBackground && hasBorder) return 'outlined';
  if (hasShadow || (node.styles.fontWeight && parseInt(node.styles.fontWeight) >= 600)) return 'primary';

  return 'secondary';
}

/**
 * Extract state variants (hover, active, disabled, focus)
 */
function extractStates(node: ComputedStyleNode, tokens: DesignTokens): ButtonCanonical['states'] {
  // This is challenging without runtime interaction
  // For now, we'll look for CSS classes that suggest states
  const className = node.className || '';

  // TODO: Implement more sophisticated state detection
  // - Parse :hover, :active, :focus pseudo-classes from stylesheets
  // - Detect data-state attributes
  // - Use computed styles for disabled state

  return undefined;
}

/**
 * Calculate button prominence (0-1 scale)
 */
function calculateProminence(
  node: ComputedStyleNode,
  palette: BaseCanonicalSpec['palette'],
  elevation: TokenRef<string>
): number {
  let prominence = 0.5;

  // High contrast increases prominence
  const contrast = calculateContrast(resolveTokenRef(palette.bg), resolveTokenRef(palette.fg));
  prominence += (contrast - 4.5) / 20; // Normalize around WCAG AA

  // Shadow increases prominence
  if (resolveTokenRef(elevation) !== 'none') {
    prominence += 0.2;
  }

  // Bold font increases prominence
  const fontWeight = parseNumeric(node.styles.fontWeight, 400);
  if (fontWeight >= 600) {
    prominence += 0.1;
  }

  // Large size increases prominence
  const fontSize = parseNumeric(node.styles.fontSize, 16);
  if (fontSize >= 18) {
    prominence += 0.1;
  }

  return Math.min(1.0, Math.max(0.0, prominence));
}

/**
 * Check if button has accessible label
 */
function hasAccessibleLabel(node: ComputedStyleNode): boolean {
  // Has visible text
  if ((node.textContent || '').trim().length > 0) return true;

  // Has aria-label
  if (node.attributes?.['aria-label']) return true;

  // Has aria-labelledby
  if (node.attributes?.['aria-labelledby']) return true;

  // Has title
  if (node.attributes?.title) return true;

  return false;
}

/**
 * Calculate shadow intensity (0-1 scale)
 */
function calculateShadowIntensity(boxShadow: string | undefined): number {
  if (!boxShadow || boxShadow === 'none') return 0;

  // Parse shadow (simplified)
  const parts = boxShadow.split('px');
  if (parts.length < 3) return 0.3;

  const blur = Math.abs(parseFloat(parts[1]) || 0);
  const spread = Math.abs(parseFloat(parts[2]) || 0);

  return Math.min(1.0, (blur + spread) / 20);
}

/**
 * Infer text casing from content
 */
function inferTextCasing(text: string | undefined): ButtonCanonical['features']['textCasing'] {
  if (!text) return 'sentence';

  if (text === text.toUpperCase()) return 'upper';
  if (text === text.toLowerCase()) return 'lower';
  if (/^[A-Z][a-z]/.test(text)) return 'title';

  return 'sentence';
}

/**
 * Calculate casing score (0 = lowercase, 1 = uppercase)
 */
function calculateCasingScore(text: string | undefined): number {
  if (!text) return 0;

  const letters = text.replace(/[^a-zA-Z]/g, '');
  if (letters.length === 0) return 0;

  const uppercaseCount = (text.match(/[A-Z]/g) || []).length;
  return uppercaseCount / letters.length;
}

/**
 * Resolve token reference to concrete value
 */
function resolveTokenRef<T>(ref: TokenRef<T>): T {
  return ref.value;
}

/**
 * Parse numeric value from CSS string
 */
function parseNumeric(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = parseFloat(value);
  return isNaN(parsed) ? fallback : parsed;
}
```

---

## 9. Frontend Display System

### 9.1 Generic Component Display

**File:** `app/vectors/[styleProfileId]/page.tsx` (refactored)

```typescript
'use client';

import { useState, useEffect } from 'react';
import { COMPONENT_REGISTRY, ENABLED_COMPONENTS, getComponentMetadata } from '@/pipeline/components/registry';
import type { VectorData, ComponentType } from '@/pipeline/components/types';

export default function VectorPage({ params }: { params: { styleProfileId: string } }) {
  const [activeTab, setActiveTab] = useState<string>('overview');
  const [data, setData] = useState<VectorData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Fetch vector data on mount
  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        const response = await fetch(`/api/vectors/${params.styleProfileId}`);
        if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);

        const json = await response.json();
        setData(json);
      } catch (err) {
        setError(err as Error);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [params.styleProfileId]);

  // Generate component tabs from registry
  const componentTabs = ENABLED_COMPONENTS.map(type => {
    const component = COMPONENT_REGISTRY[type];
    return {
      id: type,
      label: component.display.tabLabel,
      Icon: component.display.icon,
      Component: component.display.renderer,
      sortOrder: component.display.sortOrder,
    };
  }).sort((a, b) => a.sortOrder - b.sortOrder);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading vector data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center max-w-md">
          <p className="text-red-600 text-lg mb-2">Error loading vectors</p>
          <p className="text-gray-600">{error.message}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <h1 className="text-2xl font-bold text-gray-900">Component Vectors</h1>
          <p className="text-sm text-gray-600 mt-1">Style Profile: {params.styleProfileId}</p>
        </div>

        {/* Tab navigation */}
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex gap-6 overflow-x-auto">
            <TabButton
              active={activeTab === 'overview'}
              onClick={() => setActiveTab('overview')}
              label="Overview"
            />

            <TabButton
              active={activeTab === 'similarity'}
              onClick={() => setActiveTab('similarity')}
              label="Similarity"
            />

            {componentTabs.map(tab => (
              <TabButton
                key={tab.id}
                active={activeTab === tab.id}
                onClick={() => setActiveTab(tab.id)}
                label={tab.label}
                Icon={tab.Icon}
              />
            ))}
          </div>
        </div>
      </header>

      {/* Tab content */}
      <main className="max-w-7xl mx-auto px-4 py-8">
        {activeTab === 'overview' && <OverviewTab data={data} />}
        {activeTab === 'similarity' && <SimilarityTab data={data} styleProfileId={params.styleProfileId} />}

        {componentTabs.map(tab =>
          activeTab === tab.id ? (
            <tab.Component key={tab.id} specs={data?.components[tab.id] || []} styleProfileId={params.styleProfileId} />
          ) : null
        )}
      </main>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  label,
  Icon,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  Icon?: React.ComponentType<{ className?: string }>;
}) {
  return (
    <button
      onClick={onClick}
      className={`
        flex items-center gap-2 px-4 py-3 border-b-2 transition-colors whitespace-nowrap
        ${active
          ? 'border-blue-600 text-blue-600 font-medium'
          : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
        }
      `}
    >
      {Icon && <Icon className="w-4 h-4" />}
      {label}
    </button>
  );
}

function OverviewTab({ data }: { data: VectorData | null }) {
  if (!data) return null;

  const metadata = getComponentMetadata();

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-bold mb-4">Component Statistics</h2>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {Object.entries(data.componentCounts || {}).map(([type, count]) => (
            <div key={type} className="text-center p-4 bg-gray-50 rounded">
              <p className="text-3xl font-bold text-blue-600">{count}</p>
              <p className="text-sm text-gray-600 mt-1 capitalize">{type}s</p>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-bold mb-4">System Information</h2>

        <dl className="grid grid-cols-2 gap-4">
          <div>
            <dt className="text-sm font-medium text-gray-600">Total Components</dt>
            <dd className="text-lg font-semibold">{metadata.totalComponents}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-600">Enabled Components</dt>
            <dd className="text-lg font-semibold text-green-600">{metadata.enabledComponents}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-600">Processing Time</dt>
            <dd className="text-lg font-semibold">{data.processingTimeMs}ms</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-600">Total Vectors</dt>
            <dd className="text-lg font-semibold">{data.totalVectors}</dd>
          </div>
        </dl>
      </div>
    </div>
  );
}

function SimilarityTab({ data, styleProfileId }: { data: VectorData | null; styleProfileId: string }) {
  const [componentType, setComponentType] = useState<ComponentType>('button');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  async function handleSearch(vectorId: string) {
    setLoading(true);
    try {
      const response = await fetch(
        `/api/vectors/nearest/${componentType}s?vectorId=${vectorId}&limit=10`
      );
      const results = await response.json();
      setSearchResults(results);
    } catch (error) {
      console.error('Similarity search failed:', error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-bold mb-4">Similarity Search</h2>

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Component Type
          </label>
          <select
            value={componentType}
            onChange={(e) => setComponentType(e.target.value as ComponentType)}
            className="block w-full px-3 py-2 border border-gray-300 rounded-md"
          >
            {ENABLED_COMPONENTS.map(type => (
              <option key={type} value={type}>
                {COMPONENT_REGISTRY[type].display.tabLabel}
              </option>
            ))}
          </select>
        </div>

        {searchResults.length > 0 && (
          <div className="mt-6">
            <h3 className="text-lg font-semibold mb-3">Similar Components</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {searchResults.map((result, i) => (
                <div key={i} className="border rounded p-3">
                  <p className="text-sm font-medium">Similarity: {(result.similarity * 100).toFixed(1)}%</p>
                  <p className="text-xs text-gray-600 mt-1">From: {result.sourceUrl}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
```

### 9.2 Component-Specific Renderer (Button Example)

**File:** `app/vectors/[styleProfileId]/components/ButtonDisplay.tsx`

```typescript
'use client';

import { useState } from 'react';
import type { ButtonCanonical } from '@/pipeline/components/button/spec';
import { resolveTokenRef } from '@/pipeline/components/utils';
import { ComponentCard } from './shared/ComponentCard';
import { TokenBadge } from './shared/TokenBadge';
import { FeatureList } from './shared/FeatureList';

interface ButtonDisplayProps {
  specs: ButtonCanonical[];
  styleProfileId: string;
}

export function ButtonDisplay({ specs, styleProfileId }: ButtonDisplayProps) {
  const [selectedVariant, setSelectedVariant] = useState<string | null>(null);

  // Group by variant
  const variantGroups = specs.reduce((acc, spec) => {
    const variant = spec.variant || 'unknown';
    if (!acc[variant]) acc[variant] = [];
    acc[variant].push(spec);
    return acc;
  }, {} as Record<string, ButtonCanonical[]>);

  const variants = Object.keys(variantGroups).sort();

  // Filter by selected variant
  const displayedSpecs = selectedVariant
    ? variantGroups[selectedVariant]
    : specs;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Buttons</h2>
          <p className="text-sm text-gray-600 mt-1">
            {specs.length} button{specs.length !== 1 ? 's' : ''} detected
          </p>
        </div>

        {/* Variant filter */}
        <div className="flex gap-2">
          <button
            onClick={() => setSelectedVariant(null)}
            className={`px-3 py-1 rounded text-sm ${
              selectedVariant === null
                ? 'bg-blue-600 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            All
          </button>
          {variants.map(variant => (
            <button
              key={variant}
              onClick={() => setSelectedVariant(variant)}
              className={`px-3 py-1 rounded text-sm capitalize ${
                selectedVariant === variant
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              {variant} ({variantGroups[variant].length})
            </button>
          ))}
        </div>
      </div>

      {/* Buttons grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {displayedSpecs.map((spec, i) => (
          <ButtonCard key={i} spec={spec} />
        ))}
      </div>
    </div>
  );
}

function ButtonCard({ spec }: { spec: ButtonCanonical }) {
  const [showDetails, setShowDetails] = useState(false);

  const bgColor = resolveTokenRef(spec.palette.bg);
  const fgColor = resolveTokenRef(spec.palette.fg);
  const radiusValue = resolveTokenRef(spec.radius);

  return (
    <ComponentCard>
      {/* Visual preview */}
      <div className="mb-4">
        <div
          className="inline-flex items-center justify-center px-6 py-3 font-medium transition-transform hover:scale-105"
          style={{
            backgroundColor: bgColor,
            color: fgColor,
            borderRadius: `${radiusValue}px`,
            fontSize: `${resolveTokenRef(spec.typography?.size || { source: 'raw', value: 16 })}px`,
            fontWeight: resolveTokenRef(spec.typography?.weight || { source: 'raw', value: 400 }),
          }}
        >
          {spec.typography?.textContent || 'Button Text'}
        </div>
      </div>

      {/* Metadata */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-gray-700">Variant</span>
          <TokenBadge variant={spec.variant} />
        </div>

        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-gray-700">Shape</span>
          <span className="text-sm text-gray-600 capitalize">{spec.shape}</span>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-gray-700">Contrast</span>
          <span className={`text-sm font-medium ${spec.constraints.minContrastAA ? 'text-green-600' : 'text-red-600'}`}>
            {spec.constraints.minContrastAA ? 'AA ✓' : 'Fail'}
            {spec.constraints.minContrastAAA && ' AAA ✓'}
          </span>
        </div>

        {spec.icon && (
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700">Icon</span>
            <span className="text-sm text-gray-600 capitalize">{spec.icon.position}</span>
          </div>
        )}
      </div>

      {/* Token references toggle */}
      <button
        onClick={() => setShowDetails(!showDetails)}
        className="mt-4 text-sm text-blue-600 hover:text-blue-700 font-medium"
      >
        {showDetails ? 'Hide' : 'Show'} token references
      </button>

      {showDetails && (
        <div className="mt-4 pt-4 border-t border-gray-200">
          <FeatureList
            features={[
              { label: 'Background', value: spec.palette.bg },
              { label: 'Foreground', value: spec.palette.fg },
              { label: 'Border Radius', value: spec.radius },
              { label: 'Font Size', value: spec.typography?.size },
              { label: 'Font Weight', value: spec.typography?.weight },
              { label: 'Padding X', value: spec.padding?.x },
              { label: 'Padding Y', value: spec.padding?.y },
            ]}
          />

          <details className="mt-4">
            <summary className="cursor-pointer text-xs text-gray-600 hover:text-gray-900">
              View full spec JSON
            </summary>
            <pre className="text-xs mt-2 bg-gray-50 p-3 rounded overflow-auto max-h-64">
              {JSON.stringify(spec, null, 2)}
            </pre>
          </details>
        </div>
      )}
    </ComponentCard>
  );
}
```

### 9.3 Shared Components

**File:** `app/vectors/[styleProfileId]/components/shared/ComponentCard.tsx`

```typescript
export function ComponentCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
      {children}
    </div>
  );
}
```

**File:** `app/vectors/[styleProfileId]/components/shared/TokenBadge.tsx`

```typescript
interface TokenBadgeProps {
  variant?: string;
  source?: 'token' | 'computed' | 'raw';
}

export function TokenBadge({ variant, source }: TokenBadgeProps) {
  const colors = {
    primary: 'bg-blue-100 text-blue-800',
    secondary: 'bg-purple-100 text-purple-800',
    tertiary: 'bg-gray-100 text-gray-800',
    ghost: 'bg-gray-50 text-gray-600',
    token: 'bg-green-100 text-green-800',
    computed: 'bg-yellow-100 text-yellow-800',
    raw: 'bg-red-100 text-red-800',
  };

  const label = variant || source || 'unknown';
  const colorClass = colors[label as keyof typeof colors] || colors.raw;

  return (
    <span className={`px-2 py-1 rounded text-xs font-medium ${colorClass}`}>
      {label}
    </span>
  );
}
```

**File:** `app/vectors/[styleProfileId]/components/shared/FeatureList.tsx`

```typescript
import type { TokenRef } from '@/pipeline/components/types';
import { TokenBadge } from './TokenBadge';

interface Feature {
  label: string;
  value?: TokenRef<any>;
}

interface FeatureListProps {
  features: Feature[];
}

export function FeatureList({ features }: FeatureListProps) {
  return (
    <dl className="space-y-2">
      {features.map((feature, i) => {
        if (!feature.value) return null;

        return (
          <div key={i} className="flex items-center justify-between text-xs">
            <dt className="text-gray-600">{feature.label}</dt>
            <dd className="flex items-center gap-2">
              <span className="font-mono">{String(feature.value.value)}</span>
              <TokenBadge source={feature.value.source} />
            </dd>
          </div>
        );
      })}
    </dl>
  );
}
```

---

## 10. Detailed Implementation Plan

### Phase 0: Foundation & Primary CTA Button (Week 1)

**Goal:** Refactor existing button code into Primary CTA Button canonical component

**Duration:** 5-7 days

**Prerequisites:**
- Current code is working (role_vectors_primarycta table exists)
- Test suite exists for buttons

**Key Decision:** Primary CTA and Secondary CTA are **separate canonical component types**, not variants

#### Day 1-2: Repository Reorganization

**Task 0.1: Create component directory structure**

```bash
# Create directory structure
mkdir -p pipeline/components/{button,input,card,hero,navbar}
mkdir -p pipeline/components/{button,input,card,hero,navbar}/__tests__
mkdir -p app/vectors/[styleProfileId]/components/shared
mkdir -p lib/db/migrations
```

**Acceptance Criteria:**
- [ ] All directories created
- [ ] Directory structure matches design document

**Task 0.2: Create shared type definitions**

Create `pipeline/components/types.ts`:

```typescript
// Export all shared types
export type ComponentType = 'button' | 'input' | 'card' | 'hero' | 'navbar';
export interface ComponentDefinition<TSpec = BaseCanonicalSpec> { /* ... */ }
export interface TokenRef<T = string | number> { /* ... */ }
export interface BaseCanonicalSpec { /* ... */ }
// ... (all interfaces from design doc)
```

**Acceptance Criteria:**
- [ ] All types compile without errors
- [ ] Types are exported correctly
- [ ] No circular dependencies

**Task 0.3: Create shared utilities**

Create `pipeline/components/utils.ts` with functions:
- `calculateContrast()`
- `isVisible()`
- `parseNumeric()`
- `matchToToken()`
- `hashNode()`
- `extractTypography()`
- `extractPadding()`
- `extractRadius()`
- `extractElevation()`
- `detectIcons()`

**Acceptance Criteria:**
- [ ] All utility functions implemented
- [ ] Unit tests for each utility (>80% coverage)
- [ ] No dependencies on old code

#### Day 3-4: Refactor Button Component

**Task 0.4: Create Primary CTA Button spec types**

Create `pipeline/components/primary-cta-button/spec.ts`:

```typescript
import type { BaseCanonicalSpec } from '../types';

export interface PrimaryCtaButtonCanonical extends BaseCanonicalSpec {
  type: 'primary-cta-button';
  shape: 'rectangle' | 'rounded' | 'pill' | 'circle' | 'square';
  // ... (all fields from design doc Section 4.1.1)
}
```

**Acceptance Criteria:**
- [ ] Types compile
- [ ] All fields documented
- [ ] Extends BaseCanonicalSpec correctly
- [ ] Type is 'primary-cta-button' (not 'button')

**Task 0.5: Extract Primary CTA Button extractor**

Move button extraction logic from `pipeline/tokens/index.ts` to `pipeline/components/primary-cta-button/extractor.ts`:

```typescript
export function extractPrimaryCtaButtons(
  nodes: ComputedStyleNode[],
  tokens: DesignTokens,
  context: ExtractionContext
): ExtractionResult<PrimaryCtaButtonCanonical> {
  // ... implementation from design doc
  // Filter for PRIMARY CTAs only (high prominence, solid fill, etc.)
}
```

**Steps:**
1. Copy `analyzeButtonVariant()` logic from tokens/index.ts
2. Refactor to use new interfaces
3. **Add primary CTA filtering** (high prominence, AAA contrast, etc.)
4. Add instrumentation (timing, warnings)
5. Write unit tests

**Acceptance Criteria:**
- [ ] Extracts PRIMARY CTA buttons only (not all buttons)
- [ ] Returns ExtractionResult with metadata
- [ ] Filters out secondary/tertiary buttons
- [ ] Unit tests pass (>80% coverage)
- [ ] Performance: <200ms for 100 nodes

**Task 0.6: Move Primary CTA Button classifier**

Move `pipeline/tokens/button-classifier.ts` → `pipeline/components/primary-cta-button/classifier.ts`:

```typescript
export async function classifyPrimaryCtaButtons(
  specs: PrimaryCtaButtonCanonical[],
  context: ClassificationContext
): Promise<ClassificationResult<PrimaryCtaButtonCanonical>> {
  // ... existing logic
  // Now only classifies PRIMARY CTAs (already filtered by extractor)
}
```

**Steps:**
1. Move file
2. Update imports
3. Refactor to use new interfaces
4. Add retry logic for LLM calls
5. Write unit tests (with mocked LLM)

**Acceptance Criteria:**
- [ ] Classifies same as old code
- [ ] Returns ClassificationResult with metadata
- [ ] Unit tests pass (mocked LLM)
- [ ] Integration test with real LLM

**Task 0.7: Move Primary CTA Button vectorizer**

Move `pipeline/vectors/primary-cta-vec.ts` → `pipeline/components/primary-cta-button/vectorizer.ts`:

```typescript
export function vectorizePrimaryCtaButton(
  spec: PrimaryCtaButtonCanonical,
  tokens: DesignTokens,
  report: StyleReport,
  context: VectorizationContext
): VectorizationResult {
  // ... existing logic (same 26D vector)
}
```

**Steps:**
1. Move logic from primary-cta-vec.ts
2. Refactor to use new interfaces
3. Add instrumentation
4. Write unit tests

**Acceptance Criteria:**
- [ ] Generates same 26D vectors as old code
- [ ] Returns VectorizationResult with metadata
- [ ] Unit tests pass
- [ ] Vectors are L2-normalized

**Task 0.8: Create Primary CTA Button component definition**

Create `pipeline/components/primary-cta-button/index.ts`:

```typescript
export const primaryCtaButtonComponent: ComponentDefinition = {
  type: 'primary-cta-button',
  enabled: true,
  version: '1.0.0',
  extractor: extractPrimaryCtaButtons,
  classifier: classifyPrimaryCtaButtons,
  vectorizer: vectorizePrimaryCtaButton,
  storage: {
    tableName: 'role_vectors_primary_cta_button',
    vectorDimension: 26,
    // ... schema
  },
  display: {
    renderer: PrimaryCtaButtonDisplay,
    tabLabel: 'Primary CTAs',
    icon: FiTarget,
    sortOrder: 1,
  },
  metadata: {
    featureDimensions: 26,
    averageExtractionsPerPage: 2,  // Typically 1-3 primary CTAs per page
    estimatedProcessingTimeMs: 1500,
  },
};
```

**Acceptance Criteria:**
- [ ] Exports complete ComponentDefinition
- [ ] Type is 'primary-cta-button'
- [ ] Table name is 'role_vectors_primary_cta_button'
- [ ] All fields populated correctly
- [ ] TypeScript compiles

#### Day 5: Create Component Registry

**Task 0.9: Implement component registry**

Create `pipeline/components/registry.ts`:

```typescript
import { primaryCtaButtonComponent } from './primary-cta-button';

export const COMPONENT_REGISTRY = {
  'primary-cta-button': primaryCtaButtonComponent,
  // Placeholders for future components
  'secondary-cta-button': null as any,  // Phase 1
  'input': null as any,                  // Phase 2
  'card': null as any,                   // Phase 3
  'hero': null as any,                   // Phase 4
  'navbar': null as any,                 // Phase 5
};

export const ENABLED_COMPONENTS: ComponentType[] = ['primary-cta-button'];

export function getEnabledComponents() { /* ... */ }
export function isComponentEnabled(type) { /* ... */ }
export function getComponent(type) { /* ... */ }
export function getComponentMetadata() { /* ... */ }
```

**Acceptance Criteria:**
- [ ] Registry exports all functions
- [ ] getEnabledComponents() returns [primaryCtaButtonComponent]
- [ ] Component type is 'primary-cta-button'
- [ ] Unit tests pass

**Task 0.10: Refactor storage pipeline**

Update `pipeline/storage/index.ts` to use registry:

```typescript
import { getEnabledComponents } from '../components/registry';

export async function storeVectors(runId: string): Promise<StorageResult> {
  const enabledComponents = getEnabledComponents();

  for (const component of enabledComponents) {
    // Extract, classify, vectorize, store
  }
}
```

Create `pipeline/storage/component-storage.ts`:

```typescript
export async function storeComponentVectors(
  tableName: string,
  styleProfileId: string,
  vectors: ComponentVector[],
  componentType: ComponentType
): Promise<void> {
  // Generic storage logic
}
```

**Acceptance Criteria:**
- [ ] storeVectors() processes all enabled components
- [ ] Returns StorageResult with stats
- [ ] Integration test passes (end-to-end)

#### Day 6: Database Migration

**Task 0.11: Create database schema**

Drop old table and create new clean schema:

**File:** `lib/db/migrations/012_create_primary_cta_button_table.sql`

```sql
-- Clean slate: Drop old table
DROP TABLE IF EXISTS role_vectors_primarycta CASCADE;

-- Create new primary CTA button table
CREATE TABLE role_vectors_primary_cta_button (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  style_profile_id UUID NOT NULL REFERENCES style_profiles(id) ON DELETE CASCADE,

  vec VECTOR(26) NOT NULL,
  spec_json JSONB NOT NULL,

  variant TEXT,
  ux_report JSONB,
  confidence REAL CHECK (confidence >= 0 AND confidence <= 1),

  representative_node_id TEXT NOT NULL,
  cluster_id TEXT,

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  UNIQUE(style_profile_id, representative_node_id)
);

-- Indexes
CREATE INDEX idx_primary_cta_button_profile ON role_vectors_primary_cta_button(style_profile_id);
CREATE INDEX idx_primary_cta_button_variant ON role_vectors_primary_cta_button(variant) WHERE variant IS NOT NULL;
CREATE INDEX idx_primary_cta_button_created ON role_vectors_primary_cta_button(created_at DESC);
CREATE INDEX idx_primary_cta_button_vec ON role_vectors_primary_cta_button USING ivfflat (vec vector_cosine_ops) WITH (lists = 100);

-- Trigger for updated_at
CREATE TRIGGER update_primary_cta_button_updated_at
  BEFORE UPDATE ON role_vectors_primary_cta_button
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
```

**Steps:**
1. Run migration: `psql $DATABASE_URL < lib/db/migrations/012_create_primary_cta_button_table.sql`
2. Verify table exists: `\d role_vectors_primary_cta_button`
3. Verify indexes: `\di role_vectors_primary_cta_button*`

**Acceptance Criteria:**
- [ ] Table created successfully
- [ ] All indexes exist
- [ ] Trigger works (test UPDATE query)

#### Day 7: Frontend Refactoring & Integration Testing

**Task 0.12: Update API endpoint**

Rename `app/api/vectors/nearest-ctas/route.ts` → `app/api/vectors/nearest/primary-cta-buttons/route.ts`:

```typescript
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const vectorId = searchParams.get('vectorId');
  const limit = parseInt(searchParams.get('limit') || '10');

  // Query role_vectors_primary_cta_button instead of role_vectors_primarycta
  const results = await db.query(`
    SELECT *, vec <=> (SELECT vec FROM role_vectors_primary_cta_button WHERE id = $1) as distance
    FROM role_vectors_primary_cta_button
    WHERE id != $1
    ORDER BY distance
    LIMIT $2
  `, [vectorId, limit]);

  return Response.json(results.rows);
}
```

**Acceptance Criteria:**
- [ ] API endpoint returns results
- [ ] Similarity scores are correct
- [ ] Performance: <200ms per query

**Task 0.13: Update frontend display**

Update `app/vectors/[styleProfileId]/page.tsx` to use registry:

```typescript
import { COMPONENT_REGISTRY, ENABLED_COMPONENTS } from '@/pipeline/components/registry';

// Generate tabs from registry
const componentTabs = ENABLED_COMPONENTS.map(type => ({
  id: type,
  label: COMPONENT_REGISTRY[type].display.tabLabel,
  Component: COMPONENT_REGISTRY[type].display.renderer,
}));
```

Create `app/vectors/[styleProfileId]/components/PrimaryCtaButtonDisplay.tsx` (new modular component)

**Acceptance Criteria:**
- [ ] Frontend renders "Primary CTAs" tab
- [ ] Primary CTA buttons display correctly
- [ ] Token references visible
- [ ] Tab label reads "Primary CTAs" not "Buttons"
- [ ] No errors in console

**Task 0.14: End-to-end integration test**

Run full pipeline and verify:

```bash
# 1. Capture a test site
npm run capture -- https://stripe.com

# 2. Extract tokens
npm run tokens -- artifacts/<runId>

# 3. Build vectors
npm run vectors -- artifacts/<runId>

# 4. Store vectors
npm run storage -- artifacts/<runId>

# 5. Verify database
psql $DATABASE_URL -c "SELECT COUNT(*) FROM role_vectors_primary_cta_button;"

# 6. Test API
curl http://localhost:3000/api/vectors/<styleProfileId>

# 7. Test frontend
open http://localhost:3000/vectors/<styleProfileId>
```

**Acceptance Criteria:**
- [ ] All steps complete successfully
- [ ] Database has PRIMARY CTA button vectors
- [ ] API returns data
- [ ] Frontend displays PRIMARY CTA buttons in dedicated tab
- [ ] No regressions vs old code

### Phase 1: Secondary CTA Button (Week 2)

**Goal:** Add Secondary CTA Button as separate canonical component type to validate architecture

**Duration:** 5-7 days

**Prerequisites:**
- Phase 0 complete
- Primary CTA Button component working

**Key Point:** This validates that the architecture supports multiple related component types

#### Day 1: Spec & Extractor

**Task 1.1: Define Secondary CTA Button spec**

Create `pipeline/components/secondary-cta-button/spec.ts`:

```typescript
export interface SecondaryCtaButtonCanonical extends BaseCanonicalSpec {
  type: 'secondary-cta-button';
  // ... (all fields from design doc Section 4.1.2)
}
```

**Time estimate:** 2 hours

**Acceptance Criteria:**
- [ ] Types compile
- [ ] Type is 'secondary-cta-button'
- [ ] Has different constraints than Primary CTA (AA vs AAA contrast)
- [ ] Extends BaseCanonicalSpec

**Task 1.2: Implement Secondary CTA Button extractor**

Create `pipeline/components/secondary-cta-button/extractor.ts`:

```typescript
export function extractSecondaryCtaButtons(
  nodes: ComputedStyleNode[],
  tokens: DesignTokens,
  context: ExtractionContext
): ExtractionResult<SecondaryCtaButtonCanonical> {
  const startTime = Date.now();

  // Find button candidates
  const candidates = nodes.filter(isButtonLike);

  // Filter for SECONDARY CTAs (outline, ghost, lower prominence)
  const secondaryButtons = candidates.filter(node => {
    // Has outline or ghost styling
    const hasOutline = parseNumeric(node.styles.borderWidth, 0) > 0;
    const hasTransparentBg = node.styles.backgroundColor === 'transparent';
    const hasSubduedfill = /* ... */;

    // Lower prominence than primary
    const prominence = calculateProminence(node);

    return (hasOutline || hasTransparentBg || hasSubduedFill) && prominence < 0.7;
  });

  // ... extract specs
}
```

**Time estimate:** 1 day

**Acceptance Criteria:**
- [ ] Extracts SECONDARY CTA buttons only
- [ ] Filters out primary CTAs
- [ ] Filters out tertiary/ghost buttons
- [ ] Unit tests pass (>80% coverage)
- [ ] Test on stripe.com, github.com

#### Day 2-5: Classifier, Vectorizer, Database, Frontend

Follow same pattern as Phase 0 but for Secondary CTA Button:

**Task 1.3:** Create classifier (if needed - may not need LLM)
**Task 1.4:** Create vectorizer (26D, same as primary)
**Task 1.5:** Create database table `role_vectors_secondary_cta_button`
**Task 1.6:** Create component definition
**Task 1.7:** Update registry to include 'secondary-cta-button'
**Task 1.8:** Create `SecondaryCtaButtonDisplay.tsx` frontend component
**Task 1.9:** Create API endpoint `/api/vectors/nearest/secondary-cta-buttons`
**Task 1.10:** Integration testing

**Success Criteria:**
- [ ] Secondary CTA buttons extracted correctly
- [ ] Separate from Primary CTAs in database
- [ ] Frontend has "Primary CTAs" and "Secondary CTAs" tabs
- [ ] Can search for similar secondary CTAs independently
- [ ] Architecture validated (2 related component types working)

### Phase 2: Input Component (Week 3)

**Goal:** Add input component (first non-button canonical type)

**Duration:** 5-7 days

**Prerequisites:**
- Phase 0 complete (Primary CTA)
- Phase 1 complete (Secondary CTA)
- Architecture validated with 2 component types

#### Day 1: Spec & Extractor

**Task 2.1: Define input spec**

Create `pipeline/components/input/spec.ts`:

```typescript
export interface InputCanonical extends BaseCanonicalSpec {
  type: 'input';
  variant: 'text' | 'email' | 'password' | 'search' | 'tel' | 'url' | 'number' | 'date' | 'time' | 'textarea' | 'select';
  style: 'outlined' | 'filled' | 'underlined' | 'borderless';
  size: 'small' | 'medium' | 'large';
  // ... (all fields from design doc)
}
```

**Time estimate:** 2 hours

**Acceptance Criteria:**
- [ ] Types compile
- [ ] All fields documented
- [ ] Extends BaseCanonicalSpec

**Task 1.2: Implement input extractor**

Create `pipeline/components/input/extractor.ts`:

```typescript
export function extractInputs(
  nodes: ComputedStyleNode[],
  tokens: DesignTokens,
  context: ExtractionContext
): ExtractionResult<InputCanonical> {
  const startTime = Date.now();

  // Find input candidates
  const candidates = nodes.filter(isInputLike);

  // Extract specs
  const specs = candidates.map(node => ({
    type: 'input',
    variant: inferInputType(node),
    style: inferInputStyle(node),
    size: inferInputSize(node),
    label: extractLabel(node),
    placeholder: extractPlaceholder(node),
    // ... (all fields)
  }));

  return { specs, metadata: { /* ... */ } };
}

function isInputLike(node: ComputedStyleNode): boolean {
  return (
    node.tagName === 'input' ||
    node.tagName === 'textarea' ||
    node.tagName === 'select' ||
    node.attributes?.role === 'textbox' ||
    node.attributes?.role === 'combobox'
  );
}

function inferInputType(node: ComputedStyleNode): InputCanonical['variant'] {
  if (node.tagName === 'textarea') return 'textarea';
  if (node.tagName === 'select') return 'select';

  const type = node.attributes?.type || 'text';
  const validTypes = ['text', 'email', 'password', 'search', 'tel', 'url', 'number', 'date', 'time'];

  return validTypes.includes(type) ? type as InputCanonical['variant'] : 'text';
}

function inferInputStyle(node: ComputedStyleNode): InputCanonical['style'] {
  const borderWidth = parseNumeric(node.styles.borderWidth, 0);
  const bgColor = node.styles.backgroundColor;

  if (borderWidth === 0 && bgColor === 'transparent') return 'borderless';
  if (borderWidth === 0 && bgColor !== 'transparent') return 'filled';
  if (borderWidth > 0) return 'outlined';

  // Check for underline (bottom border only)
  const borderBottom = parseNumeric(node.styles.borderBottomWidth, 0);
  if (borderBottom > 0 && borderWidth === 0) return 'underlined';

  return 'outlined';
}
```

**Time estimate:** 1 day

**Acceptance Criteria:**
- [ ] Extracts inputs from test sites
- [ ] Correctly identifies input types
- [ ] Correctly identifies input styles
- [ ] Unit tests pass (>80% coverage)
- [ ] Test on airbnb.com, booking.com

#### Day 2: Classifier & Vectorizer

**Task 1.3: Implement input classifier**

Create `pipeline/components/input/classifier.ts`:

```typescript
export async function classifyInputs(
  specs: InputCanonical[],
  context: ClassificationContext
): Promise<ClassificationResult<InputCanonical>> {
  // Group by variant (already extracted, just organize)
  const variants = specs.reduce((acc, spec) => {
    const variant = spec.variant;
    if (!acc[variant]) acc[variant] = [];
    acc[variant].push(spec);
    return acc;
  }, {} as Record<string, InputCanonical[]>);

  return {
    variants,
    metadata: {
      classificationTimeMs: 0,
      llmCalls: 0,
      confidenceScores: {},
      fallbackUsed: false,
    },
  };
}
```

**Time estimate:** 2 hours

**Task 1.4: Implement input vectorizer**

Create `pipeline/components/input/vectorizer.ts`:

```typescript
export function vectorizeInput(
  spec: InputCanonical,
  tokens: DesignTokens,
  report: StyleReport,
  context: VectorizationContext
): VectorizationResult {
  const interpretable: number[] = [];
  const featureNames: string[] = [];

  // === 12D Colors (default + focus + error states) ===
  const defaultBg = hexToLCH(resolveTokenRef(spec.states.default.palette.bg));
  interpretable.push(defaultBg.l / 100, defaultBg.c / 150, defaultBg.h / 360);
  featureNames.push('default_bg_l', 'default_bg_c', 'default_bg_h');

  const defaultFg = hexToLCH(resolveTokenRef(spec.states.default.palette.fg));
  interpretable.push(defaultFg.l / 100, defaultFg.c / 150, defaultFg.h / 360);
  featureNames.push('default_fg_l', 'default_fg_c', 'default_fg_h');

  // Focus state colors
  const focusBorder = hexToLCH(resolveTokenRef(spec.states.focus.palette.border || spec.states.default.palette.border));
  interpretable.push(focusBorder.l / 100, focusBorder.c / 150, focusBorder.h / 360);
  featureNames.push('focus_border_l', 'focus_border_c', 'focus_border_h');

  // Error state colors (if present)
  if (spec.states.error) {
    const errorBorder = hexToLCH(resolveTokenRef(spec.states.error.palette.border));
    interpretable.push(errorBorder.l / 100, errorBorder.c / 150, errorBorder.h / 360);
    featureNames.push('error_border_l', 'error_border_c', 'error_border_h');
  } else {
    interpretable.push(0, 0, 0);
    featureNames.push('error_border_l', 'error_border_c', 'error_border_h');
  }

  // === 4D Typography ===
  const fontSize = normalizeFeature(resolveTokenRef(spec.typography.size), 'input_font_size');
  const fontWeight = normalizeFeature(resolveTokenRef(spec.typography.weight), 'input_font_weight');
  const lineHeight = normalizeFeature(parseNumeric(String(resolveTokenRef(spec.typography.lineHeight)), 1.5), 'line_height');
  interpretable.push(fontSize, fontWeight, lineHeight, 0);
  featureNames.push('font_size', 'font_weight', 'line_height', 'reserved');

  // === 8D Shape ===
  const radius = normalizeFeature(resolveTokenRef(spec.radius), 'input_border_radius');
  const borderWidthDefault = normalizeFeature(resolveTokenRef(spec.states.default.borderWidth), 'border_width');
  const borderWidthFocus = normalizeFeature(resolveTokenRef(spec.states.focus.borderWidth), 'border_width');
  const paddingX = normalizeFeature(resolveTokenRef(spec.padding.x), 'padding');
  const paddingY = normalizeFeature(resolveTokenRef(spec.padding.y), 'padding');
  const height = normalizeFeature(resolveTokenRef(spec.dimensions.height), 'input_height');
  interpretable.push(radius, borderWidthDefault, borderWidthFocus, paddingX, paddingY, height, 0, 0);
  featureNames.push('radius', 'border_default', 'border_focus', 'padding_x', 'padding_y', 'height', 'reserved1', 'reserved2');

  // === 4D Adornments ===
  interpretable.push(
    spec.features.hasLabel ? 1 : 0,
    spec.features.hasPlaceholder ? 1 : 0,
    spec.features.hasStartAdornment ? 1 : 0,
    spec.features.hasEndAdornment ? 1 : 0
  );
  featureNames.push('has_label', 'has_placeholder', 'has_start', 'has_end');

  // === 4D UX ===
  const contrast = calculateContrast(resolveTokenRef(spec.states.default.palette.bg), resolveTokenRef(spec.states.default.palette.fg));
  interpretable.push(
    contrast / 21,  // Normalize to 0-1
    spec.constraints.hasAccessibleLabel ? 1 : 0,
    spec.constraints.required ? 1 : 0,
    0
  );
  featureNames.push('contrast', 'accessible_label', 'required', 'reserved');

  // Total: 32D
  const combined = l2Normalize(interpretable);

  return {
    interpretable: Float32Array.from(interpretable),
    combined: Float32Array.from(combined),
    metadata: {
      featureNames,
      nonZeroCount: interpretable.filter(x => x !== 0).length,
      normalizationApplied: true,
      vectorizationTimeMs: Date.now() - startTime,
    },
  };
}
```

**Time estimate:** 1 day

**Acceptance Criteria:**
- [ ] Generates 32D vectors
- [ ] Vectors are L2-normalized
- [ ] Feature names documented
- [ ] Unit tests pass

#### Day 3: Database & Storage

**Task 1.5: Create input table**

**File:** `lib/db/migrations/013_create_input_table.sql`

```sql
CREATE TABLE role_vectors_input (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  style_profile_id UUID NOT NULL REFERENCES style_profiles(id) ON DELETE CASCADE,

  vec VECTOR(32) NOT NULL,
  spec_json JSONB NOT NULL,

  variant TEXT,
  style TEXT,
  size TEXT,

  ux_report JSONB,
  confidence REAL CHECK (confidence >= 0 AND confidence <= 1),

  representative_node_id TEXT NOT NULL,
  cluster_id TEXT,

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  UNIQUE(style_profile_id, representative_node_id)
);

-- Indexes
CREATE INDEX idx_input_profile ON role_vectors_input(style_profile_id);
CREATE INDEX idx_input_variant ON role_vectors_input(variant) WHERE variant IS NOT NULL;
CREATE INDEX idx_input_style ON role_vectors_input(style) WHERE style IS NOT NULL;
CREATE INDEX idx_input_created ON role_vectors_input(created_at DESC);
CREATE INDEX idx_input_vec ON role_vectors_input USING ivfflat (vec vector_cosine_ops) WITH (lists = 100);

-- Trigger
CREATE TRIGGER update_input_updated_at
  BEFORE UPDATE ON role_vectors_input
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
```

**Time estimate:** 1 hour

**Acceptance Criteria:**
- [ ] Table created
- [ ] Indexes exist
- [ ] Trigger works

#### Day 4-5: Component Definition & Frontend

**Task 1.6: Create input component definition**

Create `pipeline/components/input/index.ts`:

```typescript
export const inputComponent: ComponentDefinition = {
  type: 'input',
  enabled: false,  // Will enable after testing
  version: '1.0.0',
  extractor: extractInputs,
  classifier: classifyInputs,
  vectorizer: vectorizeInput,
  storage: {
    tableName: 'role_vectors_input',
    vectorDimension: 32,
    schema: { /* ... */ },
    indexes: [ /* ... */ ],
    constraints: [ /* ... */ ],
  },
  display: {
    renderer: InputDisplay,
    tabLabel: 'Inputs',
    icon: FiEdit,
    sortOrder: 2,
  },
  metadata: {
    featureDimensions: 32,
    averageExtractionsPerPage: 5,
    estimatedProcessingTimeMs: 1200,
  },
};
```

**Time estimate:** 1 hour

**Task 1.7: Update registry**

Update `pipeline/components/registry.ts`:

```typescript
import { inputComponent } from './input';

export const COMPONENT_REGISTRY = {
  button: buttonComponent,
  input: inputComponent,  // Added
  card: null as any,
  hero: null as any,
  navbar: null as any,
};

export const ENABLED_COMPONENTS: ComponentType[] = [
  'button',
  'input',  // Enable input
];
```

**Time estimate:** 5 minutes

**Task 1.8: Create input display component**

Create `app/vectors/[styleProfileId]/components/InputDisplay.tsx`:

```typescript
export function InputDisplay({ specs }: { specs: InputCanonical[] }) {
  // Similar to ButtonDisplay but for inputs
  // Group by variant (text, email, password, etc.)
  // Render visual previews
  // Show token references
}
```

**Time estimate:** 1 day

**Acceptance Criteria:**
- [ ] Frontend renders input tab
- [ ] Inputs display correctly
- [ ] Grouped by variant
- [ ] Token references visible

**Task 1.9: Create API endpoint**

Create `app/api/vectors/nearest/inputs/route.ts`:

```typescript
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const vectorId = searchParams.get('vectorId');
  const limit = parseInt(searchParams.get('limit') || '10');

  const results = await db.query(`
    SELECT *, vec <=> (SELECT vec FROM role_vectors_input WHERE id = $1) as distance
    FROM role_vectors_input
    WHERE id != $1
    ORDER BY distance
    LIMIT $2
  `, [vectorId, limit]);

  return Response.json(results.rows);
}
```

**Time estimate:** 1 hour

**Task 1.10: Integration testing**

Test end-to-end:

1. Capture test sites (airbnb.com, booking.com)
2. Run full pipeline
3. Verify inputs extracted
4. Verify vectors stored
5. Test API
6. Test frontend

**Time estimate:** 1 day

**Acceptance Criteria:**
- [ ] Inputs extracted correctly
- [ ] Vectors stored in database
- [ ] API returns results
- [ ] Frontend displays inputs
- [ ] Similarity search works

### Phase 2-4: Card, Hero, NavBar (Weeks 3-5)

**Each component follows same pattern as Phase 1:**

1. Define spec types (1 day)
2. Implement extractor (1-2 days)
3. Implement classifier (1 day)
4. Implement vectorizer (1 day)
5. Create database table (0.5 day)
6. Create component definition (0.5 day)
7. Update registry (0.1 day)
8. Create frontend display (1-2 days)
9. Create API endpoint (0.5 day)
10. Integration testing (1 day)

**Total per component: 7-10 days**

### Phase 5: System-Wide Enhancements (Week 6)

**Goal:** Cross-component features and optimizations

**Tasks:**
1. Component composition analysis (detect buttons in heroes/navbars)
2. Variant clustering across components
3. Quality scoring system
4. Bulk similarity search
5. Performance optimization
6. Documentation

---

## 11. Testing & Validation Strategy

### 11.1 Unit Test Pattern

**For each component module:**

```typescript
// Example: button/extractor.test.ts
describe('button extractor', () => {
  describe('isButtonLike', () => {
    it('should detect <button> elements', () => {
      const node = { tagName: 'button' };
      expect(isButtonLike(node)).toBe(true);
    });

    it('should detect links with href', () => {
      const node = { tagName: 'a', attributes: { href: '#' } };
      expect(isButtonLike(node)).toBe(true);
    });

    it('should detect role="button"', () => {
      const node = { tagName: 'div', attributes: { role: 'button' } };
      expect(isButtonLike(node)).toBe(true);
    });

    it('should reject non-button elements', () => {
      const node = { tagName: 'div' };
      expect(isButtonLike(node)).toBe(false);
    });
  });

  describe('extractButtons', () => {
    it('should extract buttons from DOM nodes', () => {
      const nodes = [
        { tagName: 'button', styles: mockStyles, boundingBox: { width: 100, height: 40 } },
        { tagName: 'a', attributes: { href: '#' }, styles: mockStyles, boundingBox: { width: 80, height: 36 } },
      ];

      const result = extractButtons(nodes, mockTokens, mockContext);

      expect(result.specs).toHaveLength(2);
      expect(result.specs[0].type).toBe('button');
    });

    it('should filter out invisible buttons', () => {
      const nodes = [
        { tagName: 'button', styles: { display: 'none' } },
      ];

      const result = extractButtons(nodes, mockTokens, mockContext);

      expect(result.specs).toHaveLength(0);
      expect(result.metadata.warnings).toContain(/* ... */);
    });

    it('should map to token references', () => {
      const nodes = [{ tagName: 'button', styles: { borderRadius: '8px' } }];
      const tokens = { shape: { radius: [{ id: 'radius.md', value: 8 }] } };

      const result = extractButtons(nodes, tokens, mockContext);

      expect(result.specs[0].radius.source).toBe('token');
      expect(result.specs[0].radius.tokenId).toBe('radius.md');
    });
  });
});
```

**Test coverage target: >80% per module**

### 11.2 Integration Test Pattern

```typescript
// Example: integration/button-pipeline.test.ts
describe('button pipeline integration', () => {
  it('should extract, classify, vectorize, and store buttons', async () => {
    // Setup
    const runId = await captureTestSite('https://stripe.com');

    // Extract tokens
    const tokens = await extractTokens(runId);
    expect(tokens).toBeDefined();

    // Build vectors
    const vectors = await buildVectors(runId);
    expect(vectors.components.button).toBeDefined();
    expect(vectors.components.button.length).toBeGreaterThan(0);

    // Store vectors
    const storageResult = await storeVectors(runId);
    expect(storageResult.componentStats.button.count).toBeGreaterThan(0);

    // Query database
    const dbResults = await db.query('SELECT COUNT(*) FROM role_vectors_button WHERE style_profile_id = $1', [styleProfileId]);
    expect(parseInt(dbResults.rows[0].count)).toBeGreaterThan(0);

    // Test API
    const apiResponse = await fetch(`http://localhost:3000/api/vectors/${styleProfileId}`);
    const apiData = await apiResponse.json();
    expect(apiData.components.button).toBeDefined();
  });
});
```

### 11.3 Validation Sites

**Curated test sites for each component:**

| Component | Test Sites | Expected Extractions | Notes |
|-----------|------------|----------------------|-------|
| Button | stripe.com | 8-12 buttons | Primary/secondary CTAs, ghost buttons |
| Button | github.com | 10-15 buttons | Various states, pill shapes |
| Button | vercel.com | 6-10 buttons | Modern design, high contrast |
| Input | airbnb.com | 5-8 inputs | Search bar, date picker, dropdown |
| Input | booking.com | 8-12 inputs | Complex forms, multi-step |
| Card | pinterest.com | 20-30 cards | Image-heavy, grid layout |
| Card | amazon.com | 15-25 cards | Product cards, various styles |
| Hero | apple.com | 1-2 heroes | Full-width, media background |
| Hero | tesla.com | 1-3 heroes | Video background, text overlay |
| NavBar | All sites | 1 navbar | Universal component |

**Validation script:**

```bash
#!/bin/bash
# scripts/validate-components.sh

SITES=(
  "https://stripe.com"
  "https://github.com"
  "https://vercel.com"
  "https://airbnb.com"
  "https://booking.com"
)

for SITE in "${SITES[@]}"; do
  echo "Testing $SITE..."

  # Run full pipeline
  npm run generate -- --url "$SITE"

  # Check results
  RUN_ID=$(ls -t artifacts | head -1)

  # Validate buttons
  BUTTON_COUNT=$(psql $DATABASE_URL -t -c "SELECT COUNT(*) FROM role_vectors_button WHERE style_profile_id = (SELECT id FROM style_profiles WHERE source_url = '$SITE')")
  echo "  Buttons: $BUTTON_COUNT"

  # Validate inputs
  INPUT_COUNT=$(psql $DATABASE_URL -t -c "SELECT COUNT(*) FROM role_vectors_input WHERE style_profile_id = (SELECT id FROM style_profiles WHERE source_url = '$SITE')")
  echo "  Inputs: $INPUT_COUNT"

  # ... other components
done
```

### 11.4 Quality Metrics

**Track these metrics:**

```typescript
interface QualityMetrics {
  extraction: {
    recall: number;        // % of actual components detected
    precision: number;     // % of detected components that are correct
    f1Score: number;       // Harmonic mean of precision/recall
  };
  classification: {
    accuracy: number;      // % correctly classified variants
    confusionMatrix: number[][];  // Actual vs predicted
  };
  tokenMapping: {
    rate: number;          // % of values mapped to tokens (vs raw)
    confidence: number;    // Average confidence score
  };
  vectorQuality: {
    similarity: number;    // Cosine similarity for known duplicates
    dimensionality: number;  // Effective dimensionality (non-zero features)
  };
  performance: {
    extractionTimeMs: number;
    classificationTimeMs: number;
    vectorizationTimeMs: number;
    storageTimeMs: number;
    totalTimeMs: number;
  };
}
```

**Benchmark targets:**

| Metric | Target | Baseline | Notes |
|--------|--------|----------|-------|
| Extraction recall | >70% | - | % of ground truth components found |
| Extraction precision | >80% | - | % of detections that are correct |
| Classification accuracy | >85% | 90% | With LLM classifier |
| Token mapping rate | >60% | 40% | Increase over time as token library grows |
| Vector similarity (duplicates) | >0.9 | 0.95 | Same button should have >0.9 similarity |
| Pipeline time (per site) | <20s | 15s | For all 5 components |

---

## 12. Migration Path & Rollback

### 12.1 Clean Slate Approach

Since we don't need to preserve data, we can use a clean slate approach:

**Migration script:**

```bash
#!/bin/bash
# scripts/migrate-to-component-system.sh

echo "🚀 Migrating to canonical component system..."

# Step 1: Drop old tables
echo "🗑️  Dropping old tables..."
psql $DATABASE_URL <<SQL
DROP TABLE IF EXISTS role_vectors_primarycta CASCADE;
DROP VIEW IF EXISTS role_vectors_primarycta CASCADE;
SQL

# Step 2: Run all migrations
echo "📝 Running migrations..."
for MIGRATION in lib/db/migrations/012_*.sql; do
  echo "  Running $MIGRATION..."
  psql $DATABASE_URL < "$MIGRATION"
done

# Step 3: Verify schema
echo "✅ Verifying schema..."
psql $DATABASE_URL <<SQL
\d role_vectors_button
\d role_vectors_input
\d role_vectors_card
\d role_vectors_hero
\d role_vectors_navbar
SQL

echo "✅ Migration complete!"
```

### 12.2 Quick Reset (If Needed)

**If you need to start fresh:**

```bash
#!/bin/bash
# scripts/reset-component-tables.sh

echo "🔄 Resetting component tables..."

# Drop all component tables
psql $DATABASE_URL <<SQL
DROP TABLE IF EXISTS role_vectors_button CASCADE;
DROP TABLE IF EXISTS role_vectors_input CASCADE;
DROP TABLE IF EXISTS role_vectors_card CASCADE;
DROP TABLE IF EXISTS role_vectors_hero CASCADE;
DROP TABLE IF EXISTS role_vectors_navbar CASCADE;
SQL

echo "✅ Tables dropped. Run migrate-to-component-system.sh to recreate."
```

---

## 13. Performance & Monitoring

### 13.1 Performance Budgets

**Per-component processing time budgets:**

| Component | Extraction | Classification | Vectorization | Storage | Total |
|-----------|------------|----------------|---------------|---------|-------|
| Button | <500ms | <1000ms | <200ms | <500ms | <2200ms |
| Input | <400ms | <800ms | <250ms | <400ms | <1850ms |
| Card | <600ms | <1200ms | <300ms | <600ms | <2700ms |
| Hero | <400ms | <1000ms | <350ms | <400ms | <2150ms |
| NavBar | <300ms | <800ms | <200ms | <300ms | <1600ms |
| **Total** | **<2200ms** | **<4800ms** | **<1300ms** | **<2200ms** | **<10500ms** |

**Target: <20s total for all components**

### 13.2 Instrumentation

**Add performance tracking to each component:**

```typescript
// In each extractor/classifier/vectorizer
export function extractButtons(...) {
  const startTime = performance.now();

  try {
    // ... extraction logic

    return {
      specs,
      metadata: {
        extractionTimeMs: performance.now() - startTime,
        // ... other metadata
      },
    };
  } catch (error) {
    console.error(`Button extraction failed after ${performance.now() - startTime}ms:`, error);
    throw error;
  }
}
```

**Aggregate metrics in storage:**

```typescript
export async function storeVectors(runId: string): Promise<StorageResult> {
  const metrics = {
    componentTimings: {},
    totalTime: 0,
  };

  for (const component of enabledComponents) {
    const componentStart = performance.now();

    // ... process component

    const componentTime = performance.now() - componentStart;
    metrics.componentTimings[component.type] = {
      total: componentTime,
      extraction: extractionResult.metadata.extractionTimeMs,
      classification: classificationResult?.metadata.classificationTimeMs || 0,
      vectorization: /* ... */,
      storage: /* ... */,
    };
  }

  // Log metrics
  console.log('⏱️  Performance metrics:', JSON.stringify(metrics, null, 2));

  // Send to monitoring service (optional)
  await sendMetrics(metrics);

  return result;
}
```

### 13.3 Monitoring Dashboard

**Key metrics to track:**

1. **Throughput**: Sites processed per hour
2. **Latency**: Average processing time per site
3. **Success rate**: % of successful ingestions
4. **Component counts**: Average components extracted per site
5. **Token mapping rate**: % of values mapped to tokens
6. **Vector quality**: Average cosine similarity for duplicates
7. **Error rate**: % of failed extractions
8. **Database size**: Growth rate of vector tables

---

## 14. Risk Assessment & Mitigation

### 14.1 Technical Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Performance degradation with 5 components | Medium | High | Implement parallel processing, optimize LLM calls |
| LLM classification failures | Medium | Medium | Implement fallback heuristics, retry logic |
| Vector dimension explosion | Low | Medium | Reserve dimensions, monitor dimensionality |
| Database storage costs | Medium | Medium | Implement vector compression, archive old data |
| Frontend rendering slowness | Low | Low | Implement pagination, lazy loading |
| Component extraction false positives | High | Medium | Improve detection heuristics, add confidence scoring |
| Token matching failures | Medium | Low | Expand token library, improve matching tolerance |

### 14.2 Mitigation Strategies

**Performance degradation:**
- Implement parallel component processing
- Cache LLM responses
- Optimize database queries with proper indexes
- Implement batch processing for vectorization

**LLM classification failures:**
- Implement retry logic with exponential backoff
- Use fallback heuristics when LLM confidence is low
- Monitor LLM API status and implement circuit breakers

**Vector dimension explosion:**
- Reserve 10-20% of dimensions for future features
- Document feature additions carefully
- Implement dimension reduction techniques if needed

**Database storage costs:**
- Implement vector quantization (32-bit → 16-bit or 8-bit)
- Archive vectors for sites not accessed in 90+ days
- Implement incremental updates (only store changed components)

**Frontend rendering slowness:**
- Implement virtual scrolling for large component lists
- Lazy load component previews
- Cache similarity search results

---

## 15. Open Questions & Decisions

### 15.1 Resolved Decisions

**✅ Token resolution strategy:**
- **Decision:** Store both token ID and resolved value in JSONB
- **Rationale:** Provides flexibility to resolve at render time or use cached value

**✅ Component nesting:**
- **Decision:** Store composition graph separately in Phase 5
- **Rationale:** Keeps component specs simple, enables relationship queries later

**✅ Variant vs Type:**
- **Decision:** Use variant field within type (e.g., type=button, variant=ghost)
- **Rationale:** Enables variant-specific queries while maintaining type consistency

**✅ Normalization strategy:**
- **Decision:** Per-feature normalization using bounds from normalization-bounds.json
- **Rationale:** Maintains interpretability, allows feature-specific scaling

**✅ Database migration:**
- **Decision:** Clean slate approach (drop old tables)
- **Rationale:** User confirmed no need for data preservation

### 15.2 Open Questions

**🔶 CLIP embeddings:**
- **Question:** Add visual embeddings for component similarity?
- **Options:**
  1. Yes, in Phase 5 (after all components implemented)
  2. Yes, immediately for buttons only
  3. No, focus on interpretable vectors only
- **Recommendation:** Option 1 (Phase 5)
- **Dependencies:** CLIP model integration, screenshot capture, storage increase

**🔶 Component detection accuracy:**
- **Question:** What's acceptable precision/recall for Phase 1?
- **Options:**
  1. >80% precision, >70% recall (aggressive)
  2. >90% precision, >60% recall (conservative)
  3. >85% precision, >65% recall (balanced)
- **Recommendation:** Option 3 (balanced)
- **Validation:** Manual review of 100 extracted components per type

**🔶 LLM classification threshold:**
- **Question:** When to fallback to heuristics?
- **Options:**
  1. LLM confidence <0.5
  2. LLM confidence <0.7
  3. Always use LLM, no fallback
- **Recommendation:** Option 1 (confidence <0.5)
- **Rationale:** Balances accuracy with cost/latency

---

## 16. Success Criteria

### 16.1 Technical Metrics

**Phase 0 Success Criteria:**
- [ ] Button component refactored into modular structure
- [ ] All button tests passing (unit + integration)
- [ ] No performance regression vs old code
- [ ] Database migration successful
- [ ] Frontend displays buttons correctly

**Phase 1-4 Success Criteria (per component):**
- [ ] Component extracts with >80% precision, >70% recall
- [ ] Vectors generated with correct dimensionality
- [ ] Database table created with proper indexes
- [ ] API endpoint returns results in <200ms
- [ ] Frontend renders component tab correctly
- [ ] Token mapping rate >60%

**System-Wide Success Criteria:**
- [ ] All 5 component types extracting successfully
- [ ] Pipeline processes site in <20s (all components)
- [ ] Database size <1GB for 1000 sites
- [ ] Frontend loads in <2s
- [ ] Test coverage >70% for all components
- [ ] Documentation complete for each component

### 16.2 Developer Experience

**Success indicators:**
- [ ] Adding new component takes <1 week
- [ ] Component modules are <500 lines each
- [ ] Clear separation of concerns (extractor/classifier/vectorizer)
- [ ] Easy to debug (artifact-based outputs)
- [ ] Good error messages (actionable warnings)
- [ ] Comprehensive documentation (README per component)

### 16.3 User Experience

**Success indicators:**
- [ ] Component tabs load smoothly (<2s)
- [ ] Visual previews match source sites
- [ ] Token references visible and helpful
- [ ] Similarity search returns relevant results (<200ms)
- [ ] Clear variant labeling (primary/secondary/etc.)
- [ ] No frontend errors or crashes

---

## 17. Next Steps

### Immediate Actions (This Week)

1. **Review & Approve Document**
   - [ ] Team review of this technical plan
   - [ ] Stakeholder approval
   - [ ] Budget approval (if needed for compute/LLM costs)

2. **Setup Development Environment**
   - [ ] Create feature branch: `feature/canonical-component-system`
   - [ ] Setup test database
   - [ ] Configure CI/CD for new structure

3. **Begin Phase 0 Implementation**
   - [ ] Day 1-2: Repository reorganization
   - [ ] Day 3-4: Refactor button component
   - [ ] Day 5: Create component registry
   - [ ] Day 6: Database migration
   - [ ] Day 7: Integration testing

### Short-Term (Next 2 Weeks)

1. Complete Phase 0 refactoring
2. Begin Phase 1 (Input component)
3. Validate architecture with 2 component types

### Medium-Term (Next 6 Weeks)

1. Complete Phases 1-4 (all component types)
2. Launch to production with 5 component types
3. Monitor performance and quality metrics

### Long-Term (Q1 2026)

1. Phase 5: Cross-component features
2. Phase 6: Advanced features (CLIP, clustering)
3. Scale to 10,000+ sites
4. Add 5-10 more component types

---

## 18. Conclusion

This technical implementation guide provides a complete roadmap for evolving from a single-component system (buttons) to a comprehensive canonical component system with 5 component types.

**Key Takeaways:**

1. **Modular Architecture**: Each component is self-contained with clear responsibilities
2. **Incremental Rollout**: Enable components one-by-one to de-risk deployment
3. **Token-First Approach**: Preserve brand consistency through design token mapping
4. **Clean Slate**: No backward compatibility concerns simplify migration
5. **Observable**: Instrumentation at every step for debugging and monitoring
6. **Testable**: Comprehensive test strategy ensures quality

**Estimated Timeline:**
- Phase 0 (Button refactor): 1 week
- Phase 1 (Input): 1 week
- Phase 2 (Card): 1 week
- Phase 3 (Hero): 1 week
- Phase 4 (NavBar): 1 week
- Phase 5 (Enhancements): 1 week
- **Total: 6 weeks**

**Next Step:** Begin Phase 0 implementation.

---

**Document Status:** ✅ Complete and ready for implementation

**Version:** 2.0

**Last Updated:** 2025-10-10

**Authors:** Engineering Team

**Approvers:** [To be filled]
