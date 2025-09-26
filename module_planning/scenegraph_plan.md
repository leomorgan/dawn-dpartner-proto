# DOM Scenegraph Module Improvement Plan

## Current State & Critical Limitations

**Current Implementation**: Geometric heuristics with brittle hardcoded assumptions

**Critical Project Goal Violations**:
- ❌ **Hardcoded position heuristics** (footer at `y > 520px`) break with different layouts
- ❌ **Fixed fallback bounds** (header: 100px) don't adapt to actual content
- ❌ **Arbitrary wrapper reduction target** (40%) not design-quality driven
- ❌ **Brittle element matching** fails with complex modern layouts

## Module Goal: Intelligent Layout Understanding

**Objective**: Replace brittle heuristics with sophisticated layout intelligence that understands modern web design patterns and adapts to any layout structure.

## Priority 1: Remove Hardcoded Position Assumptions

### Current Critical Issues

**Brittle Hardcoded Logic to Remove**:
```typescript
// REMOVE THIS - Fails with modern responsive layouts
if (depth <= 1 && rect.y < 100) {
  return 'Header';
}

if (depth <= 1 && rect.y > 520) { // <- HARDCODED ASSUMPTION
  return 'Footer';
}

// REMOVE THIS - Fixed dimensions don't match reality
if (['header', 'nav'].includes(tag)) {
  return { x: 0, y: 0, w: 1280, h: 100 }; // <- HARDCODED
}
```

**New Intelligent Approach**:
```typescript
interface LayoutIntelligence {
  semanticRegions: SemanticRegion[];
  layoutPattern: LayoutPattern;
  responsiveStrategy: ResponsiveStrategy;
  designPrinciples: DesignPrinciple[];
}

interface SemanticRegion {
  type: string; // Discovered, not hardcoded
  bounds: BoundingBox;
  confidence: number;
  evidence: SemanticEvidence[];
  relationships: RegionRelationship[];
}

interface SemanticEvidence {
  type: 'positional' | 'semantic' | 'visual' | 'content';
  strength: number;
  description: string;
}

async function analyzeLayoutIntelligently(
  element: Element,
  styleMap: Map<string, ComputedStyleNode>,
  context: LayoutContext
): Promise<SemanticRegion> {

  // Multi-factor analysis instead of position-only
  const positionalAnalysis = analyzePosition(element, context);
  const semanticAnalysis = analyzeSemanticHTML(element);
  const visualAnalysis = analyzeVisualHierarchy(element, styleMap);
  const contentAnalysis = analyzeContentPatterns(element);

  // Weight evidence from multiple sources
  const evidence = combineEvidence([
    positionalAnalysis,
    semanticAnalysis,
    visualAnalysis,
    contentAnalysis
  ]);

  return synthesizeSemanticRole(evidence, context);
}
```

## Priority 2: Adaptive Layout Pattern Recognition

### Modern Layout Understanding

```typescript
interface ModernLayoutPattern {
  type: 'header-main-footer' | 'sidebar-content' | 'grid-layout' | 'hero-sections' | 'card-grid' | 'asymmetric' | 'custom';
  characteristics: LayoutCharacteristic[];
  regions: LayoutRegion[];
  hierarchy: HierarchyLevel[];
  responsive: ResponsiveBehavior;
}

interface LayoutCharacteristic {
  feature: string;
  strength: number;
  evidence: string[];
}

class AdaptiveLayoutAnalyzer {
  async recognizeLayoutPattern(
    nodes: ComputedStyleNode[],
    scenegraph: SceneNode
  ): Promise<ModernLayoutPattern> {

    // Analyze layout structure
    const gridAnalysis = this.analyzeGridPatterns(nodes);
    const flexboxAnalysis = this.analyzeFlexboxPatterns(nodes);
    const hierarchyAnalysis = this.analyzeVisualHierarchy(nodes);
    const spacingAnalysis = this.analyzeSpacingRhythm(nodes);

    // Recognize common patterns
    const patterns = [
      this.detectHeaderMainFooter(nodes),
      this.detectSidebarLayout(nodes),
      this.detectHeroSections(nodes),
      this.detectCardGrids(nodes),
      this.detectAsymmetricLayouts(nodes)
    ];

    // Select best matching pattern
    const bestPattern = this.selectBestPattern(patterns, nodes);

    return this.synthesizeLayoutPattern(bestPattern, {
      gridAnalysis,
      flexboxAnalysis,
      hierarchyAnalysis,
      spacingAnalysis
    });
  }

  private detectHeaderMainFooter(nodes: ComputedStyleNode[]): PatternMatch {
    // Look for semantic HTML and layout evidence
    const headerEvidence = this.findHeaderEvidence(nodes);
    const footerEvidence = this.findFooterEvidence(nodes);
    const mainEvidence = this.findMainContentEvidence(nodes);

    return {
      pattern: 'header-main-footer',
      confidence: this.calculateConfidence([headerEvidence, footerEvidence, mainEvidence]),
      evidence: [headerEvidence, footerEvidence, mainEvidence]
    };
  }

  private findHeaderEvidence(nodes: ComputedStyleNode[]): Evidence {
    // Multiple indicators, not just position
    const indicators = [
      this.checkSemanticHTML(nodes, ['header', 'nav']),
      this.checkTopPositioning(nodes), // But not hardcoded y < 100
      this.checkNavigationPatterns(nodes),
      this.checkBrandingElements(nodes),
      this.checkStickyPositioning(nodes)
    ];

    return this.synthesizeEvidence(indicators, 'header');
  }
}
```

## Priority 3: Smart Element Matching

### Replace Brittle Matching Logic

**Current Issue**: Simple tag/className matching fails with modern components

```typescript
// REPLACE brittle matching with intelligent analysis
interface IntelligentElementMatcher {
  matchStrategies: MatchStrategy[];
  confidenceThreshold: number;
  fallbackBehavior: FallbackStrategy;
}

interface MatchStrategy {
  name: string;
  weight: number;
  matcher: (element: Element, computed: ComputedStyleNode) => MatchResult;
}

interface MatchResult {
  confidence: number;
  evidence: string[];
  computedNode?: ComputedStyleNode;
}

class SmartElementMatcher {
  private strategies: MatchStrategy[] = [
    {
      name: 'semantic-html',
      weight: 0.4,
      matcher: this.matchBySemanticHTML.bind(this)
    },
    {
      name: 'visual-similarity',
      weight: 0.3,
      matcher: this.matchByVisualSimilarity.bind(this)
    },
    {
      name: 'content-pattern',
      weight: 0.2,
      matcher: this.matchByContentPattern.bind(this)
    },
    {
      name: 'position-context',
      weight: 0.1,
      matcher: this.matchByPositionContext.bind(this)
    }
  ];

  async findBestMatch(
    element: Element,
    styleMap: Map<string, ComputedStyleNode>
  ): Promise<ComputedStyleNode | null> {

    const candidates = Array.from(styleMap.values());
    let bestMatch: { node: ComputedStyleNode; score: number } | null = null;

    for (const candidate of candidates) {
      const score = await this.calculateMatchScore(element, candidate);
      if (score > this.confidenceThreshold && (!bestMatch || score > bestMatch.score)) {
        bestMatch = { node: candidate, score };
      }
    }

    return bestMatch?.node || null;
  }

  private async calculateMatchScore(
    element: Element,
    candidate: ComputedStyleNode
  ): Promise<number> {

    let totalScore = 0;
    let totalWeight = 0;

    for (const strategy of this.strategies) {
      const result = strategy.matcher(element, candidate);
      totalScore += result.confidence * strategy.weight;
      totalWeight += strategy.weight;
    }

    return totalWeight > 0 ? totalScore / totalWeight : 0;
  }
}
```

## Priority 4: Content-Aware Wrapper Collapse

### Replace Arbitrary 40% Target

**Current Issue**: Fixed wrapper reduction target doesn't consider design quality

```typescript
// REPLACE arbitrary target with intelligent analysis
interface WrapperCollapseStrategy {
  preserveSemanticStructure: boolean;
  maintainAccessibility: boolean;
  optimizeForDesign: boolean;
  collapseThreshold: CollapseThreshold;
}

interface CollapseThreshold {
  minSemanticValue: number;
  maxNestingLevel: number;
  preserveKeyElements: string[];
  contextualFactors: ContextualFactor[];
}

interface ContextualFactor {
  factor: 'layout-container' | 'style-wrapper' | 'framework-artifact' | 'semantic-grouping';
  importance: number;
  preservationRule: PreservationRule;
}

class IntelligentWrapperCollapse {
  async optimizeHierarchy(
    scenegraph: SceneNode,
    designPrinciples: DesignPrinciple[]
  ): Promise<OptimizedSceneGraph> {

    const analysis = await this.analyzeHierarchyValue(scenegraph);
    const optimized = await this.performIntelligentCollapse(scenegraph, analysis);

    return {
      original: scenegraph,
      optimized: optimized,
      reductionAnalysis: this.analyzeReduction(scenegraph, optimized),
      qualityMetrics: await this.calculateQualityMetrics(optimized)
    };
  }

  private async analyzeHierarchyValue(node: SceneNode): Promise<HierarchyValue> {
    return {
      semanticValue: this.calculateSemanticValue(node),
      layoutValue: this.calculateLayoutValue(node),
      accessibilityValue: this.calculateAccessibilityValue(node),
      designValue: this.calculateDesignValue(node)
    };
  }

  private shouldPreserveWrapper(
    element: Element,
    children: SceneNode[],
    context: CollapseContext
  ): boolean {

    // Multiple factors instead of simple rules
    const semanticImportance = this.assessSemanticImportance(element);
    const layoutContribution = this.assessLayoutContribution(element, children);
    const accessibilityRole = this.assessAccessibilityRole(element);
    const designImpact = this.assessDesignImpact(element, context);

    // Weighted decision
    const preservationScore =
      semanticImportance * 0.3 +
      layoutContribution * 0.3 +
      accessibilityRole * 0.2 +
      designImpact * 0.2;

    return preservationScore > context.preservationThreshold;
  }
}
```

## Priority 5: Responsive Layout Understanding

### Modern CSS Layout Support

```typescript
interface ResponsiveLayoutAnalysis {
  breakpointStrategy: BreakpointStrategy;
  layoutShifts: LayoutShift[];
  componentAdaptation: ComponentAdaptation[];
  mobilePriority: MobilePriority;
}

interface BreakpointStrategy {
  type: 'mobile-first' | 'desktop-first' | 'container-queries' | 'fluid';
  breakpoints: Breakpoint[];
  scalingStrategy: ScalingStrategy;
}

class ResponsiveLayoutAnalyzer {
  async analyzeResponsiveBehavior(
    nodes: ComputedStyleNode[]
  ): Promise<ResponsiveLayoutAnalysis> {

    // Analyze CSS for responsive patterns
    const mediaQueryAnalysis = this.analyzeMediaQueries(nodes);
    const fluidDesignAnalysis = this.analyzeFluidDesign(nodes);
    const containerQueryAnalysis = this.analyzeContainerQueries(nodes);

    // Infer responsive strategy
    const strategy = this.inferResponsiveStrategy({
      mediaQueryAnalysis,
      fluidDesignAnalysis,
      containerQueryAnalysis
    });

    return {
      breakpointStrategy: strategy,
      layoutShifts: this.predictLayoutShifts(nodes, strategy),
      componentAdaptation: this.analyzeComponentAdaptation(nodes),
      mobilePriority: this.assessMobilePriority(nodes)
    };
  }
}
```

## Implementation Timeline

### Phase 1 (Immediate Impact): Remove Hardcoded Assumptions
- Replace position-based role detection with multi-factor analysis
- Remove fixed fallback bounds
- Implement intelligent element matching

**Success Test**: Process websites with non-traditional layouts (footer at top, navigation in middle, content-first designs). System should correctly identify semantic roles without relying on y-position assumptions. No "footer" elements should be detected solely because y > 520px.

### Phase 2 (Layout Intelligence): Pattern Recognition
- Add modern layout pattern recognition
- Implement content-aware wrapper collapse
- Create responsive layout analysis

### Phase 3 (Advanced Understanding): Semantic Intelligence
- Advanced semantic region detection
- Design principle extraction
- Accessibility-aware hierarchy optimization

## Success Metrics

1. **Adaptability**: Handle any layout pattern (not just traditional header/footer)
2. **Accuracy**: 95%+ correct semantic region identification
3. **Quality**: Preserve design intent during hierarchy optimization
4. **Modern Support**: Support CSS Grid, Flexbox, Container Queries
5. **Robustness**: No failures due to hardcoded assumptions

## Risk Mitigation

1. **Graceful Fallbacks**: When uncertain, preserve original structure
2. **Validation**: Cross-check semantic analysis with visual evidence
3. **Performance**: Optimize pattern recognition algorithms
4. **Testing**: Extensive testing with diverse layout patterns

This transformation enables the scenegraph module to understand modern web layouts intelligently rather than relying on brittle assumptions, supporting the goal of professional design-grade outputs.