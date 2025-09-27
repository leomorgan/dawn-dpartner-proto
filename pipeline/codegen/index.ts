import { readFile, writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';
import { OpenAI } from 'openai';
import { generatePreviewHTML } from './preview-generator';
import type { StyledComponent, StyledSection, SemanticComponent, ComponentGenerationPlan, LayoutOrchestrator } from '../styling';
import type { AdaptiveIntent } from '../intent';
import type { DesignTokens } from '../tokens';

export interface GeneratedComponent {
  name: string;
  filename: string;
  code: string;
  imports: string[];
  exports: string[];
  isOrchestrator?: boolean;
}

export interface CodegenResult {
  runId: string;
  components: GeneratedComponent[];
  indexFile: string;
  totalLines: number;
}

interface ContentGenerationContext {
  designTokens: DesignTokens;
  intent: AdaptiveIntent;
  sectionType: string;
  componentName: string;
}

interface BrandPersonality {
  tone: 'professional' | 'playful' | 'elegant' | 'bold' | 'minimal' | 'luxury' | 'friendly';
  energy: 'calm' | 'energetic' | 'sophisticated' | 'dynamic';
  trustLevel: 'conservative' | 'modern' | 'innovative' | 'experimental';
}

async function loadDesignTokens(runId: string, artifactDir?: string): Promise<DesignTokens> {
  const baseDir = artifactDir || join(process.cwd(), 'artifacts');
  const runDir = join(baseDir, runId);
  const tokensContent = await readFile(join(runDir, 'design_tokens.json'), 'utf8');
  return JSON.parse(tokensContent);
}

async function loadIntent(runId: string, artifactDir?: string): Promise<AdaptiveIntent> {
  const baseDir = artifactDir || join(process.cwd(), 'artifacts');
  const runDir = join(baseDir, runId);
  const intentContent = await readFile(join(runDir, 'adaptive_intent.json'), 'utf8');
  return JSON.parse(intentContent);
}

async function loadComponentPlan(runId: string, artifactDir?: string): Promise<ComponentGenerationPlan | null> {
  const baseDir = artifactDir || join(process.cwd(), 'artifacts');
  const runDir = join(baseDir, runId);
  const planPath = join(runDir, 'component_plan.json');

  if (existsSync(planPath)) {
    const planContent = await readFile(planPath, 'utf8');
    return JSON.parse(planContent);
  }

  return null;
}

function analyzeBrandPersonality(tokens: DesignTokens): BrandPersonality {
  const colors = tokens.colors.primary;
  const hasWarmColors = colors.some(c => c.includes('#f') || c.includes('#e') || c.toLowerCase().includes('red') || c.toLowerCase().includes('orange'));
  const hasCoolColors = colors.some(c => c.includes('#0') || c.includes('#3') || c.toLowerCase().includes('blue') || c.toLowerCase().includes('green'));
  const hasNeutralColors = colors.some(c => c.includes('#6') || c.includes('#8') || c.includes('#9') || c.toLowerCase().includes('gray'));

  const spacingValues = tokens.spacing || [8, 16, 24, 32];
  const hasLargeSpacing = spacingValues.some(s => s >= 24);
  const hasSmallSpacing = spacingValues.every(s => s <= 16);

  const fontSizes = tokens.typography.fontSizes || [14, 16, 18, 20];
  const hasLargeFonts = fontSizes.some(s => s >= 24);
  const hasSmallFonts = fontSizes.every(s => s <= 16);

  let tone: BrandPersonality['tone'] = 'professional';
  if (hasWarmColors && hasLargeSpacing) tone = 'friendly';
  if (hasCoolColors && hasNeutralColors) tone = 'professional';
  if (colors.length <= 2 && hasNeutralColors) tone = 'minimal';
  if (colors.length >= 4 || hasWarmColors) tone = 'playful';
  if (hasCoolColors && hasSmallFonts) tone = 'elegant';

  let energy: BrandPersonality['energy'] = 'calm';
  if (hasSmallSpacing || hasLargeFonts) energy = 'energetic';
  if (hasLargeSpacing && hasSmallFonts) energy = 'sophisticated';
  if (hasWarmColors && hasLargeSpacing) energy = 'dynamic';

  let trustLevel: BrandPersonality['trustLevel'] = 'modern';
  if (hasNeutralColors && tone === 'professional') trustLevel = 'conservative';
  if (tone === 'playful') trustLevel = 'innovative';
  if (colors.length >= 5) trustLevel = 'experimental';

  return { tone, energy, trustLevel };
}

function getBrandColors(tokens: DesignTokens) {
  return {
    primary: tokens.colors.primary[0],
    accent: tokens.colors.semantic?.accent || tokens.colors.primary[2],
    cta: tokens.colors.semantic?.cta || tokens.colors.primary[1],
    text: tokens.colors.semantic.text,
    background: tokens.colors.semantic.background,
    muted: tokens.colors.semantic?.muted || tokens.colors.neutral[0],
    link: tokens.colors.contextual?.links?.[0] || tokens.colors.primary[1],
    neutral: tokens.colors.neutral[0],
    light: tokens.colors.contextual?.backgrounds?.[0] || tokens.colors.semantic.background,
    // Button variants
    buttonPrimary: tokens.colors.contextual?.buttons?.[0] || tokens.colors.semantic?.cta || tokens.colors.primary[0],
    buttonSecondary: tokens.colors.contextual?.buttons?.[1] || tokens.colors.neutral[0] || tokens.colors.semantic.background,
  };
}

async function generateSemanticContent(context: ContentGenerationContext): Promise<string> {
  const { sectionType, intent, designTokens, componentName } = context;
  const colors = getBrandColors(designTokens);

  console.log(`🎨 Generating content for ${componentName} (${sectionType})`);

  const brandPersonality = analyzeBrandPersonality(designTokens);

  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  const systemPrompt = `You are an expert UI developer generating complete JSX content for a ${intent.pageType} page about ${intent.primaryEntity}.

Generate professional JSX that will be placed directly inside a React component.

DESIGN TOKENS TO USE:
- Primary color: ${colors.primary}
- CTA/Action color: ${colors.cta}
- Accent color: ${colors.accent}
- Text color: ${colors.text}
- Muted text: ${colors.muted}
- Background: ${colors.background}
- Link color: ${colors.link}
- Button colors: Primary ${colors.buttonPrimary}, Secondary ${colors.buttonSecondary}
- Typography: Font family ${designTokens.typography.fontFamilies[0] || 'system-ui'}, weights ${designTokens.typography.fontWeights?.join(', ') || '400, 600, 700'}
- Spacing scale: ${designTokens.spacing.join('px, ')}px
- Border radius: ${designTokens.borderRadius.join(', ') || '8px, 12px, 16px'}
- Use Tailwind CSS classes with exact hex values (e.g., bg-[${colors.primary}], text-[${colors.text}])
- Use semantic Tailwind classes when possible (bg-semantic-cta, text-semantic-text, etc.)

BRAND PERSONALITY: ${brandPersonality.tone} tone, ${brandPersonality.energy} energy, ${brandPersonality.trustLevel} trust level

CRITICAL REQUIREMENTS:
- Generate complete, self-contained JSX with all data inline
- Use realistic mock data appropriate for ${intent.primaryEntity}
- NO component wrapper or function declaration
- NO separate data definitions - put data directly in JSX
- Professional component structure with proper accessibility
- Strategic use of brand colors for visual hierarchy
- Valid, complete JSX that will compile

Return ONLY the JSX content, no explanation, no markdown, no code blocks.`;

  const sectionPrompts: Record<string, string> = {
    'overview': `Create a sophisticated overview section that presents key summary information about ${intent.primaryEntity}.
      Include: headline, key metrics or highlights, brief description, and primary action.
      Use the ${brandPersonality.tone} tone to match the brand personality.
      Apply colors: headline in ${colors.text}, accent elements in ${colors.accent}, CTA button in ${colors.cta}.
      Use spacing from the scale: ${designTokens.spacing.join('px, ')}px.`,

    'details': `Create a detailed information section about ${intent.primaryEntity}.
      Include: structured data presentation, expandable sections if needed, clear information hierarchy.
      Present information in a ${brandPersonality.energy} way that matches the brand.
      Use text color ${colors.text}, muted text ${colors.muted}, links in ${colors.link}.
      Apply consistent spacing using the scale: ${designTokens.spacing.join('px, ')}px.`,

    'services': `Create a services/features section highlighting key offerings related to ${intent.primaryEntity}.
      Include: service cards or list, benefits, quick actions.
      Use ${brandPersonality.tone} tone to present the services.
      Cards should use background ${colors.light}, accent borders ${colors.accent}, action buttons ${colors.cta}.`,

    'alerts': `Create a notifications/alerts section for important updates about ${intent.primaryEntity}.
      Include: alert message, severity indication, action button if needed.
      Design with ${brandPersonality.energy} energy level.
      Use CTA color ${colors.cta} for important alerts, muted color ${colors.muted} for less critical ones.`,

    'preferences': `Create a settings/preferences section for user customization related to ${intent.primaryEntity}.
      Include: toggle switches, options, save button.
      Keep the interface ${brandPersonality.tone} and intuitive.
      Use primary button color ${colors.buttonPrimary}, secondary ${colors.buttonSecondary}, text ${colors.text}.`,

    'data-table': `Create a data table section showing ${intent.primaryEntity} records.
      IMPORTANT: Define the data array first (const payments = [...]) before using it in the table.
      Include: table headers, realistic row data (5-7 rows), proper column alignment.
      Make the data contextually relevant to ${intent.primaryEntity}.`,

    'chart': `Create a chart visualization section for ${intent.primaryEntity} metrics.
      IMPORTANT: Define chart data and options objects before using them.
      Include: chart title, data visualization placeholder, legend or labels.`,

    'form': `Create a form section for ${intent.primaryEntity} input.
      Include: relevant form fields, labels, submit button.
      Make it professional and user-friendly.`,

    'summary': `Create a summary section highlighting key information about ${intent.primaryEntity}.
      Include: key metrics, status indicators, important totals.
      Use clear visual hierarchy.`,

    'support': `Create a support/help section for ${intent.primaryEntity} assistance.
      Include: help text, contact options, FAQ or resources.
      Keep it helpful and accessible.`
  };

  const prompt = sectionPrompts[sectionType] ||
    `Create a ${sectionType} section for ${intent.primaryEntity} with ${brandPersonality.tone} tone. IMPORTANT: Define any data arrays or objects before using them.`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt }
      ],
      max_tokens: 1500,
      temperature: 0.4,
    });

    let content = response.choices[0].message.content?.trim();
    if (!content) {
      throw new Error(`OpenAI returned no content for ${sectionType}`);
    }

    // Remove markdown code blocks if present
    if (content.startsWith('```jsx') && content.endsWith('```')) {
      content = content.slice(6, -3).trim();
    } else if (content.startsWith('```') && content.endsWith('```')) {
      content = content.slice(3, -3).trim();
    }

    console.log(`✅ Generated content for ${componentName}`);
    return content;

  } catch (error) {
    console.error(`❌ Error generating content for ${sectionType}:`, error);
    throw new Error(`Failed to generate content for ${sectionType}: ${error}`);
  }
}

async function generateSemanticComponent(
  semantic: SemanticComponent,
  context: ContentGenerationContext
): Promise<GeneratedComponent> {
  const { componentName } = semantic;

  // Generate AI-driven content for this semantic section
  const jsxContent = await generateSemanticContent({
    sectionType: semantic.semanticType,
    componentName: semantic.componentName,
    intent: context.intent,
    designTokens: context.designTokens
  });

  const code = `export interface ${componentName}Props {
  className?: string;
}

export const ${componentName}: React.FC<${componentName}Props> = ({
  className = ''
}) => {
  return (
    <${semantic.element}
      className={\`${semantic.className} \${className}\`}
      style={{
        ${Object.entries(semantic.styles)
          .filter(([_, value]) => value !== undefined)
          .map(([key, value]) => {
            return `${key}: '${value}'`;
          })
          .join(',\n        ')}
      }}
    >
      ${jsxContent.split('\n').map(line => `      ${line}`).join('\n')}
    </${semantic.element}>
  );
};

export default ${componentName};`;

  return {
    name: componentName,
    filename: `${componentName}.tsx`,
    code,
    imports: [],
    exports: [componentName, `${componentName}Props`],
  };
}

function generateLayoutOrchestrator(
  orchestrator: LayoutOrchestrator,
  components: GeneratedComponent[],
  semanticComponents: SemanticComponent[]
): GeneratedComponent {
  const componentImports = components
    .filter(c => !c.isOrchestrator)
    .map(c => `import { ${c.name} } from './${c.name}';`)
    .join('\n');

  // Create a mapping from component IDs to component names using semantic components
  const idToComponentName: Record<string, string> = {};
  semanticComponents.forEach(sc => {
    idToComponentName[sc.id] = sc.componentName;
  });

  // Validate that ALL semantic components are included in orchestrator
  const allComponentIds = new Set(semanticComponents.map(sc => sc.id));
  const orchestratorIds = new Set(orchestrator.stacks.flatMap(s => s.componentIds));
  const missingIds = Array.from(allComponentIds).filter(id => !orchestratorIds.has(id));

  if (missingIds.length > 0) {
    throw new Error(`Layout orchestrator missing components: ${missingIds.join(', ')}`);
  }

  const stacksJSX = orchestrator.stacks.map(stack => {
    const stackComponents = stack.componentIds
      .map(id => {
        const componentName = idToComponentName[id];
        if (!componentName) {
          throw new Error(`Component ID "${id}" not found in semantic components`);
        }

        // Verify component exists in generated components
        const component = components.find(c => c.name === componentName);
        if (!component) {
          throw new Error(`Generated component "${componentName}" not found for ID "${id}"`);
        }

        return `        <${componentName} />`;
      })
      .join('\n');

    const styleProps = Object.entries(stack.styles)
      .filter(([_, value]) => value !== undefined)
      .map(([key, value]) => `${key}: '${value}'`)
      .join(', ');

    return `      <div
        className="${stack.className}"
        style={{ ${styleProps} }}
      >
${stackComponents}
      </div>`;
  }).join('\n');

  // Verify all components are used
  const usedComponentNames = new Set(
    orchestrator.stacks.flatMap(s =>
      s.componentIds.map(id => idToComponentName[id])
    )
  );
  const allComponentNames = new Set(components.filter(c => !c.isOrchestrator).map(c => c.name));
  const unusedComponents = Array.from(allComponentNames).filter(name => !usedComponentNames.has(name));

  if (unusedComponents.length > 0) {
    throw new Error(`Components not used in PageLayout: ${unusedComponents.join(', ')}`);
  }

  const code = `${componentImports}

export interface PageLayoutProps {
  className?: string;
}

export const PageLayout: React.FC<PageLayoutProps> = ({
  className = ''
}) => {
  return (
    <div className={\`page-layout \${className}\`}>
${stacksJSX}
    </div>
  );
};

export default PageLayout;`;

  return {
    name: 'PageLayout',
    filename: 'PageLayout.tsx',
    code,
    imports: [],
    exports: ['PageLayout', 'PageLayoutProps'],
    isOrchestrator: true,
  };
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

// Main function with new semantic component generation
export async function generateCode(runId: string, artifactDir?: string): Promise<CodegenResult> {
  const baseDir = artifactDir || join(process.cwd(), 'artifacts');
  const runDir = join(baseDir, runId);

  // Try to load component plan (new structure)
  const componentPlan = await loadComponentPlan(runId, artifactDir);

  if (componentPlan) {
    console.log('📦 Using new component plan structure');

    // Load context for content generation
    const [designTokens, intent] = await Promise.all([
      loadDesignTokens(runId, artifactDir),
      loadIntent(runId, artifactDir)
    ]);

    const context: ContentGenerationContext = {
      designTokens,
      intent,
      sectionType: '',
      componentName: ''
    };

    // Generate individual semantic components
    const semanticComponents = await Promise.all(
      componentPlan.semanticComponents.map(semantic =>
        generateSemanticComponent(semantic, context)
      )
    );

    // Generate layout orchestrator
    const layoutOrchestrator = generateLayoutOrchestrator(
      componentPlan.layoutOrchestrator,
      semanticComponents,
      componentPlan.semanticComponents
    );

    const allComponents = [...semanticComponents, layoutOrchestrator];

    // Generate index file
    const indexFile = generateIndexFile(allComponents);

    // Create components directory
    const componentsDir = join(runDir, 'components');
    if (!existsSync(componentsDir)) {
      await mkdir(componentsDir, { recursive: true });
    }

    // Write all component files
    await Promise.all([
      ...allComponents.map(component =>
        writeFile(join(componentsDir, component.filename), component.code)
      ),
      writeFile(join(componentsDir, 'index.ts'), indexFile)
    ]);

    // Generate preview HTML
    const previewHTML = await generatePreviewHTML(
      allComponents,
      runId,
      designTokens
    );
    await writeFile(join(runDir, 'preview.html'), previewHTML);

    const totalLines = allComponents.reduce((sum, comp) => sum + comp.code.split('\n').length, 0);

    return {
      runId,
      components: allComponents,
      indexFile,
      totalLines,
    };

  } else {
    // NO FALLBACKS - component plan is required
    throw new Error('No component plan found. Run styling module first to generate component_plan.json');
  }
}

