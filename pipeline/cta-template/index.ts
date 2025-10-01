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

  // SIMPLIFIED APPROACH:
  // 1. Find button matching primary color (for sizing and primary hover)
  // 2. Find button matching secondary color (for secondary hover only)
  // 3. Use primary button's sizing for BOTH buttons

  const primaryCTAColor = safeColors.ctaPrimary;
  const secondaryCTAColor = safeColors.ctaSecondary;

  // Find ALL buttons for each color
  const primaryButtons = tokens.buttons.variants.filter(b => b.backgroundColor === primaryCTAColor);
  const secondaryButtons = tokens.buttons.variants.filter(b => b.backgroundColor === secondaryCTAColor);

  // Helper: check if hover background matches card background (would be invisible/confusing)
  const cardBackground = safeColors.background;
  const isHoverSameAsCardBg = (hoverBg: string | undefined) => {
    if (!hoverBg) return false;
    return hoverBg.toLowerCase() === cardBackground.toLowerCase();
  };

  // Select primary: prefer buttons WITH meaningful hover (backgroundColor or opacity change)
  // but exclude hovers that match the card background
  const primaryButton = primaryButtons.find(b =>
    (b.hover?.backgroundColor && !isHoverSameAsCardBg(b.hover.backgroundColor)) || b.hover?.opacity
  ) || primaryButtons[0] || tokens.buttons.variants[0];

  // Select secondary: prefer buttons with opacity hover OR backgroundColor that doesn't match card background
  const secondaryButton = secondaryButtons.find(b =>
    b.hover?.opacity && !isHoverSameAsCardBg(b.hover.backgroundColor)
  ) || secondaryButtons.find(b =>
    b.hover?.backgroundColor && !isHoverSameAsCardBg(b.hover.backgroundColor)
  ) || secondaryButtons[0] || tokens.buttons.variants[1];

  console.log('🔍 PRIMARY BUTTON SELECTED:', {
    backgroundColor: primaryButton?.backgroundColor,
    hover: primaryButton?.hover
  });
  console.log('🔍 SECONDARY BUTTON SELECTED:', {
    backgroundColor: secondaryButton?.backgroundColor,
    hover: secondaryButton?.hover
  });

  const buttonBorderRadius = primaryButton?.borderRadius || tokens.borderRadius[0] || '4px';
  const buttonPadding = normalizePadding(primaryButton?.padding || '8px 16px');
  const buttonFontSize = primaryButton?.fontSize ? `${primaryButton.fontSize}px` : '16px';
  const buttonFontWeight = primaryButton?.fontWeight?.toString() || '500';
  const buttonBorder = primaryButton?.borderColor ? `1px solid ${primaryButton.borderColor}` : 'none';
  const buttonDisplay = normalizeDisplay(primaryButton?.display || 'inline-flex');
  const buttonAlignItems = normalizeAlignment(primaryButton?.alignItems || 'center');
  const buttonJustifyContent = normalizeAlignment(primaryButton?.justifyContent || 'center');
  const buttonTextAlign = normalizeAlignment(primaryButton?.textAlign || 'center');

  // Extract hover styles - use what we have, with sensible fallbacks
  const primaryButtonHover = primaryButton?.hover ? {
    backgroundColor: primaryButton.hover.backgroundColor,
    color: primaryButton.hover.color,
    opacity: primaryButton.hover.opacity?.toString(),
    transform: primaryButton.hover.transform,
    transition: primaryButton.hover.transition
  } : undefined;

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
  // Simple card with header + two CTAs (Cancel/Accept)
  const containerClasses = 'max-w-sm mx-auto shadow-lg';
  const headerClasses = 'text-center';
  const buttonContainerClasses = 'flex justify-center';
  const buttonBaseClasses = 'cursor-pointer inline-flex items-center justify-center text-center transition-all duration-200 ease-in-out';

  return `
    <div class="${containerClasses}" style="
      background-color: var(--cta-background);
      color: var(--cta-text);
      padding: var(--cta-container-padding);
      border-radius: var(--cta-button-radius);
      font-family: var(--cta-font-family);
    ">
      <header class="${headerClasses}" style="margin-bottom: var(--cta-section-spacing);">
        <h1 class="text-2xl font-semibold m-0" style="color: var(--cta-text);">
          Header
        </h1>
      </header>

      <div class="${buttonContainerClasses}" style="gap: var(--cta-element-spacing);">
        <button class="${buttonBaseClasses} cta-button-secondary" style="
          background-color: var(--cta-secondary-bg);
          color: var(--cta-secondary-text);
          padding: var(--cta-button-padding);
          border-radius: var(--cta-button-radius);
          border: var(--cta-button-border);
          font-size: var(--cta-button-font-size);
          font-weight: var(--cta-button-font-weight);
          line-height: var(--cta-button-line-height);
          transition: var(--cta-transition);
        ">
          Cancel
        </button>
        <button class="${buttonBaseClasses} cta-button-primary" style="
          background-color: var(--cta-primary-bg);
          color: var(--cta-primary-text);
          padding: var(--cta-button-padding);
          border-radius: var(--cta-button-radius);
          border: var(--cta-button-border);
          font-size: var(--cta-button-font-size);
          font-weight: var(--cta-button-font-weight);
          line-height: var(--cta-button-line-height);
          transition: var(--cta-transition);
        ">
          Accept
        </button>
      </div>
    </div>
  `;
}

export function generateReactComponent(styles: StyleMapping, safeColors: SafeColors, tokens: DesignTokens): string {
  // Simple card with header + two CTAs (Cancel/Accept)
  return `export default function CTATemplate() {
  return (
    <div
      style={{
        backgroundColor: 'var(--cta-background)',
        color: 'var(--cta-text)',
        padding: 'var(--cta-container-padding)',
        borderRadius: 'var(--cta-button-radius)',
        fontFamily: 'var(--cta-font-family)'
      }}
      className="max-w-sm mx-auto shadow-lg"
    >
      <header
        style={{ marginBottom: 'var(--cta-section-spacing)' }}
        className="text-center"
      >
        <h1
          style={{ color: 'var(--cta-text)' }}
          className="text-2xl font-semibold m-0"
        >
          Header
        </h1>
      </header>

      <div
        style={{ gap: 'var(--cta-element-spacing)' }}
        className="flex justify-center"
      >
        <button
          style={{
            backgroundColor: 'var(--cta-secondary-bg)',
            color: 'var(--cta-secondary-text)',
            padding: 'var(--cta-button-padding)',
            borderRadius: 'var(--cta-button-radius)',
            border: 'var(--cta-button-border)',
            fontSize: 'var(--cta-button-font-size)',
            fontWeight: 'var(--cta-button-font-weight)',
            lineHeight: 'var(--cta-button-line-height)',
            transition: 'var(--cta-transition)'
          }}
          className="cursor-pointer inline-flex items-center justify-center text-center transition-all duration-200 ease-in-out"
          onMouseOver={(e) => {
            const target = e.target as HTMLButtonElement;
            target.style.backgroundColor = 'var(--cta-secondary-hover-bg)';
            target.style.color = 'var(--cta-secondary-hover-color)';
            target.style.opacity = 'var(--cta-secondary-hover-opacity)';
            target.style.transform = 'var(--cta-secondary-hover-transform)';
          }}
          onMouseOut={(e) => {
            const target = e.target as HTMLButtonElement;
            target.style.backgroundColor = 'var(--cta-secondary-bg)';
            target.style.color = 'var(--cta-secondary-text)';
            target.style.opacity = '1';
            target.style.transform = 'none';
          }}
        >
          Cancel
        </button>
        <button
          style={{
            backgroundColor: 'var(--cta-primary-bg)',
            color: 'var(--cta-primary-text)',
            padding: 'var(--cta-button-padding)',
            borderRadius: 'var(--cta-button-radius)',
            border: 'var(--cta-button-border)',
            fontSize: 'var(--cta-button-font-size)',
            fontWeight: 'var(--cta-button-font-weight)',
            lineHeight: 'var(--cta-button-line-height)',
            transition: 'var(--cta-transition)'
          }}
          className="cursor-pointer inline-flex items-center justify-center text-center transition-all duration-200 ease-in-out"
          onMouseOver={(e) => {
            const target = e.target as HTMLButtonElement;
            target.style.backgroundColor = 'var(--cta-primary-hover-bg)';
            target.style.color = 'var(--cta-primary-hover-color)';
            target.style.opacity = 'var(--cta-primary-hover-opacity)';
            target.style.transform = 'var(--cta-primary-hover-transform)';
          }}
          onMouseOut={(e) => {
            const target = e.target as HTMLButtonElement;
            target.style.backgroundColor = 'var(--cta-primary-bg)';
            target.style.color = 'var(--cta-primary-text)';
            target.style.opacity = '1';
            target.style.transform = 'none';
          }}
        >
          Accept
        </button>
      </div>
    </div>
  );
}`;
}


export function generateTemplateCSSVars(tokens: DesignTokens, safeColors: SafeColors, styles: StyleMapping): string {
  const fontFamily = tokens.typography.fontFamilies[0] || 'system-ui, -apple-system, sans-serif';

  // Check if we have actual hover data
  const hasPrimaryHover = styles.button?.primaryHover &&
    (styles.button.primaryHover.backgroundColor || styles.button.primaryHover.opacity);
  const hasSecondaryHover = styles.button?.secondaryHover &&
    (styles.button.secondaryHover.backgroundColor || styles.button.secondaryHover.opacity);

  console.log('🔍 Hover data check:', { hasPrimaryHover, hasSecondaryHover });
  if (hasPrimaryHover) {
    console.log('🎨 PRIMARY HOVER:', styles.button?.primaryHover);
  }
  if (hasSecondaryHover) {
    console.log('🎨 SECONDARY HOVER:', styles.button?.secondaryHover);
  }

  // Generate hover CSS only if we have hover data
  let primaryHoverCSS = '';
  if (hasPrimaryHover) {
    primaryHoverCSS = `
.cta-button-primary:hover {
  ${styles.button?.primaryHover?.backgroundColor ? `background-color: ${styles.button.primaryHover.backgroundColor} !important;` : ''}
  ${styles.button?.primaryHover?.color ? `color: ${styles.button.primaryHover.color} !important;` : ''}
  ${styles.button?.primaryHover?.opacity ? `opacity: ${styles.button.primaryHover.opacity};` : ''}
  ${styles.button?.primaryHover?.transform ? `transform: ${styles.button.primaryHover.transform};` : ''}
}`;
  }

  let secondaryHoverCSS = '';
  if (hasSecondaryHover) {
    secondaryHoverCSS = `
.cta-button-secondary:hover {
  ${styles.button?.secondaryHover?.backgroundColor ? `background-color: ${styles.button.secondaryHover.backgroundColor} !important;` : ''}
  ${styles.button?.secondaryHover?.color ? `color: ${styles.button.secondaryHover.color} !important;` : ''}
  ${styles.button?.secondaryHover?.opacity ? `opacity: ${styles.button.secondaryHover.opacity};` : ''}
  ${styles.button?.secondaryHover?.transform ? `transform: ${styles.button.secondaryHover.transform};` : ''}
}`;
  }

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

  /* Transitions */
  --cta-transition: all 0.2s ease-in-out;
}
${primaryHoverCSS}
${secondaryHoverCSS}`;
}

export async function saveTemplateArtifacts(
  runId: string,
  artifacts: {
    component: string;
    styles: StyleMapping;
    css: string;
    template: string;
    html?: string;
  },
  artifactDir?: string
): Promise<void> {
  const baseDir = artifactDir || join(process.cwd(), 'artifacts');
  const runDir = join(baseDir, runId);
  const ctaDir = join(runDir, 'cta');

  await mkdir(ctaDir, { recursive: true });

  const filesToWrite = [
    writeFile(join(ctaDir, 'CTATemplate.tsx'), artifacts.component),
    writeFile(join(ctaDir, 'styles.json'), JSON.stringify(artifacts.styles, null, 2)),
    writeFile(join(ctaDir, 'template.css'), artifacts.css),
    writeFile(join(ctaDir, 'metadata.json'), JSON.stringify({
      templateType: artifacts.template,
      generatedAt: new Date().toISOString(),
      runId
    }, null, 2))
  ];

  if (artifacts.html) {
    filesToWrite.push(writeFile(join(ctaDir, 'template.html'), artifacts.html));
  }

  await Promise.all(filesToWrite);
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
    template: template.type,
    html: html
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