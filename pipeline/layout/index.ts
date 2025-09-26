import { readFile, writeFile } from 'fs/promises';
import { join } from 'path';
import { OpenAI } from 'openai';
import type { Intent, SectionType, AdaptiveIntent } from '../intent';
import type { DesignTokens } from '../tokens';
import type { SceneGraph } from '../scenegraph';

export interface LayoutArea {
  section: SectionType;
  cols: number;
  minHeight?: number;
  content?: string;
}

export interface LayoutStack {
  id: string;
  direction: 'row' | 'column';
  gap: number;
  areas: (LayoutArea | LayoutStack)[];
  justify?: 'start' | 'center' | 'end' | 'between' | 'around';
  align?: 'start' | 'center' | 'end' | 'stretch';
}

export interface Layout {
  frame: {
    width: number;
    maxWidth: number;
    padding: number;
  };
  grid: {
    columns: number;
    gutter: number;
  };
  stacks: LayoutStack[];
  sections: Record<SectionType, {
    minWidth: number;
    minHeight: number;
    preferredCols: number;
  }>;
}

export interface LayoutResult {
  runId: string;
  layout: Layout;
  sections: SectionType[];
  constraints: {
    satisfied: number;
    total: number;
    violations: string[];
  };
}

// New adaptive layout interfaces
export interface GenerativeLayoutRequest {
  scenegraph: SceneGraph;
  tokens: DesignTokens;
  intent: Intent;
  adaptiveIntent?: AdaptiveIntent;
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
  generationMethod: 'ai-generated' | 'template-fallback';
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
          areas: { type: 'array' }
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

  // Use adaptive intent if available, fallback to legacy
  const sections = request.adaptiveIntent?.discoveredSections ||
    request.intent.required_sections.map(s => ({ semanticType: s, purpose: 'Legacy section' }));

  const layoutPrompt = `You are an expert UI/UX designer generating professional layout specifications.

DESIGN CONTEXT:
- Page Type: ${request.adaptiveIntent?.pageType || request.intent.page_type}
- Primary Entity: ${request.adaptiveIntent?.primaryEntity || request.intent.primary_entity}
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
      functions: [{
        name: 'generate_adaptive_layout',
        description: 'Generate comprehensive layout specification',
        parameters: ADAPTIVE_LAYOUT_SCHEMA
      }],
      function_call: { name: 'generate_adaptive_layout' },
      temperature: 0.3,
    });

    const functionCall = response.choices[0].message.function_call;
    if (!functionCall?.arguments) {
      throw new Error('Failed to get structured response from GPT-4o');
    }

    const aiLayout = JSON.parse(functionCall.arguments);
    return convertToAdaptiveLayoutResult(aiLayout, request);
  } catch (error) {
    console.warn('AI layout generation failed:', error);
    return generateFallbackLayout(request);
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

function generateFallbackLayout(request: GenerativeLayoutRequest): AdaptiveLayoutResult {
  // Use legacy template system as fallback
  const template = LEGACY_LAYOUT_TEMPLATES[request.intent.page_type] || LEGACY_LAYOUT_TEMPLATES.detail;
  const stacks = template(request.intent.required_sections);

  return {
    runId: '',
    layout: convertLegacyToAdaptive(stacks, request),
    sections: request.intent.required_sections,
    generationMethod: 'template-fallback',
    confidence: 0.7,
    reasoning: 'Fallback to template due to AI generation failure',
    constraints: {
      satisfied: 0,
      total: 0,
      violations: []
    }
  };
}

function convertLegacyToAdaptive(stacks: LayoutStack[], request: GenerativeLayoutRequest): AdaptiveLayout {
  return {
    frame: { width: 1280, maxWidth: 1280, padding: 24 },
    grid: {
      columns: 12,
      gutter: 24,
      breakpoints: [],
      strategy: 'fixed'
    },
    stacks: stacks.map(convertLegacyStackToAdaptive),
    sections: { ...LEGACY_SECTION_SPECS },
    responsiveStrategy: {
      approach: 'desktop-first',
      breakpoints: [768, 1024],
      stackingOrder: [],
      priorityContent: []
    }
  };
}

function convertLegacyStackToAdaptive(stack: LayoutStack): AdaptiveLayoutStack {
  return {
    id: stack.id,
    direction: stack.direction,
    gap: stack.gap,
    areas: stack.areas.map(area => {
      if ('areas' in area) {
        return convertLegacyStackToAdaptive(area);
      }
      return {
        sectionId: area.section,
        semanticType: area.section,
        cols: area.cols,
        minHeight: area.minHeight
      };
    }),
    justify: stack.justify,
    align: stack.align
  };
}

// Keep legacy templates for fallback (renamed to avoid conflicts)
const LEGACY_SECTION_SPECS = {
  // Detail page sections
  gallery: { minWidth: 400, minHeight: 300, preferredCols: 7 },
  summary: { minWidth: 300, minHeight: 200, preferredCols: 5 },
  price_cta: { minWidth: 280, minHeight: 120, preferredCols: 4 },
  amenities: { minWidth: 600, minHeight: 200, preferredCols: 12 },
  reviews: { minWidth: 600, minHeight: 300, preferredCols: 12 },
  trust_signals: { minWidth: 200, minHeight: 80, preferredCols: 3 },

  // Generic sections
  hero: { minWidth: 800, minHeight: 400, preferredCols: 12 },
  features: { minWidth: 900, minHeight: 400, preferredCols: 12 },
  testimonials: { minWidth: 800, minHeight: 300, preferredCols: 12 },
  faq: { minWidth: 600, minHeight: 400, preferredCols: 8 },
  contact: { minWidth: 400, minHeight: 300, preferredCols: 6 },

  // Profile sections
  avatar: { minWidth: 200, minHeight: 200, preferredCols: 3 },
  bio: { minWidth: 400, minHeight: 150, preferredCols: 6 },
  experience: { minWidth: 500, minHeight: 300, preferredCols: 8 },
  portfolio: { minWidth: 600, minHeight: 400, preferredCols: 9 },
  social_links: { minWidth: 300, minHeight: 60, preferredCols: 4 },
} as const;

const LEGACY_LAYOUT_TEMPLATES: Record<string, (sections: SectionType[]) => LayoutStack[]> = {
  detail: (sections: SectionType[]) => {
    const stacks: LayoutStack[] = [];

    // Hero section (if present)
    if (sections.includes('hero')) {
      stacks.push({
        id: 'hero_section',
        direction: 'column',
        gap: 24,
        areas: [{ section: 'hero', cols: 12 }],
        justify: 'center',
        align: 'center'
      });
    }

    // Main content: Gallery + Summary/Price
    const mainContentAreas: LayoutArea[] = [];
    if (sections.includes('gallery')) {
      mainContentAreas.push({ section: 'gallery', cols: 7 });
    }

    // Summary and price in sidebar
    const sidebarAreas: LayoutArea[] = [];
    if (sections.includes('summary')) {
      sidebarAreas.push({ section: 'summary', cols: 5 });
    }
    if (sections.includes('price_cta')) {
      sidebarAreas.push({ section: 'price_cta', cols: 5, minHeight: 120 });
    }
    if (sections.includes('trust_signals')) {
      sidebarAreas.push({ section: 'trust_signals', cols: 5 });
    }

    if (mainContentAreas.length > 0 || sidebarAreas.length > 0) {
      const mainAreas: (LayoutArea | LayoutStack)[] = [];

      if (mainContentAreas.length > 0) {
        mainAreas.push(...mainContentAreas);
      }

      if (sidebarAreas.length > 0) {
        mainAreas.push({
          id: 'sidebar',
          direction: 'column',
          gap: 16,
          areas: sidebarAreas,
          align: 'stretch'
        });
      }

      stacks.push({
        id: 'main_content',
        direction: 'row',
        gap: 32,
        areas: mainAreas,
        align: 'start'
      });
    }

    // Additional sections below
    const belowSections = sections.filter(s =>
      !['hero', 'gallery', 'summary', 'price_cta', 'trust_signals'].includes(s)
    );

    for (const section of belowSections) {
      stacks.push({
        id: `${section}_section`,
        direction: 'column',
        gap: 24,
        areas: [{ section, cols: LEGACY_SECTION_SPECS[section]?.preferredCols || 12 }],
      });
    }

    return stacks;
  },

  list: (sections: SectionType[]) => {
    const stacks: LayoutStack[] = [];

    // Hero section
    if (sections.includes('hero')) {
      stacks.push({
        id: 'hero_section',
        direction: 'column',
        gap: 24,
        areas: [{ section: 'hero', cols: 12 }],
        justify: 'center',
        align: 'center'
      });
    }

    // Features in grid
    if (sections.includes('features')) {
      stacks.push({
        id: 'features_section',
        direction: 'column',
        gap: 32,
        areas: [{ section: 'features', cols: 12 }],
      });
    }

    // Other sections
    const otherSections = sections.filter(s => !['hero', 'features'].includes(s));
    for (const section of otherSections) {
      stacks.push({
        id: `${section}_section`,
        direction: 'column',
        gap: 24,
        areas: [{ section, cols: LEGACY_SECTION_SPECS[section]?.preferredCols || 12 }],
      });
    }

    return stacks;
  },

  profile: (sections: SectionType[]) => {
    const stacks: LayoutStack[] = [];

    // Header with avatar and bio
    const headerAreas: LayoutArea[] = [];
    if (sections.includes('avatar')) {
      headerAreas.push({ section: 'avatar', cols: 3 });
    }
    if (sections.includes('bio')) {
      headerAreas.push({ section: 'bio', cols: 9 });
    }

    if (headerAreas.length > 0) {
      stacks.push({
        id: 'profile_header',
        direction: 'row',
        gap: 32,
        areas: headerAreas,
        align: 'center'
      });
    }

    // Portfolio and experience
    if (sections.includes('portfolio')) {
      stacks.push({
        id: 'portfolio_section',
        direction: 'column',
        gap: 24,
        areas: [{ section: 'portfolio', cols: 12 }],
      });
    }

    if (sections.includes('experience')) {
      stacks.push({
        id: 'experience_section',
        direction: 'column',
        gap: 24,
        areas: [{ section: 'experience', cols: 10 }],
        justify: 'center'
      });
    }

    // Social links
    if (sections.includes('social_links')) {
      stacks.push({
        id: 'social_section',
        direction: 'column',
        gap: 16,
        areas: [{ section: 'social_links', cols: 6 }],
        justify: 'center',
        align: 'center'
      });
    }

    return stacks;
  }
};

export async function synthesizeLayout(runId: string, artifactDir?: string): Promise<LayoutResult> {
  const baseDir = artifactDir || join(process.cwd(), 'artifacts');
  const runDir = join(baseDir, runId);

  try {
    // Read intent, adaptive intent (if available), design tokens, and scenegraph
    const fileReads = [
      readFile(join(runDir, 'intent.json'), 'utf8'),
      readFile(join(runDir, 'design_tokens.json'), 'utf8'),
      readFile(join(runDir, 'scenegraph.json'), 'utf8').catch(() => null),
      readFile(join(runDir, 'adaptive_intent.json'), 'utf8').catch(() => null),
    ];

    const [intentContent, tokensContent, scenegraphContent, adaptiveIntentContent] = await Promise.all(fileReads);

    const intent: Intent = JSON.parse(intentContent);
    const tokens: DesignTokens = JSON.parse(tokensContent);
    const scenegraph: SceneGraph | null = scenegraphContent ? JSON.parse(scenegraphContent) : null;
    const adaptiveIntent: AdaptiveIntent | undefined = adaptiveIntentContent ? JSON.parse(adaptiveIntentContent) : undefined;

    if (!scenegraph) {
      throw new Error('Scenegraph required for adaptive layout generation');
    }

    // Use new adaptive layout generation
    const request: GenerativeLayoutRequest = {
      scenegraph,
      tokens,
      intent,
      adaptiveIntent
    };

    const adaptiveResult = await generateAdaptiveLayout(request);
    adaptiveResult.runId = runId;

    // Convert to legacy format for backward compatibility
    const legacyLayout = convertAdaptiveToLegacyLayout(adaptiveResult.layout);
    const legacyConstraints = validateConstraints(legacyLayout, intent.required_sections);

    // Save both formats
    await Promise.all([
      writeFile(join(runDir, 'layout.json'), JSON.stringify(legacyLayout, null, 2)),
      writeFile(join(runDir, 'adaptive_layout.json'), JSON.stringify(adaptiveResult.layout, null, 2))
    ]);

    // Return legacy format for pipeline compatibility
    return {
      runId,
      layout: legacyLayout,
      sections: intent.required_sections,
      constraints: legacyConstraints,
    };

  } catch (error) {
    console.warn('Adaptive layout generation failed, using fallback:', error);
    return await generateLegacyLayout(runId, artifactDir);
  }
}

// Fallback to legacy template system
async function generateLegacyLayout(runId: string, artifactDir?: string): Promise<LayoutResult> {
  const baseDir = artifactDir || join(process.cwd(), 'artifacts');
  const runDir = join(baseDir, runId);

  const [intentContent, tokensContent] = await Promise.all([
    readFile(join(runDir, 'intent.json'), 'utf8'),
    readFile(join(runDir, 'design_tokens.json'), 'utf8'),
  ]);

  const intent: Intent = JSON.parse(intentContent);
  const tokens: DesignTokens = JSON.parse(tokensContent);

  // Select appropriate gap from design tokens
  const availableGaps = tokens.spacing.filter(s => s >= 8 && s <= 48);
  const defaultGap = availableGaps[Math.floor(availableGaps.length / 2)] || 24;

  // Generate layout using legacy template
  const template = LEGACY_LAYOUT_TEMPLATES[intent.page_type] || LEGACY_LAYOUT_TEMPLATES.detail;
  const stacks = template(intent.required_sections);

  // Apply design token gaps to stacks
  const adjustedStacks = stacks.map((stack: any) => ({
    ...stack,
    gap: findClosestGap(stack.gap, availableGaps) || defaultGap
  }));

  const layout: Layout = {
    frame: {
      width: 1280,
      maxWidth: 1280,
      padding: 24,
    },
    grid: {
      columns: 12,
      gutter: 24,
    },
    stacks: adjustedStacks,
    sections: { ...LEGACY_SECTION_SPECS }
  };

  // Validate constraints
  const constraints = validateConstraints(layout, intent.required_sections);

  // Save layout
  await writeFile(join(runDir, 'layout.json'), JSON.stringify(layout, null, 2));

  return {
    runId,
    layout,
    sections: intent.required_sections,
    constraints,
  };
}

function convertAdaptiveToLegacyLayout(adaptiveLayout: AdaptiveLayout): Layout {
  return {
    frame: {
      width: typeof adaptiveLayout.frame.width === 'number' ? adaptiveLayout.frame.width : 1440,
      maxWidth: adaptiveLayout.frame.maxWidth,
      padding: adaptiveLayout.frame.padding,
    },
    grid: {
      columns: adaptiveLayout.grid.columns,
      gutter: adaptiveLayout.grid.gutter,
    },
    stacks: adaptiveLayout.stacks.map(convertAdaptiveStackToLegacy),
    sections: adaptiveLayout.sections as any
  };
}

function convertAdaptiveStackToLegacy(stack: AdaptiveLayoutStack): LayoutStack {
  return {
    id: stack.id,
    direction: stack.direction,
    gap: stack.gap,
    areas: stack.areas.map(area => {
      if ('areas' in area) {
        return convertAdaptiveStackToLegacy(area);
      }
      return {
        section: area.semanticType as SectionType,
        cols: area.cols,
        minHeight: area.minHeight
      };
    }),
    justify: stack.justify,
    align: stack.align
  };
}

function findClosestGap(targetGap: number, availableGaps: number[]): number | null {
  if (availableGaps.length === 0) return null;

  return availableGaps.reduce((closest, gap) => {
    return Math.abs(gap - targetGap) < Math.abs(closest - targetGap) ? gap : closest;
  });
}

function validateConstraints(layout: Layout, requiredSections: SectionType[]): LayoutResult['constraints'] {
  const violations: string[] = [];
  let satisfied = 0;
  let total = 0;

  // Check that all required sections are present
  const presentSections = extractSectionsFromStacks(layout.stacks);
  for (const section of requiredSections) {
    total++;
    if (presentSections.includes(section)) {
      satisfied++;
    } else {
      violations.push(`Missing required section: ${section}`);
    }
  }

  // Check minimum width constraints
  for (const stack of layout.stacks) {
    const stackViolations = validateStackConstraints(stack, layout);
    violations.push(...stackViolations);
    total += 1; // Each stack should satisfy constraints
    if (stackViolations.length === 0) satisfied++;
  }

  // Check that gaps are within design token set
  for (const stack of layout.stacks) {
    total++;
    // This is a simplified check - in practice we'd verify against actual tokens
    if (stack.gap >= 8 && stack.gap <= 48 && stack.gap % 8 === 0) {
      satisfied++;
    } else {
      violations.push(`Gap ${stack.gap} not in token set for stack ${stack.id}`);
    }
  }

  return {
    satisfied,
    total,
    violations,
  };
}

function extractSectionsFromStacks(stacks: LayoutStack[]): SectionType[] {
  const sections: SectionType[] = [];

  function traverse(areas: (LayoutArea | LayoutStack)[]) {
    for (const area of areas) {
      if ('section' in area) {
        sections.push(area.section);
      } else {
        traverse(area.areas);
      }
    }
  }

  for (const stack of stacks) {
    traverse(stack.areas);
  }

  return sections;
}

function validateStackConstraints(stack: LayoutStack, layout: Layout): string[] {
  const violations: string[] = [];
  const colWidth = (layout.frame.width - layout.frame.padding * 2) / layout.grid.columns;

  for (const area of stack.areas) {
    if ('section' in area) {
      const specs = LEGACY_SECTION_SPECS[area.section];
      if (specs) {
        const areaWidth = area.cols * colWidth;

        if (areaWidth < specs.minWidth) {
          violations.push(`${area.section} width ${areaWidth}px < minimum ${specs.minWidth}px`);
        }

        if (area.minHeight && area.minHeight < specs.minHeight) {
          violations.push(`${area.section} height ${area.minHeight}px < minimum ${specs.minHeight}px`);
        }
      }
    } else {
      // Recursive check for nested stacks
      const nestedViolations = validateStackConstraints(area, layout);
      violations.push(...nestedViolations);
    }
  }

  return violations;
}