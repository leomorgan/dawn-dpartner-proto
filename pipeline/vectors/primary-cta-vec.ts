import type { DesignTokens, StyleReport } from '../tokens';
import { hexToLCH, calculateContrast } from './utils';
import { normalizeFeature, l2Normalize as l2NormalizeVec } from './normalization';

/**
 * Builds a 26D PrimaryCTA role vector:
 * - 26D interpretable: button-specific features (8D colors + 4D typography + 6D shape + 4D interaction + 4D UX)
 * - Visual features removed (no longer needed)
 *
 * CHANGES from 24D:
 * - Color features: 6D → 8D (circular hue encoding: cos/sin instead of linear 0-360)
 * - Chroma normalization fixed: 0-100 → 0-150
 */
export function buildPrimaryCtaVec(
  tokens: DesignTokens,
  report: StyleReport
): {
  interpretable: Float32Array;
  visual: Float32Array;
  combined: Float32Array;
  metadata: { featureNames: string[]; nonZeroCount: number; buttonIndex: number };
} {
  // Find primary button variant
  const primaryButtonIndex = tokens.buttons.variants.findIndex(b => b.type === 'primary');
  const primaryButton = primaryButtonIndex >= 0
    ? tokens.buttons.variants[primaryButtonIndex]
    : tokens.buttons.variants[0];

  if (!primaryButton) {
    // No buttons found - return zero vector (26D)
    return {
      interpretable: Float32Array.from(Array(26).fill(0)),
      visual: Float32Array.from([]),  // Empty - visual features removed
      combined: Float32Array.from(Array(26).fill(0)),
      metadata: {
        featureNames: Array(26).fill('missing'),
        nonZeroCount: 0,
        buttonIndex: -1
      }
    };
  }

  const interpretable: number[] = [];
  const featureNames: string[] = [];

  // === Color Features (8D) ===
  // FIXED: Circular hue encoding (cos/sin) and correct chroma range (0-150)

  // Background color LCH (4D: L, C, H_cos, H_sin)
  const bgLCH = hexToLCH(primaryButton.backgroundColor);
  featureNames.push('cta_bg_lightness', 'cta_bg_chroma', 'cta_bg_hue_cos', 'cta_bg_hue_sin');
  const bgHueRad = (bgLCH.h * Math.PI) / 180;
  interpretable.push(
    normalizeFeature(bgLCH.l, 'cta_bg_lightness'),
    normalizeFeature(bgLCH.c, 'cta_bg_chroma'),
    Math.cos(bgHueRad),                 // Already normalized [-1, 1]
    Math.sin(bgHueRad)                  // Already normalized [-1, 1]
  );

  // Text color LCH (4D: L, C, H_cos, H_sin)
  const fgLCH = hexToLCH(primaryButton.color);
  featureNames.push('cta_text_lightness', 'cta_text_chroma', 'cta_text_hue_cos', 'cta_text_hue_sin');
  const fgHueRad = (fgLCH.h * Math.PI) / 180;
  interpretable.push(
    normalizeFeature(fgLCH.l, 'cta_text_lightness'),
    normalizeFeature(fgLCH.c, 'cta_text_chroma'),
    Math.cos(fgHueRad),                 // Already normalized [-1, 1]
    Math.sin(fgHueRad)                  // Already normalized [-1, 1]
  );

  // === Typography Features (4D) ===

  // Font size
  featureNames.push('cta_font_size');
  interpretable.push(normalizeFeature(primaryButton.fontSize, 'cta_font_size'));

  // Font weight
  featureNames.push('cta_font_weight');
  interpretable.push(normalizeFeature(primaryButton.fontWeight, 'cta_font_weight'));

  // Casing score (from textContent if available)
  const casingScore = primaryButton.textContent
    ? calculateCasingScore(primaryButton.textContent)
    : 0;
  featureNames.push('cta_casing_score');
  interpretable.push(casingScore);

  // Reserved (1D)
  featureNames.push('cta_typo_reserved_1');
  interpretable.push(0);

  // === Shape Features (6D) ===

  // Border radius
  const radiusPx = parseFloat(primaryButton.borderRadius) || 0;
  featureNames.push('cta_border_radius');
  interpretable.push(normalizeFeature(radiusPx, 'cta_border_radius'));

  // Stroke width (binary: has border or not)
  const strokePx = primaryButton.borderColor ? 1 : 0;
  featureNames.push('cta_stroke_width');
  interpretable.push(strokePx);

  // Padding (2D: X and Y)
  const [padY, padX] = parsePadding(primaryButton.padding);
  featureNames.push('cta_padding_x', 'cta_padding_y');
  interpretable.push(
    normalizeFeature(padX, 'cta_padding_x'),
    normalizeFeature(padY, 'cta_padding_y')
  );

  // Reserved (2D)
  featureNames.push('cta_shape_reserved_1', 'cta_shape_reserved_2');
  interpretable.push(0, 0);

  // === Interaction Features (4D) ===

  // Has hover state (binary)
  const hasHover = primaryButton.hover ? 1 : 0;
  featureNames.push('cta_has_hover');
  interpretable.push(hasHover);

  // Hover color shift (binary)
  const hoverColorShift = primaryButton.hover?.backgroundColor ? 1 : 0;
  featureNames.push('cta_hover_color_shift');
  interpretable.push(hoverColorShift);

  // Hover opacity change
  const hoverOpacity = primaryButton.hover?.opacity
    ? normalizeFeature(primaryButton.hover.opacity, 'cta_hover_opacity')
    : 0;
  featureNames.push('cta_hover_opacity');
  interpretable.push(hoverOpacity);

  // Reserved (1D)
  featureNames.push('cta_interaction_reserved_1');
  interpretable.push(0);

  // === UX Features (4D) ===

  // Contrast ratio
  const contrast = calculateContrast(primaryButton.color, primaryButton.backgroundColor);
  featureNames.push('cta_contrast');
  interpretable.push(normalizeFeature(contrast, 'cta_contrast'));

  // Min tap side
  const minTapSide = Math.min(padX, padY) * 2 + primaryButton.fontSize;
  featureNames.push('cta_min_tap_side');
  interpretable.push(normalizeFeature(minTapSide, 'cta_min_tap_side'));

  // Reserved (2D)
  featureNames.push('cta_ux_reserved_1', 'cta_ux_reserved_2');
  interpretable.push(0, 0);

  // === Verify Length ===
  // 8D colors + 4D typography + 6D shape + 4D interaction + 4D UX = 26D
  if (interpretable.length !== 26) {
    throw new Error(`Interpretable vector must be 26D, got ${interpretable.length}D. Breakdown:
      - Colors: 8D (bg: 4D, fg: 4D with circular hue)
      - Typography: 4D
      - Shape: 6D
      - Interaction: 4D
      - UX: 4D
      Total: 26D`);
  }

  // === Visual Features - Removed (empty array) ===
  const visual = Float32Array.from([]);

  // === Combined is just interpretable now (26D) ===
  // L2 normalize for cosine similarity
  const combined = l2NormalizeVec(interpretable);

  if (combined.length !== 26) {
    throw new Error(`Combined vector must be 26D, got ${combined.length}D`);
  }

  // === Metadata ===
  const nonZeroCount = interpretable.filter(x => x !== 0).length;

  return {
    interpretable: Float32Array.from(interpretable),
    visual,
    combined,
    metadata: {
      featureNames,
      nonZeroCount,
      buttonIndex: primaryButtonIndex
    }
  };
}

function parsePadding(padding: string): [number, number] {
  const parts = padding.split(/\s+/).map(p => parseFloat(p) || 0);
  if (parts.length === 1) return [parts[0], parts[0]];
  if (parts.length === 2) return [parts[0], parts[1]];
  if (parts.length === 4) return [parts[0], parts[1]];
  return [0, 0];
}

function calculateCasingScore(text: string): number {
  // 0 = lowercase, 1 = UPPERCASE, 0.5 = Mixed Case
  const upperCount = (text.match(/[A-Z]/g) || []).length;
  const lowerCount = (text.match(/[a-z]/g) || []).length;
  const total = upperCount + lowerCount;

  if (total === 0) return 0;
  return upperCount / total;
}
