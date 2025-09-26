# Layout Module Improvement Plan

## Current State & Critical Limitations

**Current Implementation**: Template-based system with only 3 hardcoded page types (`detail`, `list`, `profile`)

**Critical Project Goal Violations**:
- ❌ **Cannot "generate a new layout"** - limited to predefined templates
- ❌ **Cannot achieve "design-grade outputs indistinguishable from human designers"** - template variety is predictable
- ❌ **Fixed 12-column grid** prevents responsive innovation
- ❌ **16 hardcoded section types** limit content discovery

## Module Goal: Truly Generative Layout System

**Objective**: Replace template-based layout with AI-driven generative algorithms that can create novel, professional layouts indistinguishable from human designers.

## Priority 1: GPT-4o Layout Generation Engine

### Implementation Strategy

```typescript
interface GenerativeLayoutRequest {
  scenegraph: SceneGraph;
  tokens: DesignTokens;
  intent: Intent;
  sourceLayoutPatterns: LayoutPattern[];
}

interface LayoutPattern {
  gridSystem: GridSystem;
  sectionFlow: SectionFlow;
  responsiveStrategy: ResponsiveStrategy;
  visualHierarchy: VisualHierarchy;
}
```

### Replace Templates with AI Generation

**Current Limitation**:
```typescript
// REMOVE THIS - Fixed templates
const LAYOUT_TEMPLATES: Record<string, (sections: SectionType[]) => LayoutStack[]>
```

**New Approach**:
```typescript
async function generateLayout(request: GenerativeLayoutRequest): Promise<Layout> {
  const layoutPrompt = `
You are an expert UI/UX designer. Generate a professional layout specification for:

INTENT: ${request.intent.page_type} page about ${request.intent.primary_entity}
USER GOAL: ${request.intent.reasoning}

EXTRACTED DESIGN PATTERNS from source:
- Grid system: ${analyzeGridSystem(request.scenegraph)}
- Section hierarchy: ${analyzeSectionHierarchy(request.scenegraph)}
- Spacing patterns: ${request.tokens.spacing}

REQUIREMENTS:
1. Create a novel layout that feels professional and credible
2. Use responsive design principles
3. Optimize for content hierarchy and user flow
4. Generate adaptive grid system (not fixed 12-column)
5. Create section relationships that make UX sense

Return JSON layout specification with:
- Adaptive grid system (columns, breakpoints, gutters)
- Section placement with intelligent relationships
- Visual hierarchy and spacing
- Responsive behavior patterns
`;

  return await gpt4oLayoutGeneration(layoutPrompt, request);
}
```

## Priority 2: Dynamic Section Discovery

### Remove Fixed Section Taxonomy

**Current Limitation**:
```typescript
// REMOVE THIS - Fixed 16 section types
export type SectionType = 'gallery' | 'summary' | 'price_cta' | ...
```

**New Approach**:
```typescript
interface DiscoveredSection {
  id: string;
  semanticType: string; // AI-discovered, not hardcoded
  purpose: string;
  contentType: 'visual' | 'textual' | 'interactive' | 'hybrid';
  relationships: SectionRelationship[];
  layoutConstraints: LayoutConstraints;
}

async function discoverSections(
  scenegraph: SceneGraph,
  intent: Intent
): Promise<DiscoveredSection[]> {
  const discoveryPrompt = `
Analyze this page structure and user intent to discover semantic sections:

PAGE STRUCTURE: ${JSON.stringify(scenegraph, null, 2)}
USER INTENT: ${intent.reasoning}

Discover and categorize content sections based on:
1. Semantic meaning and user value
2. Content patterns in the source
3. UX best practices for ${intent.page_type} pages
4. Visual hierarchy and importance

DO NOT limit to predefined categories. Discover novel section types if they serve the user goal.

Return sections with semantic types, purposes, and relationships.
`;

  return await gpt4oSectionDiscovery(discoveryPrompt, scenegraph, intent);
}
```

## Priority 3: Adaptive Grid Systems

### Replace Fixed 12-Column Grid

**Current Limitation**:
```typescript
// REMOVE THIS - Fixed grid
grid: { columns: 12, gutter: 24 }
```

**New Approach**:
```typescript
interface AdaptiveGridSystem {
  baseColumns: number;
  breakpoints: Breakpoint[];
  gutterStrategy: 'fixed' | 'proportional' | 'content-aware';
  columnStrategy: 'uniform' | 'golden-ratio' | 'content-driven';
}

async function generateGridSystem(
  tokens: DesignTokens,
  content: DiscoveredSection[],
  sourcePatterns: LayoutPattern[]
): Promise<AdaptiveGridSystem> {
  // Analyze source grid patterns
  const sourceGrid = analyzeSourceGridSystem(sourcePatterns);

  // Generate appropriate grid for content
  const gridPrompt = `
Design an optimal grid system for this content:

SOURCE GRID ANALYSIS: ${sourceGrid}
CONTENT SECTIONS: ${content.map(s => s.semanticType).join(', ')}
SPACING TOKENS: ${tokens.spacing}

Generate a grid system that:
1. Respects the source design language
2. Optimizes for the specific content types
3. Provides flexible responsive behavior
4. Maintains visual harmony with extracted spacing tokens

Consider content-driven column counts, proportional gutters, and semantic breakpoints.
`;

  return await gpt4oGridGeneration(gridPrompt, tokens, content);
}
```

## Priority 4: Constraint-Based Validation

### Intelligent Constraint System

**Replace Fixed Constraints**:
```typescript
interface AdaptiveConstraint {
  type: 'semantic' | 'visual' | 'accessibility' | 'brand';
  rule: string;
  validation: (layout: Layout) => ConstraintResult;
  adaptable: boolean;
}

async function generateConstraints(
  tokens: DesignTokens,
  intent: Intent,
  sections: DiscoveredSection[]
): Promise<AdaptiveConstraint[]> {
  // Generate constraints based on content, not fixed rules
  return [
    // Semantic constraints (e.g., hero above content)
    // Accessibility constraints (keyboard navigation, screen readers)
    // Brand constraints (consistent spacing, color usage)
    // Visual constraints (hierarchy, balance, whitespace)
  ];
}
```

## Implementation Timeline

### Phase 1 (Immediate Impact): GPT-4o Layout Generation
- Replace template system with AI generation
- Implement dynamic section discovery
- Remove hardcoded page types

**Success Test**: Given the same input (URL + prompt), the system generates consistent, high-quality layouts. When tested with 10 different input combinations (different URLs + prompts), each should produce layouts with distinct grid systems, section arrangements, and responsive strategies - no template reuse across different inputs. Same input should produce same layout.

### Phase 2 (Enhanced Capability): Adaptive Grid Systems
- Analyze source grid patterns
- Generate content-driven grid systems
- Implement responsive strategies

### Phase 3 (Professional Quality): Constraint Intelligence
- AI-generated constraint systems
- Visual hierarchy optimization
- Brand consistency validation

## Success Metrics

1. **Layout Variety**: Generate 100+ unique layouts from same input
2. **Professional Quality**: Layouts pass designer review (>90% approval)
3. **Brand Consistency**: Maintain source brand patterns
4. **Adaptive**: Support any grid system, not just 12-column
5. **Generative**: Create novel layouts, not template selections

## Risk Mitigation

1. **Fallback System**: Template fallbacks for AI failures
2. **Constraint Validation**: Ensure all generated layouts are usable
3. **Quality Gates**: Automated design quality checks
4. **Progressive Enhancement**: Start with proven patterns, add innovation

This transformation will enable the layout module to achieve the project goal of "design-grade outputs indistinguishable from human designers" through true generative capability rather than template selection.