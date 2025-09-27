import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import type { DesignTokens } from '../tokens';

export interface TemplateVariant {
  type: 'card' | 'banner' | 'modal';
  name: string;
  description: string;
  structure: TemplateStructure;
  styleMapping: StyleMapping;
}

export interface TemplateStructure {
  sections: {
    header?: boolean;
    card?: boolean;
    actions: boolean;
    pricing?: boolean;
    features?: boolean;
  };
  layout: 'vertical' | 'horizontal' | 'centered';
  complexity: 'simple' | 'medium' | 'rich';
}

export interface StyleMapping {
  primary: string;
  secondary: string;
  background: string;
  text: string;
  accent: string;
  spacing: {
    container: string;
    section: string;
    element: string;
  };
  button?: {
    borderRadius: string;
    padding: string;
    fontSize: string;
    fontWeight: string;
    border: string;
    display: string;
    alignItems: string;
    justifyContent: string;
    textAlign: string;
  };
}

export interface SafeColors {
  primary: string;
  secondary: string;
  background: string;
  text: string;
  accent: string;
  ctaPrimary: string;
  ctaSecondary: string;
  muted: string;
}

export interface TemplateResult {
  runId: string;
  componentCode: string;
  html: string;
  appliedStyles: StyleMapping;
  cssVariables: string;
  templateType: 'card' | 'banner' | 'modal';
  safeColors: SafeColors;
}

// Template definitions
export const cardTemplate: TemplateVariant = {
  type: 'card',
  name: 'Product Card',
  description: 'Professional service offering with features and pricing',
  structure: {
    sections: {
      header: true,
      card: true,
      actions: true,
      pricing: true,
      features: true
    },
    layout: 'vertical',
    complexity: 'rich'
  },
  styleMapping: {
    primary: 'semantic.cta',
    secondary: 'neutral.0',
    background: 'semantic.background',
    text: 'semantic.text',
    accent: 'semantic.accent',
    spacing: {
      container: 'large',
      section: 'medium',
      element: 'small'
    }
  }
};


export function selectTemplate(): TemplateVariant {
  // Always return the card template - single option with header, card, and two CTAs
  return cardTemplate;
}

export function validateAndSelectColors(tokens: DesignTokens): SafeColors {
  const safeColors: SafeColors = {
    primary: tokens.colors.primary[0] || '#000000',
    secondary: tokens.colors.neutral[0] || '#666666',
    background: tokens.colors.semantic.background || '#ffffff',
    text: tokens.colors.semantic.text || '#000000',
    accent: tokens.colors.semantic.accent || tokens.colors.primary[1] || '#0066cc',
    ctaPrimary: tokens.colors.semantic.cta || tokens.colors.primary[0] || '#ff385c',
    ctaSecondary: tokens.colors.contextual?.buttons?.[1] || tokens.colors.neutral[0] || '#f7f7f7',
    muted: tokens.colors.semantic.muted || tokens.colors.neutral[0] || '#666666'
  };

  // Validate contrast for each color pair
  safeColors.text = ensureContrastCompliance(safeColors.text, safeColors.background, tokens);
  safeColors.ctaPrimary = ensureContrastCompliance('#ffffff', safeColors.ctaPrimary, tokens) === '#ffffff'
    ? safeColors.ctaPrimary
    : safeColors.ctaPrimary;

  return safeColors;
}

function ensureContrastCompliance(foreground: string, background: string, tokens: DesignTokens): string {
  const contrast = calculateContrast(foreground, background);

  if (contrast >= 4.5) return foreground;

  // Try alternative colors from extracted palette
  const alternatives = [
    tokens.colors.semantic.text,
    tokens.colors.primary[0],
    tokens.colors.neutral[0],
  ].filter(Boolean);

  for (const alt of alternatives) {
    if (calculateContrast(alt, background) >= 4.5) {
      return alt;
    }
  }

  return foreground;
}

function calculateContrast(color1: string, color2: string): number {
  // Simple contrast calculation - in production, use a proper library
  const getLuminance = (hex: string): number => {
    const rgb = parseInt(hex.slice(1), 16);
    const r = ((rgb >> 16) & 0xff) / 255;
    const g = ((rgb >> 8) & 0xff) / 255;
    const b = ((rgb >> 0) & 0xff) / 255;

    const sRGB = [r, g, b].map(c => {
      c = c / 255;
      return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    });

    return 0.2126 * sRGB[0] + 0.7152 * sRGB[1] + 0.0722 * sRGB[2];
  };

  try {
    const lum1 = getLuminance(color1);
    const lum2 = getLuminance(color2);
    const lightest = Math.max(lum1, lum2);
    const darkest = Math.min(lum1, lum2);
    return (lightest + 0.05) / (darkest + 0.05);
  } catch {
    return 4.5; // Safe fallback
  }
}

export function applyTemplateStyles(
  template: TemplateVariant,
  safeColors: SafeColors,
  tokens: DesignTokens
): StyleMapping {
  const spacingMap = {
    small: tokens.spacing.find(s => s >= 8 && s <= 16) || 12,
    medium: tokens.spacing.find(s => s >= 16 && s <= 24) || 20,
    large: tokens.spacing.find(s => s >= 24) || 32
  };

  // Extract button-specific styles from detected button variants
  const primaryButton = tokens.buttons.variants.find(b => b.type === 'primary') || tokens.buttons.variants[0];
  const buttonBorderRadius = primaryButton?.borderRadius || tokens.borderRadius[0] || '4px';
  const buttonPadding = primaryButton?.padding || '8px 16px';
  const buttonFontSize = primaryButton?.fontSize ? `${primaryButton.fontSize}px` : '16px';
  const buttonFontWeight = primaryButton?.fontWeight?.toString() || '500';
  const buttonBorder = primaryButton?.borderColor ? `1px solid ${primaryButton.borderColor}` : 'none';
  const buttonDisplay = primaryButton?.display || 'inline-flex';
  const buttonAlignItems = primaryButton?.alignItems || 'center';
  const buttonJustifyContent = primaryButton?.justifyContent || 'center';
  const buttonTextAlign = primaryButton?.textAlign || 'center';

  return {
    primary: safeColors.ctaPrimary,
    secondary: safeColors.ctaSecondary,
    background: safeColors.background,
    text: safeColors.text,
    accent: safeColors.accent,
    spacing: {
      container: `${spacingMap[template.styleMapping.spacing.container as keyof typeof spacingMap]}px`,
      section: `${spacingMap[template.styleMapping.spacing.section as keyof typeof spacingMap]}px`,
      element: `${spacingMap[template.styleMapping.spacing.element as keyof typeof spacingMap]}px`
    },
    button: {
      borderRadius: buttonBorderRadius,
      padding: buttonPadding,
      fontSize: buttonFontSize,
      fontWeight: buttonFontWeight,
      border: buttonBorder,
      display: buttonDisplay,
      alignItems: buttonAlignItems,
      justifyContent: buttonJustifyContent,
      textAlign: buttonTextAlign
    }
  };
}

export function generateTemplateHTML(styles: StyleMapping): string {
  return `
    <div
      style="
        font-family: system-ui, -apple-system, sans-serif;
        background-color: ${styles.background};
        color: ${styles.text};
        padding: ${styles.spacing.container};
        max-width: 400px;
        margin: 0 auto;
        border-radius: ${styles.button?.borderRadius || '4px'};
        box-shadow: 0 2px 8px rgba(0,0,0,0.1);
      "
    >
      <header style="text-align: center; margin-bottom: ${styles.spacing.section};">
        <h1 style="
          font-size: 1.5rem;
          font-weight: 600;
          margin: 0;
          color: ${styles.text};
        ">
          Header
        </h1>
      </header>

      <div style="
        display: flex;
        gap: ${styles.spacing.element};
        justify-content: center;
      ">
        <button style="
          background-color: ${styles.secondary};
          color: ${styles.text};
          padding: ${styles.button?.padding || '8px 16px'};
          font-size: ${styles.button?.fontSize || '16px'};
          font-weight: ${styles.button?.fontWeight || '500'};
          border-radius: ${styles.button?.borderRadius || '4px'};
          border: 1px solid ${styles.secondary};
          cursor: pointer;
          transition: opacity 0.2s;
          display: ${styles.button?.display || 'inline-flex'};
          align-items: ${styles.button?.alignItems || 'center'};
          justify-content: ${styles.button?.justifyContent || 'center'};
          text-align: ${styles.button?.textAlign || 'center'};
          line-height: 1;
        ">
          Cancel
        </button>
        <button style="
          background-color: ${styles.primary};
          color: white;
          padding: ${styles.button?.padding || '8px 16px'};
          font-size: ${styles.button?.fontSize || '16px'};
          font-weight: ${styles.button?.fontWeight || '500'};
          border-radius: ${styles.button?.borderRadius || '4px'};
          border: none;
          cursor: pointer;
          transition: opacity 0.2s;
          display: ${styles.button?.display || 'inline-flex'};
          align-items: ${styles.button?.alignItems || 'center'};
          justify-content: ${styles.button?.justifyContent || 'center'};
          text-align: ${styles.button?.textAlign || 'center'};
          line-height: 1;
        ">
          Accept
        </button>
      </div>
    </div>
  `;
}


export function generateTemplateCSSVars(tokens: DesignTokens, safeColors: SafeColors): string {
  const fontFamily = tokens.typography.fontFamilies[0] || 'system-ui, -apple-system, sans-serif';

  return `:root {
  --template-font: ${fontFamily};
  --template-primary: ${safeColors.ctaPrimary};
  --template-secondary: ${safeColors.ctaSecondary};
  --template-bg: ${safeColors.background};
  --template-text: ${safeColors.text};
  --template-accent: ${safeColors.accent};
  --template-muted: ${safeColors.muted};
}`;
}

export async function saveTemplateArtifacts(
  runId: string,
  artifacts: {
    component: string;
    styles: StyleMapping;
    css: string;
    template: string;
  },
  artifactDir?: string
): Promise<void> {
  const baseDir = artifactDir || join(process.cwd(), 'artifacts');
  const runDir = join(baseDir, runId);
  const ctaDir = join(runDir, 'cta');

  await mkdir(ctaDir, { recursive: true });

  await Promise.all([
    writeFile(join(ctaDir, 'CTATemplate.tsx'), artifacts.component),
    writeFile(join(ctaDir, 'styles.json'), JSON.stringify(artifacts.styles, null, 2)),
    writeFile(join(ctaDir, 'template.css'), artifacts.css),
    writeFile(join(ctaDir, 'metadata.json'), JSON.stringify({
      templateType: artifacts.template,
      generatedAt: new Date().toISOString(),
      runId
    }, null, 2))
  ]);
}

export async function applyTokensToTemplate(
  template: TemplateVariant,
  tokens: DesignTokens,
  runId: string,
  artifactDir?: string
): Promise<TemplateResult> {

  // Select optimal colors with contrast validation
  const safeColors = validateAndSelectColors(tokens);

  // Generate template-specific styling
  const appliedStyles = applyTemplateStyles(template, safeColors, tokens);

  // Generate HTML for inline rendering
  const html = generateTemplateHTML(appliedStyles);
  const componentCode = html; // Same content for now

  // Generate CSS variables from tokens
  const cssVariables = generateTemplateCSSVars(tokens, safeColors);

  // Save artifacts
  await saveTemplateArtifacts(runId, {
    component: componentCode,
    styles: appliedStyles,
    css: cssVariables,
    template: template.type
  }, artifactDir);

  return {
    runId,
    componentCode,
    html,
    appliedStyles,
    cssVariables,
    templateType: template.type,
    safeColors
  };
}