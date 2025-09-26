import { readFile, writeFile } from 'fs/promises';
import { join } from 'path';
import { OpenAI } from 'openai';
import type { AdaptiveIntent } from '../intent';
import type { DesignTokens } from '../tokens';
import type { SceneGraph } from '../scenegraph';

// Legacy interfaces removed - use Adaptive* interfaces as primary

// New adaptive layout interfaces
export interface GenerativeLayoutRequest {
  scenegraph: SceneGraph;
  tokens: DesignTokens;
  intent: AdaptiveIntent;
}

export interface AdaptiveLayoutArea {
  sectionId: string;
  semanticType: string; // AI-discovered type
  cols: number;
  rows?: number;
  minHeight?: number;
  maxHeight?: number;
  content?: string;
}

export interface AdaptiveLayoutStack {
  id: string;
  direction: 'row' | 'column';
  gap: number;
  areas: (AdaptiveLayoutArea | AdaptiveLayoutStack)[];
  justify?: 'start' | 'center' | 'end' | 'between' | 'around';
  align?: 'start' | 'center' | 'end' | 'stretch';
  breakpoints?: ResponsiveBreakpoint[];
}

export interface ResponsiveBreakpoint {
  minWidth: number;
  direction?: 'row' | 'column';
  cols?: Record<string, number>;
  gaps?: number;
}

export interface AdaptiveGridSystem {
  columns: number;
  gutter: number;
  maxWidth?: number;
  breakpoints: GridBreakpoint[];
  strategy: 'fixed' | 'fluid' | 'hybrid';
}

export interface GridBreakpoint {
  minWidth: number;
  columns: number;
  gutter: number;
  maxWidth?: number;
}

export interface AdaptiveLayout {
  frame: {
    width: number | 'fluid';
    maxWidth: number;
    padding: number;
  };
  grid: AdaptiveGridSystem;
  stacks: AdaptiveLayoutStack[];
  sections: Record<string, {
    minWidth: number;
    minHeight: number;
    preferredCols: number;
    maxCols?: number;
    aspectRatio?: number;
  }>;
  responsiveStrategy: ResponsiveStrategy;
}

export interface ResponsiveStrategy {
  approach: 'desktop-first' | 'mobile-first' | 'content-first';
  breakpoints: number[];
  stackingOrder: string[];
  priorityContent: string[];
}

export interface AdaptiveLayoutResult {
  runId: string;
  layout: AdaptiveLayout;
  sections: string[];
  generationMethod: 'ai-generated';
  confidence: number;
  reasoning: string;
  constraints: {
    satisfied: number;
    total: number;
    violations: string[];
  };
}

// GPT-4o Layout Generation Schema
const ADAPTIVE_LAYOUT_SCHEMA = {
  type: 'object',
  properties: {
    gridSystem: {
      type: 'object',
      properties: {
        columns: { type: 'number', minimum: 1, maximum: 24 },
        gutter: { type: 'number', minimum: 8, maximum: 64 },
        maxWidth: { type: 'number', minimum: 320, maximum: 2400 },
        strategy: { type: 'string', enum: ['fixed', 'fluid', 'hybrid'] },
        breakpoints: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              minWidth: { type: 'number' },
              columns: { type: 'number' },
              gutter: { type: 'number' }
            }
          }
        }
      },
      required: ['columns', 'gutter', 'strategy']
    },
    sections: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          sectionId: { type: 'string' },
          semanticType: { type: 'string' },
          minWidth: { type: 'number' },
          minHeight: { type: 'number' },
          preferredCols: { type: 'number' },
          maxCols: { type: 'number' },
          aspectRatio: { type: 'number' }
        },
        required: ['sectionId', 'semanticType', 'minWidth', 'minHeight', 'preferredCols']
      }
    },
    stacks: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          direction: { type: 'string', enum: ['row', 'column'] },
          gap: { type: 'number' },
          areas: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                sectionId: { type: 'string' },
                semanticType: { type: 'string' },
                cols: { type: 'number', minimum: 1, maximum: 24 },
                rows: { type: 'number', minimum: 1, maximum: 10 },
                minHeight: { type: 'number', minimum: 0 },
                maxHeight: { type: 'number', minimum: 0 }
              },
              required: ['sectionId', 'semanticType', 'cols']
            }
          }
        }
      }
    },
    responsiveStrategy: {
      type: 'object',
      properties: {
        approach: { type: 'string', enum: ['desktop-first', 'mobile-first', 'content-first'] },
        breakpoints: { type: 'array', items: { type: 'number' } },
        stackingOrder: { type: 'array', items: { type: 'string' } }
      }
    },
    confidence: { type: 'number', minimum: 0, maximum: 1 },
    reasoning: { type: 'string' }
  },
  required: ['gridSystem', 'sections', 'stacks', 'responsiveStrategy', 'confidence', 'reasoning']
};

async function generateAdaptiveLayout(request: GenerativeLayoutRequest): Promise<AdaptiveLayoutResult> {
  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  // Analyze source patterns for context
  const sourcePatterns = analyzeSourcePatterns(request.scenegraph, request.tokens);

  // Use adaptive intent sections
  const sections = request.intent.discoveredSections;

  const layoutPrompt = `You are an expert UI/UX designer generating professional layout specifications.

DESIGN CONTEXT:
- Page Type: ${request.intent.pageType}
- Primary Entity: ${request.intent.primaryEntity}
- User Goal: ${request.intent.reasoning}

DISCOVERED SECTIONS:
${sections.map(s => `- ${s.semanticType}: ${s.purpose || 'Content section'}`).join('\n')}

SOURCE DESIGN PATTERNS:
- Spacing system: ${request.tokens.spacing.slice(0, 5).join('px, ')}px
- Grid patterns: ${sourcePatterns.gridPatterns}
- Visual hierarchy: ${sourcePatterns.visualHierarchy}
- Content density: ${sourcePatterns.contentDensity}

REQUIREMENTS:
1. Create a professional, credible layout that serves the user goal
2. Generate adaptive grid system (not limited to 12 columns)
3. Use intelligent section relationships and visual hierarchy
4. Apply responsive design principles
5. Respect source spacing and visual patterns
6. Optimize for content flow and user experience

CONSTRAINTS:
- Grid columns: 1-24 (analyze content needs, don't default to 12)
- Gutters: Use source spacing tokens where possible
- Breakpoints: Generate mobile/tablet/desktop strategy
- Section placement: Consider semantic relationships and visual importance

Generate a complete layout specification with grid system, section arrangements, and responsive behavior.`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: 'You are an expert layout designer generating professional UI specifications. Return valid JSON only.' },
        { role: 'user', content: layoutPrompt }
      ],
      tools: [{
        type: 'function',
        function: {
          name: 'generate_adaptive_layout',
          description: 'Generate comprehensive layout specification',
          parameters: ADAPTIVE_LAYOUT_SCHEMA
        }
      }],
      tool_choice: { type: 'function', function: { name: 'generate_adaptive_layout' } },
      temperature: 0.3,
    });

    const toolCall = response.choices[0].message.tool_calls?.[0];
    if (!toolCall?.function?.arguments) {
      throw new Error('Failed to get structured response from GPT-4o');
    }

    const aiLayout = JSON.parse(toolCall.function.arguments);
    return convertToAdaptiveLayoutResult(aiLayout, request);
  } catch (error) {
    console.error('❌ AI layout generation failed:', error);
    throw error;
  }
}

function analyzeSourcePatterns(scenegraph: SceneGraph, tokens: DesignTokens) {
  return {
    gridPatterns: scenegraph.totalNodes > 50 ? 'complex-multi-column' :
                 scenegraph.totalNodes > 20 ? 'moderate-layout' : 'minimal-single-column',
    visualHierarchy: scenegraph.root.children?.length > 4 ? 'multi-level' : 'simple',
    contentDensity: scenegraph.totalNodes > 100 ? 'high' :
                   scenegraph.totalNodes > 30 ? 'medium' : 'low'
  };
}

function convertToAdaptiveLayoutResult(aiLayout: any, request: GenerativeLayoutRequest): AdaptiveLayoutResult {
  // Convert AI response to our internal format
  const adaptiveLayout: AdaptiveLayout = {
    frame: {
      width: aiLayout.gridSystem.strategy === 'fluid' ? 'fluid' : aiLayout.gridSystem.maxWidth || 1440,
      maxWidth: aiLayout.gridSystem.maxWidth || 1440,
      padding: request.tokens.spacing.find(s => s >= 16 && s <= 32) || 24
    },
    grid: {
      columns: aiLayout.gridSystem.columns,
      gutter: aiLayout.gridSystem.gutter,
      maxWidth: aiLayout.gridSystem.maxWidth,
      breakpoints: aiLayout.gridSystem.breakpoints || [],
      strategy: aiLayout.gridSystem.strategy
    },
    stacks: aiLayout.stacks.map(convertStackToAdaptive),
    sections: aiLayout.sections.reduce((acc: any, section: any) => {
      acc[section.sectionId] = {
        minWidth: section.minWidth,
        minHeight: section.minHeight,
        preferredCols: section.preferredCols,
        maxCols: section.maxCols,
        aspectRatio: section.aspectRatio
      };
      return acc;
    }, {}),
    responsiveStrategy: aiLayout.responsiveStrategy
  };

  return {
    runId: '',
    layout: adaptiveLayout,
    sections: aiLayout.sections.map((s: any) => s.sectionId),
    generationMethod: 'ai-generated',
    confidence: aiLayout.confidence,
    reasoning: aiLayout.reasoning,
    constraints: {
      satisfied: 0,
      total: 0,
      violations: []
    }
  };
}

function convertStackToAdaptive(stack: any): AdaptiveLayoutStack {
  return {
    id: stack.id,
    direction: stack.direction,
    gap: stack.gap,
    areas: stack.areas.map((area: any) => {
      if (area.areas) {
        return convertStackToAdaptive(area);
      }
      return {
        sectionId: area.sectionId,
        semanticType: area.semanticType || area.sectionId,
        cols: area.cols,
        minHeight: area.minHeight
      };
    }),
    justify: stack.justify,
    align: stack.align,
    breakpoints: stack.breakpoints
  };
}






export async function synthesizeLayout(runId: string, artifactDir?: string): Promise<AdaptiveLayoutResult> {
  const baseDir = artifactDir || join(process.cwd(), 'artifacts');
  const runDir = join(baseDir, runId);

  try {
    // Read adaptive intent, design tokens, and scenegraph
    const fileReads = [
      readFile(join(runDir, 'adaptive_intent.json'), 'utf8'),
      readFile(join(runDir, 'design_tokens.json'), 'utf8'),
      readFile(join(runDir, 'scenegraph.json'), 'utf8'),
    ];

    const [intentContent, tokensContent, scenegraphContent] = await Promise.all(fileReads);

    if (!intentContent || !tokensContent || !scenegraphContent) {
      throw new Error('Adaptive intent, tokens, and scenegraph files are required');
    }

    const intent: AdaptiveIntent = JSON.parse(intentContent);
    const tokens: DesignTokens = JSON.parse(tokensContent);
    const scenegraph: SceneGraph = JSON.parse(scenegraphContent);

    // Use new adaptive layout generation
    const request: GenerativeLayoutRequest = {
      scenegraph,
      tokens,
      intent
    };

    const adaptiveResult = await generateAdaptiveLayout(request);
    adaptiveResult.runId = runId;

    // Save adaptive layout
    await writeFile(join(runDir, 'adaptive_layout.json'), JSON.stringify(adaptiveResult.layout, null, 2));

    // Return adaptive layout result
    return adaptiveResult;

  } catch (error) {
    console.error('❌ Adaptive layout generation failed:', error);
    throw error;
  }
}


// Layout module refactored - only uses AdaptiveLayout interfaces