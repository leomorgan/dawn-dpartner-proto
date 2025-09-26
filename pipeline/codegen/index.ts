import { readFile, writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';
import { OpenAI } from 'openai';
import type { StyledComponent, StyledSection } from '../styling';
import type { SectionType, Intent } from '../intent';
import type { DesignTokens } from '../tokens';

export interface GeneratedComponent {
  name: string;
  filename: string;
  code: string;
  imports: string[];
  exports: string[];
}

export interface CodegenResult {
  runId: string;
  components: GeneratedComponent[];
  indexFile: string;
  totalLines: number;
}

interface ContentGenerationContext {
  designTokens: DesignTokens;
  intent: Intent;
  sectionType: SectionType;
}

interface BrandPersonality {
  tone: 'professional' | 'playful' | 'elegant' | 'bold' | 'minimal' | 'luxury' | 'friendly';
  energy: 'calm' | 'energetic' | 'sophisticated' | 'dynamic';
  trustLevel: 'conservative' | 'modern' | 'innovative' | 'experimental';
}

interface PatternVariation {
  name: string;
  approach: string;
  contentStrategy: 'feature-focused' | 'benefit-driven' | 'story-driven' | 'data-driven';
  designElements: string[];
  brandPersonalities: BrandPersonality['tone'][];
}

interface ComponentPattern {
  sectionType: SectionType;
  variations: PatternVariation[];
  brandAdaptations: Record<string, string>;
}

async function loadDesignTokens(runId: string, artifactDir?: string): Promise<DesignTokens> {
  const baseDir = artifactDir || join(process.cwd(), 'artifacts');
  const runDir = join(baseDir, runId);
  const tokensContent = await readFile(join(runDir, 'design_tokens.json'), 'utf8');
  return JSON.parse(tokensContent);
}

async function loadIntent(runId: string, artifactDir?: string): Promise<Intent> {
  const baseDir = artifactDir || join(process.cwd(), 'artifacts');
  const runDir = join(baseDir, runId);
  const intentContent = await readFile(join(runDir, 'intent.json'), 'utf8');
  return JSON.parse(intentContent);
}

// Sophisticated Pattern Library replacing hardcoded prompts
const COMPONENT_PATTERNS: ComponentPattern[] = [
  {
    sectionType: 'hero',
    variations: [
      {
        name: 'minimal-impact',
        approach: 'Clean, focused messaging with strong visual hierarchy',
        contentStrategy: 'benefit-driven',
        designElements: ['minimal text', 'bold typography', 'strategic whitespace', 'single CTA'],
        brandPersonalities: ['minimal', 'professional', 'elegant']
      },
      {
        name: 'feature-showcase',
        approach: 'Comprehensive feature presentation with detailed benefits',
        contentStrategy: 'feature-focused',
        designElements: ['feature highlights', 'benefit bullets', 'social proof', 'dual CTAs'],
        brandPersonalities: ['professional', 'bold', 'friendly']
      },
      {
        name: 'story-driven',
        approach: 'Narrative approach connecting with user journey',
        contentStrategy: 'story-driven',
        designElements: ['compelling narrative', 'emotional hooks', 'user testimonial', 'journey CTA'],
        brandPersonalities: ['playful', 'friendly', 'luxury']
      },
      {
        name: 'data-powered',
        approach: 'Metrics and proof points leading value proposition',
        contentStrategy: 'data-driven',
        designElements: ['key statistics', 'performance metrics', 'trust indicators', 'results CTA'],
        brandPersonalities: ['professional', 'bold', 'elegant']
      }
    ],
    brandAdaptations: {
      'professional': 'Use formal language, emphasize reliability and expertise',
      'playful': 'Use casual tone, add personality and humor where appropriate',
      'elegant': 'Refined language, focus on sophistication and quality',
      'bold': 'Strong statements, action-oriented language, confidence',
      'minimal': 'Concise messaging, focus on essential benefits only',
      'luxury': 'Premium positioning, exclusive language, aspirational tone',
      'friendly': 'Conversational tone, approachable language, community focus'
    }
  },
  {
    sectionType: 'gallery',
    variations: [
      {
        name: 'grid-showcase',
        approach: 'Organized grid highlighting key visual elements',
        contentStrategy: 'feature-focused',
        designElements: ['organized grid', 'hover effects', 'category filters', 'lightbox modal'],
        brandPersonalities: ['professional', 'minimal', 'elegant']
      },
      {
        name: 'masonry-creative',
        approach: 'Dynamic masonry layout for creative impact',
        contentStrategy: 'story-driven',
        designElements: ['masonry layout', 'varied sizes', 'overlay captions', 'scroll animations'],
        brandPersonalities: ['playful', 'bold', 'luxury']
      },
      {
        name: 'carousel-focused',
        approach: 'Sequential presentation with detailed descriptions',
        contentStrategy: 'benefit-driven',
        designElements: ['navigation controls', 'detailed captions', 'progress indicators', 'auto-play'],
        brandPersonalities: ['friendly', 'professional', 'bold']
      }
    ],
    brandAdaptations: {
      'professional': 'Clean layouts, informative captions, business-focused imagery',
      'playful': 'Creative layouts, fun interactions, personality in descriptions',
      'elegant': 'Sophisticated presentations, refined aesthetics, premium feel',
      'bold': 'Strong visual impact, dramatic presentations, confident descriptions',
      'minimal': 'Clean grids, minimal text, focus on visual quality',
      'luxury': 'Exclusive presentations, premium positioning, aspirational imagery',
      'friendly': 'Approachable layouts, community-focused, welcoming descriptions'
    }
  },
  {
    sectionType: 'features',
    variations: [
      {
        name: 'benefits-grid',
        approach: 'Benefit-focused feature presentation in organized grid',
        contentStrategy: 'benefit-driven',
        designElements: ['benefit headlines', 'supporting descriptions', 'icon illustrations', 'grid layout'],
        brandPersonalities: ['professional', 'friendly', 'minimal']
      },
      {
        name: 'comparison-table',
        approach: 'Detailed feature comparison with competitive advantages',
        contentStrategy: 'data-driven',
        designElements: ['comparison matrix', 'checkmarks/indicators', 'highlight advantages', 'clear categories'],
        brandPersonalities: ['professional', 'bold', 'elegant']
      },
      {
        name: 'story-features',
        approach: 'Feature presentation through user scenarios and stories',
        contentStrategy: 'story-driven',
        designElements: ['scenario descriptions', 'user journey maps', 'contextual examples', 'narrative flow'],
        brandPersonalities: ['playful', 'friendly', 'luxury']
      }
    ],
    brandAdaptations: {
      'professional': 'Technical accuracy, business benefits, ROI focus',
      'playful': 'Creative descriptions, fun analogies, engaging presentations',
      'elegant': 'Sophisticated feature descriptions, premium positioning',
      'bold': 'Strong feature claims, competitive advantages, confident tone',
      'minimal': 'Essential features only, clean presentations, no fluff',
      'luxury': 'Exclusive features, premium benefits, aspirational positioning',
      'friendly': 'Approachable explanations, community benefits, helpful tone'
    }
  }
];

function analyzeBrandPersonality(tokens: DesignTokens): BrandPersonality {
  // Analyze brand personality from design tokens
  const colors = tokens.colors.primary;
  const hasWarmColors = colors.some(c => c.includes('#f') || c.includes('#e') || c.toLowerCase().includes('red') || c.toLowerCase().includes('orange'));
  const hasCoolColors = colors.some(c => c.includes('#0') || c.includes('#3') || c.toLowerCase().includes('blue') || c.toLowerCase().includes('green'));
  const hasNeutralColors = colors.some(c => c.includes('#6') || c.includes('#8') || c.includes('#9') || c.toLowerCase().includes('gray'));

  // Simple spacing analysis from spacing array
  const spacingValues = tokens.spacing || [8, 16, 24, 32];
  const hasLargeSpacing = spacingValues.some(s => s >= 24);
  const hasSmallSpacing = spacingValues.every(s => s <= 16);

  // Simple typography analysis from font sizes
  const fontSizes = tokens.typography.fontSizes || [14, 16, 18, 20];
  const hasLargeFonts = fontSizes.some(s => s >= 24);
  const hasSmallFonts = fontSizes.every(s => s <= 16);

  // Determine tone from color psychology and design tokens
  let tone: BrandPersonality['tone'] = 'professional';
  if (hasWarmColors && hasLargeSpacing) tone = 'friendly';
  if (hasCoolColors && hasNeutralColors) tone = 'professional';
  if (colors.length <= 2 && hasNeutralColors) tone = 'minimal';
  if (colors.length >= 4 || hasWarmColors) tone = 'playful';
  if (hasCoolColors && hasSmallFonts) tone = 'elegant';

  // Determine energy from spacing and typography
  let energy: BrandPersonality['energy'] = 'calm';
  if (hasSmallSpacing || hasLargeFonts) energy = 'energetic';
  if (hasLargeSpacing && hasSmallFonts) energy = 'sophisticated';
  if (hasWarmColors && hasLargeSpacing) energy = 'dynamic';

  // Determine trust level from overall design approach
  let trustLevel: BrandPersonality['trustLevel'] = 'modern';
  if (hasNeutralColors && tone === 'professional') trustLevel = 'conservative';
  if (tone === 'playful') trustLevel = 'innovative';
  if (colors.length >= 5) trustLevel = 'experimental';

  return { tone, energy, trustLevel };
}

function selectOptimalPattern(sectionType: SectionType, brandPersonality: BrandPersonality): PatternVariation {
  // Find pattern for this section type
  const sectionPattern = COMPONENT_PATTERNS.find(p => p.sectionType === sectionType);
  if (!sectionPattern) {
    // Fallback to first variation if pattern not found
    return COMPONENT_PATTERNS[0].variations[0];
  }

  // Score variations by brand personality alignment
  const scoredVariations = sectionPattern.variations.map(variation => {
    const personalityMatch = variation.brandPersonalities.includes(brandPersonality.tone) ? 2 : 0;
    const energyMatch = variation.contentStrategy === 'data-driven' && brandPersonality.energy === 'sophisticated' ? 1 : 0;
    const trustMatch = variation.contentStrategy === 'story-driven' && brandPersonality.trustLevel === 'innovative' ? 1 : 0;

    return {
      variation,
      score: personalityMatch + energyMatch + trustMatch + Math.random() * 0.1 // Small randomization for variety
    };
  });

  // Return highest scoring variation
  return scoredVariations.sort((a, b) => b.score - a.score)[0].variation;
}

function generateIntelligentPrompt(
  sectionType: SectionType,
  pattern: PatternVariation,
  brandPersonality: BrandPersonality,
  intent: Intent,
  colors: any
): string {
  const sectionPattern = COMPONENT_PATTERNS.find(p => p.sectionType === sectionType);
  const brandGuidance = sectionPattern?.brandAdaptations[brandPersonality.tone] || 'Use professional tone';

  const basePrompt = `Create a sophisticated ${sectionType} component following the "${pattern.name}" approach.

DESIGN APPROACH: ${pattern.approach}

CONTENT STRATEGY: ${pattern.contentStrategy}
${pattern.contentStrategy === 'feature-focused' ? '- Focus on specific capabilities and functional benefits' :
  pattern.contentStrategy === 'benefit-driven' ? '- Emphasize user outcomes and value propositions' :
  pattern.contentStrategy === 'story-driven' ? '- Use narrative elements and emotional connections' :
  '- Leverage metrics, proof points, and quantifiable results'}

DESIGN ELEMENTS TO INCLUDE: ${pattern.designElements.join(', ')}

BRAND PERSONALITY GUIDANCE: ${brandGuidance}

BRAND COLORS:
- Primary: ${colors.primary}
- Accent: ${colors.accent}
- Text: ${colors.text}
- Background: ${colors.background}

ENTITY CONTEXT: ${intent.primary_entity}
BRAND ENERGY: ${brandPersonality.energy}
TRUST LEVEL: ${brandPersonality.trustLevel}

REQUIREMENTS:
- Create professional, design-grade component that reflects brand personality
- Use provided brand colors strategically
- Include appropriate interactive elements for ${pattern.name} pattern
- Generate realistic, contextual content (not placeholder text)
- Follow ${brandPersonality.tone} brand voice consistently
- Structure should support ${pattern.contentStrategy} strategy

Return ONLY the JSX component code, no explanation.`;

  return basePrompt;
}

function generateSophisticatedFallback(
  sectionType: SectionType,
  pattern: PatternVariation,
  brandPersonality: BrandPersonality,
  colors: any,
  intent: Intent
): string {
  // Generate sophisticated fallback components that still reflect brand personality
  const brandClass = brandPersonality.tone === 'minimal' ? 'space-y-4' :
                     brandPersonality.tone === 'playful' ? 'space-y-6' :
                     'space-y-5';

  const fallbackTemplates: Partial<Record<SectionType, string>> = {
    hero: `<div className="py-16 px-6 text-center ${brandClass}">
      <h1 className="text-4xl font-bold text-[${colors.text}] mb-4">
        ${brandPersonality.tone === 'luxury' ? 'Experience Premium' :
          brandPersonality.tone === 'playful' ? 'Welcome to Something Amazing' :
          brandPersonality.tone === 'professional' ? 'Professional Excellence' :
          'Discover Quality'} ${intent.primary_entity}
      </h1>
      <p className="text-lg text-[${colors.neutral}] max-w-2xl mx-auto mb-8">
        ${pattern.contentStrategy === 'benefit-driven' ? 'Experience the benefits that set us apart' :
          pattern.contentStrategy === 'feature-focused' ? 'Comprehensive features designed for your needs' :
          pattern.contentStrategy === 'story-driven' ? 'Join thousands who have discovered the difference' :
          'Proven results you can trust'}
      </p>
      <button className="bg-[${colors.accent}] text-white px-8 py-3 rounded-lg font-semibold hover:opacity-90 transition-opacity">
        ${brandPersonality.tone === 'professional' ? 'Get Started' :
          brandPersonality.tone === 'playful' ? 'Let\'s Go!' :
          'Explore Now'}
      </button>
    </div>`,

    gallery: `<div className="grid grid-cols-2 md:grid-cols-3 gap-4 p-6">
      ${Array(6).fill(0).map((_, i) =>
        `<div className="aspect-square bg-gradient-to-br from-[${colors.primary}] to-[${colors.accent}] rounded-lg opacity-20 flex items-center justify-center">
          <span className="text-[${colors.text}] font-medium">${i + 1}</span>
        </div>`
      ).join('')}
    </div>`,

    features: `<div className="py-12 px-6">
      <h2 className="text-3xl font-bold text-[${colors.text}] text-center mb-12">
        ${pattern.contentStrategy === 'benefit-driven' ? 'Why Choose Us' :
          pattern.contentStrategy === 'feature-focused' ? 'Powerful Features' :
          pattern.contentStrategy === 'story-driven' ? 'Your Success Story Starts Here' :
          'Proven Excellence'}
      </h2>
      <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
        ${Array(3).fill(0).map((_, i) => {
          const features = ['Quality', 'Innovation', 'Support'];
          const descriptions = [
            brandPersonality.tone === 'luxury' ? 'Uncompromising excellence' : 'Superior quality standards',
            brandPersonality.tone === 'playful' ? 'Creative solutions that wow' : 'Cutting-edge innovation',
            brandPersonality.tone === 'friendly' ? 'Always here to help' : 'Professional support team'
          ];
          return `<div className="text-center ${brandClass}">
            <div className="w-16 h-16 bg-[${colors.accent}] rounded-lg mx-auto mb-4 flex items-center justify-center">
              <span className="text-white font-bold text-xl">${i + 1}</span>
            </div>
            <h3 className="text-xl font-semibold text-[${colors.text}] mb-2">${features[i]}</h3>
            <p className="text-[${colors.neutral}]">${descriptions[i]}</p>
          </div>`;
        }).join('')}
      </div>
    </div>`
  };

  // Default fallback for sections not in templates
  const defaultFallback = `<div className="p-8 ${brandClass} border-l-4 border-[${colors.accent}]">
    <h2 className="text-2xl font-semibold text-[${colors.text}] mb-4">
      ${sectionType.charAt(0).toUpperCase() + sectionType.slice(1)} Section
    </h2>
    <p className="text-[${colors.neutral}] mb-4">
      ${pattern.approach} for your ${intent.primary_entity}.
    </p>
    <div className="inline-block bg-[${colors.primary}] text-white px-4 py-2 rounded">
      ${brandPersonality.tone === 'professional' ? 'Learn More' :
        brandPersonality.tone === 'playful' ? 'Check It Out' :
        'Discover More'}
    </div>
  </div>`;

  return fallbackTemplates[sectionType] || defaultFallback;
}

function getBrandColors(tokens: DesignTokens) {
  return {
    primary: tokens.colors.primary[0] || '#000000',
    accent: tokens.colors.neutral.find(c => c.includes('#ff') || c.includes('#0') || c.includes('#3')) || tokens.colors.primary[2] || '#ff385c',
    text: tokens.colors.semantic.text || tokens.colors.primary[0] || '#000000',
    background: tokens.colors.semantic.background || '#ffffff',
    neutral: tokens.colors.neutral[0] || '#666666',
    light: tokens.colors.primary.find(c => c === '#ffffff' || c === '#f7f7f7') || '#f7f7f7',
  };
}

async function generateDynamicSectionContent(context: ContentGenerationContext): Promise<string> {
  const { sectionType, intent, designTokens } = context;
  const colors = getBrandColors(designTokens);

  console.log(`🎨 Generating intelligent content for ${sectionType} section`);
  console.log('🎯 Brand colors extracted:', colors);
  console.log('🔑 OpenAI API key available:', !!process.env.OPENAI_API_KEY);

  // Analyze brand personality from design tokens
  const brandPersonality = analyzeBrandPersonality(designTokens);
  console.log('🧠 Brand personality analysis:', brandPersonality);

  // Select optimal pattern based on brand personality
  const selectedPattern = selectOptimalPattern(sectionType, brandPersonality);
  console.log(`🎯 Selected pattern: ${selectedPattern.name} (${selectedPattern.approach})`);

  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  const systemPrompt = `You are an expert UI developer generating sophisticated React JSX components for a ${intent.page_type} page about ${intent.primary_entity}.

Generate professional, design-grade components that reflect brand personality and follow modern design principles.

DESIGN TOKENS TO USE:
- Font family: ${designTokens.typography.fontFamilies[0] || 'Inter'}
- Border radius: ${designTokens.borderRadius.join(', ') || '8px, 12px, 16px'}
- Spacing: Follow 8px grid system
- Use Tailwind CSS classes with brand colors as hex values (e.g., bg-[${colors.primary}])

BRAND PERSONALITY: ${brandPersonality.tone} tone, ${brandPersonality.energy} energy, ${brandPersonality.trustLevel} trust level

QUALITY STANDARDS:
- Generate realistic, contextual content (not placeholder text)
- Professional component structure with proper accessibility
- Strategic use of brand colors for visual hierarchy
- Interactive elements appropriate for the pattern
- Responsive design considerations
- Clean, production-ready code

Return ONLY the JSX component code, no explanation.`;

  // Generate intelligent prompt based on pattern and brand personality
  const intelligentPrompt = generateIntelligentPrompt(
    sectionType,
    selectedPattern,
    brandPersonality,
    intent,
    colors
  );

  try {
    console.log(`🤖 Making intelligent OpenAI API call for ${sectionType} with ${selectedPattern.name} pattern`);
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: intelligentPrompt }
      ],
      max_tokens: 1200, // Increased for more sophisticated content
      temperature: 0.4, // Slight increase for brand-appropriate creativity
    });

    let content = response.choices[0].message.content?.trim() || `<div>Failed to generate ${sectionType} content</div>`;

    // Remove markdown code blocks if present
    if (content.startsWith('```jsx') && content.endsWith('```')) {
      content = content.slice(6, -3).trim();
    } else if (content.startsWith('```') && content.endsWith('```')) {
      content = content.slice(3, -3).trim();
    }

    console.log(`✅ Intelligent ${selectedPattern.name} pattern content generated for ${sectionType}`);
    console.log(`📄 Brand personality: ${brandPersonality.tone} • Strategy: ${selectedPattern.contentStrategy}`);
    console.log('📄 Generated content preview:', content.substring(0, 200) + '...');
    return content;
  } catch (error) {
    console.error('❌ Error generating intelligent content for', sectionType, ':', error);

    // Sophisticated fallback based on selected pattern
    const sophisticatedFallback = generateSophisticatedFallback(sectionType, selectedPattern, brandPersonality, colors, intent);
    console.log(`🔄 Using sophisticated ${selectedPattern.name} fallback pattern`);
    return sophisticatedFallback;
  }
}

export async function generateCode(runId: string, artifactDir?: string): Promise<CodegenResult> {
  const baseDir = artifactDir || join(process.cwd(), 'artifacts');
  const runDir = join(baseDir, runId);

  // Read styled components
  const styledComponentsContent = await readFile(join(runDir, 'styled_components.json'), 'utf8');
  const styledComponents: StyledComponent[] = JSON.parse(styledComponentsContent);

  // Generate React components (now async)
  const components = await Promise.all(
    styledComponents.map(component =>
      generateReactComponent(component, runId, artifactDir)
    )
  );

  // Generate index file
  const indexFile = generateIndexFile(components);

  // Create components directory
  const componentsDir = join(runDir, 'components');
  if (!existsSync(componentsDir)) {
    await mkdir(componentsDir, { recursive: true });
  }

  // Write component files
  await Promise.all([
    ...components.map(component =>
      writeFile(join(componentsDir, component.filename), component.code)
    ),
    writeFile(join(componentsDir, 'index.ts'), indexFile)
  ]);

  const totalLines = components.reduce((sum, comp) => sum + comp.code.split('\n').length, 0);

  return {
    runId,
    components,
    indexFile,
    totalLines,
  };
}

async function generateReactComponent(component: StyledComponent, runId: string, artifactDir?: string): Promise<GeneratedComponent> {
  const componentName = toPascalCase(component.id);
  const filename = `${componentName}.tsx`;

  // Load context for dynamic content generation
  const designTokens = await loadDesignTokens(runId, artifactDir);
  const intent = await loadIntent(runId, artifactDir);
  const context: ContentGenerationContext = {
    designTokens,
    intent,
    sectionType: 'hero' // Default section type, will be overridden for actual sections
  };

  const imports = ['import React from \'react\';'];
  const childComponents: string[] = [];

  // Generate child components recursively
  if (component.children) {
    for (const child of component.children) {
      if ('section' in child) {
        const sectionContext = { ...context, sectionType: child.section };
        childComponents.push(await generateSectionJSX(child, sectionContext));
      } else {
        childComponents.push(await generateComponentJSX(child, context));
      }
    }
  }

  const styleProps = generateInlineStyles(component.styles);
  const jsx = component.children
    ? `<${component.element} className="${component.className}"${styleProps}>
        ${childComponents.join('\n        ')}
      </${component.element}>`
    : `<${component.element} className="${component.className}"${styleProps} />`;

  const code = `${imports.join('\n')}

export interface ${componentName}Props {
  className?: string;
}

export const ${componentName}: React.FC<${componentName}Props> = ({
  className = ''
}) => {
  return (
    ${jsx.split('\n').map(line => `    ${line}`).join('\n')}
  );
};

export default ${componentName};`;

  return {
    name: componentName,
    filename,
    code,
    imports,
    exports: [componentName, `${componentName}Props`],
  };
}

async function generateSectionJSX(section: StyledSection, context: ContentGenerationContext): Promise<string> {
  const sectionName = toPascalCase(section.section);
  const styleProps = generateInlineStyles(section.styles);
  const content = await generateDynamicSectionContent(context);

  return `<section className="${section.className}"${styleProps}>
      ${content.trim().split('\n').map(line => `      ${line}`).join('\n')}
    </section>`;
}

async function generateComponentJSX(component: StyledComponent, context: ContentGenerationContext): Promise<string> {
  const childComponents: string[] = [];

  if (component.children) {
    for (const child of component.children) {
      if ('section' in child) {
        const sectionContext = { ...context, sectionType: child.section };
        childComponents.push(await generateSectionJSX(child, sectionContext));
      } else {
        childComponents.push(await generateComponentJSX(child, context));
      }
    }
  }

  const styleProps = generateInlineStyles(component.styles);

  if (component.children && component.children.length > 0) {
    return `<${component.element} className="${component.className}"${styleProps}>
        ${childComponents.join('\n        ')}
      </${component.element}>`;
  } else {
    return `<${component.element} className="${component.className}"${styleProps} />`;
  }
}

function generateInlineStyles(styles: StyledComponent['styles'] | StyledSection['styles']): string {
  const styleEntries = Object.entries(styles).filter(([_, value]) => value !== undefined);

  if (styleEntries.length === 0) {
    return '';
  }

  const styleObject = styleEntries
    .map(([key, value]) => `${key}: '${value}'`)
    .join(', ');

  return ` style={{ ${styleObject} }}`;
}

function generateIndexFile(components: GeneratedComponent[]): string {
  const exports = components.map(comp =>
    `export { ${comp.name}, type ${comp.name}Props } from './${comp.name.replace('.tsx', '')}';`
  ).join('\n');

  return `// Generated component exports
${exports}

// Re-export all components as default
export default {
  ${components.map(comp => comp.name).join(',\n  ')}
};`;
}

function toPascalCase(str: string): string {
  return str
    .split(/[-_]/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join('');
}