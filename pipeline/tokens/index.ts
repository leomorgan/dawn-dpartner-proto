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
  // New advanced metrics
  brandPersonality?: BrandPersonality;
  designSystemAnalysis?: DesignSystemAnalysis;
  realTokenMetrics?: RealTokenMetrics;
}

// New interfaces for brand intelligence
export interface BrandPersonality {
  tone: 'professional' | 'playful' | 'elegant' | 'bold' | 'minimal' | 'luxury' | 'friendly';
  energy: 'calm' | 'energetic' | 'sophisticated' | 'dynamic';
  trustLevel: 'conservative' | 'modern' | 'innovative' | 'experimental';
  colorPsychology: {
    dominantMood: string;
    emotionalResponse: string[];
    brandAdjectives: string[];
  };
  spacingPersonality: {
    rhythm: 'tight' | 'comfortable' | 'generous' | 'luxurious';
    consistency: 'rigid' | 'systematic' | 'organic';
  };
  confidence: number;
}

export interface DesignSystemAnalysis {
  maturityLevel: 'basic' | 'developing' | 'mature' | 'sophisticated';
  consistency: {
    colors: number;
    spacing: number;
    typography: number;
    overall: number;
  };
  patternComplexity: 'simple' | 'moderate' | 'complex';
  systematicApproach: boolean;
}

export interface RealTokenMetrics {
  actualCoverage: TokenCoverageAnalysis;
  brandCoherence: BrandCoherenceScore;
  designSystemMaturity: DesignSystemAnalysis;
  colorHarmony: ColorHarmonyAnalysis;
}

export interface TokenCoverageAnalysis {
  colorsCaptured: number;
  totalColorsFound: number;
  coveragePercentage: number;
  missedCriticalColors: string[];
  confidenceScore: number;
}

export interface BrandCoherenceScore {
  colorHarmony: number;
  spacingConsistency: number;
  typographyCoherence: number;
  overallCoherence: number;
  reasoning: string;
}

export interface ColorHarmonyAnalysis {
  paletteType: 'monochromatic' | 'analogous' | 'complementary' | 'triadic' | 'complex';
  harmonyScore: number;
  dominantHue: number;
  saturationRange: { min: number; max: number; avg: number };
  lightnessRange: { min: number; max: number; avg: number };
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

// Real token coverage calculation - replaces hardcoded 0.95
function calculateRealTokenMetrics(nodes: ComputedStyleNode[], tokens: DesignTokens): RealTokenMetrics {
  // Extract all colors actually used in the DOM
  const allColorsUsed = new Set<string>();
  const criticalColors = new Set<string>(); // Colors on important elements

  for (const node of nodes) {
    if (node.styles.color) {
      const color = formatHex(parse(node.styles.color) || '#000000');
      allColorsUsed.add(color);

      // Mark as critical if it's text on visible element with significant area
      if (node.textContent && node.textContent.trim() &&
          node.boundingBox && node.boundingBox.width * node.boundingBox.height > 100) {
        criticalColors.add(color);
      }
    }
    if (node.styles.backgroundColor && node.styles.backgroundColor !== 'rgba(0, 0, 0, 0)') {
      const bgColor = formatHex(parse(node.styles.backgroundColor) || '#ffffff');
      allColorsUsed.add(bgColor);
    }
  }

  // Check how many of the used colors we captured in our tokens
  const extractedColors = new Set([
    ...tokens.colors.primary,
    ...tokens.colors.neutral,
    tokens.colors.semantic.text,
    tokens.colors.semantic.background
  ]);

  let captured = 0;
  const missedCritical: string[] = [];

  for (const color of allColorsUsed) {
    let found = false;
    for (const extractedColor of extractedColors) {
      // Check if colors are similar (within reasonable threshold)
      const distance = differenceEuclidean(color, extractedColor);
      if (distance < 0.1) { // Similar colors
        found = true;
        break;
      }
    }
    if (found) captured++;
    else if (criticalColors.has(color)) {
      missedCritical.push(color);
    }
  }

  const coveragePercentage = allColorsUsed.size > 0 ? (captured / allColorsUsed.size) * 100 : 100;
  const confidenceScore = Math.max(0, coveragePercentage / 100 - (missedCritical.length * 0.1));

  const actualCoverage: TokenCoverageAnalysis = {
    colorsCaptured: captured,
    totalColorsFound: allColorsUsed.size,
    coveragePercentage,
    missedCriticalColors: missedCritical,
    confidenceScore
  };

  const colorHarmony = analyzeColorHarmony(tokens);
  const brandCoherence = calculateBrandCoherence(tokens, nodes);

  return {
    actualCoverage,
    brandCoherence,
    designSystemMaturity: analyzeDesignSystem(tokens, nodes),
    colorHarmony
  };
}

// Brand personality analysis from design tokens
function analyzeBrandPersonality(tokens: DesignTokens, nodes: ComputedStyleNode[]): BrandPersonality {
  // Analyze color psychology
  const primaryColors = tokens.colors.primary.map(c => parse(c)).filter(Boolean);
  const colorPsychology = analyzeColorPsychology(primaryColors);

  // Analyze spacing personality
  const spacingPersonality = analyzeSpacingPersonality(tokens.spacing);

  // Determine overall brand tone
  const tone = determineBrandTone(colorPsychology, spacingPersonality);
  const energy = determineBrandEnergy(colorPsychology, tokens);
  const trustLevel = determineTrustLevel(tokens, nodes);

  return {
    tone,
    energy,
    trustLevel,
    colorPsychology: {
      dominantMood: colorPsychology.dominantMood,
      emotionalResponse: colorPsychology.emotions,
      brandAdjectives: colorPsychology.adjectives
    },
    spacingPersonality,
    confidence: 0.8 // Based on analysis depth
  };
}

function analyzeColorPsychology(colors: any[]) {
  if (!colors.length) return { dominantMood: 'neutral', emotions: ['balanced'], adjectives: ['neutral'] };

  // Analyze hue, saturation, lightness patterns
  let totalHue = 0, totalSat = 0, totalLight = 0;
  const hues: number[] = [];

  for (const color of colors) {
    if (color) {
      // Convert to HSL if not already
      let hslColor = color;
      if (!('h' in color)) {
        const hexColor = formatHex(color);
        hslColor = parse(hexColor);
      }

      if (hslColor && typeof hslColor === 'object' && 'h' in hslColor) {
        const hue = hslColor.h || 0;
        const sat = hslColor.s || 0;
        const light = hslColor.l || 0;

        totalHue += hue;
        totalSat += sat;
        totalLight += light;
        hues.push(hue);
      }
    }
  }

  const avgHue = totalHue / colors.length;
  const avgSat = totalSat / colors.length;
  const avgLight = totalLight / colors.length;

  // Determine mood based on color characteristics
  let dominantMood = 'neutral';
  let emotions: string[] = [];
  let adjectives: string[] = [];

  // Blue range (210-270): professional, trustworthy, calm
  if (avgHue >= 210 && avgHue <= 270) {
    dominantMood = 'professional';
    emotions = ['calm', 'trustworthy', 'stable'];
    adjectives = ['professional', 'reliable', 'corporate'];
  }
  // Red range (0-30, 330-360): energetic, bold, passionate
  else if (avgHue <= 30 || avgHue >= 330) {
    dominantMood = 'energetic';
    emotions = ['exciting', 'passionate', 'urgent'];
    adjectives = ['bold', 'dynamic', 'powerful'];
  }
  // Green range (90-150): natural, growth, harmony
  else if (avgHue >= 90 && avgHue <= 150) {
    dominantMood = 'natural';
    emotions = ['harmonious', 'growing', 'fresh'];
    adjectives = ['sustainable', 'organic', 'balanced'];
  }
  // Purple range (270-330): luxury, creative, sophisticated
  else if (avgHue >= 270 && avgHue <= 330) {
    dominantMood = 'sophisticated';
    emotions = ['luxurious', 'creative', 'mystical'];
    adjectives = ['premium', 'artistic', 'elegant'];
  }

  // Adjust based on saturation and lightness
  if (avgSat > 0.7) {
    adjectives.push('vibrant', 'energetic');
  } else if (avgSat < 0.3) {
    adjectives.push('subtle', 'refined');
  }

  if (avgLight > 0.8) {
    adjectives.push('light', 'airy');
  } else if (avgLight < 0.3) {
    adjectives.push('dramatic', 'bold');
  }

  return { dominantMood, emotions, adjectives };
}

function analyzeSpacingPersonality(spacing: number[]) {
  const avgSpacing = spacing.reduce((a, b) => a + b, 0) / spacing.length;
  const maxSpacing = Math.max(...spacing);

  let rhythm: 'tight' | 'comfortable' | 'generous' | 'luxurious';
  let consistency: 'rigid' | 'systematic' | 'organic';

  // Determine rhythm
  if (avgSpacing < 12) rhythm = 'tight';
  else if (avgSpacing < 24) rhythm = 'comfortable';
  else if (avgSpacing < 48) rhythm = 'generous';
  else rhythm = 'luxurious';

  // Determine consistency - check if values follow systematic pattern
  const spacingSet = new Set(spacing);
  const uniqueValues = spacingSet.size;
  const systematicPattern = spacing.every(s => s % 4 === 0) || spacing.every(s => s % 8 === 0);

  if (uniqueValues <= 4 && systematicPattern) consistency = 'rigid';
  else if (uniqueValues <= 6 && systematicPattern) consistency = 'systematic';
  else consistency = 'organic';

  return { rhythm, consistency };
}

function determineBrandTone(colorPsychology: any, spacingPersonality: any): BrandPersonality['tone'] {
  const { dominantMood } = colorPsychology;
  const { rhythm } = spacingPersonality;

  if (dominantMood === 'professional' && rhythm === 'comfortable') return 'professional';
  if (dominantMood === 'energetic') return 'bold';
  if (dominantMood === 'sophisticated') return 'elegant';
  if (rhythm === 'luxurious') return 'luxury';
  if (rhythm === 'tight') return 'minimal';
  return 'friendly';
}

function determineBrandEnergy(colorPsychology: any, tokens: DesignTokens): BrandPersonality['energy'] {
  const hasVibrantColors = tokens.colors.primary.some(color => {
    const parsed = parse(color);
    if (!parsed) return false;

    // Convert to HSL if needed
    let hslColor = parsed;
    if (!('s' in parsed)) {
      hslColor = parse(formatHex(parsed));
    }

    return hslColor && 's' in hslColor && hslColor.s > 0.6;
  });

  if (colorPsychology.dominantMood === 'sophisticated') return 'sophisticated';
  if (hasVibrantColors || colorPsychology.dominantMood === 'energetic') return 'energetic';
  if (colorPsychology.dominantMood === 'professional') return 'calm';
  return 'dynamic';
}

function determineTrustLevel(tokens: DesignTokens, nodes: ComputedStyleNode[]): BrandPersonality['trustLevel'] {
  // Analyze design conservatism vs innovation
  const hasRoundedCorners = tokens.borderRadius.some(r => parseInt(r) > 8);
  const hasComplexShadows = tokens.boxShadow.length > 2;
  const colorCount = tokens.colors.primary.length + tokens.colors.neutral.length;

  if (colorCount <= 4 && !hasRoundedCorners && !hasComplexShadows) return 'conservative';
  if (colorCount > 8 || hasComplexShadows) return 'innovative';
  if (hasRoundedCorners) return 'modern';
  return 'modern';
}

function analyzeColorHarmony(tokens: DesignTokens): ColorHarmonyAnalysis {
  const allColors = [...tokens.colors.primary, ...tokens.colors.neutral];
  const parsedColors = allColors.map(c => parse(c)).filter(Boolean);

  if (!parsedColors.length) {
    return {
      paletteType: 'monochromatic',
      harmonyScore: 0.5,
      dominantHue: 0,
      saturationRange: { min: 0, max: 0, avg: 0 },
      lightnessRange: { min: 0, max: 0, avg: 0 }
    };
  }

  // Convert to HSL and analyze
  const hslColors = parsedColors.map(color => {
    if (color && 'h' in color) return color;
    const hexColor = formatHex(color);
    const hslColor = parse(hexColor);
    return hslColor && typeof hslColor === 'object' && 'h' in hslColor ? hslColor : null;
  }).filter(Boolean);

  const hues = hslColors.map(c => c.h || 0);
  const saturations = hslColors.map(c => c.s || 0);
  const lightnesses = hslColors.map(c => c.l || 0);

  const dominantHue = hues.reduce((a, b) => a + b, 0) / hues.length;

  // Determine palette type based on hue distribution
  const hueRange = Math.max(...hues) - Math.min(...hues);
  let paletteType: ColorHarmonyAnalysis['paletteType'] = 'monochromatic';

  if (hueRange < 30) paletteType = 'monochromatic';
  else if (hueRange < 60) paletteType = 'analogous';
  else if (hues.length >= 3 && hueRange > 180) paletteType = 'triadic';
  else if (hueRange > 120) paletteType = 'complementary';
  else paletteType = 'complex';

  // Calculate harmony score based on consistency and balance
  const saturationVariance = Math.max(...saturations) - Math.min(...saturations);
  const lightnessVariance = Math.max(...lightnesses) - Math.min(...lightnesses);
  const harmonyScore = Math.max(0, 1 - (saturationVariance + lightnessVariance) / 2);

  return {
    paletteType,
    harmonyScore,
    dominantHue,
    saturationRange: {
      min: Math.min(...saturations),
      max: Math.max(...saturations),
      avg: saturations.reduce((a, b) => a + b, 0) / saturations.length
    },
    lightnessRange: {
      min: Math.min(...lightnesses),
      max: Math.max(...lightnesses),
      avg: lightnesses.reduce((a, b) => a + b, 0) / lightnesses.length
    }
  };
}

function calculateBrandCoherence(tokens: DesignTokens, nodes: ComputedStyleNode[]): BrandCoherenceScore {
  const colorHarmony = analyzeColorHarmony(tokens);
  const spacingConsistency = analyzeSpacingConsistency(tokens.spacing);
  const typographyCoherence = analyzeTypographyCoherence(tokens.typography);

  const overallCoherence = (colorHarmony.harmonyScore + spacingConsistency + typographyCoherence) / 3;

  return {
    colorHarmony: colorHarmony.harmonyScore,
    spacingConsistency,
    typographyCoherence,
    overallCoherence,
    reasoning: `Color harmony: ${colorHarmony.paletteType} (${Math.round(colorHarmony.harmonyScore * 100)}%), spacing consistency: ${Math.round(spacingConsistency * 100)}%, typography coherence: ${Math.round(typographyCoherence * 100)}%`
  };
}

function analyzeSpacingConsistency(spacing: number[]): number {
  if (spacing.length < 2) return 1;

  // Check if spacing follows systematic patterns (4px, 8px grid, etc.)
  const systematicPattern = spacing.every(s => s % 4 === 0) || spacing.every(s => s % 8 === 0);
  const uniqueValues = new Set(spacing).size;

  // Penalize too many unique values or no systematic pattern
  let consistency = 1;
  if (!systematicPattern) consistency -= 0.3;
  if (uniqueValues > 8) consistency -= 0.2;

  return Math.max(0, consistency);
}

function analyzeTypographyCoherence(typography: DesignTokens['typography']): number {
  // Simple heuristic: fewer font families = more coherent
  const fontFamilyCount = typography.fontFamilies.length;
  const fontSizeRange = Math.max(...typography.fontSizes) - Math.min(...typography.fontSizes);

  let coherence = 1;
  if (fontFamilyCount > 3) coherence -= 0.3;
  if (fontSizeRange > 32) coherence -= 0.2; // Very wide range of sizes

  return Math.max(0.3, coherence);
}

function analyzeDesignSystem(tokens: DesignTokens, nodes: ComputedStyleNode[]): DesignSystemAnalysis {
  const colorConsistency = Math.min(1, tokens.colors.primary.length / 8); // Optimal 4-8 colors
  const spacingConsistency = analyzeSpacingConsistency(tokens.spacing);
  const typographyConsistency = analyzeTypographyCoherence(tokens.typography);

  const overallConsistency = (colorConsistency + spacingConsistency + typographyConsistency) / 3;

  // Determine maturity level
  let maturityLevel: DesignSystemAnalysis['maturityLevel'] = 'basic';
  if (overallConsistency > 0.8 && tokens.colors.primary.length >= 4) maturityLevel = 'sophisticated';
  else if (overallConsistency > 0.6) maturityLevel = 'mature';
  else if (overallConsistency > 0.4) maturityLevel = 'developing';

  // Pattern complexity
  const totalTokens = tokens.colors.primary.length + tokens.colors.neutral.length +
                     tokens.spacing.length + tokens.borderRadius.length + tokens.boxShadow.length;
  let patternComplexity: DesignSystemAnalysis['patternComplexity'] = 'simple';
  if (totalTokens > 20) patternComplexity = 'complex';
  else if (totalTokens > 10) patternComplexity = 'moderate';

  return {
    maturityLevel,
    consistency: {
      colors: colorConsistency,
      spacing: spacingConsistency,
      typography: typographyConsistency,
      overall: overallConsistency
    },
    patternComplexity,
    systematicApproach: spacingConsistency > 0.7 && typographyConsistency > 0.6
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

  // Calculate real token coverage
  const realTokenMetrics = calculateRealTokenMetrics(nodes, tokens);
  const brandPersonality = analyzeBrandPersonality(tokens, nodes);
  const designSystemAnalysis = analyzeDesignSystem(tokens, nodes);

  return {
    tokenCoverage: realTokenMetrics.actualCoverage.coveragePercentage / 100,
    paletteRecall,
    contrastResults: {
      totalPairs,
      aaPassing,
      aaPassRate: totalPairs > 0 ? aaPassing / totalPairs : 1,
      failures,
    },
    spacingDistribution,
    brandPersonality,
    designSystemAnalysis,
    realTokenMetrics,
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