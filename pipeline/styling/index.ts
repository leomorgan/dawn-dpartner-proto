import { readFile, writeFile } from 'fs/promises';
import { join } from 'path';
import type { AdaptiveLayout, AdaptiveLayoutArea, AdaptiveLayoutStack } from '../layout';
import type { DesignTokens } from '../tokens';

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

export interface StylingResult {
  runId: string;
  components: StyledComponent[];
  css: string;
  tailwindClasses: string[];
}

const SECTION_ELEMENTS: Record<string, { tag: 'section' | 'header' | 'main' | 'aside'; baseClass: string }> = {
  // Detail page sections
  gallery: { tag: 'section', baseClass: 'gallery-section' },
  summary: { tag: 'section', baseClass: 'summary-section' },
  price_cta: { tag: 'aside', baseClass: 'price-cta' },
  amenities: { tag: 'section', baseClass: 'amenities-section' },
  reviews: { tag: 'section', baseClass: 'reviews-section' },
  trust_signals: { tag: 'section', baseClass: 'trust-signals' },

  // Generic sections
  hero: { tag: 'header', baseClass: 'hero-section' },
  features: { tag: 'section', baseClass: 'features-section' },
  testimonials: { tag: 'section', baseClass: 'testimonials-section' },
  faq: { tag: 'section', baseClass: 'faq-section' },
  contact: { tag: 'section', baseClass: 'contact-section' },

  // Profile sections
  avatar: { tag: 'section', baseClass: 'avatar-section' },
  bio: { tag: 'section', baseClass: 'bio-section' },
  experience: { tag: 'section', baseClass: 'experience-section' },
  portfolio: { tag: 'main', baseClass: 'portfolio-section' },
  social_links: { tag: 'section', baseClass: 'social-links' },
};

function convertAdaptiveLayoutToComponents(adaptiveLayout: AdaptiveLayout, tokens: DesignTokens): StyledComponent[] {
  return adaptiveLayout.stacks.map(stack => convertAdaptiveStackToComponent(stack, adaptiveLayout, tokens));
}

function convertAdaptiveStackToComponent(
  stack: AdaptiveLayoutStack,
  layout: AdaptiveLayout,
  tokens: DesignTokens
): StyledComponent {
  const containerClass = generateAdaptiveContainerClass(stack);
  const styles = generateAdaptiveStackStyles(stack, tokens);

  return {
    id: `${stack.id}_container`,
    element: 'div',
    className: containerClass,
    styles,
    children: stack.areas.map(area => {
      if ('sectionId' in area) {
        return convertAdaptiveAreaToSection(area, layout, tokens);
      } else {
        return convertAdaptiveStackToComponent(area as AdaptiveLayoutStack, layout, tokens);
      }
    }),
  };
}

export async function applyStyling(runId: string, artifactDir?: string): Promise<StylingResult> {
  const baseDir = artifactDir || join(process.cwd(), 'artifacts');
  const runDir = join(baseDir, runId);

  // Read layout and design tokens
  const [layoutContent, tokensContent] = await Promise.all([
    readFile(join(runDir, 'adaptive_layout.json'), 'utf8'),
    readFile(join(runDir, 'design_tokens.json'), 'utf8'),
  ]);

  const adaptiveLayout: AdaptiveLayout = JSON.parse(layoutContent);
  const tokens: DesignTokens = JSON.parse(tokensContent);

  // Convert adaptive layout to styled components
  const components = convertAdaptiveLayoutToComponents(adaptiveLayout, tokens);

  // Generate CSS and Tailwind classes
  const css = generateCSS(components, tokens);
  const tailwindClasses = extractTailwindClasses(components);

  // Save styled components
  await writeFile(join(runDir, 'styled_components.json'), JSON.stringify(components, null, 2));
  await writeFile(join(runDir, 'styles.css'), css);

  return {
    runId,
    components,
    css,
    tailwindClasses,
  };
}

function convertAdaptiveAreaToSection(
  area: AdaptiveLayoutArea,
  layout: AdaptiveLayout,
  tokens: DesignTokens
): StyledSection {
  const sectionClass = generateSectionClass(area.semanticType);
  const gridColumn = generateGridColumn(area.cols, layout.grid.columns);

  return {
    id: `${area.sectionId}_area`,
    section: area.semanticType,
    element: 'section',
    className: sectionClass,
    styles: {
      gridColumn,
      minHeight: area.minHeight ? `${area.minHeight}px` : undefined,
      backgroundColor: selectSectionBackground(area.semanticType, tokens),
      borderRadius: selectBorderRadius(tokens),
      boxShadow: selectBoxShadow(area.semanticType, tokens),
      padding: selectSectionPadding(area.semanticType, tokens),
    },
    content: area.content,
  };
}

function generateAdaptiveContainerClass(stack: AdaptiveLayoutStack): string {
  const direction = stack.direction === 'row' ? 'flex-row' : 'flex-col';
  const justify = stack.justify ? `justify-${stack.justify}` : '';
  const align = stack.align ? `items-${stack.align}` : '';
  const gap = `gap-${Math.floor(stack.gap / 4)}`; // Convert to Tailwind gap scale
  const stackId = stack.id ? stack.id.replace(/_/g, '-') : 'stack';

  return ['flex', direction, justify, align, gap, stackId]
    .filter(Boolean)
    .join(' ');
}

function generateSectionClass(section: string): string {
  if (!section) {
    console.warn(`⚠️  Section is undefined, using default styling`);
    return 'section section-default';
  }
  const config = SECTION_ELEMENTS[section];
  if (!config) {
    console.warn(`⚠️  Unknown section type: ${section}, using default styling`);
    return `section section-${section.replace(/_/g, '-')}`;
  }
  return `${config.baseClass} section-${section.replace(/_/g, '-')}`;
}

function generateAdaptiveStackStyles(stack: AdaptiveLayoutStack, tokens: DesignTokens): StyledComponent['styles'] {
  const gapValue = tokens.spacing.includes(stack.gap)
    ? `${stack.gap}px`
    : `${tokens.spacing.find(s => Math.abs(s - stack.gap) <= 8) || stack.gap}px`;

  return {
    display: 'flex',
    flexDirection: stack.direction,
    justifyContent: mapJustifyContent(stack.justify),
    alignItems: mapAlignItems(stack.align),
    gap: gapValue,
  };
}

function generateGridColumn(cols: number, totalColumns: number): string {
  if (cols >= totalColumns) {
    return '1 / -1'; // Full width
  }
  return `span ${cols}`;
}

function selectSectionBackground(section: string, tokens: DesignTokens): string | undefined {
  // Hero sections get primary background
  if (section === 'hero') {
    return tokens.colors.primary[0];
  }

  // Price/CTA sections get accent background
  if (section === 'price_cta') {
    return tokens.colors.primary[1] || tokens.colors.primary[0];
  }

  // Most sections get neutral background
  return tokens.colors.semantic.background;
}

function selectBorderRadius(tokens: DesignTokens): string | undefined {
  // Use medium border radius for most components
  const radius = tokens.borderRadius.find(r => r !== '0px' && r !== '0') || tokens.borderRadius[1];
  return radius;
}

function selectBoxShadow(section: string, tokens: DesignTokens): string | undefined {
  // Elevated sections get shadows
  const elevatedSections: string[] = ['price_cta', 'trust_signals', 'hero'];

  if (elevatedSections.includes(section)) {
    return tokens.boxShadow.find(s => s !== 'none') || 'none';
  }

  return 'none';
}

function selectSectionPadding(section: string, tokens: DesignTokens): string {
  // Larger padding for hero sections, standard for others
  const paddingValue = section === 'hero'
    ? tokens.spacing.find(s => s >= 32) || 32
    : tokens.spacing.find(s => s >= 16 && s <= 24) || 24;

  return `${paddingValue}px`;
}

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

function mapAlignItems(align?: AdaptiveLayoutStack['align']): string | undefined {
  const mapping = {
    start: 'flex-start',
    center: 'center',
    end: 'flex-end',
    stretch: 'stretch',
  } as const;

  return align ? mapping[align] : undefined;
}

function generateCSS(components: StyledComponent[], tokens: DesignTokens): string {
  let css = '/* Generated styles from design tokens */\n\n';

  // Add CSS custom properties for design tokens
  css += ':root {\n';

  // Colors
  tokens.colors.primary.forEach((color, index) => {
    css += `  --color-primary-${index + 1}: ${color};\n`;
  });

  tokens.colors.neutral.forEach((color, index) => {
    css += `  --color-neutral-${index + 1}: ${color};\n`;
  });

  css += `  --color-text: ${tokens.colors.semantic.text};\n`;
  css += `  --color-background: ${tokens.colors.semantic.background};\n`;

  // Typography
  css += `  --font-family: ${tokens.typography.fontFamilies.join(', ')};\n`;

  // Spacing
  tokens.spacing.forEach((space, index) => {
    css += `  --spacing-${index}: ${space}px;\n`;
  });

  css += '}\n\n';

  // Add component styles
  const cssRules = new Set<string>();

  function addComponentCSS(component: StyledComponent | StyledSection) {
    const selector = `.${component.className.split(' ')[0]}`;
    const rules: string[] = [];

    Object.entries(component.styles).forEach(([prop, value]) => {
      if (value) {
        const cssProperty = prop.replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`);
        rules.push(`  ${cssProperty}: ${value};`);
      }
    });

    if (rules.length > 0) {
      cssRules.add(`${selector} {\n${rules.join('\n')}\n}\n`);
    }

    if ('children' in component && component.children) {
      component.children.forEach(child => addComponentCSS(child));
    }
  }

  components.forEach(component => addComponentCSS(component));

  css += Array.from(cssRules).join('\n');

  return css;
}

function extractTailwindClasses(components: StyledComponent[]): string[] {
  const classes = new Set<string>();

  function collectClasses(component: StyledComponent | StyledSection) {
    component.className.split(' ').forEach(cls => {
      if (cls.startsWith('flex') || cls.startsWith('gap-') || cls.startsWith('justify-') ||
          cls.startsWith('items-') || cls.startsWith('grid') || cls.startsWith('col-')) {
        classes.add(cls);
      }
    });

    if ('children' in component && component.children) {
      component.children.forEach(child => collectClasses(child));
    }
  }

  components.forEach(component => collectClasses(component));

  return Array.from(classes).sort();
}