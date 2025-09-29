import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import type { DesignTokens } from '../tokens';
// Tailwind mapper imports - commented out as we're using manual classes for now
// import {
//   generateButtonClasses,
//   tokenButtonToTailwind,
//   styleMapperToTailwind,
//   mapColorToTailwind,
//   mapSpacingToTailwind,
//   mapRadiusToTailwind,
//   combineClasses
// } from '../utils/tailwind-mapper';

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
    lineHeight: string;
    primaryHover?: {
      backgroundColor?: string;
      color?: string;
      opacity?: string;
      transform?: string;
      transition?: string;
    };
    secondaryHover?: {
      backgroundColor?: string;
      color?: string;
      opacity?: string;
      transform?: string;
      transition?: string;
    };
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
  ctaPrimaryText: string;
  ctaSecondaryText: string;
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
  buttonVariant?: {
    type: 'primary' | 'secondary' | 'outline' | 'ghost';
    backgroundColor: string;
    color: string;
    padding: string;
    fontSize: number;
    fontWeight: number;
    hover?: {
      backgroundColor?: string;
      color?: string;
      opacity?: number;
      transform?: string;
      transition?: string;
    };
  };
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

export const bannerTemplate: TemplateVariant = {
  type: 'banner',
  name: 'Banner CTA',
  description: 'Full-width banner with prominent call-to-action',
  structure: {
    sections: {
      header: true,
      actions: true
    },
    layout: 'horizontal',
    complexity: 'simple'
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

export const modalTemplate: TemplateVariant = {
  type: 'modal',
  name: 'Modal Dialog',
  description: 'Focused modal dialog with clear actions',
  structure: {
    sections: {
      header: true,
      actions: true
    },
    layout: 'centered',
    complexity: 'medium'
  },
  styleMapping: {
    primary: 'semantic.cta',
    secondary: 'neutral.0',
    background: 'semantic.background',
    text: 'semantic.text',
    accent: 'semantic.accent',
    spacing: {
      container: 'medium',
      section: 'small',
      element: 'small'
    }
  }
};


export function selectTemplate(): TemplateVariant {
  // Always return the card template - single option with header, card, and two CTAs
  return cardTemplate;
}

function findButtonTextColor(backgroundColor: string, tokens: DesignTokens): string {
  // Find the best text color by looking at existing button combinations
  for (const variant of tokens.buttons.variants) {
    if (variant.backgroundColor === backgroundColor) {
      return variant.color;
    }
  }

  // If no exact match, find a button with similar background
  const bgBrightness = getBrightness(backgroundColor);
  for (const variant of tokens.buttons.variants) {
    const variantBrightness = getBrightness(variant.backgroundColor);
    if (Math.abs(bgBrightness - variantBrightness) < 0.3) {
      return variant.color;
    }
  }

  // Fallback to contrast-compliant color
  const textColor = ensureContrastCompliance(tokens.colors.semantic.text, backgroundColor, tokens);
  return textColor !== tokens.colors.semantic.text ? textColor : '#000000';
}

function getBrightness(color: string): number {
  // Convert hex to RGB and calculate relative luminance
  try {
    const rgb = parseInt(color.slice(1), 16);
    const r = ((rgb >> 16) & 0xff) / 255;
    const g = ((rgb >> 8) & 0xff) / 255;
    const b = ((rgb >> 0) & 0xff) / 255;

    // Calculate relative luminance
    const sRGB = [r, g, b].map(c => {
      return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    });

    return 0.2126 * sRGB[0] + 0.7152 * sRGB[1] + 0.0722 * sRGB[2];
  } catch {
    return 0.5; // Fallback
  }
}

export function validateAndSelectColors(tokens: DesignTokens): SafeColors {
  // 1. Use the most common button style for primary
  const mostCommonButton = tokens.buttons.variants.find(b => b.type !== 'ghost') || tokens.buttons.variants[0];

  // 2. Find secondary background color (use semantic secondary or neutral)
  const secondaryBg = tokens.colors.contextual?.buttons?.[1] || tokens.colors.neutral[0];

  // 3. Find appropriate text colors for both buttons
  const primaryTextColor = mostCommonButton?.color || findButtonTextColor(mostCommonButton?.backgroundColor || tokens.colors.semantic.cta, tokens);
  const secondaryTextColor = findButtonTextColor(secondaryBg, tokens);

  const safeColors: SafeColors = {
    primary: tokens.colors.primary[0],
    secondary: secondaryBg,
    background: tokens.colors.semantic.background,
    text: tokens.colors.semantic.text,
    accent: tokens.colors.semantic.accent,
    ctaPrimary: mostCommonButton?.backgroundColor || tokens.colors.semantic.cta,
    ctaSecondary: secondaryBg,
    ctaPrimaryText: primaryTextColor,
    ctaSecondaryText: secondaryTextColor,
    muted: tokens.colors.semantic.muted
  };

  // Validate contrast for each color pair
  safeColors.text = ensureContrastCompliance(safeColors.text, safeColors.background, tokens);

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

// Phase 2.1: REMOVED convertPaddingToTailwind - no more arbitrary value classes

function normalizePadding(padding: string): string {
  // Convert asymmetric padding to symmetric for better centering
  const parts = padding.trim().split(/\s+/);

  if (parts.length === 1) {
    // Single value: already symmetric
    return padding;
  } else if (parts.length === 2) {
    // Two values: vertical horizontal - already symmetric
    return padding;
  } else if (parts.length === 4) {
    // Four values: top right bottom left - make symmetric
    const [top, right, bottom, left] = parts;
    const verticalPadding = Math.max(parseInt(top), parseInt(bottom));
    const horizontalPadding = Math.max(parseInt(right), parseInt(left));
    return `${verticalPadding}px ${horizontalPadding}px`;
  }

  return padding;
}

function normalizeDisplay(display: string): string {
  // Ensure display supports flexbox alignment
  if (display === 'block' || display === 'inline-block') {
    return 'inline-flex';
  }
  return display.includes('flex') ? display : 'inline-flex';
}

function normalizeAlignment(alignment: string): string {
  // Ensure proper centering values
  if (alignment === 'start' || alignment === 'left') {
    return 'center';
  }
  return alignment;
}

function normalizeLineHeight(lineHeight: string | number | undefined): string {
  // Ensure readable line-height for buttons (not too tight)
  if (!lineHeight || lineHeight === '1' || lineHeight === 1) {
    return '1.2';
  }
  return lineHeight.toString();
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
  // Use the most frequently detected non-ghost button (since they're sorted by count, ghost buttons last)
  const mostCommonButton = tokens.buttons.variants.find(b => b.type !== 'ghost') || tokens.buttons.variants[0];

  // Find button that matches the primary CTA color chosen by validateAndSelectColors
  // Prefer buttons with hover styles when multiple buttons have the same color
  const primaryCTAColor = safeColors.ctaPrimary;
  const primaryCandidates = tokens.buttons.variants.filter(b => b.backgroundColor === primaryCTAColor);
  const primaryButton = primaryCandidates.find(b => b.hover) || primaryCandidates[0] || mostCommonButton;

  // Find button that matches the secondary CTA color chosen by validateAndSelectColors
  // Prefer buttons with hover styles when multiple buttons have the same color
  const secondaryCTAColor = safeColors.ctaSecondary;
  const secondaryCandidates = tokens.buttons.variants.filter(b =>
    b.backgroundColor === secondaryCTAColor &&
    b !== primaryButton // Ensure it's not the same button instance
  );
  const secondaryButton = secondaryCandidates.find(b => b.hover) || // Prefer with hover
                          secondaryCandidates[0] || // Fallback to first with matching color
                          tokens.buttons.variants.find(b =>
                            b.type !== 'ghost' &&
                            b !== primaryButton &&
                            (b.backgroundColor !== primaryButton?.backgroundColor ||
                             b.color !== primaryButton?.color ||
                             b.type !== primaryButton?.type)
                          ) || tokens.buttons.variants[1]; // Final fallback

  const buttonBorderRadius = primaryButton?.borderRadius || tokens.borderRadius[0] || '4px';
  const buttonPadding = normalizePadding(primaryButton?.padding || '8px 16px');
  const buttonFontSize = primaryButton?.fontSize ? `${primaryButton.fontSize}px` : '16px';
  const buttonFontWeight = primaryButton?.fontWeight?.toString() || '500';
  const buttonBorder = primaryButton?.borderColor ? `1px solid ${primaryButton.borderColor}` : 'none';
  const buttonDisplay = normalizeDisplay(primaryButton?.display || 'inline-flex');
  const buttonAlignItems = normalizeAlignment(primaryButton?.alignItems || 'center');
  const buttonJustifyContent = normalizeAlignment(primaryButton?.justifyContent || 'center');
  const buttonTextAlign = normalizeAlignment(primaryButton?.textAlign || 'center');

  // Extract primary button hover styles if detected
  const primaryButtonHover = primaryButton?.hover ? {
    backgroundColor: primaryButton.hover.backgroundColor,
    color: primaryButton.hover.color,
    opacity: primaryButton.hover.opacity?.toString(),
    transform: primaryButton.hover.transform,
    transition: primaryButton.hover.transition
  } : undefined;

  // Extract secondary button hover styles if detected
  const secondaryButtonHover = secondaryButton?.hover ? {
    backgroundColor: secondaryButton.hover.backgroundColor,
    color: secondaryButton.hover.color,
    opacity: secondaryButton.hover.opacity?.toString(),
    transform: secondaryButton.hover.transform,
    transition: secondaryButton.hover.transition
  } : undefined;

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
      textAlign: buttonTextAlign,
      lineHeight: normalizeLineHeight(undefined),
      primaryHover: primaryButtonHover,
      secondaryHover: secondaryButtonHover
    }
  };
}

export function generateTemplateHTML(styles: StyleMapping, safeColors: SafeColors, tokens: DesignTokens): string {
  // Define content constants to follow DRY principle
  const content = {
    title: "Financial infrastructure for the internet",
    subtitle: "Millions of businesses of all sizes use Stripe's software and APIs",
    primaryCTA: "Start now",
    secondaryCTA: "Contact sales"
  };

  // Phase 2.1: Removed Tailwind arbitrary values - use layout classes only + CSS variables
  const containerClasses = 'max-w-sm mx-auto shadow-lg p-6 bg-white rounded-lg';
  const headerClasses = 'text-center mb-6';
  const titleClasses = 'text-2xl font-semibold mb-3';
  const subtitleClasses = 'text-sm text-gray-600 mb-6';
  const buttonContainerClasses = 'flex gap-3 justify-center';

  // Phase 2.1: Use basic layout classes only - styles will come from CSS variables
  const buttonBaseClasses = 'cursor-pointer inline-flex items-center justify-center text-center transition-all duration-200 ease-in-out px-4 py-2 rounded-lg font-medium text-sm';

  // Phase 2.3: Apply inline styles using CSS custom properties for precision
  return `
    <div class="${containerClasses}" style="
      background-color: var(--cta-background);
      color: var(--cta-text);
      font-family: var(--cta-font-family);
      border-radius: var(--cta-button-radius);
    ">
      <header class="${headerClasses}">
        <h1 class="${titleClasses}" style="color: var(--cta-text); font-weight: var(--cta-button-font-weight);">
          ${content.title}
        </h1>
        <p class="${subtitleClasses}" style="color: var(--cta-text); opacity: 0.8;">
          ${content.subtitle}
        </p>
      </header>

      <div class="${buttonContainerClasses}">
        <button class="${buttonBaseClasses}" style="
          background-color: var(--cta-primary-bg);
          color: var(--cta-primary-text);
          border: var(--cta-button-border);
          font-size: var(--cta-button-font-size);
          font-weight: var(--cta-button-font-weight);
          border-radius: var(--cta-button-radius);
        " onmouseover="this.style.backgroundColor='var(--cta-primary-hover-bg)';" onmouseout="this.style.backgroundColor='var(--cta-primary-bg)';">
          ${content.primaryCTA}
        </button>
        <button class="${buttonBaseClasses}" style="
          background-color: var(--cta-secondary-bg);
          color: var(--cta-secondary-text);
          border: 1px solid var(--cta-secondary-bg);
          font-size: var(--cta-button-font-size);
          font-weight: var(--cta-button-font-weight);
          border-radius: var(--cta-button-radius);
        " onmouseover="this.style.backgroundColor='var(--cta-secondary-hover-bg)';" onmouseout="this.style.backgroundColor='var(--cta-secondary-bg)';">
          ${content.secondaryCTA}
        </button>
      </div>
    </div>
  `;
}

export function generateReactComponent(styles: StyleMapping, safeColors: SafeColors, tokens: DesignTokens): string {
  // Define content constants to follow DRY principle
  const content = {
    title: "Financial infrastructure for the internet",
    subtitle: "Millions of businesses of all sizes use Stripe's software and APIs",
    primaryCTA: "Start now",
    secondaryCTA: "Contact sales"
  };

  // Phase 2.1: Removed Tailwind arbitrary values - use layout classes only + CSS variables
  const containerClasses = 'max-w-sm mx-auto shadow-lg p-6 bg-white rounded-lg';
  const headerClasses = 'text-center mb-6';
  const titleClasses = 'text-2xl font-semibold mb-3';
  const subtitleClasses = 'text-sm text-gray-600 mb-6';
  const buttonContainerClasses = 'flex gap-3 justify-center';
  const buttonBaseClasses = 'cursor-pointer inline-flex items-center justify-center text-center transition-all duration-200 ease-in-out px-4 py-2 rounded-lg font-medium text-sm';

  // Phase 2.3: Apply inline styles using CSS custom properties for precision
  return `export default function CTATemplate() {
  return (
    <div
      className="${containerClasses}"
      style={{
        backgroundColor: 'var(--cta-background)',
        color: 'var(--cta-text)',
        fontFamily: 'var(--cta-font-family)',
        borderRadius: 'var(--cta-button-radius)'
      }}
    >
      <header className="${headerClasses}">
        <h1
          className="${titleClasses}"
          style={{
            color: 'var(--cta-text)',
            fontWeight: 'var(--cta-button-font-weight)'
          }}
        >
          ${content.title}
        </h1>
        <p
          className="${subtitleClasses}"
          style={{
            color: 'var(--cta-text)',
            opacity: 0.8
          }}
        >
          ${content.subtitle}
        </p>
      </header>

      <div className="${buttonContainerClasses}">
        <button
          className="${buttonBaseClasses}"
          style={{
            backgroundColor: 'var(--cta-primary-bg)',
            color: 'var(--cta-primary-text)',
            border: 'var(--cta-button-border)',
            fontSize: 'var(--cta-button-font-size)',
            fontWeight: 'var(--cta-button-font-weight)',
            borderRadius: 'var(--cta-button-radius)'
          }}
          onMouseOver={(e) => {
            e.currentTarget.style.backgroundColor = 'var(--cta-primary-hover-bg)';
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.backgroundColor = 'var(--cta-primary-bg)';
          }}
        >
          ${content.primaryCTA}
        </button>
        <button
          className="${buttonBaseClasses}"
          style={{
            backgroundColor: 'var(--cta-secondary-bg)',
            color: 'var(--cta-secondary-text)',
            border: '1px solid var(--cta-secondary-bg)',
            fontSize: 'var(--cta-button-font-size)',
            fontWeight: 'var(--cta-button-font-weight)',
            borderRadius: 'var(--cta-button-radius)'
          }}
          onMouseOver={(e) => {
            e.currentTarget.style.backgroundColor = 'var(--cta-secondary-hover-bg)';
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.backgroundColor = 'var(--cta-secondary-bg)';
          }}
        >
          ${content.secondaryCTA}
        </button>
      </div>
    </div>
  );
}`;
}


export function generateTemplateCSSVars(tokens: DesignTokens, safeColors: SafeColors, styles: StyleMapping): string {
  const fontFamily = tokens.typography.fontFamilies[0] || 'system-ui, -apple-system, sans-serif';

  // Phase 2.2: Comprehensive CSS Custom Properties System
  return `:root {
  /* Colors */
  --cta-primary-bg: ${safeColors.ctaPrimary};
  --cta-primary-text: ${safeColors.ctaPrimaryText};
  --cta-secondary-bg: ${safeColors.ctaSecondary};
  --cta-secondary-text: ${safeColors.ctaSecondaryText};
  --cta-background: ${safeColors.background};
  --cta-text: ${safeColors.text};
  --cta-accent: ${safeColors.accent};
  --cta-muted: ${safeColors.muted};

  /* Typography */
  --cta-font-family: ${fontFamily};
  --cta-button-font-size: ${styles.button?.fontSize || '16px'};
  --cta-button-font-weight: ${styles.button?.fontWeight || '500'};
  --cta-button-line-height: ${styles.button?.lineHeight || '1.2'};

  /* Spacing */
  --cta-button-padding: ${styles.button?.padding || '12px 24px'};
  --cta-container-padding: ${styles.spacing.container};
  --cta-section-spacing: ${styles.spacing.section};
  --cta-element-spacing: ${styles.spacing.element};

  /* Layout */
  --cta-button-radius: ${styles.button?.borderRadius || tokens.borderRadius[0] || '8px'};
  --cta-button-border: ${styles.button?.border || 'none'};
  --cta-button-display: ${styles.button?.display || 'inline-flex'};
  --cta-button-align-items: ${styles.button?.alignItems || 'center'};
  --cta-button-justify-content: ${styles.button?.justifyContent || 'center'};

  /* Hover States */
  --cta-primary-hover-bg: ${styles.button?.primaryHover?.backgroundColor || safeColors.ctaPrimary};
  --cta-primary-hover-color: ${styles.button?.primaryHover?.color || safeColors.ctaPrimaryText};
  --cta-primary-hover-opacity: ${styles.button?.primaryHover?.opacity || '0.8'};
  --cta-primary-hover-transform: ${styles.button?.primaryHover?.transform || 'none'};

  --cta-secondary-hover-bg: ${styles.button?.secondaryHover?.backgroundColor || safeColors.ctaSecondary};
  --cta-secondary-hover-color: ${styles.button?.secondaryHover?.color || safeColors.ctaSecondaryText};
  --cta-secondary-hover-opacity: ${styles.button?.secondaryHover?.opacity || '0.8'};
  --cta-secondary-hover-transform: ${styles.button?.secondaryHover?.transform || 'none'};

  /* Transitions */
  --cta-transition: all 0.2s ease-in-out;
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

  // Get the primary button variant for metadata
  const primaryButton = tokens.buttons.variants.find(b => b.type !== 'ghost') || tokens.buttons.variants[0];

  // Generate template-specific styling
  const appliedStyles = applyTemplateStyles(template, safeColors, tokens);

  // Generate HTML for inline rendering (with Tailwind classes)
  const html = generateTemplateHTML(appliedStyles, safeColors, tokens);

  // Generate proper React component code
  const componentCode = generateReactComponent(appliedStyles, safeColors, tokens);

  // Generate CSS variables from tokens
  const cssVariables = generateTemplateCSSVars(tokens, safeColors, appliedStyles);

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
    safeColors,
    buttonVariant: primaryButton ? {
      type: primaryButton.type,
      backgroundColor: primaryButton.backgroundColor,
      color: primaryButton.color,
      padding: primaryButton.padding,
      fontSize: primaryButton.fontSize,
      fontWeight: primaryButton.fontWeight,
      hover: primaryButton.hover
    } : undefined
  };
}