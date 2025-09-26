import { readFile, writeFile } from 'fs/promises';
import { join } from 'path';
import type { AdaptiveLayout, AdaptiveLayoutArea, AdaptiveLayoutStack } from '../layout';
import type { DesignTokens } from '../tokens';
import type { AdaptiveIntent } from '../intent';

// Legacy interfaces for backward compatibility
export interface StyledComponent {
  id: string;
  element: 'div' | 'section' | 'header' | 'main' | 'aside';
  className: string;
  styles: {
    display?: string;
    flexDirection?: 'row' | 'column';
    justifyContent?: string;
    alignItems?: string;
    gap?: string;
    gridColumn?: string;
    minHeight?: string;
    backgroundColor?: string;
    borderRadius?: string;
    boxShadow?: string;
    padding?: string;
  };
  children?: (StyledComponent | StyledSection)[];
}

export interface StyledSection {
  id: string;
  section: string;
  element: 'section';
  className: string;
  styles: {
    gridColumn: string;
    minHeight?: string;
    backgroundColor?: string;
    borderRadius?: string;
    boxShadow?: string;
    padding?: string;
  };
  content?: string;
}

// New structure for individual semantic components
export interface SemanticComponent {
  id: string;
  componentName: string;
  semanticType: string;
  element: 'section' | 'div' | 'article' | 'aside' | 'header' | 'main';
  className: string;
  styles: {
    gridColumn?: string;
    minHeight?: string;
    backgroundColor?: string;
    borderRadius?: string;
    boxShadow?: string;
    padding?: string;
    display?: string;
    flexDirection?: string;
    gap?: string;
  };
  layoutRole: {
    stackId: string;
    position: number;
    cols: number;
    responsive?: any;
  };
}

// Layout orchestrator that composes semantic components
export interface LayoutOrchestrator {
  id: string;
  componentName: string;
  stacks: {
    id: string;
    direction: 'row' | 'column';
    gap: number;
    componentIds: string[];
    className: string;
    styles: any;
  }[];
}

// Component generation plan with individual components + orchestrator
export interface ComponentGenerationPlan {
  semanticComponents: SemanticComponent[];
  layoutOrchestrator: LayoutOrchestrator;
  designSystem: {
    tokens: DesignTokens;
    cssVariables: string;
  };
}

export interface StylingResult {
  runId: string;
  componentPlan: ComponentGenerationPlan;
  css: string;
  tailwindClasses: string[];
}

// Convert semantic type to component name, ensuring uniqueness
function toComponentName(semanticType: string, sectionId: string): string {
  // Generate meaningful component names based on semantic type
  const semanticMap: Record<string, string> = {
    'overview': 'Overview',
    'details': 'Details',
    'services': 'Services',
    'alerts': 'Notifications',
    'preferences': 'Settings',
    'gallery': 'Gallery',
    'summary': 'Summary',
    'price_cta': 'PricingAction',
    'amenities': 'Amenities',
    'reviews': 'Reviews',
    'trust_signals': 'TrustIndicators',
    'hero': 'Hero',
    'features': 'Features',
    'testimonials': 'Testimonials',
    'faq': 'FAQ',
    'contact': 'Contact',
    'data-table': 'DataTable',
    'chart': 'Chart',
    'form': 'Form',
    'support': 'Support'
  };

  const baseName = semanticMap[semanticType] ||
                   semanticType
                     .replace(/[\s-]+/g, '_')  // Replace spaces and hyphens with underscores
                     .split('_')
                     .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
                     .join('');

  // Use sectionId to make component names unique when there are multiple sections of the same type
  const uniqueId = sectionId
    .replace(/[\s-]+/g, '_')  // Replace spaces and hyphens with underscores
    .split('_')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join('');

  // If the sectionId is just the semantic type, don't duplicate it
  if (uniqueId.toLowerCase() === baseName.toLowerCase()) {
    return baseName + 'Section';
  }

  return uniqueId + 'Section';
}

// Extract all semantic sections as individual components
function extractSemanticComponents(
  layout: AdaptiveLayout,
  tokens: DesignTokens,
  intent?: AdaptiveIntent
): SemanticComponent[] {
  const components: SemanticComponent[] = [];

  layout.stacks.forEach(stack => {
    stack.areas.forEach((area, index) => {
      if ('sectionId' in area) {
        const componentName = toComponentName(area.semanticType, area.sectionId);
        const sectionConfig = layout.sections[area.sectionId];

        components.push({
          id: area.sectionId,
          componentName,
          semanticType: area.semanticType,
          element: getSemanticElement(area.semanticType),
          className: generateComponentClass(area.semanticType, area.sectionId),
          styles: {
            gridColumn: generateGridColumn(area.cols, layout.grid.columns),
            minHeight: sectionConfig?.minHeight ? `${sectionConfig.minHeight}px` : undefined,
            backgroundColor: selectComponentBackground(area.semanticType, tokens),
            borderRadius: selectBorderRadius(tokens),
            boxShadow: selectBoxShadow(area.semanticType, tokens),
            padding: selectComponentPadding(area.semanticType, tokens),
          },
          layoutRole: {
            stackId: stack.id,
            position: index,
            cols: area.cols,
            responsive: layout.responsiveStrategy
          }
        });
      }
    });
  });

  return components;
}

// Create layout orchestrator that composes all components
function createLayoutOrchestrator(
  layout: AdaptiveLayout,
  components: SemanticComponent[],
  tokens: DesignTokens
): LayoutOrchestrator {
  const stacks = layout.stacks.map(stack => {
    const stackComponents = components.filter(c => c.layoutRole.stackId === stack.id);

    return {
      id: stack.id,
      direction: stack.direction,
      gap: stack.gap,
      componentIds: stackComponents.map(c => c.id),
      className: generateStackClass(stack),
      styles: {
        display: 'flex',
        flexDirection: stack.direction,
        gap: `${stack.gap}px`,
        justifyContent: mapJustifyContent(stack.justify),
        alignItems: mapAlignItems(stack.align)
      }
    };
  });

  return {
    id: 'page-layout',
    componentName: 'PageLayout',
    stacks
  };
}

// Get appropriate semantic HTML element
function getSemanticElement(semanticType: string): SemanticComponent['element'] {
  const elementMap: Record<string, SemanticComponent['element']> = {
    'hero': 'header',
    'overview': 'section',
    'details': 'main',
    'services': 'section',
    'alerts': 'aside',
    'preferences': 'aside',
    'gallery': 'article',
    'features': 'section',
    'testimonials': 'section',
    'contact': 'section'
  };

  return elementMap[semanticType] || 'section';
}

// Generate component-specific classes
function generateComponentClass(semanticType: string, sectionId: string): string {
  const baseClass = `component-${semanticType.replace(/[\s_]+/g, '-').toLowerCase()}`;
  const idClass = `${sectionId.replace(/[\s_]+/g, '-').toLowerCase()}-section`;
  return `${baseClass} ${idClass}`;
}

// Generate grid column specification
function generateGridColumn(cols: number, totalColumns: number): string {
  if (cols >= totalColumns) {
    return '1 / -1'; // Full width
  }
  return `span ${cols}`;
}

// Generate stack classes
function generateStackClass(stack: AdaptiveLayoutStack): string {
  const direction = stack.direction === 'row' ? 'flex-row' : 'flex-col';
  const justify = stack.justify ? `justify-${stack.justify}` : '';
  const align = stack.align ? `items-${stack.align}` : '';
  const gap = `gap-${Math.floor(stack.gap / 4)}`;
  const stackId = stack.id.replace(/_/g, '-');

  return ['flex', direction, justify, align, gap, stackId]
    .filter(Boolean)
    .join(' ');
}

// Select background color based on semantic type using enhanced tokens
function selectComponentBackground(semanticType: string, tokens: DesignTokens): string {
  // Use contextual colors when available
  if (semanticType === 'hero' || semanticType === 'overview') {
    return tokens.colors.contextual?.backgrounds?.[0] ||
           tokens.colors.primary[0] ||
           tokens.colors.semantic.background;
  }

  if (semanticType === 'alerts' || semanticType === 'price_cta') {
    return tokens.colors.semantic?.cta ||
           tokens.colors.contextual?.buttons?.[0] ||
           tokens.colors.primary[1] ||
           tokens.colors.semantic.background;
  }

  if (semanticType === 'form' || semanticType === 'preferences') {
    return tokens.colors.contextual?.backgrounds?.[1] ||
           tokens.colors.semantic.background;
  }

  return tokens.colors.semantic.background;
}

// Select border radius from tokens
function selectBorderRadius(tokens: DesignTokens): string | undefined {
  const radius = tokens.borderRadius.find(r => r !== '0px' && r !== '0') || tokens.borderRadius[1];
  return radius;
}

// Select box shadow based on semantic type
function selectBoxShadow(semanticType: string, tokens: DesignTokens): string | undefined {
  const elevatedTypes = ['price_cta', 'alerts', 'hero', 'trust_signals'];

  if (elevatedTypes.includes(semanticType)) {
    return tokens.boxShadow.find(s => s !== 'none') || 'none';
  }

  return 'none';
}

// Select padding based on semantic type using actual spacing tokens
function selectComponentPadding(semanticType: string, tokens: DesignTokens): string {
  const largePaddingTypes = ['hero', 'overview', 'features'];
  const mediumPaddingTypes = ['details', 'services', 'gallery'];
  const smallPaddingTypes = ['alerts', 'preferences'];

  let paddingValue: number;

  if (largePaddingTypes.includes(semanticType)) {
    // Use largest spacing token available
    paddingValue = tokens.spacing.find(s => s >= 32) ||
                   tokens.spacing[tokens.spacing.length - 1] ||
                   32;
  } else if (mediumPaddingTypes.includes(semanticType)) {
    // Use medium spacing
    paddingValue = tokens.spacing.find(s => s >= 16 && s <= 32) ||
                   tokens.spacing.find(s => s >= 16) ||
                   24;
  } else if (smallPaddingTypes.includes(semanticType)) {
    // Use smaller spacing
    paddingValue = tokens.spacing.find(s => s >= 8 && s <= 16) ||
                   tokens.spacing.find(s => s >= 8) ||
                   16;
  } else {
    // Default medium padding
    paddingValue = tokens.spacing.find(s => s >= 16 && s <= 24) ||
                   tokens.spacing.find(s => s >= 16) ||
                   16;
  }

  return `${paddingValue}px`;
}

// Map justify content values
function mapJustifyContent(justify?: AdaptiveLayoutStack['justify']): string | undefined {
  const mapping = {
    start: 'flex-start',
    center: 'center',
    end: 'flex-end',
    between: 'space-between',
    around: 'space-around',
  } as const;

  return justify ? mapping[justify] : undefined;
}

// Map align items values
function mapAlignItems(align?: AdaptiveLayoutStack['align']): string | undefined {
  const mapping = {
    start: 'flex-start',
    center: 'center',
    end: 'flex-end',
    stretch: 'stretch',
  } as const;

  return align ? mapping[align] : undefined;
}

// Generate CSS for all components
function generateCSS(plan: ComponentGenerationPlan): string {
  let css = '/* Generated styles from design tokens */\n\n';
  const tokens = plan.designSystem.tokens;

  // Add CSS custom properties with enhanced tokens
  css += ':root {\n';

  // Primary and neutral colors
  tokens.colors.primary.forEach((color, index) => {
    css += `  --color-primary-${index + 1}: ${color};\n`;
  });

  tokens.colors.neutral.forEach((color, index) => {
    css += `  --color-neutral-${index + 1}: ${color};\n`;
  });

  // Enhanced semantic colors
  css += `  --color-text: ${tokens.colors.semantic.text};\n`;
  css += `  --color-background: ${tokens.colors.semantic.background};\n`;
  css += `  --color-cta: ${tokens.colors.semantic?.cta || tokens.colors.primary[0]};\n`;
  css += `  --color-accent: ${tokens.colors.semantic?.accent || tokens.colors.primary[1]};\n`;
  css += `  --color-muted: ${tokens.colors.semantic?.muted || tokens.colors.neutral[0]};\n`;

  // Contextual colors
  if (tokens.colors.contextual?.buttons?.length) {
    tokens.colors.contextual.buttons.forEach((color, index) => {
      css += `  --color-button-${index + 1}: ${color};\n`;
    });
  }

  if (tokens.colors.contextual?.links?.length) {
    tokens.colors.contextual.links.forEach((color, index) => {
      css += `  --color-link-${index + 1}: ${color};\n`;
    });
  }

  // Enhanced typography
  css += `  --font-family: ${tokens.typography.fontFamilies.join(', ')};\n`;

  if (tokens.typography.fontWeights?.length) {
    tokens.typography.fontWeights.forEach((weight, index) => {
      css += `  --font-weight-${index + 1}: ${weight};\n`;
    });
  }

  // Spacing with enhanced naming
  tokens.spacing.forEach((space, index) => {
    css += `  --spacing-${index}: ${space}px;\n`;
    // Also add semantic names
    if (space === 8) css += `  --spacing-xs: ${space}px;\n`;
    if (space === 16) css += `  --spacing-sm: ${space}px;\n`;
    if (space === 24) css += `  --spacing-md: ${space}px;\n`;
    if (space === 32) css += `  --spacing-lg: ${space}px;\n`;
    if (space === 48) css += `  --spacing-xl: ${space}px;\n`;
  });

  // Border radius
  tokens.borderRadius.forEach((radius, index) => {
    css += `  --radius-${index}: ${radius};\n`;
  });

  // Shadows
  tokens.boxShadow.forEach((shadow, index) => {
    css += `  --shadow-${index}: ${shadow};\n`;
  });

  css += '}\n\n';

  // Add component styles
  plan.semanticComponents.forEach(component => {
    const selector = `.${component.className.split(' ')[0]}`;
    const rules: string[] = [];

    Object.entries(component.styles).forEach(([prop, value]) => {
      if (value) {
        const cssProperty = prop.replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`);
        rules.push(`  ${cssProperty}: ${value};`);
      }
    });

    if (rules.length > 0) {
      css += `${selector} {\n${rules.join('\n')}\n}\n\n`;
    }
  });

  // Add orchestrator styles
  plan.layoutOrchestrator.stacks.forEach(stack => {
    if (!stack.className) return; // Skip if no className
    const selector = `.${stack.className.split(' ')[0]}`;
    const rules: string[] = [];

    if (stack.styles) {
      Object.entries(stack.styles).forEach(([prop, value]) => {
        if (value) {
          const cssProperty = prop.replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`);
          rules.push(`  ${cssProperty}: ${value};`);
        }
      });
    }

    if (rules.length > 0) {
      css += `${selector} {\n${rules.join('\n')}\n}\n\n`;
    }
  });

  return css;
}

// Extract Tailwind classes
function extractTailwindClasses(plan: ComponentGenerationPlan): string[] {
  const classes = new Set<string>();

  // From components
  plan.semanticComponents.forEach(component => {
    component.className.split(' ').forEach(cls => classes.add(cls));
  });

  // From orchestrator
  plan.layoutOrchestrator.stacks.forEach(stack => {
    stack.className.split(' ').forEach(cls => {
      if (cls.startsWith('flex') || cls.startsWith('gap-') ||
          cls.startsWith('justify-') || cls.startsWith('items-')) {
        classes.add(cls);
      }
    });
  });

  return Array.from(classes).sort();
}

// Main export function
export async function applyStyling(runId: string, artifactDir?: string): Promise<StylingResult> {
  const baseDir = artifactDir || join(process.cwd(), 'artifacts');
  const runDir = join(baseDir, runId);

  // Read layout, design tokens, and intent
  const [layoutContent, tokensContent, intentContent] = await Promise.all([
    readFile(join(runDir, 'adaptive_layout.json'), 'utf8'),
    readFile(join(runDir, 'design_tokens.json'), 'utf8'),
    readFile(join(runDir, 'adaptive_intent.json'), 'utf8').catch(() => null)
  ]);

  const adaptiveLayout: AdaptiveLayout = JSON.parse(layoutContent);
  const tokens: DesignTokens = JSON.parse(tokensContent);
  const intent: AdaptiveIntent | null = intentContent ? JSON.parse(intentContent) : null;

  // Extract individual semantic components
  const semanticComponents = extractSemanticComponents(adaptiveLayout, tokens, intent || undefined);

  // Create layout orchestrator
  const layoutOrchestrator = createLayoutOrchestrator(adaptiveLayout, semanticComponents, tokens);

  // Build component generation plan
  const componentPlan: ComponentGenerationPlan = {
    semanticComponents,
    layoutOrchestrator,
    designSystem: {
      tokens,
      cssVariables: generateCSSVariables(tokens)
    }
  };

  // Generate CSS and extract Tailwind classes
  const css = generateCSS(componentPlan);
  const tailwindClasses = extractTailwindClasses(componentPlan);

  // Save the component plan (instead of styled_components.json)
  await writeFile(
    join(runDir, 'component_plan.json'),
    JSON.stringify(componentPlan, null, 2)
  );

  // Keep styled_components.json for backward compatibility but with new structure
  await writeFile(
    join(runDir, 'styled_components.json'),
    JSON.stringify(semanticComponents, null, 2)
  );

  await writeFile(join(runDir, 'styles.css'), css);

  return {
    runId,
    componentPlan,
    css,
    tailwindClasses
  };
}

// Helper function to generate CSS variables
function generateCSSVariables(tokens: DesignTokens): string {
  let vars = '';

  if (tokens?.colors?.primary?.length) {
    tokens.colors.primary.forEach((color, i) => {
      vars += `--color-primary-${i + 1}: ${color}; `;
    });
  }

  if (tokens?.colors?.neutral?.length) {
    tokens.colors.neutral.forEach((color, i) => {
      vars += `--color-neutral-${i + 1}: ${color}; `;
    });
  }

  if (tokens?.colors?.semantic?.text) {
    vars += `--color-text: ${tokens.colors.semantic.text}; `;
  }

  if (tokens?.colors?.semantic?.background) {
    vars += `--color-background: ${tokens.colors.semantic.background}; `;
  }

  return vars.trim();
}