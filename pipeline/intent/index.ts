import { readFile, writeFile } from 'fs/promises';
import { join } from 'path';
import { OpenAI } from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import type { SceneGraph } from '../scenegraph';

export interface DiscoveredSection {
  semanticType: string; // AI-discovered, not predefined
  purpose: string;
  contentHints: string[];
  visualImportance: number;
  relationships: string[];
  suggestedComponents: string[];
}

export interface ContentStrategy {
  informationArchitecture: string;
  userJourney: string[];
  conversionGoals: string[];
  contentPriorities: string[];
}

export interface DesignPattern {
  pattern: string;
  justification: string;
  sourceEvidence: string[];
}

export interface AdaptiveIntent {
  pageType: string; // Not limited to 3 types
  primaryEntity: string;
  discoveredSections: DiscoveredSection[];
  contentStrategy: ContentStrategy;
  designPatterns: DesignPattern[];
  confidence: number;
  reasoning: string;
}

// Legacy SectionType for backward compatibility
export type SectionType = 'gallery' | 'summary' | 'price_cta' | 'amenities' | 'reviews' | 'trust_signals' | 'hero' | 'features' | 'testimonials' | 'faq' | 'contact' | 'avatar' | 'bio' | 'experience' | 'portfolio' | 'social_links';

// Legacy interface for backward compatibility
export interface Intent {
  page_type: string;
  primary_entity: string;
  required_sections: string[];
  priority_order: string[];
  confidence: number;
  reasoning: string;
}

export interface IntentParseResult {
  runId: string;
  adaptiveIntent: AdaptiveIntent;
  legacyIntent: Intent; // For backward compatibility
  provider: 'openai' | 'anthropic';
}

// Adaptive schema - no hardcoded enums
const ADAPTIVE_INTENT_SCHEMA = {
  type: 'object',
  properties: {
    pageType: {
      type: 'string',
      description: 'The type of page to create (discovered dynamically)'
    },
    primaryEntity: {
      type: 'string',
      description: 'The main entity/subject of the page'
    },
    discoveredSections: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          semanticType: { type: 'string', description: 'Semantic name for this section type' },
          purpose: { type: 'string', description: 'What this section accomplishes for users' },
          contentHints: { type: 'array', items: { type: 'string' }, description: 'Types of content this section contains' },
          visualImportance: { type: 'number', minimum: 0, maximum: 1, description: 'Visual prominence (0-1)' },
          relationships: { type: 'array', items: { type: 'string' }, description: 'How this section relates to others' },
          suggestedComponents: { type: 'array', items: { type: 'string' }, description: 'Suggested component types' }
        },
        required: ['semanticType', 'purpose', 'contentHints', 'visualImportance']
      },
      description: 'Discovered sections based on content analysis'
    },
    contentStrategy: {
      type: 'object',
      properties: {
        informationArchitecture: { type: 'string', description: 'Overall content organization strategy' },
        userJourney: { type: 'array', items: { type: 'string' }, description: 'Expected user flow steps' },
        conversionGoals: { type: 'array', items: { type: 'string' }, description: 'Key conversion objectives' },
        contentPriorities: { type: 'array', items: { type: 'string' }, description: 'Content priority order' }
      },
      required: ['informationArchitecture', 'userJourney']
    },
    designPatterns: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          pattern: { type: 'string', description: 'Design pattern name' },
          justification: { type: 'string', description: 'Why this pattern fits the context' },
          sourceEvidence: { type: 'array', items: { type: 'string' }, description: 'Evidence from source analysis' }
        },
        required: ['pattern', 'justification']
      },
      description: 'Recommended design patterns'
    },
    confidence: {
      type: 'number',
      minimum: 0,
      maximum: 1,
      description: 'Confidence in the interpretation (0-1)'
    },
    reasoning: {
      type: 'string',
      description: 'Brief explanation of the analysis and decisions'
    }
  },
  required: ['pageType', 'primaryEntity', 'discoveredSections', 'contentStrategy', 'confidence', 'reasoning']
};


export async function parseIntent(
  prompt: string,
  runId: string,
  artifactDir?: string,
  provider?: 'openai' | 'anthropic'
): Promise<IntentParseResult> {
  const baseDir = artifactDir || join(process.cwd(), 'artifacts');
  const runDir = join(baseDir, runId);

  // Read scenegraph for context
  let scenegraph: SceneGraph | null = null;
  try {
    const scenegraphContent = await readFile(join(runDir, 'scenegraph.json'), 'utf8');
    scenegraph = JSON.parse(scenegraphContent);
  } catch (error) {
    // Scenegraph is optional for intent parsing
  }

  // Read design tokens for context
  let tokens: any = null;
  try {
    const tokensContent = await readFile(join(runDir, 'design_tokens.json'), 'utf8');
    tokens = JSON.parse(tokensContent);
  } catch (error) {
    // Tokens are optional
  }

  const intentProvider = provider || process.env.INTENT_PROVIDER || 'openai';
  let adaptiveIntent: AdaptiveIntent;

  switch (intentProvider) {
    case 'openai':
      adaptiveIntent = await parseAdaptiveIntent(prompt, scenegraph, tokens);
      break;
    case 'anthropic':
      adaptiveIntent = await parseWithAnthropic(prompt, scenegraph);
      break;
    default:
      throw new Error(`Unsupported intent provider: ${intentProvider}. Must be 'openai' or 'anthropic'.`);
  }

  // Create legacy intent for backward compatibility
  const legacyIntent = adaptToLegacyIntent(adaptiveIntent);

  // Save both formats
  await Promise.all([
    writeFile(join(runDir, 'adaptive_intent.json'), JSON.stringify(adaptiveIntent, null, 2)),
    writeFile(join(runDir, 'intent.json'), JSON.stringify(legacyIntent, null, 2))
  ]);

  return {
    runId,
    adaptiveIntent,
    legacyIntent,
    provider: intentProvider as any,
  };
}

async function parseAdaptiveIntent(
  prompt: string,
  scenegraph?: SceneGraph | null,
  tokens?: any
): Promise<AdaptiveIntent> {
  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  const systemPrompt = `You are an expert UX strategist analyzing user intent for design generation.

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

${scenegraph ? `SOURCE ANALYSIS:
- Page structure: ${scenegraph.totalNodes} elements
- Sections found: ${scenegraph.root.children?.map(c => c.role).join(', ')}
- Layout patterns: ${analyzeLayoutPatterns(scenegraph)}` : ''}

${tokens ? `DESIGN CONTEXT:
- Brand colors: ${tokens.colors?.primary?.slice(0, 3).join(', ')}
- Spacing system: ${tokens.spacing?.slice(0, 4).join('px, ')}px
- Typography: ${tokens.typography?.fontFamilies?.[0]}` : ''}

Return comprehensive intent analysis with discovered sections and patterns.`;

  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: prompt }
    ],
    functions: [{
      name: 'analyze_adaptive_intent',
      description: 'Analyze user intent and discover optimal UI patterns',
      parameters: ADAPTIVE_INTENT_SCHEMA
    }],
    function_call: { name: 'analyze_adaptive_intent' },
    temperature: 0.2,
  });

  const functionCall = response.choices[0].message.function_call;
  if (!functionCall?.arguments) {
    throw new Error('Failed to get structured response from GPT-4o');
  }

  const adaptiveIntent = JSON.parse(functionCall.arguments) as AdaptiveIntent;
  return validateAdaptiveIntent(adaptiveIntent);
}

async function parseWithAnthropic(prompt: string, scenegraph?: SceneGraph | null): Promise<AdaptiveIntent> {
  const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
  });

  const systemPrompt = `You are an expert UX strategist analyzing user intent for design generation.

TASK: Discover optimal content strategy and UI patterns for this request.

REQUIREMENTS:
1. DO NOT limit to predefined section types
2. Discover novel UI patterns that serve the user goal
3. Consider user journey and information architecture
4. Suggest semantic section types based on content needs

${scenegraph ? `SOURCE CONTEXT: Page has ${scenegraph.totalNodes} elements` : ''}

Return JSON matching this structure:
{
  "pageType": "discovered page type",
  "primaryEntity": "main subject",
  "discoveredSections": [
    {
      "semanticType": "section name",
      "purpose": "what it accomplishes",
      "contentHints": ["content types"],
      "visualImportance": 0.8,
      "relationships": ["related sections"],
      "suggestedComponents": ["component types"]
    }
  ],
  "contentStrategy": {
    "informationArchitecture": "overall strategy",
    "userJourney": ["step1", "step2"],
    "conversionGoals": ["goals"],
    "contentPriorities": ["priorities"]
  },
  "designPatterns": [
    {
      "pattern": "pattern name",
      "justification": "why it fits"
    }
  ],
  "confidence": 0.9,
  "reasoning": "analysis explanation"
}`;

  const response = await anthropic.messages.create({
    model: 'claude-3-haiku-20240307',
    max_tokens: 1000,
    system: systemPrompt,
    messages: [
      { role: 'user', content: prompt }
    ],
    temperature: 0.2,
  });

  const content = response.content[0];
  if (content.type !== 'text') {
    throw new Error('Unexpected response type from Anthropic');
  }

  const adaptiveIntent = JSON.parse(content.text) as AdaptiveIntent;
  return validateAdaptiveIntent(adaptiveIntent);
}


function validateAdaptiveIntent(intent: AdaptiveIntent): AdaptiveIntent {
  // Ensure confidence is between 0 and 1
  intent.confidence = Math.max(0, Math.min(1, intent.confidence || 0.5));

  // Ensure discovered sections have minimum required fields
  intent.discoveredSections = intent.discoveredSections.map(section => ({
    ...section,
    visualImportance: Math.max(0, Math.min(1, section.visualImportance || 0.5)),
    contentHints: section.contentHints || [],
    relationships: section.relationships || [],
    suggestedComponents: section.suggestedComponents || []
  }));

  // Provide defaults if empty
  if (!intent.pageType) {
    intent.pageType = 'detail';
  }

  if (!intent.primaryEntity) {
    intent.primaryEntity = 'unknown';
  }

  if (intent.discoveredSections.length === 0) {
    intent.discoveredSections = [{
      semanticType: 'hero',
      purpose: 'Primary introduction and engagement',
      contentHints: ['headline', 'description'],
      visualImportance: 0.9,
      relationships: [],
      suggestedComponents: ['Hero']
    }];
  }

  return intent;
}

function adaptToLegacyIntent(adaptiveIntent: AdaptiveIntent): Intent {
  // Map discovered sections to legacy section types
  const sectionMapping: Record<string, string> = {
    'hero': 'hero',
    'gallery': 'gallery',
    'summary': 'summary',
    'features': 'features',
    'pricing': 'price_cta',
    'reviews': 'reviews',
    'testimonials': 'testimonials',
    'contact': 'contact',
    'faq': 'faq',
    'amenities': 'amenities',
    'trust-signals': 'trust_signals',
    'profile': 'avatar',
    'bio': 'bio',
    'experience': 'experience',
    'portfolio': 'portfolio',
    'social': 'social_links'
  };

  const mappedSections = adaptiveIntent.discoveredSections
    .map(section => sectionMapping[section.semanticType] || section.semanticType)
    .filter(section => section);

  // Sort by visual importance
  const priorityOrder = adaptiveIntent.discoveredSections
    .sort((a, b) => b.visualImportance - a.visualImportance)
    .map(section => sectionMapping[section.semanticType] || section.semanticType)
    .filter(section => section);

  return {
    page_type: adaptiveIntent.pageType === 'detail' || adaptiveIntent.pageType === 'list' || adaptiveIntent.pageType === 'profile'
      ? adaptiveIntent.pageType : 'detail',
    primary_entity: adaptiveIntent.primaryEntity,
    required_sections: mappedSections,
    priority_order: priorityOrder,
    confidence: adaptiveIntent.confidence,
    reasoning: adaptiveIntent.reasoning
  };
}

function analyzeLayoutPatterns(scenegraph: SceneGraph): string {
  const patterns = [];

  // Analyze grid patterns
  if (scenegraph.root.children && scenegraph.root.children.length > 1) {
    patterns.push('multi-section');
  }

  // Analyze visual hierarchy
  const hasHero = scenegraph.root.children?.some(c => c.role?.includes('hero') || c.role?.includes('banner'));
  if (hasHero) {
    patterns.push('hero-driven');
  }

  // Analyze content density
  if (scenegraph.totalNodes > 50) {
    patterns.push('content-rich');
  } else if (scenegraph.totalNodes < 20) {
    patterns.push('minimal');
  }

  return patterns.length > 0 ? patterns.join(', ') : 'standard';
}