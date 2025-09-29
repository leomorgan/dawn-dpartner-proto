import { parse, formatHex, differenceEuclidean } from 'culori';
import type { DesignTokens } from '../tokens';

// Standard Tailwind color palette for mapping
const TAILWIND_COLORS = {
  slate: ['#f8fafc', '#f1f5f9', '#e2e8f0', '#cbd5e1', '#94a3b8', '#64748b', '#475569', '#334155', '#1e293b', '#0f172a'],
  gray: ['#f9fafb', '#f3f4f6', '#e5e7eb', '#d1d5db', '#9ca3af', '#6b7280', '#374151', '#111827', '#030712'],
  zinc: ['#fafafa', '#f4f4f5', '#e4e4e7', '#d4d4d8', '#a1a1aa', '#71717a', '#52525b', '#3f3f46', '#27272a', '#18181b'],
  neutral: ['#fafafa', '#f5f5f5', '#e5e5e5', '#d4d4d4', '#a3a3a3', '#737373', '#525252', '#404040', '#262626', '#171717'],
  stone: ['#fafaf9', '#f5f5f4', '#e7e5e4', '#d6d3d1', '#a8a29e', '#78716c', '#57534e', '#44403c', '#292524', '#1c1917'],
  red: ['#fef2f2', '#fee2e2', '#fecaca', '#fca5a5', '#f87171', '#ef4444', '#dc2626', '#b91c1c', '#991b1b', '#7f1d1d'],
  orange: ['#fff7ed', '#ffedd5', '#fed7aa', '#fdba74', '#fb923c', '#f97316', '#ea580c', '#c2410c', '#9a3412', '#7c2d12'],
  amber: ['#fffbeb', '#fef3c7', '#fde68a', '#fcd34d', '#fbbf24', '#f59e0b', '#d97706', '#b45309', '#92400e', '#78350f'],
  yellow: ['#fefce8', '#fef9c3', '#fef08a', '#fde047', '#facc15', '#eab308', '#ca8a04', '#a16207', '#854d0e', '#713f12'],
  lime: ['#f7fee7', '#ecfccb', '#d9f99d', '#bef264', '#a3e635', '#84cc16', '#65a30d', '#4d7c0f', '#365314', '#1a2e05'],
  green: ['#f0fdf4', '#dcfce7', '#bbf7d0', '#86efac', '#4ade80', '#22c55e', '#16a34a', '#15803d', '#166534', '#14532d'],
  emerald: ['#ecfdf5', '#d1fae5', '#a7f3d0', '#6ee7b7', '#34d399', '#10b981', '#059669', '#047857', '#065f46', '#064e3b'],
  teal: ['#f0fdfa', '#ccfbf1', '#99f6e4', '#5eead4', '#2dd4bf', '#14b8a6', '#0d9488', '#0f766e', '#115e59', '#134e4a'],
  cyan: ['#ecfeff', '#cffafe', '#a5f3fc', '#67e8f9', '#22d3ee', '#06b6d4', '#0891b2', '#0e7490', '#155e75', '#164e63'],
  sky: ['#f0f9ff', '#e0f2fe', '#bae6fd', '#7dd3fc', '#38bdf8', '#0ea5e9', '#0284c7', '#0369a1', '#075985', '#0c4a6e'],
  blue: ['#eff6ff', '#dbeafe', '#bfdbfe', '#93c5fd', '#60a5fa', '#3b82f6', '#2563eb', '#1d4ed8', '#1e40af', '#1e3a8a'],
  indigo: ['#eef2ff', '#e0e7ff', '#c7d2fe', '#a5b4fc', '#818cf8', '#6366f1', '#4f46e5', '#4338ca', '#3730a3', '#312e81'],
  violet: ['#f5f3ff', '#ede9fe', '#ddd6fe', '#c4b5fd', '#a78bfa', '#8b5cf6', '#7c3aed', '#6d28d9', '#5b21b6', '#4c1d95'],
  purple: ['#faf5ff', '#f3e8ff', '#e9d5ff', '#d8b4fe', '#c084fc', '#a855f7', '#9333ea', '#7e22ce', '#6b21a8', '#581c87'],
  fuchsia: ['#fdf4ff', '#fae8ff', '#f5d0fe', '#f0abfc', '#e879f9', '#d946ef', '#c026d3', '#a21caf', '#86198f', '#701a75'],
  pink: ['#fdf2f8', '#fce7f3', '#fbcfe8', '#f9a8d4', '#f472b6', '#ec4899', '#db2777', '#be185d', '#9d174d', '#831843'],
  rose: ['#fff1f2', '#ffe4e6', '#fecdd3', '#fda4af', '#fb7185', '#f43f5e', '#e11d48', '#be123c', '#9f1239', '#881337']
};

// Tailwind spacing scale (4px units)
const TAILWIND_SPACING = {
  0: '0px',
  px: '1px',
  0.5: '2px',
  1: '4px',
  1.5: '6px',
  2: '8px',
  2.5: '10px',
  3: '12px',
  3.5: '14px',
  4: '16px',
  5: '20px',
  6: '24px',
  7: '28px',
  8: '32px',
  9: '36px',
  10: '40px',
  11: '44px',
  12: '48px',
  14: '56px',
  16: '64px',
  20: '80px',
  24: '96px',
  28: '112px',
  32: '128px',
  36: '144px',
  40: '160px',
  44: '176px',
  48: '192px',
  52: '208px',
  56: '224px',
  60: '240px',
  64: '256px',
  72: '288px',
  80: '320px',
  96: '384px'
};

// Tailwind border radius scale
const TAILWIND_RADIUS = {
  none: '0px',
  sm: '2px',
  DEFAULT: '4px',
  md: '6px',
  lg: '8px',
  xl: '12px',
  '2xl': '16px',
  '3xl': '24px',
  full: '9999px'
};

// Tailwind font weight scale
const TAILWIND_FONT_WEIGHTS = {
  thin: '100',
  extralight: '200',
  light: '300',
  normal: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
  extrabold: '800',
  black: '900'
};

// Configuration interfaces
export interface ButtonConfig {
  backgroundColor: string;
  color: string;
  borderColor?: string;
  borderRadius: string;
  padding: string;
  fontSize: number;
  fontWeight: number;
  display: string;
  alignItems: string;
  justifyContent: string;
  textAlign: string;
  hover?: HoverConfig;
}

export interface HoverConfig {
  backgroundColor?: string;
  color?: string;
  opacity?: number;
  transform?: string;
  transition?: string;
}

export interface TailwindClasses {
  base: string[];
  hover: string[];
  responsive?: Record<string, string[]>;
}

/**
 * Maps a hex color to the closest Tailwind color class
 */
export function mapColorToTailwind(hex: string): string {
  if (!hex || hex === 'transparent' || hex === '#transparent') {
    return 'transparent';
  }

  const parsedColor = parse(hex);
  if (!parsedColor) {
    return 'gray-500'; // Safe fallback
  }

  let closestColor = 'gray-500';
  let smallestDistance = Infinity;

  // Check each Tailwind color family
  for (const [colorName, shades] of Object.entries(TAILWIND_COLORS)) {
    shades.forEach((shade, index) => {
      const parsedShade = parse(shade);
      if (parsedShade) {
        const distance = differenceEuclidean()(parsedColor, parsedShade);
        if (distance < smallestDistance) {
          smallestDistance = distance;
          // Map index to Tailwind scale (50, 100, 200, ..., 900)
          const weight = index === 0 ? 50 : index * 100;
          closestColor = `${colorName}-${weight}`;
        }
      }
    });
  }

  return closestColor;
}

/**
 * Maps pixel values to Tailwind spacing classes
 */
export function mapSpacingToTailwind(px: string | number): string {
  const pixelValue = typeof px === 'string' ? parseFloat(px.replace('px', '')) : px;

  if (isNaN(pixelValue) || pixelValue < 0) {
    return '0';
  }

  // Find the closest Tailwind spacing value
  let closestKey = '0';
  let smallestDifference = Infinity;

  for (const [key, value] of Object.entries(TAILWIND_SPACING)) {
    const spacingPx = parseFloat(value.replace('px', ''));
    const difference = Math.abs(spacingPx - pixelValue);

    if (difference < smallestDifference) {
      smallestDifference = difference;
      closestKey = key;
    }
  }

  return closestKey;
}

/**
 * Maps border radius values to Tailwind radius classes
 */
export function mapRadiusToTailwind(radius: string): string {
  if (!radius || radius === '0' || radius === '0px') {
    return 'none';
  }

  const pixelValue = parseFloat(radius.replace('px', ''));

  if (isNaN(pixelValue)) {
    return 'DEFAULT';
  }

  // Handle special cases
  if (pixelValue >= 9999 || radius.includes('%')) {
    return 'full';
  }

  // Find closest Tailwind radius
  let closestKey = 'DEFAULT';
  let smallestDifference = Infinity;

  for (const [key, value] of Object.entries(TAILWIND_RADIUS)) {
    if (key === 'full') continue; // Handle separately above

    const radiusPx = parseFloat(value.replace('px', ''));
    const difference = Math.abs(radiusPx - pixelValue);

    if (difference < smallestDifference) {
      smallestDifference = difference;
      closestKey = key;
    }
  }

  return closestKey;
}

/**
 * Maps font weight values to Tailwind font weight classes
 */
export function mapFontWeightToTailwind(weight: number | string): string {
  const weightNumber = typeof weight === 'string' ? parseInt(weight) : weight;

  if (isNaN(weightNumber)) {
    return 'normal';
  }

  // Find closest Tailwind font weight
  let closestKey = 'normal';
  let smallestDifference = Infinity;

  for (const [key, value] of Object.entries(TAILWIND_FONT_WEIGHTS)) {
    const weightValue = parseInt(value);
    const difference = Math.abs(weightValue - weightNumber);

    if (difference < smallestDifference) {
      smallestDifference = difference;
      closestKey = key;
    }
  }

  return closestKey;
}

/**
 * Parses padding shorthand into individual values
 */
function parsePadding(padding: string): { top: string, right: string, bottom: string, left: string } {
  const parts = padding.trim().split(/\s+/);

  switch (parts.length) {
    case 1:
      return { top: parts[0], right: parts[0], bottom: parts[0], left: parts[0] };
    case 2:
      return { top: parts[0], right: parts[1], bottom: parts[0], left: parts[1] };
    case 3:
      return { top: parts[0], right: parts[1], bottom: parts[2], left: parts[1] };
    case 4:
      return { top: parts[0], right: parts[1], bottom: parts[2], left: parts[3] };
    default:
      return { top: '0', right: '0', bottom: '0', left: '0' };
  }
}

/**
 * Maps padding values to Tailwind padding classes
 */
export function mapPaddingToTailwind(padding: string): string[] {
  const parsed = parsePadding(padding);
  const classes: string[] = [];

  const topKey = mapSpacingToTailwind(parsed.top);
  const rightKey = mapSpacingToTailwind(parsed.right);
  const bottomKey = mapSpacingToTailwind(parsed.bottom);
  const leftKey = mapSpacingToTailwind(parsed.left);

  // Check if we can use shorthand classes
  if (topKey === rightKey && rightKey === bottomKey && bottomKey === leftKey) {
    // All sides equal
    classes.push(`p-${topKey}`);
  } else if (topKey === bottomKey && rightKey === leftKey) {
    // Vertical and horizontal pairs
    classes.push(`py-${topKey}`, `px-${rightKey}`);
  } else {
    // Individual sides
    if (topKey !== '0') classes.push(`pt-${topKey}`);
    if (rightKey !== '0') classes.push(`pr-${rightKey}`);
    if (bottomKey !== '0') classes.push(`pb-${bottomKey}`);
    if (leftKey !== '0') classes.push(`pl-${leftKey}`);
  }

  return classes.filter(cls => !cls.includes('undefined'));
}

/**
 * Generates complete button classes from button configuration
 */
export function generateButtonClasses(buttonConfig: ButtonConfig): TailwindClasses {
  const base: string[] = [];
  let hover: string[] = [];

  // Background color
  const bgClass = mapColorToTailwind(buttonConfig.backgroundColor);
  if (bgClass !== 'transparent') {
    base.push(`bg-${bgClass}`);
  }

  // Text color
  const textClass = mapColorToTailwind(buttonConfig.color);
  base.push(`text-${textClass}`);

  // Border
  if (buttonConfig.borderColor) {
    const borderClass = mapColorToTailwind(buttonConfig.borderColor);
    base.push(`border`, `border-${borderClass}`);
  }

  // Border radius
  const radiusClass = mapRadiusToTailwind(buttonConfig.borderRadius);
  if (radiusClass !== 'DEFAULT') {
    base.push(`rounded-${radiusClass}`);
  } else {
    base.push('rounded');
  }

  // Padding
  const paddingClasses = mapPaddingToTailwind(buttonConfig.padding);
  base.push(...paddingClasses);

  // Font size
  const fontSize = buttonConfig.fontSize;
  if (fontSize <= 12) base.push('text-xs');
  else if (fontSize <= 14) base.push('text-sm');
  else if (fontSize <= 16) base.push('text-base');
  else if (fontSize <= 18) base.push('text-lg');
  else if (fontSize <= 20) base.push('text-xl');
  else if (fontSize <= 24) base.push('text-2xl');
  else base.push('text-3xl');

  // Font weight
  const weightClass = mapFontWeightToTailwind(buttonConfig.fontWeight);
  base.push(`font-${weightClass}`);

  // Display and alignment
  if (buttonConfig.display.includes('flex')) {
    base.push('flex');

    if (buttonConfig.alignItems === 'center') base.push('items-center');
    else if (buttonConfig.alignItems === 'start') base.push('items-start');
    else if (buttonConfig.alignItems === 'end') base.push('items-end');

    if (buttonConfig.justifyContent === 'center') base.push('justify-center');
    else if (buttonConfig.justifyContent === 'start') base.push('justify-start');
    else if (buttonConfig.justifyContent === 'end') base.push('justify-end');
    else if (buttonConfig.justifyContent === 'between') base.push('justify-between');
  } else if (buttonConfig.display === 'inline-block') {
    base.push('inline-block');
  }

  // Text alignment
  if (buttonConfig.textAlign === 'center') base.push('text-center');
  else if (buttonConfig.textAlign === 'left') base.push('text-left');
  else if (buttonConfig.textAlign === 'right') base.push('text-right');

  // Common button utilities
  base.push('cursor-pointer', 'transition-colors', 'duration-200');

  // Generate hover classes if hover config is provided
  if (buttonConfig.hover) {
    hover = generateHoverClasses(buttonConfig.hover);
  }

  return { base, hover };
}

/**
 * Generates hover modifier classes
 */
export function generateHoverClasses(hoverConfig: HoverConfig): string[] {
  const hoverClasses: string[] = [];

  if (hoverConfig.backgroundColor) {
    const bgClass = mapColorToTailwind(hoverConfig.backgroundColor);
    if (bgClass !== 'transparent') {
      hoverClasses.push(`hover:bg-${bgClass}`);
    }
  }

  if (hoverConfig.color) {
    const textClass = mapColorToTailwind(hoverConfig.color);
    hoverClasses.push(`hover:text-${textClass}`);
  }

  if (hoverConfig.opacity !== undefined) {
    const opacity = Math.round(hoverConfig.opacity * 100);
    if (opacity === 0) hoverClasses.push('hover:opacity-0');
    else if (opacity === 5) hoverClasses.push('hover:opacity-5');
    else if (opacity === 10) hoverClasses.push('hover:opacity-10');
    else if (opacity === 20) hoverClasses.push('hover:opacity-20');
    else if (opacity === 25) hoverClasses.push('hover:opacity-25');
    else if (opacity === 30) hoverClasses.push('hover:opacity-30');
    else if (opacity === 40) hoverClasses.push('hover:opacity-40');
    else if (opacity === 50) hoverClasses.push('hover:opacity-50');
    else if (opacity === 60) hoverClasses.push('hover:opacity-60');
    else if (opacity === 70) hoverClasses.push('hover:opacity-70');
    else if (opacity === 75) hoverClasses.push('hover:opacity-75');
    else if (opacity === 80) hoverClasses.push('hover:opacity-80');
    else if (opacity === 90) hoverClasses.push('hover:opacity-90');
    else if (opacity === 95) hoverClasses.push('hover:opacity-95');
    else hoverClasses.push('hover:opacity-100');
  }

  if (hoverConfig.transform) {
    if (hoverConfig.transform.includes('scale')) {
      hoverClasses.push('hover:scale-105');
    }
    if (hoverConfig.transform.includes('translate')) {
      hoverClasses.push('hover:-translate-y-1');
    }
  }

  return hoverClasses;
}

/**
 * Generates button variant mappings for common button types
 */
export function generateButtonVariants(tokens: DesignTokens): Record<string, TailwindClasses> {
  const variants: Record<string, TailwindClasses> = {};

  // Process each button variant from design tokens
  tokens.buttons.variants.forEach((variant, index) => {
    const variantName = `${variant.type}-${index}`;
    const buttonClasses = generateButtonClasses(variant);

    if (variant.hover) {
      const hoverClasses = generateHoverClasses(variant.hover);
      buttonClasses.hover = hoverClasses;
    }

    variants[variantName] = buttonClasses;
  });

  // Generate standard variants if not present
  if (!variants['primary-0']) {
    const primaryColor = tokens.colors.semantic.cta || tokens.colors.primary[0];
    const primaryText = tokens.colors.semantic.background || '#ffffff';

    variants.primary = generateButtonClasses({
      backgroundColor: primaryColor,
      color: primaryText,
      borderRadius: tokens.borderRadius[0] || '4px',
      padding: '12px 24px',
      fontSize: 16,
      fontWeight: 500,
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      textAlign: 'center'
    });
  }

  if (!variants['secondary-0']) {
    const secondaryColor = tokens.colors.neutral[0] || '#f5f5f5';
    const secondaryText = tokens.colors.semantic.text || '#000000';

    variants.secondary = generateButtonClasses({
      backgroundColor: secondaryColor,
      color: secondaryText,
      borderRadius: tokens.borderRadius[0] || '4px',
      padding: '12px 24px',
      fontSize: 16,
      fontWeight: 500,
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      textAlign: 'center'
    });
  }

  return variants;
}

/**
 * Generates a complete set of utility classes for a component
 */
export function generateComponentClasses(tokens: DesignTokens): {
  colors: Record<string, string>;
  spacing: Record<string, string>;
  typography: Record<string, string>;
  buttons: Record<string, TailwindClasses>;
} {
  // Colors
  const colors: Record<string, string> = {};
  tokens.colors.primary.forEach((color, index) => {
    colors[`primary-${index}`] = mapColorToTailwind(color);
  });
  tokens.colors.neutral.forEach((color, index) => {
    colors[`neutral-${index}`] = mapColorToTailwind(color);
  });

  // Spacing
  const spacing: Record<string, string> = {};
  tokens.spacing.forEach((space, index) => {
    spacing[`space-${index}`] = mapSpacingToTailwind(space);
  });

  // Typography
  const typography: Record<string, string> = {};
  tokens.typography.fontWeights.forEach((weight, index) => {
    typography[`weight-${index}`] = mapFontWeightToTailwind(weight);
  });

  // Buttons
  const buttons = generateButtonVariants(tokens);

  return {
    colors,
    spacing,
    typography,
    buttons
  };
}

/**
 * Utility function to create a complete Tailwind class string from multiple parts
 */
export function combineClasses(...classGroups: (string | string[] | undefined)[]): string {
  const allClasses: string[] = [];

  classGroups.forEach(group => {
    if (typeof group === 'string') {
      allClasses.push(group);
    } else if (Array.isArray(group)) {
      allClasses.push(...group);
    }
  });

  // Remove duplicates and filter out empty strings
  return Array.from(new Set(allClasses))
    .filter(cls => cls && cls.trim())
    .join(' ');
}

/**
 * Generates responsive modifier classes
 */
export function generateResponsiveClasses(
  baseClasses: string[],
  breakpoints: Record<string, string[]> = {}
): Record<string, string[]> {
  const responsive: Record<string, string[]> = {
    base: baseClasses
  };

  // Add breakpoint-specific classes
  Object.entries(breakpoints).forEach(([breakpoint, classes]) => {
    responsive[breakpoint] = classes.map(cls => `${breakpoint}:${cls}`);
  });

  return responsive;
}

/**
 * Integration helper: Convert CTA template StyleMapping to Tailwind classes
 */
export function styleMapperToTailwind(styleMapping: {
  primary?: string;
  secondary?: string;
  background?: string;
  text?: string;
  accent?: string;
  spacing?: {
    container?: string;
    section?: string;
    element?: string;
  };
  button?: {
    borderRadius?: string;
    padding?: string;
    fontSize?: string;
    fontWeight?: string;
    border?: string;
    display?: string;
    alignItems?: string;
    justifyContent?: string;
    textAlign?: string;
  };
}): {
  colors: Record<string, string>;
  spacing: Record<string, string>;
  button: string[];
} {
  const result = {
    colors: {} as Record<string, string>,
    spacing: {} as Record<string, string>,
    button: [] as string[]
  };

  // Map colors
  if (styleMapping.primary) {
    result.colors.primary = mapColorToTailwind(styleMapping.primary);
  }
  if (styleMapping.secondary) {
    result.colors.secondary = mapColorToTailwind(styleMapping.secondary);
  }
  if (styleMapping.background) {
    result.colors.background = mapColorToTailwind(styleMapping.background);
  }
  if (styleMapping.text) {
    result.colors.text = mapColorToTailwind(styleMapping.text);
  }
  if (styleMapping.accent) {
    result.colors.accent = mapColorToTailwind(styleMapping.accent);
  }

  // Map spacing
  if (styleMapping.spacing?.container) {
    result.spacing.container = mapSpacingToTailwind(styleMapping.spacing.container);
  }
  if (styleMapping.spacing?.section) {
    result.spacing.section = mapSpacingToTailwind(styleMapping.spacing.section);
  }
  if (styleMapping.spacing?.element) {
    result.spacing.element = mapSpacingToTailwind(styleMapping.spacing.element);
  }

  // Map button styles
  if (styleMapping.button) {
    const button = styleMapping.button;

    if (button.borderRadius) {
      const radiusClass = mapRadiusToTailwind(button.borderRadius);
      result.button.push(radiusClass !== 'DEFAULT' ? `rounded-${radiusClass}` : 'rounded');
    }

    if (button.padding) {
      const paddingClasses = mapPaddingToTailwind(button.padding);
      result.button.push(...paddingClasses);
    }

    if (button.fontSize) {
      const fontSize = parseFloat(button.fontSize);
      if (fontSize <= 12) result.button.push('text-xs');
      else if (fontSize <= 14) result.button.push('text-sm');
      else if (fontSize <= 16) result.button.push('text-base');
      else if (fontSize <= 18) result.button.push('text-lg');
      else if (fontSize <= 20) result.button.push('text-xl');
      else if (fontSize <= 24) result.button.push('text-2xl');
      else result.button.push('text-3xl');
    }

    if (button.fontWeight) {
      const weightClass = mapFontWeightToTailwind(button.fontWeight);
      result.button.push(`font-${weightClass}`);
    }

    if (button.display?.includes('flex')) {
      result.button.push('flex');
    }

    if (button.alignItems === 'center') result.button.push('items-center');
    if (button.justifyContent === 'center') result.button.push('justify-center');
    if (button.textAlign === 'center') result.button.push('text-center');

    // Add common button utilities
    result.button.push('cursor-pointer', 'transition-colors', 'duration-200');
  }

  return result;
}

/**
 * Quick helper: Generate complete button Tailwind classes from design tokens button variant
 */
export function tokenButtonToTailwind(buttonVariant: {
  backgroundColor: string;
  color: string;
  borderColor?: string;
  borderRadius: string;
  padding: string;
  fontSize: number;
  fontWeight: number;
  display: string;
  alignItems: string;
  justifyContent: string;
  textAlign: string;
  hover?: {
    backgroundColor?: string;
    color?: string;
    opacity?: number;
    transform?: string;
    transition?: string;
  };
}): { base: string; hover: string } {
  const buttonConfig: ButtonConfig = {
    backgroundColor: buttonVariant.backgroundColor,
    color: buttonVariant.color,
    borderColor: buttonVariant.borderColor,
    borderRadius: buttonVariant.borderRadius,
    padding: buttonVariant.padding,
    fontSize: buttonVariant.fontSize,
    fontWeight: buttonVariant.fontWeight,
    display: buttonVariant.display,
    alignItems: buttonVariant.alignItems,
    justifyContent: buttonVariant.justifyContent,
    textAlign: buttonVariant.textAlign,
    hover: buttonVariant.hover
  };

  const classes = generateButtonClasses(buttonConfig);

  return {
    base: classes.base.join(' '),
    hover: classes.hover.join(' ')
  };
}