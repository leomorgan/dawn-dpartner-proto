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

  console.log(`🎨 Generating dynamic content for ${sectionType} section`);
  console.log('🎯 Brand colors extracted:', colors);
  console.log('🔑 OpenAI API key available:', !!process.env.OPENAI_API_KEY);

  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  const systemPrompt = `You are an expert UI developer generating React JSX content for a ${intent.page_type} page about ${intent.primary_entity}.

Generate ONLY the JSX content for a ${sectionType} section that:
1. Uses these exact brand colors:
   - Primary: ${colors.primary}
   - Accent: ${colors.accent}
   - Text: ${colors.text}
   - Light: ${colors.light}
   - Neutral: ${colors.neutral}

2. Uses extracted design tokens:
   - Font family: ${designTokens.typography.fontFamilies[0]}
   - Border radius: ${designTokens.borderRadius.join(', ')}
   - Spacing: 8px grid system

3. Generates realistic ${intent.primary_entity}-focused content (not generic)
4. Uses Tailwind CSS classes with these brand colors as hex values (e.g., bg-[${colors.primary}])
5. No hardcoded blues/grays - only use the extracted brand colors

Return ONLY the JSX content, no explanation.`;

  const sectionPrompts: Record<SectionType, string> = {
    gallery: 'Create an image gallery with 3-6 image placeholders using brand colors for overlays/borders',
    summary: `Write a compelling ${intent.primary_entity} summary with key features using brand typography`,
    price_cta: `Create a pricing section with CTA button using the accent color (${colors.accent})`,
    amenities: 'List 6 relevant amenities with checkmarks in the accent color',
    reviews: 'Generate 2 customer reviews with star ratings in accent color',
    trust_signals: 'Create 3 trust badges/signals relevant to this business type',
    hero: 'Create a hero section with headline, description and CTA',
    features: 'Show 3 key features with icons using brand colors',
    testimonials: 'Display 2 testimonials with proper attribution',
    faq: 'Create 3 relevant FAQ items with expandable content',
    contact: 'Build a contact form with brand-colored submit button',
    avatar: 'Profile avatar with name placeholder using brand styling',
    bio: 'Professional bio section with brand typography',
    experience: 'Work experience timeline with brand accent lines',
    portfolio: 'Portfolio grid with brand-colored project cards',
    social_links: 'Social media links using brand colors'
  };

  const userPrompt = sectionPrompts[sectionType];

  try {
    console.log('🤖 Making OpenAI API call for', sectionType);
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      max_tokens: 800,
      temperature: 0.3,
    });

    let content = response.choices[0].message.content?.trim() || `<div>Failed to generate ${sectionType} content</div>`;

    // Remove markdown code blocks if present
    if (content.startsWith('```jsx') && content.endsWith('```')) {
      content = content.slice(6, -3).trim();
    } else if (content.startsWith('```') && content.endsWith('```')) {
      content = content.slice(3, -3).trim();
    }

    console.log('✅ AI content generated successfully for', sectionType);
    console.log('📄 Generated content preview:', content.substring(0, 200) + '...');
    return content;
  } catch (error) {
    console.error('❌ Error generating dynamic content for', sectionType, ':', error);
    const fallbackContent = `<div className="p-4 text-[${colors.text}]">Dynamic ${sectionType} content</div>`;
    console.log('🔄 Using fallback content:', fallbackContent);
    return fallbackContent;
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