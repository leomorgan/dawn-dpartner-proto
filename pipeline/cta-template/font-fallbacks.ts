/**
 * Font Fallback System
 * Maps custom/web fonts to the closest matching system fonts
 */

interface FontMatch {
  systemFont: string;
  fullStack: string;
  characteristics: string;
}

// Comprehensive font fallback mapping
const FONT_FALLBACKS: Record<string, FontMatch> = {
  // Sans-serif - Geometric
  'Circular': {
    systemFont: 'system-ui',
    fullStack: 'system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
    characteristics: 'geometric, rounded'
  },
  'Avenir': {
    systemFont: 'system-ui',
    fullStack: 'system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
    characteristics: 'geometric, clean'
  },
  'Gotham': {
    systemFont: 'system-ui',
    fullStack: 'system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
    characteristics: 'geometric, strong'
  },
  'Proxima Nova': {
    systemFont: 'system-ui',
    fullStack: 'system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
    characteristics: 'geometric, versatile'
  },

  // Sans-serif - Humanist
  'sohne': {
    systemFont: 'Helvetica Neue',
    fullStack: 'Helvetica Neue, Helvetica, Arial, sans-serif',
    characteristics: 'humanist, elegant'
  },
  'sohne-var': {
    systemFont: 'Helvetica Neue',
    fullStack: 'Helvetica Neue, Helvetica, Arial, sans-serif',
    characteristics: 'humanist, elegant, variable'
  },
  'Inter': {
    systemFont: 'system-ui',
    fullStack: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    characteristics: 'humanist, modern'
  },
  'Open Sans': {
    systemFont: 'system-ui',
    fullStack: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    characteristics: 'humanist, neutral'
  },
  'Lato': {
    systemFont: 'system-ui',
    fullStack: 'system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
    characteristics: 'humanist, warm'
  },

  // Sans-serif - Grotesque
  'Helvetica': {
    systemFont: 'Helvetica Neue',
    fullStack: 'Helvetica Neue, Helvetica, Arial, sans-serif',
    characteristics: 'grotesque, neutral'
  },
  'Helvetica Neue': {
    systemFont: 'Helvetica Neue',
    fullStack: 'Helvetica Neue, Helvetica, Arial, sans-serif',
    characteristics: 'grotesque, refined'
  },
  'Arial': {
    systemFont: 'Arial',
    fullStack: 'Arial, Helvetica, sans-serif',
    characteristics: 'grotesque, universal'
  },
  'Roboto': {
    systemFont: 'Roboto',
    fullStack: 'Roboto, system-ui, -apple-system, sans-serif',
    characteristics: 'grotesque, modern'
  },
  'San Francisco': {
    systemFont: '-apple-system',
    fullStack: '-apple-system, BlinkMacSystemFont, system-ui, sans-serif',
    characteristics: 'grotesque, apple'
  },
  'SF Pro': {
    systemFont: '-apple-system',
    fullStack: '-apple-system, BlinkMacSystemFont, system-ui, sans-serif',
    characteristics: 'grotesque, apple'
  },

  // Sans-serif - Neo-grotesque
  'Univers': {
    systemFont: 'Helvetica Neue',
    fullStack: 'Helvetica Neue, Helvetica, Arial, sans-serif',
    characteristics: 'neo-grotesque'
  },
  'Akzidenz-Grotesk': {
    systemFont: 'Helvetica Neue',
    fullStack: 'Helvetica Neue, Helvetica, Arial, sans-serif',
    characteristics: 'neo-grotesque, classic'
  },

  // Sans-serif - Other
  'GT-America': {
    systemFont: 'system-ui',
    fullStack: 'system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
    characteristics: 'versatile, modern'
  },
  'Graphik': {
    systemFont: 'system-ui',
    fullStack: 'system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
    characteristics: 'geometric, neutral'
  },
  'Suisse': {
    systemFont: 'Helvetica Neue',
    fullStack: 'Helvetica Neue, Helvetica, Arial, sans-serif',
    characteristics: 'swiss, refined'
  },

  // Serif
  'Georgia': {
    systemFont: 'Georgia',
    fullStack: 'Georgia, "Times New Roman", Times, serif',
    characteristics: 'transitional serif'
  },
  'Times New Roman': {
    systemFont: 'Times New Roman',
    fullStack: '"Times New Roman", Times, Georgia, serif',
    characteristics: 'transitional serif'
  },
  'Freight': {
    systemFont: 'Georgia',
    fullStack: 'Georgia, "Times New Roman", serif',
    characteristics: 'transitional serif, elegant'
  },
  'Playfair': {
    systemFont: 'Georgia',
    fullStack: 'Georgia, "Times New Roman", serif',
    characteristics: 'transitional serif, display'
  },
  'Tiempos': {
    systemFont: 'Georgia',
    fullStack: 'Georgia, "Times New Roman", serif',
    characteristics: 'contemporary serif'
  },

  // Monospace
  'Source Code Pro': {
    systemFont: 'SF Mono',
    fullStack: '"SF Mono", Monaco, Consolas, "Courier New", monospace',
    characteristics: 'monospace, code'
  },
  'SourceCodePro': {
    systemFont: 'SF Mono',
    fullStack: '"SF Mono", Monaco, Consolas, "Courier New", monospace',
    characteristics: 'monospace, code'
  },
  'Monaco': {
    systemFont: 'Monaco',
    fullStack: 'Monaco, Consolas, "Courier New", monospace',
    characteristics: 'monospace'
  },
  'Consolas': {
    systemFont: 'Consolas',
    fullStack: 'Consolas, Monaco, "Courier New", monospace',
    characteristics: 'monospace'
  },
  'Courier New': {
    systemFont: 'Courier New',
    fullStack: '"Courier New", Courier, monospace',
    characteristics: 'monospace, classic'
  },
  'Fira Code': {
    systemFont: 'SF Mono',
    fullStack: '"SF Mono", Monaco, Consolas, monospace',
    characteristics: 'monospace, ligatures'
  },
  'JetBrains Mono': {
    systemFont: 'SF Mono',
    fullStack: '"SF Mono", Monaco, Consolas, monospace',
    characteristics: 'monospace, developer'
  }
};

/**
 * Converts a custom font stack to the best system font alternative
 */
export function getSystemFontFallback(fontFamily: string): string {
  if (!fontFamily) {
    return 'system-ui, -apple-system, BlinkMacSystemFont, sans-serif';
  }

  // Parse the font stack (e.g., "sohne-var, Helvetica Neue, Arial, sans-serif")
  const fonts = fontFamily
    .split(',')
    .map(f => f.trim().replace(/['"]/g, ''));

  // Try to match the first font in the stack
  const primaryFont = fonts[0];

  // Check for exact match
  const exactMatch = FONT_FALLBACKS[primaryFont];
  if (exactMatch) {
    return exactMatch.fullStack;
  }

  // Check for partial match (e.g., "sohne-var" matches "sohne")
  const partialMatch = Object.keys(FONT_FALLBACKS).find(key =>
    primaryFont.toLowerCase().includes(key.toLowerCase()) ||
    key.toLowerCase().includes(primaryFont.toLowerCase())
  );

  if (partialMatch) {
    return FONT_FALLBACKS[partialMatch].fullStack;
  }

  // Analyze generic family and characteristics
  const fontLower = fontFamily.toLowerCase();

  // Monospace detection
  if (fontLower.includes('mono') || fontLower.includes('code') || fontLower.includes('courier')) {
    return '"SF Mono", Monaco, Consolas, "Courier New", monospace';
  }

  // Serif detection
  if (fontLower.includes('serif') && !fontLower.includes('sans')) {
    return 'Georgia, "Times New Roman", Times, serif';
  }

  // Default to modern system font stack for sans-serif
  return 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';
}

/**
 * Get font characteristics for documentation
 */
export function getFontCharacteristics(fontFamily: string): string {
  if (!fontFamily) return '';

  const fonts = fontFamily.split(',').map(f => f.trim().replace(/['"]/g, ''));
  const primaryFont = fonts[0];

  const match = FONT_FALLBACKS[primaryFont] ||
    FONT_FALLBACKS[Object.keys(FONT_FALLBACKS).find(key =>
      primaryFont.toLowerCase().includes(key.toLowerCase())
    ) || ''];

  return match?.characteristics || '';
}

/**
 * Normalize font weight for system fonts that don't support variable weights
 */
export function normalizeSystemFontWeight(fontWeight: number, fontFamily: string): number {
  // System fonts typically support: 100, 200, 300, 400, 500, 600, 700, 800, 900
  const standardWeights = [100, 200, 300, 400, 500, 600, 700, 800, 900];

  // If it's already a standard weight, return it
  if (standardWeights.includes(fontWeight)) {
    return fontWeight;
  }

  // Check if font supports variable weights (modern system fonts do)
  const variableFonts = ['system-ui', '-apple-system', 'SF Pro', 'San Francisco', 'Inter'];
  if (variableFonts.some(vf => fontFamily.includes(vf))) {
    return fontWeight; // Keep variable weight
  }

  // Round to nearest standard weight for non-variable fonts
  const nearest = standardWeights.reduce((prev, curr) =>
    Math.abs(curr - fontWeight) < Math.abs(prev - fontWeight) ? curr : prev
  );

  return nearest;
}
