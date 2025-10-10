# Intent Module Improvement Plan

## Current State & Critical Limitations

**Current Implementation**: Fixed 16-section taxonomy with hardcoded UI patterns

**Critical Project Goal Violations**:
- ❌ **Cannot discover new UI patterns** - limited to predefined section types
- ❌ **Fixed section taxonomy** prevents "design-grade" variety

## Module Goal: Adaptive Intent Understanding

**Objective**: Create an intelligent intent parser that discovers UI patterns from content analysis instead of relying on fixed section taxonomy.

## Priority 1: Remove Fixed Section Taxonomy

### Current Limitation Analysis

**Hardcoded Constraints**:
```typescript
// REMOVE THIS - Fixed section types
export type SectionType = 'gallery' | 'summary' | 'price_cta' | 'amenities' | 'reviews' | 'trust_signals'
  | 'hero' | 'features' | 'testimonials' | 'faq' | 'contact'
  | 'avatar' | 'bio' | 'experience' | 'portfolio' | 'social_links';

// REMOVE THIS - Fixed schema
const INTENT_SCHEMA = {
  // ... hardcoded section enums
};
```

### New Adaptive Approach

```typescript
interface AdaptiveIntent {
  pageType: string; // Not limited to 3 types
  primaryEntity: string;
  discoveredSections: DiscoveredSection[];
  contentStrategy: ContentStrategy;
  designPatterns: DesignPattern[];
  confidence: number;
  reasoning: string;
}

interface DiscoveredSection {
  semanticType: string; // AI-discovered, not predefined
  purpose: string;
  contentHints: string[];
  visualImportance: number;
  relationships: string[];
  suggestedComponents: ComponentSuggestion[];
}

interface ContentStrategy {
  informationArchitecture: string;
  userJourney: string[];
  conversionGoals: string[];
  contentPriorities: ContentPriority[];
}

interface DesignPattern {
  pattern: string;
  justification: string;
  sourceEvidence: string[];
}
```

## Priority 2: GPT-4o Content Analysis Engine

### Implementation Strategy

```typescript
async function parseAdaptiveIntent(
  prompt: string,
  scenegraph: SceneGraph,
  tokens: DesignTokens
): Promise<AdaptiveIntent> {

  const analysisPrompt = `
You are an expert UX strategist analyzing user intent for design generation.

USER REQUEST: "${prompt}"

SOURCE ANALYSIS:
- Page structure: ${summarizeSceneGraph(scenegraph)}
- Design patterns: ${analyzeDesignPatterns(scenegraph, tokens)}
- Content types: ${identifyContentTypes(scenegraph)}
- Visual hierarchy: ${analyzeHierarchy(scenegraph)}

TASK: Discover the optimal content strategy and UI patterns for this request.

REQUIREMENTS:
1. DO NOT limit to predefined section types
2. Discover novel UI patterns if they serve the user goal
3. Analyze the source to understand proven patterns
4. Consider user journey and information architecture
5. Suggest component types that match the content strategy

DISCOVER:
- What semantic content sections would best serve this user goal?
- What UI patterns from the source should be adapted/evolved?
- What's the optimal information architecture?
- What design patterns would create professional, credible results?

Return comprehensive intent analysis with discovered sections and patterns.
`;

  return await gpt4oIntentAnalysis(analysisPrompt, scenegraph, tokens);
}
```

## Priority 3: Enhanced Schema-Free Validation

### Replace Fixed Schema with Adaptive Validation

```typescript
// REMOVE rigid schema validation
// REPLACE with adaptive quality checks

interface IntentQualityMetrics {
  contentCoherence: number;
  designFeasibility: number;
  userExperienceScore: number;
  brandConsistency: number;
  technicalViability: number;
}

async function validateAdaptiveIntent(
  intent: AdaptiveIntent,
  scenegraph: SceneGraph,
  tokens: DesignTokens
): Promise<IntentQualityMetrics> {

  // Quality checks instead of schema validation
  return {
    contentCoherence: await checkContentFlow(intent.discoveredSections),
    designFeasibility: await checkDesignFeasibility(intent.designPatterns),
    userExperienceScore: await checkUXPrinciples(intent.contentStrategy),
    brandConsistency: await checkBrandAlignment(intent, tokens),
    technicalViability: await checkImplementationViability(intent)
  };
}
```

## Implementation Timeline

### Phase 1 (Immediate Impact): Remove Section Taxonomy
- Replace fixed section types with discovered sections
- Implement adaptive schema validation

**Success Test**: Test with diverse prompts ("create a restaurant menu page", "build a SaaS pricing page", "design a photographer portfolio"). Each different prompt type should discover unique section types not in the original 16 hardcoded list (e.g., "menu-categories", "pricing-tiers", "portfolio-gallery"). Same prompt should consistently discover same sections.

### Phase 2 (Quality Enhancement): Advanced Analysis
- Sophisticated content strategy analysis
- Design pattern recognition
- User journey optimization

## Success Metrics

1. **Variety**: Discover 50+ unique section types from diverse inputs
2. **Quality**: 90%+ designer approval of discovered patterns
3. **Flexibility**: Support any UI pattern, not just predefined types
4. **Accuracy**: Correct semantic understanding of user intent

## Risk Mitigation

1. **Quality Gates**: Validate discovered patterns for feasibility
2. **Fallback Patterns**: Default to proven UI patterns when uncertain
3. **Error Handling**: Graceful degradation when AI analysis fails

This transformation enables true "design-grade" variety by removing artificial constraints and enabling dynamic UI pattern discovery.