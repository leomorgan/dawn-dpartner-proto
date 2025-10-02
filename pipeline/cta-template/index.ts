import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import type { DesignTokens } from '../tokens';
import { getSystemFontFallback, normalizeSystemFontWeight } from './font-fallbacks';
import { classifyButtonsWithLLM } from '../tokens/button-classifier';
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
  primaryText?: string;
  secondaryText?: string;
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

/**
 * Ghost button visibility validator
 * Determines if a ghost button is visually valid by checking:
 * - Border visibility (color + width)
 * - Text visibility (color + contrast)
 * - Hover state presence
 */
interface GhostButtonValidation {
  isValid: boolean;
  score: number;
  reasons: string[];
}

function validateGhostButton(
  button: DesignTokens['buttons']['variants'][0],
  pageBackground: string
): GhostButtonValidation {
  const reasons: string[] = [];
  let score = 0;

  // 1. Check if button has a visible border
  const hasBorder = button.borderColor && button.borderColor !== '#000000' && button.borderColor !== 'transparent';
  if (hasBorder) {
    score += 40;
    reasons.push(`Has visible border (${button.borderColor})`);
  }

  // 2. Check if text color is visible against page background
  const textColor = button.color;
  if (textColor && textColor !== 'transparent') {
    try {
      const contrast = calculateContrast(textColor, pageBackground);
      if (contrast >= 3.0) {
        score += 30;
        reasons.push(`Text has good contrast (${contrast.toFixed(1)}:1)`);
      } else if (contrast >= 2.0) {
        score += 15;
        reasons.push(`Text has minimal contrast (${contrast.toFixed(1)}:1)`);
      } else if (contrast > 0) {
        reasons.push(`Text contrast too low (${contrast.toFixed(1)}:1)`);
      }
    } catch (err) {
      reasons.push(`Failed to calculate contrast: ${err instanceof Error ? err.message : 'unknown error'}`);
    }
  }

  // 3. Check if button has hover state
  if (button.hover) {
    if (button.hover.backgroundColor || button.hover.color) {
      score += 20;
      reasons.push('Has hover state');
    }
    if (button.hover.opacity) {
      score += 10;
      reasons.push('Has opacity hover');
    }
  }

  // Valid if: (border + text contrast) OR (text contrast + hover) OR (border + hover)
  const isValid = score >= 50;

  return { isValid, score, reasons };
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

  // Fallback to contrast-compliant color from extracted palette
  const textColor = ensureContrastCompliance(tokens.colors.semantic.text, backgroundColor, tokens);
  return textColor !== tokens.colors.semantic.text ? textColor : tokens.colors.neutral[0] || tokens.colors.primary[0];
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

export async function validateAndSelectColors(tokens: DesignTokens): Promise<SafeColors> {
  const pageBackground = tokens.colors.semantic.background;

  // 🤖 Use LLM to semantically classify buttons based on copy and visual properties
  const llmClassification = await classifyButtonsWithLLM(tokens.buttons.variants);
  console.log('🎨 Button Classification:', {
    primary: llmClassification.primary,
    secondary: llmClassification.secondary,
    primaryIndex: llmClassification.primaryIndex,
    secondaryIndex: llmClassification.secondaryIndex,
    reasoning: llmClassification.reasoning
  });

  // 1. Separate buttons into solid and ghost types
  const solidButtons = tokens.buttons.variants.filter(b => b.type !== 'ghost');
  const ghostButtons = tokens.buttons.variants.filter(b => b.type === 'ghost');

  // 2. Validate ghost buttons and filter to only valid ones
  const validGhostButtons = ghostButtons
    .map(button => ({
      button,
      validation: validateGhostButton(button, pageBackground)
    }))
    .filter(({ validation }) => validation.isValid)
    .sort((a, b) => b.validation.score - a.validation.score);

  console.log(`👻 Ghost button validation: ${ghostButtons.length} total, ${validGhostButtons.length} valid`);
  if (validGhostButtons.length > 0) {
    validGhostButtons.forEach(({ button, validation }) => {
      console.log(`  ✅ Score ${validation.score}: ${button.color} | ${validation.reasons.join(', ')}`);
    });
  } else if (ghostButtons.length > 0) {
    console.log('  ❌ No ghost buttons passed validation. Checking why...');
    ghostButtons.slice(0, 3).forEach(button => {
      const validation = validateGhostButton(button, pageBackground);
      console.log(`    ${button.color} scored ${validation.score}: ${validation.reasons.join(', ') || 'no reasons'}`);
    });
  }

  // 3. Combine solid and valid ghost buttons for selection
  const selectableButtons = [...solidButtons, ...validGhostButtons.map(v => v.button)];

  // 3a. Build a list of actionable buttons (excluding #000000) for LLM index mapping
  const actionableButtons = tokens.buttons.variants.filter(b => b.backgroundColor !== '#000000');

  // 4. Select primary: use LLM classification if available, fallback to heuristics
  let primaryButton: typeof tokens.buttons.variants[0] | undefined;

  // Try to use LLM index first (most specific)
  if (llmClassification.primaryIndex && llmClassification.primaryIndex > 0 && llmClassification.primaryIndex <= actionableButtons.length) {
    const llmSelectedPrimary = actionableButtons[llmClassification.primaryIndex - 1];
    // Verify it's in selectableButtons (passed validation)
    primaryButton = selectableButtons.find(b => b === llmSelectedPrimary);
  }

  // Fallback to backgroundColor match
  if (!primaryButton) {
    primaryButton = selectableButtons.find(b =>
      llmClassification.primary.includes(b.backgroundColor)
    );
  }

  if (!primaryButton) {
    // Fallback: prefer solid buttons with hover states
    primaryButton = selectableButtons.find(b =>
      b.type !== 'ghost' && (b.hover?.backgroundColor || b.hover?.opacity)
    ) || selectableButtons[0] || tokens.buttons.variants[0];
  }

  // 5. Select secondary: use LLM classification if available, fallback to heuristics
  const primaryBg = primaryButton?.backgroundColor;

  let secondaryButton: typeof tokens.buttons.variants[0] | undefined;

  // Try to use LLM index first (most specific)
  if (llmClassification.secondaryIndex && llmClassification.secondaryIndex > 0 && llmClassification.secondaryIndex <= actionableButtons.length) {
    const llmSelectedSecondary = actionableButtons[llmClassification.secondaryIndex - 1];
    // Verify it's in selectableButtons and different from primary
    if (llmSelectedSecondary !== primaryButton) {
      secondaryButton = selectableButtons.find(b => b === llmSelectedSecondary);
    }
  }

  // Fallback to backgroundColor match
  if (!secondaryButton) {
    secondaryButton = selectableButtons.find(b =>
      llmClassification.secondary.includes(b.backgroundColor) &&
      b.backgroundColor !== primaryBg
    );
  }

  if (!secondaryButton) {
    // Fallback: find a DIFFERENT color from primary
    const differentButtons = selectableButtons.filter(b =>
      b.backgroundColor !== primaryBg &&
      b.backgroundColor !== '#transparent' &&
      b.backgroundColor !== '#000000'
    );

    // Sort by: 1) has hover state, 2) prominence score, 3) count
    secondaryButton = differentButtons.sort((a, b) => {
      const aHasHover = (a.hover?.backgroundColor || a.hover?.opacity) ? 1 : 0;
      const bHasHover = (b.hover?.backgroundColor || b.hover?.opacity) ? 1 : 0;

      if (aHasHover !== bHasHover) return bHasHover - aHasHover;

      const aProminence = a.prominence?.score || 0;
      const bProminence = b.prominence?.score || 0;
      if (Math.abs(aProminence - bProminence) > 2) return bProminence - aProminence;

      return (b.count || 0) - (a.count || 0);
    })[0] || validGhostButtons[0]?.button;
  }

  const secondaryBg = secondaryButton?.backgroundColor ||
    tokens.colors.contextual?.buttons?.find(c => c !== primaryBg && c !== '#000000') ||
    tokens.colors.neutral.find(c => c !== '#000000') ||
    tokens.colors.neutral[0];

  // 6. Find appropriate text colors for both buttons
  const primaryTextColor = primaryButton?.color || findButtonTextColor(primaryBg || tokens.colors.semantic.cta, tokens);
  const secondaryTextColor = secondaryButton?.color || findButtonTextColor(secondaryBg, tokens);

  console.log('✅ Selected buttons:', {
    primary: { bg: primaryBg, text: primaryTextColor, hasHover: !!primaryButton?.hover },
    secondary: { bg: secondaryBg, text: secondaryTextColor, hasHover: !!secondaryButton?.hover }
  });

  const safeColors: SafeColors = {
    primary: tokens.colors.primary[0],
    secondary: secondaryBg,
    background: pageBackground,
    text: tokens.colors.semantic.text,
    accent: tokens.colors.semantic.accent,
    ctaPrimary: primaryBg || tokens.colors.semantic.cta,
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
  // WCAG 2.1 contrast calculation
  const getLuminance = (hex: string): number => {
    const rgb = parseInt(hex.slice(1), 16);
    const r = ((rgb >> 16) & 0xff) / 255;
    const g = ((rgb >> 8) & 0xff) / 255;
    const b = ((rgb >> 0) & 0xff) / 255;

    // Apply sRGB gamma correction
    const sRGB = [r, g, b].map(c => {
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

  // Normalize font weight for system fonts
  const originalFontFamily = tokens.typography.fontFamilies[0] || 'system-ui';
  const systemFontStack = getSystemFontFallback(originalFontFamily);
  const rawFontWeight = primaryButton?.fontWeight || 500;
  const buttonFontWeight = normalizeSystemFontWeight(rawFontWeight, systemFontStack).toString();

  console.log('🔢 Font weight normalization:', {
    original: rawFontWeight,
    normalized: buttonFontWeight,
    fontStack: systemFontStack
  });

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
    primaryText: safeColors.ctaPrimaryText,
    secondaryText: safeColors.ctaSecondaryText,
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
  // Get original font family and convert to system font fallback
  const originalFontFamily = tokens.typography.fontFamilies[0] || 'system-ui, -apple-system, sans-serif';
  const fontFamily = getSystemFontFallback(originalFontFamily);

  console.log('🔤 Font mapping:', {
    original: originalFontFamily,
    systemFallback: fontFamily
  });

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

  // Select optimal colors with contrast validation (using LLM semantic analysis)
  const safeColors = await validateAndSelectColors(tokens);

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