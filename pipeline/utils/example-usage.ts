/**
 * Example usage of the Tailwind Mapper with existing pipeline modules
 *
 * This demonstrates how to integrate the tailwind-mapper with the design token
 * system and CTA template generation for consistent Tailwind class generation.
 */

import type { DesignTokens } from '../tokens';
import type { StyleMapping } from '../cta-template';
import {
  mapColorToTailwind,
  generateButtonClasses,
  generateButtonVariants,
  styleMapperToTailwind,
  tokenButtonToTailwind,
  combineClasses
} from './tailwind-mapper';

/**
 * Example 1: Basic color and spacing mapping
 */
export function basicMappingExample() {
  // Map design token colors to Tailwind classes
  const primaryColor = '#3b82f6';
  const tailwindClass = mapColorToTailwind(primaryColor);
  console.log(`${primaryColor} → bg-${tailwindClass}`); // #3b82f6 → bg-blue-500

  // Build component classes
  const buttonClasses = combineClasses(
    `bg-${tailwindClass}`,
    'text-white',
    'px-4',
    'py-2',
    'rounded-lg',
    'hover:opacity-90'
  );

  return buttonClasses; // "bg-blue-500 text-white px-4 py-2 rounded-lg hover:opacity-90"
}

/**
 * Example 2: Integration with design tokens
 */
export function designTokenIntegration(tokens: DesignTokens) {
  // Generate all button variants from extracted design tokens
  const buttonVariants = generateButtonVariants(tokens);

  // Get the primary button classes
  const primaryButton = buttonVariants['primary-0'];
  const primaryClasses = combineClasses(
    primaryButton?.base,
    primaryButton?.hover
  );

  // Create a color palette mapping
  const colorPalette = {
    primary: mapColorToTailwind(tokens.colors.semantic.cta),
    text: mapColorToTailwind(tokens.colors.semantic.text),
    background: mapColorToTailwind(tokens.colors.semantic.background),
    accent: mapColorToTailwind(tokens.colors.semantic.accent)
  };

  return {
    buttonClasses: primaryClasses,
    colorPalette,
    allVariants: buttonVariants
  };
}

/**
 * Example 3: CTA Template StyleMapping integration
 */
export function ctaTemplateIntegration(styleMapping: StyleMapping) {
  // Convert existing StyleMapping to Tailwind classes
  const tailwindMapping = styleMapperToTailwind(styleMapping);

  // Build component with Tailwind classes
  const containerClasses = combineClasses(
    `bg-${tailwindMapping.colors.background}`,
    `text-${tailwindMapping.colors.text}`,
    `p-${tailwindMapping.spacing.container}`
  );

  const buttonClasses = combineClasses(
    `bg-${tailwindMapping.colors.primary}`,
    `text-white`,
    tailwindMapping.button
  );

  return {
    container: containerClasses,
    button: buttonClasses,
    mapping: tailwindMapping
  };
}

/**
 * Example 4: Direct button variant conversion
 */
export function directButtonConversion(tokens: DesignTokens) {
  // Get the most prominent button from design tokens
  const primaryButton = tokens.buttons.variants.find(b => b.type !== 'ghost') || tokens.buttons.variants[0];

  if (!primaryButton) {
    return null;
  }

  // Convert to Tailwind classes
  const tailwindButton = tokenButtonToTailwind(primaryButton);

  // Create JSX-ready className
  const baseClassName = tailwindButton.base;
  const hoverClassName = tailwindButton.hover;
  const fullClassName = combineClasses(baseClassName, hoverClassName);

  return {
    base: baseClassName,
    hover: hoverClassName,
    full: fullClassName,
    jsx: `className="${fullClassName}"`
  };
}

/**
 * Example 5: Component generation with Tailwind classes
 */
export function generateTailwindComponent(tokens: DesignTokens) {
  const buttonVariants = generateButtonVariants(tokens);
  const primaryButton = buttonVariants['primary-0'];

  // Generate React component code with Tailwind classes
  const componentCode = `
export function GeneratedButton({ children, variant = 'primary', ...props }) {
  const baseClasses = "${primaryButton?.base.join(' ') || 'btn-base'}";
  const hoverClasses = "${primaryButton?.hover.join(' ') || ''}";
  const className = \`\${baseClasses} \${hoverClasses}\`;

  return (
    <button className={className} {...props}>
      {children}
    </button>
  );
}`;

  return componentCode;
}

/**
 * Example 6: Theme generation for consistent styling
 */
export function generateTailwindTheme(tokens: DesignTokens) {
  const theme = {
    colors: {
      primary: mapColorToTailwind(tokens.colors.semantic.cta),
      secondary: mapColorToTailwind(tokens.colors.semantic.accent),
      text: mapColorToTailwind(tokens.colors.semantic.text),
      background: mapColorToTailwind(tokens.colors.semantic.background),
      muted: mapColorToTailwind(tokens.colors.semantic.muted)
    },
    buttons: generateButtonVariants(tokens)
  };

  // Generate CSS custom properties for fallback
  const cssVars = Object.entries(theme.colors)
    .map(([key, value]) => `  --color-${key}: theme('colors.${value}');`)
    .join('\n');

  return {
    theme,
    cssVars: `:root {\n${cssVars}\n}`
  };
}

/**
 * Integration helper for codegen module
 */
export function integrateWithCodegen(tokens: DesignTokens, styleMapping: StyleMapping) {
  // Convert both design tokens and style mapping to consistent Tailwind classes
  const tokenVariants = generateButtonVariants(tokens);
  const mappingClasses = styleMapperToTailwind(styleMapping);

  // Merge for comprehensive styling options
  const integrationResult = {
    // Semantic color classes
    colors: {
      primary: `bg-${mappingClasses.colors.primary}`,
      secondary: `bg-${mappingClasses.colors.secondary}`,
      text: `text-${mappingClasses.colors.text}`,
      background: `bg-${mappingClasses.colors.background}`,
      accent: `bg-${mappingClasses.colors.accent}`
    },

    // Spacing utilities
    spacing: {
      container: `p-${mappingClasses.spacing.container}`,
      section: `mb-${mappingClasses.spacing.section}`,
      element: `gap-${mappingClasses.spacing.element}`
    },

    // Button variants ready for use
    buttons: Object.entries(tokenVariants).reduce((acc, [name, classes]) => {
      acc[name] = combineClasses(classes.base, classes.hover);
      return acc;
    }, {} as Record<string, string>),

    // Component-level classes
    components: {
      card: combineClasses(
        `bg-${mappingClasses.colors.background}`,
        `text-${mappingClasses.colors.text}`,
        `p-${mappingClasses.spacing.container}`,
        'rounded-lg',
        'shadow-sm'
      ),
      button: combineClasses(mappingClasses.button),
      text: `text-${mappingClasses.colors.text}`,
      heading: combineClasses(
        `text-${mappingClasses.colors.text}`,
        'font-semibold',
        'text-xl'
      )
    }
  };

  return integrationResult;
}

/**
 * Helper for generating safelist classes for Tailwind JIT
 */
export function generateSafelistClasses(tokens: DesignTokens): string[] {
  const safelist: string[] = [];

  // Add color classes
  tokens.colors.primary.forEach(color => {
    const tailwindColor = mapColorToTailwind(color);
    safelist.push(`bg-${tailwindColor}`, `text-${tailwindColor}`, `border-${tailwindColor}`);
  });

  // Add button variant classes
  const buttonVariants = generateButtonVariants(tokens);
  Object.values(buttonVariants).forEach(variant => {
    safelist.push(...variant.base, ...variant.hover);
  });

  return [...new Set(safelist)]; // Remove duplicates
}