# Tailwind Utility Mapper

This module provides comprehensive utilities for mapping design tokens to Tailwind CSS classes, specifically designed for the AI Design Partner's component generation system.

## Features

- **Color Mapping**: Converts hex colors to closest Tailwind color classes
- **Spacing Conversion**: Maps pixel values to Tailwind's 4px-based spacing scale
- **Border Radius Mapping**: Converts radius values to Tailwind radius classes
- **Font Weight Mapping**: Maps numeric font weights to Tailwind utility classes
- **Button Class Generation**: Creates complete button class sets from configuration
- **Hover State Support**: Generates hover modifier classes
- **CTA Template Integration**: Direct integration with existing StyleMapping interface

## Quick Start

```typescript
import {
  mapColorToTailwind,
  mapSpacingToTailwind,
  generateButtonClasses,
  tokenButtonToTailwind
} from './pipeline/utils/tailwind-mapper';

// Basic color mapping
const buttonBg = mapColorToTailwind('#3b82f6'); // Returns: 'blue-500'

// Spacing conversion
const padding = mapSpacingToTailwind('16px'); // Returns: '4'

// Complete button generation
const buttonConfig = {
  backgroundColor: '#3b82f6',
  color: '#ffffff',
  borderRadius: '8px',
  padding: '12px 24px',
  fontSize: 16,
  fontWeight: 600,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  textAlign: 'center',
  hover: {
    backgroundColor: '#2563eb',
    opacity: 0.9
  }
};

const classes = generateButtonClasses(buttonConfig);
// classes.base: ['bg-blue-500', 'text-zinc-50', 'rounded-lg', 'py-3', 'px-6', ...]
// classes.hover: ['hover:bg-blue-600', 'hover:opacity-90']
```

## Integration with Design Tokens

```typescript
import { generateButtonVariants, tokenButtonToTailwind } from './pipeline/utils/tailwind-mapper';
import type { DesignTokens } from './pipeline/tokens';

// Generate all button variants from design tokens
const buttonVariants = generateButtonVariants(tokens);

// Convert a single button variant
const primaryButton = tokens.buttons.variants[0];
const tailwindClasses = tokenButtonToTailwind(primaryButton);
console.log(tailwindClasses.base); // Complete Tailwind class string
console.log(tailwindClasses.hover); // Hover modifier classes
```

## CTA Template Integration

```typescript
import { styleMapperToTailwind } from './pipeline/utils/tailwind-mapper';
import type { StyleMapping } from './pipeline/cta-template';

// Convert StyleMapping to Tailwind classes
const styleMapping: StyleMapping = {
  primary: '#3b82f6',
  secondary: '#f8fafc',
  background: '#ffffff',
  text: '#1f2937',
  spacing: {
    container: '32px',
    section: '24px',
    element: '12px'
  },
  button: {
    borderRadius: '8px',
    padding: '12px 24px',
    fontSize: '16px',
    fontWeight: '600'
  }
};

const tailwindMapping = styleMapperToTailwind(styleMapping);
// Returns: { colors: {...}, spacing: {...}, button: [...] }
```

## API Reference

### Core Functions

#### `mapColorToTailwind(hex: string): string`
Converts hex colors to closest Tailwind color classes.

#### `mapSpacingToTailwind(px: string | number): string`
Maps pixel values to Tailwind spacing scale.

#### `mapRadiusToTailwind(radius: string): string`
Converts border radius to Tailwind radius classes.

#### `mapFontWeightToTailwind(weight: number | string): string`
Maps font weights to Tailwind weight classes.

#### `mapPaddingToTailwind(padding: string): string[]`
Converts padding shorthand to Tailwind padding classes.

### Button Generation

#### `generateButtonClasses(buttonConfig: ButtonConfig): TailwindClasses`
Creates complete button class sets including hover states.

#### `generateHoverClasses(hoverConfig: HoverConfig): string[]`
Generates hover modifier classes.

#### `generateButtonVariants(tokens: DesignTokens): Record<string, TailwindClasses>`
Creates button variants from design tokens.

### Integration Helpers

#### `styleMapperToTailwind(styleMapping): { colors, spacing, button }`
Converts CTA template StyleMapping to Tailwind classes.

#### `tokenButtonToTailwind(buttonVariant): { base: string, hover: string }`
Quick conversion of design token button variants to Tailwind strings.

### Utility Functions

#### `combineClasses(...classGroups): string`
Combines multiple class groups into a single class string.

#### `generateResponsiveClasses(baseClasses, breakpoints): Record<string, string[]>`
Generates responsive modifier classes.

## Design Philosophy

This mapper follows the project's "simple over scalable" philosophy:

- **Deterministic Results**: Same input always produces same output
- **Faithful Mapping**: Preserves design intent while leveraging Tailwind's systematic approach
- **Integration-First**: Designed specifically for the existing pipeline architecture
- **Quality Focus**: Prioritizes accurate color matching and spacing conversion

## Examples

### Button Variant Generation
```typescript
// From design tokens
const tokens = await extractTokens(runId);
const variants = generateButtonVariants(tokens);

// Apply to component
const primaryClasses = variants['primary-0'].base.join(' ');
const hoverClasses = variants['primary-0'].hover.join(' ');
```

### Color System Integration
```typescript
// Extract semantic colors
const semanticColors = {
  primary: mapColorToTailwind(tokens.colors.semantic.cta),
  text: mapColorToTailwind(tokens.colors.semantic.text),
  background: mapColorToTailwind(tokens.colors.semantic.background)
};
```

### Complete Component Class Generation
```typescript
const componentClasses = generateComponentClasses(tokens);
// Returns: { colors: {...}, spacing: {...}, typography: {...}, buttons: {...} }
```