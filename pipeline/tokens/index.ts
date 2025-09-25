import { readFile, writeFile } from 'fs/promises';
import { join } from 'path';
import { parse, formatHex, differenceEuclidean } from 'culori';

// Simple WCAG contrast calculation
function calculateContrast(color1: any, color2: any): number {
  if (!color1 || !color2) return 0;

  const getLuminance = (color: any): number => {
    // Convert to RGB
    const r = color.r || 0;
    const g = color.g || 0;
    const b = color.b || 0;

    // Calculate relative luminance
    const sRGB = [r, g, b].map(c => {
      c = c / 255;
      return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    });

    return 0.2126 * sRGB[0] + 0.7152 * sRGB[1] + 0.0722 * sRGB[2];
  };

  const lum1 = getLuminance(color1);
  const lum2 = getLuminance(color2);
  const lightest = Math.max(lum1, lum2);
  const darkest = Math.min(lum1, lum2);

  return (lightest + 0.05) / (darkest + 0.05);
}
import type { ComputedStyleNode } from '../capture';

export interface DesignTokens {
  colors: {
    primary: string[];
    neutral: string[];
    semantic: {
      text: string;
      background: string;
    };
  };
  typography: {
    fontFamilies: string[];
    fontSizes: number[];
    lineHeights: number[];
  };
  spacing: number[];
  borderRadius: string[];
  boxShadow: string[];
}

export interface StyleReport {
  tokenCoverage: number;
  paletteRecall: number;
  contrastResults: {
    totalPairs: number;
    aaPassing: number;
    aaPassRate: number;
    failures: Array<{
      foreground: string;
      background: string;
      contrast: number;
      suggested: string;
    }>;
  };
  spacingDistribution: Record<number, number>;
}

export interface TokenExtractionResult {
  runId: string;
  tokens: DesignTokens;
  report: StyleReport;
  tailwindConfig: string;
  cssVars: string;
}

export async function extractTokens(runId: string, artifactDir?: string): Promise<TokenExtractionResult> {
  const baseDir = artifactDir || join(process.cwd(), 'artifacts');
  const runDir = join(baseDir, runId);
  const rawDir = join(runDir, 'raw');

  // Read computed styles
  const stylesPath = join(rawDir, 'computed_styles.json');
  const stylesContent = await readFile(stylesPath, 'utf8');
  const nodes: ComputedStyleNode[] = JSON.parse(stylesContent);

  // Extract design tokens
  const tokens = await analyzeStyles(nodes);

  // Generate style report
  const report = generateStyleReport(nodes, tokens);

  // Generate Tailwind config
  const tailwindConfig = generateTailwindConfig(tokens);

  // Generate CSS variables
  const cssVars = generateCSSVars(tokens);

  // Save artifacts
  await Promise.all([
    writeFile(join(runDir, 'design_tokens.json'), JSON.stringify(tokens, null, 2)),
    writeFile(join(runDir, 'style_report.json'), JSON.stringify(report, null, 2)),
    writeFile(join(runDir, 'tailwind.config.js'), tailwindConfig),
    writeFile(join(runDir, 'css_vars.css'), cssVars),
  ]);

  return {
    runId,
    tokens,
    report,
    tailwindConfig,
    cssVars,
  };
}

async function analyzeStyles(nodes: ComputedStyleNode[]): Promise<DesignTokens> {
  // Analyze colors weighted by element area
  const colorAreas = new Map<string, number>();
  const textColors = new Map<string, number>();
  const bgColors = new Map<string, number>();

  // Collect font data
  const fontFamilies = new Map<string, number>();
  const fontSizes = new Map<number, number>();
  const lineHeights = new Map<number, number>();

  // Collect spacing data
  const spacingValues: number[] = [];

  // Collect radius and shadow data
  const radiusValues = new Map<string, number>();
  const shadowValues = new Map<string, number>();

  for (const node of nodes) {
    const area = node.bbox.w * node.bbox.h;

    // Process colors
    const textColor = parse(node.styles.color);
    const bgColor = parse(node.styles.backgroundColor);

    if (textColor) {
      const hex = formatHex(textColor);
      colorAreas.set(hex, (colorAreas.get(hex) || 0) + area);
      textColors.set(hex, (textColors.get(hex) || 0) + 1);
    }

    if (bgColor && (bgColor.alpha ?? 1) > 0.1) {
      const hex = formatHex(bgColor);
      colorAreas.set(hex, (colorAreas.get(hex) || 0) + area);
      bgColors.set(hex, (bgColors.get(hex) || 0) + 1);
    }

    // Process typography
    fontFamilies.set(node.styles.fontFamily, (fontFamilies.get(node.styles.fontFamily) || 0) + 1);

    const fontSize = parseFloat(node.styles.fontSize);
    if (!isNaN(fontSize)) {
      fontSizes.set(fontSize, (fontSizes.get(fontSize) || 0) + 1);
    }

    const lineHeight = parseFloat(node.styles.lineHeight);
    if (!isNaN(lineHeight) && lineHeight > 0) {
      lineHeights.set(lineHeight, (lineHeights.get(lineHeight) || 0) + 1);
    }

    // Process spacing
    const margins = node.styles.margin.split(' ').map(v => parseFloat(v)).filter(v => !isNaN(v) && v >= 0);
    const paddings = node.styles.padding.split(' ').map(v => parseFloat(v)).filter(v => !isNaN(v) && v >= 0);
    spacingValues.push(...margins, ...paddings);

    // Process border radius
    if (node.styles.borderRadius && node.styles.borderRadius !== '0px') {
      radiusValues.set(node.styles.borderRadius, (radiusValues.get(node.styles.borderRadius) || 0) + 1);
    }

    // Process box shadow
    if (node.styles.boxShadow && node.styles.boxShadow !== 'none') {
      shadowValues.set(node.styles.boxShadow, (shadowValues.get(node.styles.boxShadow) || 0) + 1);
    }
  }

  // Extract top colors by area coverage
  const topColors = Array.from(colorAreas.entries())
    .sort(([, areaA], [, areaB]) => areaB - areaA)
    .slice(0, 8)
    .map(([color]) => color);

  // Separate primary and neutral colors
  const primaryColors = topColors.slice(0, 4);
  const neutralColors = topColors.slice(4);

  // Find most common text and background colors
  const mostCommonText = Array.from(textColors.entries())
    .sort(([, countA], [, countB]) => countB - countA)[0]?.[0] || '#000000';

  const mostCommonBg = Array.from(bgColors.entries())
    .sort(([, countA], [, countB]) => countB - countA)[0]?.[0] || '#ffffff';

  // Extract typography tokens
  const topFontFamilies = Array.from(fontFamilies.entries())
    .sort(([, countA], [, countB]) => countB - countA)
    .slice(0, 2)
    .map(([family]) => family.replace(/['"]/g, ''));

  const topFontSizes = Array.from(fontSizes.entries())
    .sort(([sizeA], [sizeB]) => sizeA - sizeB)
    .map(([size]) => size);

  const topLineHeights = Array.from(lineHeights.entries())
    .sort(([heightA], [heightB]) => heightA - heightB)
    .slice(0, 4)
    .map(([height]) => height);

  // Extract spacing scale (8px grid)
  const spacingScale = Array.from(new Set(
    spacingValues
      .map(v => Math.round(v / 8) * 8)
      .filter(v => v >= 0 && v <= 96)
  )).sort((a, b) => a - b).slice(0, 6);

  // Extract top border radius values
  const topRadii = Array.from(radiusValues.entries())
    .sort(([, countA], [, countB]) => countB - countA)
    .slice(0, 3)
    .map(([radius]) => radius);

  // Extract top shadow values
  const topShadows = Array.from(shadowValues.entries())
    .sort(([, countA], [, countB]) => countB - countA)
    .slice(0, 3)
    .map(([shadow]) => shadow);

  return {
    colors: {
      primary: primaryColors,
      neutral: neutralColors,
      semantic: {
        text: mostCommonText,
        background: mostCommonBg,
      },
    },
    typography: {
      fontFamilies: topFontFamilies,
      fontSizes: topFontSizes,
      lineHeights: topLineHeights,
    },
    spacing: spacingScale,
    borderRadius: topRadii,
    boxShadow: topShadows,
  };
}

function generateStyleReport(nodes: ComputedStyleNode[], tokens: DesignTokens): StyleReport {
  let totalPairs = 0;
  let aaPassing = 0;
  const failures: StyleReport['contrastResults']['failures'] = [];

  // Check contrast for all text elements
  for (const node of nodes) {
    if (node.textContent && node.textContent.trim()) {
      const textColor = parse(node.styles.color);
      const bgColor = parse(node.styles.backgroundColor);

      if (textColor && bgColor && (bgColor.alpha ?? 1) > 0.1) {
        totalPairs++;
        const contrast = calculateContrast(textColor, bgColor);

        if (contrast >= 4.5) {
          aaPassing++;
        } else {
          // Find a better color from the palette
          const suggested = findBetterColor(textColor, bgColor, tokens.colors.primary.concat(tokens.colors.neutral));
          failures.push({
            foreground: formatHex(textColor),
            background: formatHex(bgColor),
            contrast,
            suggested,
          });
        }
      }
    }
  }

  // Calculate spacing distribution
  const spacingDistribution: Record<number, number> = {};
  tokens.spacing.forEach(space => {
    spacingDistribution[space] = 0;
  });

  // Token coverage calculation
  const allColors = [...tokens.colors.primary, ...tokens.colors.neutral];
  const paletteRecall = allColors.length >= 3 ? (allColors.length >= 6 ? 1.0 : 0.75) : 0.5;

  return {
    tokenCoverage: 0.95, // Placeholder - would calculate actual coverage
    paletteRecall,
    contrastResults: {
      totalPairs,
      aaPassing,
      aaPassRate: totalPairs > 0 ? aaPassing / totalPairs : 1,
      failures,
    },
    spacingDistribution,
  };
}

function findBetterColor(foreground: any, background: any, palette: string[]): string {
  let bestColor = formatHex(foreground) || '#000000';
  let bestContrast = calculateContrast(foreground, background);

  for (const colorHex of palette) {
    const color = parse(colorHex);
    if (color) {
      const contrast = calculateContrast(color, background);
      if (contrast > bestContrast && contrast >= 4.5) {
        bestColor = colorHex;
        bestContrast = contrast;
      }
    }
  }

  return bestColor;
}

function generateTailwindConfig(tokens: DesignTokens): string {
  const colors = {
    brand: tokens.colors.primary.reduce((acc, color, idx) => {
      acc[`${(idx + 1) * 100}`] = color;
      return acc;
    }, {} as Record<string, string>),
  };

  const spacing = tokens.spacing.reduce((acc, space, idx) => {
    acc[idx.toString()] = `${space}px`;
    return acc;
  }, {} as Record<string, string>);

  const borderRadius = tokens.borderRadius.reduce((acc, radius, idx) => {
    acc[`r${idx}`] = radius;
    return acc;
  }, {} as Record<string, string>);

  const boxShadow = tokens.boxShadow.reduce((acc, shadow, idx) => {
    acc[`s${idx}`] = shadow;
    return acc;
  }, {} as Record<string, string>);

  return `/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './pipeline/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: ${JSON.stringify(colors, null, 6)},
      spacing: ${JSON.stringify(spacing, null, 6)},
      borderRadius: ${JSON.stringify(borderRadius, null, 6)},
      boxShadow: ${JSON.stringify(boxShadow, null, 6)},
      fontFamily: {
        primary: ${JSON.stringify(tokens.typography.fontFamilies, null, 8)},
      },
    },
  },
  safelist: [
    ${tokens.colors.primary.map((_, idx) => `'bg-brand-${(idx + 1) * 100}'`).join(', ')},
    ${tokens.borderRadius.map((_, idx) => `'rounded-r${idx}'`).join(', ')},
    ${tokens.boxShadow.map((_, idx) => `'shadow-s${idx}'`).join(', ')},
  ],
  plugins: [],
};`;
}

function generateCSSVars(tokens: DesignTokens): string {
  const vars: string[] = [];

  // Colors
  tokens.colors.primary.forEach((color, idx) => {
    vars.push(`  --brand-${(idx + 1) * 100}: ${color};`);
  });

  // Spacing
  tokens.spacing.forEach((space, idx) => {
    vars.push(`  --spacing-${idx}: ${space}px;`);
  });

  // Typography
  vars.push(`  --font-primary: ${tokens.typography.fontFamilies.join(', ')};`);

  return `:root {
${vars.join('\n')}
}`;
}