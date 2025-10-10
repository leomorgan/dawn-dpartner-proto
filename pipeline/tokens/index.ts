import { readFile, writeFile } from 'fs/promises';
import { join } from 'path';
import { parse, formatHex, differenceEuclidean, converter } from 'culori';
import { OpenAI } from 'openai';

// WCAG 2.1 contrast calculation
function calculateContrast(color1: any, color2: any): number {
  if (!color1 || !color2) return 0;

  const getLuminance = (color: any): number => {
    // culori parse() returns RGB values already normalized to 0-1
    const r = color.r ?? 0;
    const g = color.g ?? 0;
    const b = color.b ?? 0;

    // Calculate relative luminance using WCAG 2.1 formula
    const sRGB = [r, g, b].map(c => {
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
    // === NEW: 4-tier classification ===
    foundation: string[];       // Pure neutrals (chroma < 5)
    tintedNeutrals: string[];   // Subtle tints (chroma 5-20)
    accentColors: string[];     // Muted brand (chroma 20-50)
    brandColors: string[];      // Vibrant brand (chroma > 50)

    // === DEPRECATED (keep for backward compat) ===
    /** @deprecated Use foundation + tintedNeutrals instead */
    primary: string[];
    /** @deprecated Use accentColors + brandColors instead */
    neutral: string[];

    semantic: {
      text: string;
      background: string;
      cta: string;        // Call-to-action color
      accent: string;     // Accent/highlight color
      muted: string;      // Muted/secondary text
    };
    contextual: {
      buttons: string[];   // Colors specifically used for buttons
      links: string[];     // Colors used for links
      backgrounds: string[]; // Background variations
      borders: string[];   // Border colors
    };
  };
  typography: {
    fontFamilies: string[];
    fontSizes: number[];
    fontWeights: number[];   // Font weights found
    lineHeights: number[];
    letterSpacing: string[]; // Letter spacing values
    textTransforms: string[]; // Text transform styles (uppercase, etc.)
  };
  spacing: number[];
  borderRadius: string[];
  boxShadow: string[];
  buttons: {              // Button-specific styles
    variants: Array<{
      type: 'primary' | 'secondary' | 'outline' | 'ghost';
      backgroundColor: string;
      color: string;
      borderColor?: string;
      borderRadius: string;
      padding: string;
      fontSize: number;
      fontWeight: number;
      fontFamily?: string;
      display: string;
      alignItems: string;
      justifyContent: string;
      textAlign: string;
      textContent?: string;  // Button copy for semantic analysis
      count: number;
      prominence: {
        score: number;
        avgSize: number;
        avgPosition: number;
        totalVisibility: number;
      };
      hover?: {
        backgroundColor?: string;
        color?: string;
        opacity?: number;
        transform?: string;
        transition?: string;
      };
    }>;
  };
  interactions: {         // Interactive element styles
    hover: {
      colorShifts: string[]; // Common hover color transformations
      shadowChanges: string[]; // Hover shadow effects
    };
    focus: {
      outlineColors: string[];
      outlineStyles: string[];
    };
  };
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

  // === NEW: Per-tier statistics ===
  tierDistribution: {
    foundation: number;       // Count
    tintedNeutrals: number;
    accentColors: number;
    brandColors: number;
  };

  // === NEW: Tier-specific metrics ===
  brandColorSaturation: number;  // Avg chroma of brand colors (0-1)
  accentColorSaturation: number; // Avg chroma of accent colors (0-1)
  neutralTint: number;           // Avg chroma of tinted neutrals (0-1)

  // === NEW: Color coverage metrics ===
  coverage: ColorCoverageMetrics;
}

export interface ColorCoverageMetrics {
  brandColorCoveragePercent: number;      // % of page area using brand colors
  accentColorCoveragePercent: number;     // % using accent colors
  foundationColorCoveragePercent: number; // % using foundation colors
  totalColorArea: number;                 // Sum of all color areas (can exceed 100%)
  pageArea: number;                       // Viewport width × height
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

  // Read CSS rules
  const cssRulesPath = join(rawDir, 'css_rules.json');
  let cssRules: any[] = [];
  try {
    const cssRulesContent = await readFile(cssRulesPath, 'utf8');
    cssRules = JSON.parse(cssRulesContent);
  } catch (error) {
    console.warn('No CSS rules found or failed to read CSS rules:', error);
  }

  // Read button hover states
  const buttonHoverStatesPath = join(rawDir, 'button_hover_states.json');
  let buttonHoverStates: any[] = [];
  try {
    const buttonHoverStatesContent = await readFile(buttonHoverStatesPath, 'utf8');
    buttonHoverStates = JSON.parse(buttonHoverStatesContent);
  } catch (error) {
    console.warn('No button hover states found or failed to read button hover states:', error);
  }

  // Read metadata to get viewport dimensions
  const metadataPath = join(rawDir, 'meta.json');
  let viewport = { width: 1280, height: 720 }; // fallback
  try {
    const metadataContent = await readFile(metadataPath, 'utf8');
    const metadata = JSON.parse(metadataContent);
    if (metadata.viewport) {
      viewport = metadata.viewport;
    }
  } catch (error) {
    console.warn('No metadata found, using default viewport:', error);
  }

  // Extract design tokens
  const tokens = await analyzeStyles(nodes, cssRules, buttonHoverStates);

  // Generate style report
  const report = await generateStyleReport(nodes, tokens, viewport);

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

async function analyzeStyles(nodes: ComputedStyleNode[], cssRules: any[] = [], buttonHoverStates: any[] = []): Promise<DesignTokens> {
  // Helper: Calculate relative luminance (brightness) from hex color
  const getBrightness = (hexColor: string): number => {
    try {
      const rgb = parseInt(hexColor.slice(1), 16);
      const r = ((rgb >> 16) & 0xff) / 255;
      const g = ((rgb >> 8) & 0xff) / 255;
      const b = ((rgb >> 0) & 0xff) / 255;

      const sRGB = [r, g, b].map(c => {
        return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
      });

      return 0.2126 * sRGB[0] + 0.7152 * sRGB[1] + 0.0722 * sRGB[2];
    } catch {
      return 0.5;
    }
  };

  // Analyze colors weighted by element area
  const colorAreas = new Map<string, number>();
  const textColors = new Map<string, number>();
  const bgColors = new Map<string, number>();

  // New contextual color collections
  const buttonColors = new Map<string, number>();
  const linkColors = new Map<string, number>();
  const backgroundVariations = new Map<string, number>();
  const borderColors = new Map<string, number>();

  // Collect font data (enhanced)
  const fontFamilies = new Map<string, number>();
  const fontSizes = new Map<number, number>();
  const fontWeights = new Map<number, number>();
  const lineHeights = new Map<number, number>();
  const letterSpacings = new Map<string, number>();
  const textTransforms = new Map<string, number>();

  // Collect spacing data
  const spacingValues: number[] = [];

  // Collect radius and shadow data
  const radiusValues = new Map<string, number>();
  const shadowValues = new Map<string, number>();

  // Button analysis - collect all detected buttons with prominence data
  const allButtonVariants: Array<{
    type: 'primary' | 'secondary' | 'outline' | 'ghost';
    backgroundColor: string;
    color: string;
    borderColor?: string;
    borderRadius: string;
    padding: string;
    fontSize: number;
    fontWeight: number;
    fontFamily?: string;
    display: string;
    alignItems: string;
    justifyContent: string;
    textAlign: string;
    textContent?: string;
    area: number;
    yPosition: number;
    hover?: {
      backgroundColor?: string;
      color?: string;
      opacity?: number;
      transform?: string;
      transition?: string;
    };
  }> = [];

  // Interaction states
  const hoverColors = new Set<string>();
  const focusOutlines = new Map<string, number>();

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
      backgroundVariations.set(hex, (backgroundVariations.get(hex) || 0) + 1);
    }

    // Contextual element analysis
    const tagName = node.tag?.toLowerCase();
    const classes = node.className?.toLowerCase() || '';
    const role = node.role || '';

    // Detect buttons and CTAs with stricter criteria - Phase 1.1: Improved Button Detection
    const hasButtonSemantics = tagName === 'button' ||
                               role === 'button' ||
                               classes.includes('btn') ||
                               classes.includes('button') ||
                               classes.includes('cta') ||
                               classes.includes('ctabutton');

    // Phase 1.1: Add area thresholds and content validation for better button detection
    const hasValidArea = area >= 100 && area <= 10000; // Buttons typically 100px² to 10,000px²
    const hasValidAspectRatio = (node.bbox.w / node.bbox.h) <= 10 && (node.bbox.h / node.bbox.w) <= 10; // No extreme ratios
    const hasTextContent = node.textContent && node.textContent.trim().length > 0;

    // Enhanced: Detect links styled as buttons based on visual characteristics
    const isLink = tagName === 'a';
    const hasButtonStyling = isLink && (
      // Has visible background color (not transparent/white)
      (bgColor && (bgColor.alpha ?? 1) > 0.5 &&
       formatHex(bgColor).toLowerCase() !== '#ffffff' &&
       formatHex(bgColor).toLowerCase() !== '#fff') ||
      // Has border that makes it button-like
      (node.styles.border && node.styles.border !== 'none' &&
       node.styles.border !== '0px' &&
       parseFloat(node.styles.borderRadius) > 0) ||
      // Has significant padding (button-like)
      (node.styles.padding && parseFloat(node.styles.padding) >= 8)
    );

    // Combined button detection: semantic buttons OR styled links
    const isButton = hasButtonSemantics || (isLink && hasButtonStyling);

    // Only consider it a button if it meets our validation criteria
    const isValidButton = isButton && hasValidArea && hasValidAspectRatio && hasTextContent;

    // Debug styled links that look like buttons
    if (isLink && hasButtonStyling && node.textContent?.includes('View products')) {
      console.log(`[DEBUG] View products button:`, {
        tag: tagName,
        isButton,
        hasButtonStyling,
        isValidButton,
        hasValidArea,
        hasValidAspectRatio,
        hasTextContent,
        area,
        bgColor: bgColor ? formatHex(bgColor) : 'none',
        bgAlpha: bgColor?.alpha,
        border: node.styles.border,
        borderRadius: node.styles.borderRadius,
        padding: node.styles.padding
      });
    }

    // Debug specific elements we're looking for
    if (classes.includes('ctabutton') || classes.includes('homepagefrontdoor')) {
      console.log(`[DEBUG] Found CTA element: tag=${tagName}, classes="${classes}", isButton=${isButton}, isValidButton=${isValidButton}, area=${area}`);
    }

    if (isValidButton && bgColor) {
      // Only collect colors from non-transparent buttons for semantic color extraction
      if (bgColor.alpha === undefined || bgColor.alpha >= 0.1) {
        const hex = formatHex(bgColor);
        buttonColors.set(hex, (buttonColors.get(hex) || 0) + 1);
      }

      // Analyze button variant (this handles transparency separately)
      const variant = analyzeButtonVariant(node, area);
      if (variant) {
        allButtonVariants.push(variant);
      }
    }

    // Track link colors (excluding links that are styled as buttons)
    if (isLink && !isValidButton && textColor) {
      const hex = formatHex(textColor);
      linkColors.set(hex, (linkColors.get(hex) || 0) + 1);
    }

    // Process enhanced typography
    fontFamilies.set(node.styles.fontFamily, (fontFamilies.get(node.styles.fontFamily) || 0) + 1);

    const fontSize = parseFloat(node.styles.fontSize);
    // FIX: Filter out hidden elements and invalid font sizes
    // Hidden elements often have 0px fonts, which pollutes our token set
    const isVisible = node.bbox.w > 0 && node.bbox.h > 0 && node.styles.display !== 'none';
    const isValidFont = !isNaN(fontSize) && fontSize >= 6; // Min 6px (below this = hidden/micro text)

    if (isVisible && isValidFont) {
      fontSizes.set(fontSize, (fontSizes.get(fontSize) || 0) + 1);
    }

    // Extract actual font weights from captured data
    const fontWeight = parseInt(node.styles.fontWeight) || 400;
    if (!isNaN(fontWeight)) {
      fontWeights.set(fontWeight, (fontWeights.get(fontWeight) || 0) + 1);
    }

    const lineHeight = parseFloat(node.styles.lineHeight);
    if (!isNaN(lineHeight) && lineHeight > 0) {
      lineHeights.set(lineHeight, (lineHeights.get(lineHeight) || 0) + 1);
    }

    // Add common letter spacing and text transform values
    // since they're not captured in current interface
    letterSpacings.set('normal', (letterSpacings.get('normal') || 0) + 1);
    textTransforms.set('none', (textTransforms.get('none') || 0) + 1);

    // Process spacing - FIX: Only include non-zero, valid spacing values
    // Zero spacing is not a meaningful design token - we want actual spacing decisions
    const margins = node.styles.margin.split(' ')
      .map(v => parseFloat(v))
      .filter(v => !isNaN(v) && v > 0 && v <= 500); // Max 500px to catch overflow bugs

    const paddings = node.styles.padding.split(' ')
      .map(v => parseFloat(v))
      .filter(v => !isNaN(v) && v > 0 && v <= 500); // Max 500px to catch overflow bugs

    spacingValues.push(...margins, ...paddings);

    // Process border radius - FIX: Cap extreme values (9999px hack, overflow bugs)
    if (node.styles.borderRadius && node.styles.borderRadius !== '0px') {
      let radiusValue = parseFloat(node.styles.borderRadius);

      // Cap at 100px - anything above is effectively "fully rounded"
      // This catches both the 9999px CSS hack and overflow bugs (33M px)
      if (radiusValue > 100) {
        radiusValue = 100;
      }

      // Only include valid radii >= 0
      if (radiusValue >= 0 && isFinite(radiusValue)) {
        const cappedRadius = `${radiusValue}px`;
        radiusValues.set(cappedRadius, (radiusValues.get(cappedRadius) || 0) + 1);
      }
    }

    // Process box shadow
    if (node.styles.boxShadow && node.styles.boxShadow !== 'none') {
      shadowValues.set(node.styles.boxShadow, (shadowValues.get(node.styles.boxShadow) || 0) + 1);
    }

  }

  // Helper function to analyze button variants
  function findHoverStyles(node: ComputedStyleNode, cssRules: any[], buttonHoverStates: any[]): {
    backgroundColor?: string;
    color?: string;
    opacity?: number;
    transform?: string;
    transition?: string;
  } | undefined {
    if (!node.className) return undefined;

    // First try to match using captured button hover states
    let bestMatch = null;
    let bestScore = 0;

    for (const hoverState of buttonHoverStates) {
      // Match by class name similarity
      if (node.className && hoverState.className) {
        const nodeClasses = node.className.trim().split(/\s+/);
        const stateClasses = hoverState.className.trim().split(/\s+/);

        // Check if they share any classes
        const sharedClasses = nodeClasses.filter(cls => stateClasses.includes(cls));


        if (sharedClasses.length > 0) {
          // Calculate match score (prefer background color changes and more shared classes)
          let score = sharedClasses.length;
          const hasBackgroundChange = hoverState.hoverStyles.backgroundColor !== hoverState.normalStyles.backgroundColor;

          if (hasBackgroundChange) {
            // Bonus points for background color changes (more visually significant)
            score += 10;
          }

          // Extra bonus for exact class match (all classes match)
          if (sharedClasses.length === nodeClasses.length && sharedClasses.length === stateClasses.length) {
            score += 20;
          }

          if (score > bestScore) {
            bestScore = score;
            bestMatch = hoverState;
          }
        }
      }
    }

    // Use the best match if found
    if (bestMatch) {
      const hoverStyle: any = {};

      // Compare normal vs hover styles to extract differences
      if (bestMatch.hoverStyles.backgroundColor !== bestMatch.normalStyles.backgroundColor) {
        // Convert RGB to hex
        try {
          const bgColor = parse(bestMatch.hoverStyles.backgroundColor);
          hoverStyle.backgroundColor = bgColor ? formatHex(bgColor) : bestMatch.hoverStyles.backgroundColor;
        } catch {
          hoverStyle.backgroundColor = bestMatch.hoverStyles.backgroundColor;
        }
      }
      if (bestMatch.hoverStyles.color !== bestMatch.normalStyles.color) {
        // Convert RGB to hex
        try {
          const textColor = parse(bestMatch.hoverStyles.color);
          hoverStyle.color = textColor ? formatHex(textColor) : bestMatch.hoverStyles.color;
        } catch {
          hoverStyle.color = bestMatch.hoverStyles.color;
        }
      }
      if (bestMatch.hoverStyles.opacity !== bestMatch.normalStyles.opacity) {
        hoverStyle.opacity = parseFloat(bestMatch.hoverStyles.opacity);
      }
      if (bestMatch.hoverStyles.transform !== bestMatch.normalStyles.transform) {
        hoverStyle.transform = bestMatch.hoverStyles.transform;
      }
      if (bestMatch.hoverStyles.boxShadow !== bestMatch.normalStyles.boxShadow) {
        hoverStyle.boxShadow = bestMatch.hoverStyles.boxShadow;
      }

      if (Object.keys(hoverStyle).length > 0) {
        return hoverStyle;
      }
    }

    // Fallback to CSS rules matching (original implementation)
    const classList = node.className.split(/\s+/);

    for (const rule of cssRules) {
      // Try to match the hover rule to this element
      let matches = false;

      // Simple class-based matching
      for (const className of classList) {
        if (rule.selector.includes(`.${className}:hover`)) {
          matches = true;
          break;
        }
      }

      // Tag-based matching
      if (!matches && rule.selector.includes(`${node.tag}:hover`)) {
        matches = true;
      }

      if (matches) {
        const hoverStyle: any = {};

        if (rule.styles['background-color']) {
          hoverStyle.backgroundColor = rule.styles['background-color'];
        }
        if (rule.styles['color']) {
          hoverStyle.color = rule.styles['color'];
        }
        if (rule.styles['opacity']) {
          hoverStyle.opacity = parseFloat(rule.styles['opacity']);
        }
        if (rule.styles['transform']) {
          hoverStyle.transform = rule.styles['transform'];
        }
        if (rule.styles['transition'] || rule.styles['transition-property']) {
          hoverStyle.transition = rule.styles['transition'] || rule.styles['transition-property'];
        }

        return Object.keys(hoverStyle).length > 0 ? hoverStyle : undefined;
      }
    }

    return undefined;
  }

  // Phase 1.2: Fix Zero Padding Issue - Add fallback logic for padding calculations
  function fixZeroPadding(padding: string, node: ComputedStyleNode): string {
    const parts = padding.trim().split(/\s+/);

    // Check if any padding value is 0 (partial or complete zero padding)
    const hasZeroPadding = parts.some(part => {
      const value = parseFloat(part);
      return value === 0 || part === '0px' || part === '0';
    });

    if (hasZeroPadding) {
      // Calculate padding from button dimensions and text content
      const buttonWidth = node.bbox.w;
      const buttonHeight = node.bbox.h;

      // Estimate padding based on button size
      const verticalPadding = Math.max(12, Math.round(buttonHeight * 0.15));
      const horizontalPadding = Math.max(24, Math.round(buttonWidth * 0.1));

      // Ensure reasonable bounds
      const finalVertical = Math.min(verticalPadding, 32);
      const finalHorizontal = Math.min(horizontalPadding, 48);

      return `${finalVertical}px ${finalHorizontal}px`;
    }

    return padding;
  }

  function analyzeButtonVariant(node: ComputedStyleNode, area: number): {
    type: 'primary' | 'secondary' | 'outline' | 'ghost';
    backgroundColor: string;
    color: string;
    borderColor?: string;
    borderRadius: string;
    padding: string;
    fontSize: number;
    fontWeight: number;
    fontFamily?: string;
    display: string;
    alignItems: string;
    justifyContent: string;
    textAlign: string;
    textContent?: string;
    area: number;
    yPosition: number;
    hover?: {
      backgroundColor?: string;
      color?: string;
      opacity?: number;
      transform?: string;
      transition?: string;
    };
  } | null {
    const bgColor = parse(node.styles.backgroundColor);
    const textColor = parse(node.styles.color);

    if (!bgColor || !textColor) return null;

    const bgHex = formatHex(bgColor);
    const textHex = formatHex(textColor);

    // Skip buttons with invalid colors
    if (!bgHex || !textHex) {
      return null;
    }

    // Phase 1.2: Fix Zero Padding Issue - Add fallback logic for padding calculations
    const extractedPadding = node.styles.padding || '8px 16px';
    const validPadding = fixZeroPadding(extractedPadding, node);

    // Extract border information from the border string (e.g., "1px solid rgb(38, 38, 38)")
    const parseBorder = (borderStr: string): { width: string; style: string; color: string | null } => {
      const parts = borderStr.trim().split(/\s+/);
      if (parts.length < 2) return { width: '0px', style: 'none', color: null };

      const width = parts[0];
      const style = parts[1];

      // Extract color - it might be rgb(), rgba(), or hex
      const colorMatch = borderStr.match(/rgb\([^)]+\)|rgba\([^)]+\)|#[0-9a-f]{3,8}/i);
      let borderColor: string | null = null;

      if (colorMatch) {
        const parsedColor = parse(colorMatch[0]);
        if (parsedColor) {
          // If alpha is undefined, treat as 1.0 (fully opaque)
          const alpha = parsedColor.alpha ?? 1.0;
          if (alpha > 0.1) {
            borderColor = formatHex(parsedColor);
          }
        }
      }

      return { width, style, color: borderColor };
    };

    const border = parseBorder(node.styles.border || '0px none');

    // Handle transparent backgrounds properly
    if (bgColor.alpha !== undefined && bgColor.alpha < 0.1) {
      // IMPORTANT: Transparent elements are ONLY buttons if they have a visible border
      // Links and text elements without borders should NOT be classified as buttons
      if (!border.color) {
        return null; // Not a button - just a transparent link/text element
      }

      // For transparent buttons, use a special identifier
      const finalBgHex = '#transparent';
      const hoverStyles = findHoverStyles(node, cssRules, buttonHoverStates);

      return {
        type: 'ghost', // Transparent buttons are usually ghost/outline style
        backgroundColor: finalBgHex,
        color: textHex,
        borderColor: border.color || undefined,
        borderRadius: node.styles.borderRadius || '4px',
        padding: validPadding,
        fontSize: parseFloat(node.styles.fontSize) || 16,
        fontWeight: parseInt(node.styles.fontWeight) || 400,
        fontFamily: node.styles.fontFamily,
        display: node.styles.display || 'inline-block',
        alignItems: node.styles.alignItems || 'center',
        justifyContent: node.styles.justifyContent || 'center',
        textAlign: node.styles.textAlign || 'center',
        textContent: node.textContent?.trim() || undefined,
        area,
        yPosition: node.bbox.y,
        hover: hoverStyles
      };
    }

    // Determine button type based on visual semantics
    // For now, use simple classification - will be overridden by LLM analysis later
    const transparentCheck = bgColor.alpha === 0;

    // Simple heuristic: defer to post-processing for semantic analysis
    // Mark all solid buttons as 'primary' initially, LLM will reclassify based on copy + prominence
    const type: 'primary' | 'secondary' | 'outline' | 'ghost' = 'primary';

    const fontSize = parseFloat(node.styles.fontSize) || 16;
    const fontWeight = parseInt(node.styles.fontWeight) || 400;

    // Detect hover styles
    const hoverStyles = findHoverStyles(node, cssRules, buttonHoverStates);

    return {
      type,
      backgroundColor: bgHex,
      color: textHex,
      borderColor: border.color || undefined,
      borderRadius: node.styles.borderRadius || '4px',
      padding: validPadding,
      fontSize,
      fontWeight,
      fontFamily: node.styles.fontFamily,
      display: node.styles.display || 'inline-block',
      alignItems: node.styles.alignItems || 'center',
      justifyContent: node.styles.justifyContent || 'center',
      textAlign: node.styles.textAlign || 'center',
      textContent: node.textContent?.trim() || undefined,
      area,
      yPosition: node.bbox.y,
      hover: hoverStyles
    };
  }

  // Extract top colors by area coverage
  const topColors = Array.from(colorAreas.entries())
    .sort(([, areaA], [, areaB]) => areaB - areaA)
    .slice(0, 12)
    .map(([color]) => color);

  const top10 = Array.from(colorAreas.entries())
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10);

  console.log('🎨 Top 10 colors by area:');
  top10.forEach(([c, area], i) => console.log(`  ${i + 1}. ${c}: ${area}`));

  // === NEW: 4-tier color classification ===
  const toLch = converter('lch');
  const foundation: string[] = [];
  const tintedNeutrals: string[] = [];
  const accentColors: string[] = [];
  const brandColors: string[] = [];

  console.log('🎨 Classifying colors into 4 tiers...');

  for (const colorHex of topColors) {
    const parsed = parse(colorHex);
    if (!parsed) continue;

    const lch = toLch(parsed);
    const chroma = (lch as any).c ?? 0;
    const lightness = (lch as any).l ?? 0;

    // Foundation: Pure blacks, whites, grays (very low chroma OR extreme lightness)
    if (chroma < 5 || lightness < 5 || lightness > 95) {
      foundation.push(colorHex);
      console.log(`  ${colorHex} → Foundation (chroma=${chroma.toFixed(1)}, L=${lightness.toFixed(1)})`);
    }
    // Brand colors: Vibrant, high saturation (chroma > 50)
    else if (chroma > 50) {
      brandColors.push(colorHex);
      console.log(`  ${colorHex} → Brand (chroma=${chroma.toFixed(1)})`);
    }
    // Accent colors: Muted brand identity (chroma 20-50)
    else if (chroma > 20) {
      accentColors.push(colorHex);
      console.log(`  ${colorHex} → Accent (chroma=${chroma.toFixed(1)})`);
    }
    // Tinted neutrals: Subtle background tints (chroma 5-20)
    else {
      tintedNeutrals.push(colorHex);
      console.log(`  ${colorHex} → Tinted Neutral (chroma=${chroma.toFixed(1)})`);
    }
  }

  // Adaptive limits (no hard caps on neutrals!)
  foundation.splice(8);        // Max 8 pure neutrals
  tintedNeutrals.splice(6);    // Max 6 tinted neutrals
  accentColors.splice(6);      // Max 6 accent colors
  brandColors.splice(4);       // Max 4 brand colors

  console.log(`🎨 Color tier distribution: Foundation=${foundation.length}, Tinted=${tintedNeutrals.length}, Accent=${accentColors.length}, Brand=${brandColors.length}`);

  // === Backward compatibility: derive primary/neutral ===
  const primaryColors = [...accentColors, ...brandColors];
  const neutralColors = [...foundation, ...tintedNeutrals];

  // Ensure minimum counts for backward compat
  if (neutralColors.length === 0 && primaryColors.length > 0) {
    neutralColors.push(primaryColors.pop()!);
  }
  if (primaryColors.length === 0 && neutralColors.length > 0) {
    primaryColors.push(neutralColors.pop()!);
  }

  console.log(`🎨 Legacy compatibility: Primary=${primaryColors.length}, Neutral=${neutralColors.length}`);

  // Helper function to generate smart fallback colors
  // Find most common text and background colors from captured data
  const mostCommonText = Array.from(textColors.entries())
    .sort(([, countA], [, countB]) => countB - countA)[0]?.[0];

  // For background, prioritize <body> tag, then find largest SINGLE element's background
  // This represents the actual page background as rendered by the browser

  // First, check if <body> has a background color
  const bodyNode = nodes.find(node => node.tag?.toLowerCase() === 'body');
  let bodyBgColor: string | null = null;

  if (bodyNode) {
    const bgColor = parse(bodyNode.styles.backgroundColor);
    if (bgColor && (bgColor.alpha === undefined || bgColor.alpha >= 0.5)) {
      const hex = formatHex(bgColor);
      // Allow body background even if it's white-ish (it's the document background)
      if (hex.toLowerCase() !== '#ffffff' && hex.toLowerCase() !== '#fff') {
        bodyBgColor = hex;
        console.log(`🎨 Using <body> background: ${bodyBgColor}`);
      }
    }
  }

  // If body doesn't have a usable background, find largest element
  const largestElementBgs = nodes
    .filter(node => {
      const bgColor = parse(node.styles.backgroundColor);
      if (!bgColor || (bgColor.alpha !== undefined && bgColor.alpha < 0.5)) return false;

      const hex = formatHex(bgColor).toLowerCase();
      // Only exclude pure white (#ffffff), allow off-whites
      if (hex === '#ffffff' || hex === '#fff') return false;

      return true;
    })
    .map(node => ({
      color: formatHex(parse(node.styles.backgroundColor)!),
      area: node.bbox.w * node.bbox.h,
      tag: node.tag
    }))
    .sort((a, b) => b.area - a.area);

  if (!bodyBgColor) {
    console.log('🎨 Top 5 largest element backgrounds:');
    largestElementBgs.slice(0, 5).forEach((bg, i) =>
      console.log(`  ${i + 1}. ${bg.color} (${bg.tag}): ${bg.area}`)
    );
  }

  const mostCommonBg = bodyBgColor || largestElementBgs[0]?.color;

  // Extract typography tokens
  const topFontFamilies = Array.from(fontFamilies.entries())
    .sort(([, countA], [, countB]) => countB - countA)
    .slice(0, 2)
    .map(([family]) => family.replace(/['"]/g, ''));

  const topFontSizes = Array.from(fontSizes.entries())
    .sort(([sizeA], [sizeB]) => sizeA - sizeB)
    .map(([size]) => size);

  const topFontWeights = Array.from(fontWeights.entries())
    .sort(([, countA], [, countB]) => countB - countA)
    .slice(0, 4)
    .map(([weight]) => weight);

  const topLineHeights = Array.from(lineHeights.entries())
    .sort(([heightA], [heightB]) => heightA - heightB)
    .slice(0, 4)
    .map(([height]) => height);

  const topLetterSpacings = Array.from(letterSpacings.entries())
    .sort(([, countA], [, countB]) => countB - countA)
    .slice(0, 3)
    .map(([spacing]) => spacing);

  const topTextTransforms = Array.from(textTransforms.entries())
    .sort(([, countA], [, countB]) => countB - countA)
    .slice(0, 3)
    .map(([transform]) => transform);

  // Extract contextual colors
  const topButtonColors = Array.from(buttonColors.entries())
    .sort(([, countA], [, countB]) => countB - countA)
    .slice(0, 3)
    .map(([color]) => color);

  const topLinkColors = Array.from(linkColors.entries())
    .sort(([, countA], [, countB]) => countB - countA)
    .slice(0, 3)
    .map(([color]) => color);

  const topBackgroundVariations = Array.from(backgroundVariations.entries())
    .sort(([, countA], [, countB]) => countB - countA)
    .slice(0, 4)
    .map(([color]) => color);

  const topBorderColors = Array.from(borderColors.entries())
    .sort(([, countA], [, countB]) => countB - countA)
    .slice(0, 3)
    .map(([color]) => color);

  // Use captured colors directly without fallbacks

  // Identify semantic colors - no hardcoded values
  const validCtaColors = topButtonColors.filter(color => color && color !== mostCommonText && color !== mostCommonBg && color !== 'rgba(0, 0, 0, 0)');
  const ctaColor = validCtaColors[0] || primaryColors[0];
  const accentColor = primaryColors.find(c => c !== mostCommonText && c !== mostCommonBg) || primaryColors[1];
  const mutedColor = neutralColors[0];

  // Extract focus styles
  const topFocusOutlines = Array.from(focusOutlines.entries())
    .sort(([, countA], [, countB]) => countB - countA)
    .slice(0, 2)
    .map(([color]) => color);

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

  // Deduplicate button variants and add counts with prominence scoring
  const buttonVariantMap = new Map<string, any>();

  for (const variant of allButtonVariants) {
    // Create a unique key based on all styling properties
    const key = `${variant.type}-${variant.backgroundColor}-${variant.color}-${variant.borderRadius}-${variant.padding}-${variant.fontSize}-${variant.fontWeight}-${variant.fontFamily || 'default'}-${variant.display}-${variant.alignItems}-${variant.justifyContent}-${variant.textAlign}`;

    if (buttonVariantMap.has(key)) {
      // Update existing variant with new data
      const existing = buttonVariantMap.get(key);
      existing.count++;
      existing.areas.push(variant.area);
      existing.yPositions.push(variant.yPosition);
      // Collect hover styles
      if (variant.hover) {
        if (!existing.hoverStyles) existing.hoverStyles = [];
        existing.hoverStyles.push(variant.hover);
      }
    } else {
      // Add new variant with initial data
      buttonVariantMap.set(key, {
        ...variant,
        count: 1,
        areas: [variant.area],
        yPositions: [variant.yPosition],
        hoverStyles: variant.hover ? [variant.hover] : []
      });
    }
  }

  // Calculate prominence scores and clean up temporary data
  const buttonVariants = Array.from(buttonVariantMap.values()).map(variant => {
    const avgSize = variant.areas.reduce((a: number, b: number) => a + b, 0) / variant.areas.length;
    const avgPosition = variant.yPositions.reduce((a: number, b: number) => a + b, 0) / variant.yPositions.length;
    const totalVisibility = variant.areas.reduce((a: number, b: number) => a + b, 0);

    // Calculate prominence score (higher = more prominent)
    // Factors: larger size, higher on page (lower Y), more instances, total visibility
    const sizeScore = Math.min(avgSize / 1000, 10); // Normalize size (max 10 points)
    const positionScore = Math.max(0, 10 - (avgPosition / 1000)); // Higher on page = higher score
    const countScore = Math.min(variant.count * 2, 10); // More instances = higher score (max 10)
    const visibilityScore = Math.min(totalVisibility / 5000, 10); // Total area visibility

    const prominenceScore = sizeScore + positionScore + countScore + visibilityScore;

    // Select the best hover style from collected hover styles
    let finalHoverStyle = undefined;
    if (variant.hoverStyles && variant.hoverStyles.length > 0) {
      // If we have multiple hover styles, prefer the one with background color change over opacity change
      const backgroundHover = variant.hoverStyles.find((h: any) => h.backgroundColor);
      const opacityHover = variant.hoverStyles.find((h: any) => h.opacity);

      // Prefer background color changes as they're more visually distinct
      finalHoverStyle = backgroundHover || opacityHover || variant.hoverStyles[0];
    }

    // Clean up temporary arrays and add prominence data
    const { areas, yPositions, hoverStyles, ...cleanVariant } = variant;
    return {
      ...cleanVariant,
      hover: finalHoverStyle,
      prominence: {
        score: Math.round(prominenceScore * 10) / 10, // Round to 1 decimal
        avgSize: Math.round(avgSize),
        avgPosition: Math.round(avgPosition),
        totalVisibility: Math.round(totalVisibility)
      }
    };
  }).sort((a, b) => {
    // Ghost buttons go to the end regardless of count
    if (a.type === 'ghost' && b.type !== 'ghost') return 1;
    if (b.type === 'ghost' && a.type !== 'ghost') return -1;

    // For non-ghost buttons, sort by count (highest first)
    return b.count - a.count;
  });

  // LLM-based semantic classification of buttons (async, will update types)
  // TODO: Implement LLM button classifier that analyzes:
  // - Button text content (from nodes)
  // - Visual hierarchy (prominence, size, position)
  // - Context (surrounding elements, page section)
  // For now, keep simple type assignment

  return {
    colors: {
      // === NEW: 4-tier system ===
      foundation,
      tintedNeutrals,
      accentColors,
      brandColors,

      // === BACKWARD COMPAT ===
      primary: primaryColors,
      neutral: neutralColors,

      semantic: {
        text: mostCommonText,
        background: mostCommonBg,
        cta: ctaColor,
        accent: accentColor,
        muted: mutedColor,
      },
      contextual: {
        buttons: topButtonColors,
        links: topLinkColors,
        backgrounds: topBackgroundVariations,
        borders: topBorderColors,
      },
    },
    typography: {
      fontFamilies: topFontFamilies,
      fontSizes: topFontSizes,
      fontWeights: topFontWeights,
      lineHeights: topLineHeights,
      letterSpacing: topLetterSpacings,
      textTransforms: topTextTransforms,
    },
    spacing: spacingScale,
    borderRadius: topRadii,
    boxShadow: topShadows,
    buttons: {
      variants: buttonVariants,
    },
    interactions: {
      hover: {
        colorShifts: [], // TODO: Implement hover color detection
        shadowChanges: [], // TODO: Implement hover shadow detection
      },
      focus: {
        outlineColors: topFocusOutlines,
        outlineStyles: ['2px solid'], // Common default
      },
    },
  };
}

// Real token coverage calculation - replaces hardcoded 0.95
async function calculateRealTokenMetrics(
  nodes: ComputedStyleNode[],
  tokens: DesignTokens,
  colorAreas: Map<string, number>,
  viewport: { width: number; height: number }
): Promise<RealTokenMetrics> {
  // Extract all colors actually used in the DOM
  const allColorsUsed = new Set<string>();
  const criticalColors = new Set<string>(); // Colors on important elements

  for (const node of nodes) {
    if (node.styles.color) {
      const parsedColor = parse(node.styles.color);
      if (parsedColor) {
        const color = formatHex(parsedColor);
        if (color) {
          allColorsUsed.add(color);

          // Mark as critical if it's text on visible element with significant area
          if (node.textContent && node.textContent.trim() &&
              node.bbox && node.bbox.w * node.bbox.h > 100) {
            criticalColors.add(color);
          }
        }
      }
    }
    if (node.styles.backgroundColor && node.styles.backgroundColor !== 'rgba(0, 0, 0, 0)') {
      const parsedBgColor = parse(node.styles.backgroundColor);
      if (parsedBgColor) {
        const bgColor = formatHex(parsedBgColor);
        if (bgColor) {
          allColorsUsed.add(bgColor);
        }
      }
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

  for (const color of Array.from(allColorsUsed)) {
    let found = false;
    for (const extractedColor of Array.from(extractedColors)) {
      // Check if colors are similar (within reasonable threshold)
      const parsedColor1 = parse(color);
      const parsedColor2 = parse(extractedColor);
      if (parsedColor1 && parsedColor2) {
        const distance = differenceEuclidean()(parsedColor1, parsedColor2);
        if (distance < 0.1) { // Similar colors
          found = true;
          break;
        }
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

  const colorHarmony = analyzeColorHarmony(tokens, colorAreas, nodes);
  const brandCoherence = calculateBrandCoherence(tokens, nodes, colorAreas, viewport);

  return {
    actualCoverage,
    brandCoherence,
    designSystemMaturity: analyzeDesignSystem(tokens, nodes),
    colorHarmony
  };
}

/**
 * Use LLM to analyze brand personality from design tokens
 */
async function analyzeBrandPersonalityWithLLM(tokens: DesignTokens): Promise<BrandPersonality | null> {
  if (!process.env.OPENAI_API_KEY) {
    return null; // Fall back to heuristics
  }

  try {
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    // Prepare design token data for LLM analysis
    const colorSummary = {
      primary: tokens.colors.primary.slice(0, 5),
      neutral: tokens.colors.neutral.slice(0, 3),
      cta: tokens.colors.semantic?.cta,
      accent: tokens.colors.semantic?.accent
    };

    const typographySummary = {
      families: tokens.typography.fontFamilies.slice(0, 3),
      sizes: tokens.typography.fontSizes.slice(0, 6),
      weights: tokens.typography.fontWeights.slice(0, 4)
    };

    const spacingSummary = {
      values: tokens.spacing.slice(0, 8),
      average: tokens.spacing.reduce((a, b) => a + b, 0) / tokens.spacing.length,
      max: Math.max(...tokens.spacing)
    };

    const borderRadiusSummary = tokens.borderRadius.slice(0, 4);
    const shadowSummary = tokens.boxShadow.slice(0, 3);

    const prompt = `You are a brand personality expert analyzing design tokens from a website.

**Design Tokens:**

COLORS:
- Primary colors: ${colorSummary.primary.join(', ')}
- Neutral colors: ${colorSummary.neutral.join(', ')}
- CTA color: ${colorSummary.cta || 'N/A'}
- Accent color: ${colorSummary.accent || 'N/A'}

TYPOGRAPHY:
- Font families: ${typographySummary.families.join(', ')}
- Font sizes: ${typographySummary.sizes.join('px, ')}px
- Font weights: ${typographySummary.weights.join(', ')}

SPACING:
- Spacing values: ${spacingSummary.values.join('px, ')}px
- Average spacing: ${spacingSummary.average.toFixed(1)}px
- Max spacing: ${spacingSummary.max}px

VISUAL STYLE:
- Border radius: ${borderRadiusSummary.join(', ')}
- Box shadows: ${shadowSummary.length > 0 ? shadowSummary.join('; ') : 'None'}

**Your task:** Analyze these design tokens to determine the brand personality.

Consider:
1. Color psychology (hue, saturation, lightness)
2. Typography personality (serif vs sans-serif, weights, sizes)
3. Spacing rhythm (tight, comfortable, generous, luxurious)
4. Visual style (sharp vs rounded, shadows vs flat)

**IMPORTANT:**
- Be specific and diverse in your analysis - different brands should get different personalities
- Consider the COMBINATION of all design elements, not just one aspect
- Use the actual token values to inform your classification
- Provide a confidence score based on how distinct the design signals are

Return JSON with EXACTLY this structure:
{
  "tone": "professional" | "playful" | "elegant" | "bold" | "minimal" | "luxury" | "friendly",
  "energy": "calm" | "energetic" | "sophisticated" | "dynamic",
  "trustLevel": "conservative" | "modern" | "innovative" | "experimental",
  "colorPsychology": {
    "dominantMood": "string describing the overall mood",
    "emotionalResponse": ["emotion1", "emotion2", "emotion3"],
    "brandAdjectives": ["adjective1", "adjective2", "adjective3"]
  },
  "spacingPersonality": {
    "rhythm": "tight" | "comfortable" | "generous" | "luxurious",
    "consistency": "rigid" | "systematic" | "organic"
  },
  "confidence": 0.0-1.0
}`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'You are a design systems expert specializing in brand personality analysis. Provide accurate, diverse classifications based on design token patterns.' },
        { role: 'user', content: prompt }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.3, // Low temperature for consistent but diverse results
    });

    const content = response.choices[0].message.content;
    if (!content) {
      console.warn('No content from LLM brand personality analysis');
      return null;
    }

    const result = JSON.parse(content) as BrandPersonality;

    // Validate the result
    const validTones = ['professional', 'playful', 'elegant', 'bold', 'minimal', 'luxury', 'friendly'];
    const validEnergies = ['calm', 'energetic', 'sophisticated', 'dynamic'];
    const validTrustLevels = ['conservative', 'modern', 'innovative', 'experimental'];
    const validRhythms = ['tight', 'comfortable', 'generous', 'luxurious'];
    const validConsistencies = ['rigid', 'systematic', 'organic'];

    if (!validTones.includes(result.tone) ||
        !validEnergies.includes(result.energy) ||
        !validTrustLevels.includes(result.trustLevel) ||
        !validRhythms.includes(result.spacingPersonality?.rhythm) ||
        !validConsistencies.includes(result.spacingPersonality?.consistency)) {
      console.warn('Invalid brand personality result from LLM');
      return null;
    }

    // Ensure confidence is between 0 and 1
    result.confidence = Math.max(0, Math.min(1, result.confidence || 0.7));

    console.log('LLM brand personality analysis successful:', {
      tone: result.tone,
      energy: result.energy,
      trustLevel: result.trustLevel,
      confidence: result.confidence
    });

    return result;
  } catch (error) {
    console.warn('Error in LLM brand personality analysis, falling back to heuristics:', error);
    return null;
  }
}

// Brand personality analysis from design tokens
async function analyzeBrandPersonality(tokens: DesignTokens, nodes: ComputedStyleNode[]): Promise<BrandPersonality> {
  // Try LLM-based analysis first
  const llmResult = await analyzeBrandPersonalityWithLLM(tokens);
  if (llmResult) {
    return llmResult;
  }

  // Fall back to heuristic-based analysis
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
    confidence: calculateConfidence(tokens, colorPsychology)
  };
}

// V3 FIX: Calculate dynamic confidence based on feature distinctiveness
function calculateConfidence(tokens: DesignTokens, colorPsych: any): number {
  let distinctiveness = 0.5; // Start at 50%

  // 1. Color palette distinctiveness (+0-0.2)
  const colorCount = (tokens.colors?.foundation?.length || 0) + (tokens.colors?.accentColors?.length || 0);
  if (colorCount < 5) distinctiveness += 0.1; // Very minimal = distinct
  else if (colorCount > 15) distinctiveness += 0.15; // Very colorful = distinct
  else if (colorCount > 10) distinctiveness += 0.05; // Somewhat colorful

  // 2. Border radius distinctiveness (+0-0.15)
  const avgRadius = tokens.borderRadius.length > 0
    ? tokens.borderRadius.reduce((sum, r) => sum + parseFloat(r), 0) / tokens.borderRadius.length
    : 0;
  if (avgRadius < 2) distinctiveness += 0.15; // Very sharp = distinct
  else if (avgRadius > 20) distinctiveness += 0.15; // Very rounded = distinct
  else if (avgRadius > 12) distinctiveness += 0.05; // Somewhat rounded

  // 3. Shadow usage distinctiveness (+0-0.1)
  if (tokens.boxShadow.length === 0) distinctiveness += 0.1; // Flat = distinct
  else if (tokens.boxShadow.length > 4) distinctiveness += 0.1; // Very shadowy = distinct

  // 4. Typography distinctiveness (+0-0.15)
  if (tokens.typography.fontFamilies.length === 1) distinctiveness += 0.05; // Minimal = somewhat distinct
  else if (tokens.typography.fontFamilies.length > 2) distinctiveness += 0.15; // Multi-font = very distinct

  // 5. Spacing distinctiveness (+0-0.1)
  const spacingMedian = tokens.spacing.length > 0
    ? tokens.spacing[Math.floor(tokens.spacing.length / 2)]
    : 0;
  if (spacingMedian < 8) distinctiveness += 0.05; // Tight spacing
  else if (spacingMedian > 40) distinctiveness += 0.1; // Generous spacing = more distinct

  // Clamp to 0-1 range
  return Math.max(0, Math.min(1, distinctiveness));
}

function analyzeColorPsychology(colors: any[]) {
  if (!colors.length) return { dominantMood: 'neutral', emotions: ['balanced'], adjectives: ['neutral'] };

  // Convert to LCH using culori converter for accurate hue/chroma/lightness
  const toLch = converter('lch');
  const lchColors = colors.map(c => toLch(c)).filter(Boolean);

  if (!lchColors.length) {
    return { dominantMood: 'neutral', emotions: ['balanced'], adjectives: ['neutral'] };
  }

  // Extract hue, chroma, lightness
  let totalHue = 0, totalSat = 0, totalLight = 0;
  const hues: number[] = [];

  for (const lchColor of lchColors) {
    const hue = (lchColor as any).h ?? 0;
    // LCH chroma: typical range 0-150 for sRGB colors, normalize to 0-1
    const chroma = Math.min(1, ((lchColor as any).c ?? 0) / 150);
    // LCH lightness: 0-100, normalize to 0-1
    const lightness = ((lchColor as any).l ?? 0) / 100;

    totalHue += hue;
    totalSat += chroma;
    totalLight += lightness;
    hues.push(hue);
  }

  const avgHue = totalHue / lchColors.length;
  const avgSat = totalSat / lchColors.length;
  const avgLight = totalLight / lchColors.length;

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
      const hexColor = formatHex(parsed);
      if (hexColor) {
        const parsedHsl = parse(hexColor);
        if (parsedHsl) {
          hslColor = parsedHsl;
        }
      }
    }

    return hslColor && 's' in hslColor && (hslColor.s || 0) > 0.6;
  });

  if (colorPsychology.dominantMood === 'sophisticated') return 'sophisticated';
  if (hasVibrantColors || colorPsychology.dominantMood === 'energetic') return 'energetic';
  if (colorPsychology.dominantMood === 'professional') return 'calm';
  return 'dynamic';
}

function determineTrustLevel(tokens: DesignTokens, nodes: ComputedStyleNode[]): BrandPersonality['trustLevel'] {
  // V3 FIX: Improved scoring system for better variance
  const scores = {
    conservative: 0,
    modern: 0,
    innovative: 0,
    experimental: 0,
  };

  // 1. Border radius → conservative vs experimental
  const avgRadius = tokens.borderRadius.length > 0
    ? tokens.borderRadius.reduce((sum, r) => sum + parseFloat(r), 0) / tokens.borderRadius.length
    : 0;
  if (avgRadius < 2) {
    scores.conservative += 2;
  } else if (avgRadius > 20) {
    scores.experimental += 2;
    scores.innovative += 1;
  } else if (avgRadius > 8) {
    scores.modern += 1;
    scores.innovative += 1;
  }

  // 2. Color count → conservative vs experimental
  const colorCount = tokens.colors.primary.length + tokens.colors.neutral.length;
  if (colorCount < 6) {
    scores.conservative += 1;
  } else if (colorCount > 12) {
    scores.experimental += 1;
    scores.innovative += 1;
  } else {
    scores.modern += 1;
  }

  // 3. Shadow complexity → conservative vs innovative
  const shadowCount = tokens.boxShadow.length;
  if (shadowCount === 0) {
    scores.conservative += 1;
  } else if (shadowCount > 3) {
    scores.innovative += 2;
  } else if (shadowCount > 1) {
    scores.modern += 1;
  }

  // 4. Font family count → conservative vs experimental
  if (tokens.typography.fontFamilies.length === 1) {
    scores.conservative += 1;
  } else if (tokens.typography.fontFamilies.length > 2) {
    scores.experimental += 1;
  }

  // 5. Font weight range → conservative vs innovative
  const weights = tokens.typography.fontWeights.map(w => typeof w === 'string' ? parseInt(w) : w);
  const weightRange = weights.length > 0 ? Math.max(...weights) - Math.min(...weights) : 0;
  if (weightRange < 200) {
    scores.conservative += 1;
  } else if (weightRange > 500) {
    scores.innovative += 1;
  }

  // Return highest scoring trust level
  return Object.entries(scores).sort((a, b) => b[1] - a[1])[0][0] as BrandPersonality['trustLevel'];
}

// Helper function to calculate average chroma for a set of colors
function calculateAvgChroma(colors: string[]): number {
  if (colors.length === 0) return 0;

  const toLch = converter('lch');
  const chromas = colors
    .map(c => {
      const parsed = parse(c);
      if (!parsed) return null;
      const lch = toLch(parsed);
      return ((lch as any).c ?? 0) / 150; // Normalize to 0-1
    })
    .filter((c): c is number => c !== null);

  if (chromas.length === 0) return 0;
  return chromas.reduce((sum, c) => sum + c, 0) / chromas.length;
}

// Helper function to calculate color coverage metrics
function calculateColorCoverage(
  tokens: DesignTokens,
  colorAreas: Map<string, number>,
  nodes: ComputedStyleNode[]
): ColorCoverageMetrics {
  // Calculate actual page dimensions from bounding boxes
  let maxWidth = 0;
  let maxHeight = 0;
  for (const node of nodes) {
    const right = node.bbox.x + node.bbox.w;
    const bottom = node.bbox.y + node.bbox.h;
    if (right > maxWidth) maxWidth = right;
    if (bottom > maxHeight) maxHeight = bottom;
  }

  const pageArea = maxWidth * maxHeight;

  // Calculate area for each tier
  const brandColorArea = tokens.colors.brandColors.reduce((sum, colorHex) => {
    return sum + (colorAreas.get(colorHex) || 0);
  }, 0);

  const accentColorArea = tokens.colors.accentColors.reduce((sum, colorHex) => {
    return sum + (colorAreas.get(colorHex) || 0);
  }, 0);

  const foundationColorArea = tokens.colors.foundation.reduce((sum, colorHex) => {
    return sum + (colorAreas.get(colorHex) || 0);
  }, 0);

  // Calculate total (for debugging - can exceed 100% due to overlaps)
  const totalColorArea = Array.from(colorAreas.values())
    .reduce((sum, area) => sum + area, 0);

  return {
    brandColorCoveragePercent: (brandColorArea / pageArea) * 100,
    accentColorCoveragePercent: (accentColorArea / pageArea) * 100,
    foundationColorCoveragePercent: (foundationColorArea / pageArea) * 100,
    totalColorArea,
    pageArea
  };
}

function analyzeColorHarmony(
  tokens: DesignTokens,
  colorAreas: Map<string, number>,
  nodes: ComputedStyleNode[]
): ColorHarmonyAnalysis {
  const allColors = [...tokens.colors.primary, ...tokens.colors.neutral];
  const parsedColors = allColors.map(c => parse(c)).filter(Boolean);

  if (!parsedColors.length) {
    // Calculate page area from nodes
    let maxWidth = 0;
    let maxHeight = 0;
    for (const node of nodes) {
      const right = node.bbox.x + node.bbox.w;
      const bottom = node.bbox.y + node.bbox.h;
      if (right > maxWidth) maxWidth = right;
      if (bottom > maxHeight) maxHeight = bottom;
    }
    const pageArea = maxWidth * maxHeight;

    return {
      paletteType: 'monochromatic',
      harmonyScore: 0.5,
      dominantHue: 0,
      saturationRange: { min: 0, max: 0, avg: 0 },
      lightnessRange: { min: 0, max: 0, avg: 0 },
      tierDistribution: {
        foundation: 0,
        tintedNeutrals: 0,
        accentColors: 0,
        brandColors: 0,
      },
      brandColorSaturation: 0,
      accentColorSaturation: 0,
      neutralTint: 0,
      coverage: {
        brandColorCoveragePercent: 0,
        accentColorCoveragePercent: 0,
        foundationColorCoveragePercent: 0,
        totalColorArea: 0,
        pageArea
      }
    };
  }

  // Convert to LCH using culori converter
  const toLch = converter('lch');
  const lchColors = parsedColors.map(color => toLch(color)).filter(Boolean);

  if (!lchColors.length) {
    // Calculate page area from nodes
    let maxWidth = 0;
    let maxHeight = 0;
    for (const node of nodes) {
      const right = node.bbox.x + node.bbox.w;
      const bottom = node.bbox.y + node.bbox.h;
      if (right > maxWidth) maxWidth = right;
      if (bottom > maxHeight) maxHeight = bottom;
    }
    const pageArea = maxWidth * maxHeight;

    return {
      paletteType: 'monochromatic',
      harmonyScore: 0.5,
      dominantHue: 0,
      saturationRange: { min: 0, max: 0, avg: 0 },
      lightnessRange: { min: 0, max: 0, avg: 0 },
      tierDistribution: {
        foundation: 0,
        tintedNeutrals: 0,
        accentColors: 0,
        brandColors: 0,
      },
      brandColorSaturation: 0,
      accentColorSaturation: 0,
      neutralTint: 0,
      coverage: {
        brandColorCoveragePercent: 0,
        accentColorCoveragePercent: 0,
        foundationColorCoveragePercent: 0,
        totalColorArea: 0,
        pageArea
      }
    };
  }

  // Extract hue, chroma (saturation), lightness from LCH
  const hues = lchColors.map(c => (c as any).h ?? 0);
  // LCH chroma: typical range 0-150 for sRGB colors, normalize to 0-1
  const chromas = lchColors.map(c => Math.min(1, ((c as any).c ?? 0) / 150));
  // LCH lightness: 0-100, normalize to 0-1
  const lightnesses = lchColors.map(c => ((c as any).l ?? 0) / 100);

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
  // Lower variance = higher harmony
  const saturationVariance = Math.max(...chromas) - Math.min(...chromas);
  const lightnessVariance = Math.max(...lightnesses) - Math.min(...lightnesses);
  // Both variances are 0-1, so average variance is 0-1
  const avgVariance = (saturationVariance + lightnessVariance) / 2;
  const harmonyScore = Math.max(0, Math.min(1, 1 - avgVariance));

  // === NEW: Calculate tier distribution ===
  const tierDistribution = {
    foundation: tokens.colors.foundation.length,
    tintedNeutrals: tokens.colors.tintedNeutrals.length,
    accentColors: tokens.colors.accentColors.length,
    brandColors: tokens.colors.brandColors.length,
  };

  // === NEW: Tier-specific saturation metrics ===
  const brandColorSaturation = calculateAvgChroma(tokens.colors.brandColors);
  const accentColorSaturation = calculateAvgChroma(tokens.colors.accentColors);
  const neutralTint = calculateAvgChroma(tokens.colors.tintedNeutrals);

  // === NEW: Color coverage metrics ===
  const coverage = calculateColorCoverage(tokens, colorAreas, nodes);

  return {
    paletteType,
    harmonyScore,
    dominantHue,
    saturationRange: {
      min: Math.min(...chromas),
      max: Math.max(...chromas),
      avg: chromas.reduce((a, b) => a + b, 0) / chromas.length
    },
    lightnessRange: {
      min: Math.min(...lightnesses),
      max: Math.max(...lightnesses),
      avg: lightnesses.reduce((a, b) => a + b, 0) / lightnesses.length
    },
    tierDistribution,        // NEW
    brandColorSaturation,    // NEW
    accentColorSaturation,   // NEW
    neutralTint,             // NEW
    coverage,                // NEW
  };
}

function calculateBrandCoherence(
  tokens: DesignTokens,
  nodes: ComputedStyleNode[],
  colorAreas: Map<string, number>,
  viewport: { width: number; height: number }
): BrandCoherenceScore {
  const colorHarmony = analyzeColorHarmony(tokens, colorAreas, nodes);
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

  const uniqueValues = new Set(spacing).size;

  // Calculate coefficient of variation (std dev / mean) as a measure of consistency
  const mean = spacing.reduce((a, b) => a + b, 0) / spacing.length;
  const variance = spacing.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / spacing.length;
  const stdDev = Math.sqrt(variance);
  const coefficientOfVariation = mean > 0 ? stdDev / mean : 0;

  // Lower CV = more consistent spacing
  // CV of 0 = perfect consistency, CV > 1 = high variance
  let consistency = Math.max(0, 1 - coefficientOfVariation);

  // Penalize too many unique values (suggests ad-hoc spacing rather than systematic)
  if (uniqueValues > 8) {
    consistency -= 0.2;
  } else if (uniqueValues > 6) {
    consistency -= 0.1;
  }

  // Bonus for following systematic patterns (4px or 8px grid)
  const systematicPattern = spacing.every(s => s % 8 === 0) || spacing.every(s => s % 4 === 0);
  if (systematicPattern && uniqueValues <= 6) {
    consistency = Math.min(1, consistency + 0.1);
  }

  return Math.max(0, Math.min(1, consistency));
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

async function generateStyleReport(
  nodes: ComputedStyleNode[],
  tokens: DesignTokens,
  viewport: { width: number; height: number }
): Promise<StyleReport> {
  let totalPairs = 0;
  let aaPassing = 0;
  const failures: StyleReport['contrastResults']['failures'] = [];

  // Calculate color areas for coverage metrics
  const colorAreas = new Map<string, number>();
  for (const node of nodes) {
    const area = node.bbox.w * node.bbox.h;

    // Text color
    const textColor = parse(node.styles.color);
    if (textColor) {
      const hex = formatHex(textColor);
      colorAreas.set(hex, (colorAreas.get(hex) || 0) + area);
    }

    // Background color
    const bgColor = parse(node.styles.backgroundColor);
    if (bgColor && (bgColor.alpha ?? 1) > 0.1) {
      const hex = formatHex(bgColor);
      colorAreas.set(hex, (colorAreas.get(hex) || 0) + area);
    }
  }

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
  const realTokenMetrics = await calculateRealTokenMetrics(nodes, tokens, colorAreas, viewport);
  const brandPersonality = await analyzeBrandPersonality(tokens, nodes);
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
  let bestColor = formatHex(foreground) || palette[0];
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
  // Enhanced color configuration
  const colors = {
    brand: tokens.colors.primary.reduce((acc, color, idx) => {
      acc[`${(idx + 1) * 100}`] = color;
      return acc;
    }, {} as Record<string, string>),

    // Add semantic colors
    semantic: {
      text: tokens.colors.semantic.text,
      background: tokens.colors.semantic.background,
      cta: tokens.colors.semantic?.cta || tokens.colors.primary[0],
      accent: tokens.colors.semantic?.accent || tokens.colors.primary[1],
      muted: tokens.colors.semantic?.muted || tokens.colors.neutral[0],
    },

    // Add contextual colors if available
    ...(tokens.colors.contextual?.buttons?.length && {
      button: tokens.colors.contextual.buttons.reduce((acc, color, idx) => {
        acc[`${(idx + 1) * 100}`] = color;
        return acc;
      }, {} as Record<string, string>)
    }),

    ...(tokens.colors.contextual?.links?.length && {
      link: tokens.colors.contextual.links.reduce((acc, color, idx) => {
        acc[`${(idx + 1) * 100}`] = color;
        return acc;
      }, {} as Record<string, string>)
    }),
  };

  // Enhanced spacing with semantic names
  const spacing = tokens.spacing.reduce((acc, space, idx) => {
    acc[idx.toString()] = `${space}px`;
    // Add semantic names
    if (space === 8) acc['xs'] = `${space}px`;
    if (space === 16) acc['sm'] = `${space}px`;
    if (space === 24) acc['md'] = `${space}px`;
    if (space === 32) acc['lg'] = `${space}px`;
    if (space === 48) acc['xl'] = `${space}px`;
    return acc;
  }, {} as Record<string, string>);

  // Enhanced border radius
  const borderRadius = tokens.borderRadius.reduce((acc, radius, idx) => {
    acc[`r${idx}`] = radius;
    // Add semantic names for common values
    if (radius === '4px') acc['sm'] = radius;
    if (radius === '8px') acc['md'] = radius;
    if (radius === '16px') acc['lg'] = radius;
    return acc;
  }, {} as Record<string, string>);

  // Enhanced shadows
  const boxShadow = tokens.boxShadow.reduce((acc, shadow, idx) => {
    acc[`s${idx}`] = shadow;
    return acc;
  }, {} as Record<string, string>);

  // Enhanced typography
  const fontFamily = {
    primary: tokens.typography.fontFamilies,
  };

  const fontWeight = tokens.typography.fontWeights?.reduce((acc, weight, idx) => {
    acc[`w${idx}`] = weight.toString();
    // Add semantic names for common weights
    if (weight === 400) acc['normal'] = '400';
    if (weight === 500) acc['medium'] = '500';
    if (weight === 600) acc['semibold'] = '600';
    if (weight === 700) acc['bold'] = '700';
    return acc;
  }, {} as Record<string, string>) || {};

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
      fontFamily: ${JSON.stringify(fontFamily, null, 6)},
      fontWeight: ${JSON.stringify(fontWeight, null, 6)},
    },
  },
  safelist: [
    // Brand colors
    ${tokens.colors.primary.map((_, idx) => `'bg-brand-${(idx + 1) * 100}'`).join(', ')},
    ${tokens.colors.primary.map((_, idx) => `'text-brand-${(idx + 1) * 100}'`).join(', ')},
    ${tokens.colors.primary.map((_, idx) => `'border-brand-${(idx + 1) * 100}'`).join(', ')},

    // Semantic colors
    'bg-semantic-text', 'bg-semantic-background', 'bg-semantic-cta', 'bg-semantic-accent', 'bg-semantic-muted',
    'text-semantic-text', 'text-semantic-background', 'text-semantic-cta', 'text-semantic-accent', 'text-semantic-muted',

    // Contextual colors
    ${tokens.colors.contextual?.buttons?.length ?
      tokens.colors.contextual.buttons.map((_, idx) => `'bg-button-${(idx + 1) * 100}'`).join(', ') + ',' : ''}
    ${tokens.colors.contextual?.links?.length ?
      tokens.colors.contextual.links.map((_, idx) => `'text-link-${(idx + 1) * 100}'`).join(', ') + ',' : ''}

    // Spacing
    ${tokens.spacing.map((_, idx) => `'p-${idx}'`).join(', ')},
    ${tokens.spacing.map((_, idx) => `'m-${idx}'`).join(', ')},
    'p-xs', 'p-sm', 'p-md', 'p-lg', 'p-xl',
    'm-xs', 'm-sm', 'm-md', 'm-lg', 'm-xl',

    // Border radius
    ${tokens.borderRadius.map((_, idx) => `'rounded-r${idx}'`).join(', ')},
    'rounded-sm', 'rounded-md', 'rounded-lg',

    // Shadows
    ${tokens.boxShadow.map((_, idx) => `'shadow-s${idx}'`).join(', ')},

    // Typography
    'font-primary',
    ${tokens.typography.fontWeights?.map((_, idx) => `'font-w${idx}'`).join(', ') || ''},
    'font-normal', 'font-medium', 'font-semibold', 'font-bold',
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