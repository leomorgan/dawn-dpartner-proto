import type { DesignTokens, StyleReport } from '../tokens';
import { normalizeLinear, hexToLCH, calculateContrast } from './utils';

/**
 * Builds a 64D PrimaryCTA role vector:
 * - 24D interpretable: button-specific features
 * - 40D visual: zero-padded for MVP (future: button crop embeddings)
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
    // No buttons found - return zero vector
    return {
      interpretable: Float32Array.from(Array(24).fill(0)),
      visual: Float32Array.from(Array(40).fill(0)),
      combined: Float32Array.from(Array(64).fill(0)),
      metadata: {
        featureNames: Array(64).fill('missing'),
        nonZeroCount: 0,
        buttonIndex: -1
      }
    };
  }

  const interpretable: number[] = [];
  const featureNames: string[] = [];

  // === Color Features (6D) ===

  // Background color LCH (3D)
  const bgLCH = hexToLCH(primaryButton.backgroundColor);
  featureNames.push('cta_bg_L', 'cta_bg_C', 'cta_bg_h');
  interpretable.push(
    normalizeLinear(bgLCH.l, 0, 100),
    normalizeLinear(bgLCH.c, 0, 100),
    normalizeLinear(bgLCH.h, 0, 360)
  );

  // Text color LCH (3D)
  const fgLCH = hexToLCH(primaryButton.color);
  featureNames.push('cta_fg_L', 'cta_fg_C', 'cta_fg_h');
  interpretable.push(
    normalizeLinear(fgLCH.l, 0, 100),
    normalizeLinear(fgLCH.c, 0, 100),
    normalizeLinear(fgLCH.h, 0, 360)
  );

  // === Typography Features (4D) ===

  // Font size (linear normalize, typical 10-24px)
  featureNames.push('cta_font_size');
  interpretable.push(normalizeLinear(primaryButton.fontSize, 10, 24));

  // Font weight (linear normalize, 300-900)
  featureNames.push('cta_font_weight');
  interpretable.push(normalizeLinear(primaryButton.fontWeight, 300, 900));

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

  // Border radius (linear normalize, typical 0-32px)
  const radiusPx = parseFloat(primaryButton.borderRadius) || 0;
  featureNames.push('cta_border_radius');
  interpretable.push(normalizeLinear(radiusPx, 0, 32));

  // Stroke width (binary: has border or not)
  const strokePx = primaryButton.borderColor ? 1 : 0;
  featureNames.push('cta_stroke_width');
  interpretable.push(strokePx);

  // Padding (2D: X and Y)
  const [padY, padX] = parsePadding(primaryButton.padding);
  featureNames.push('cta_padding_x', 'cta_padding_y');
  interpretable.push(
    normalizeLinear(padX, 0, 48),
    normalizeLinear(padY, 0, 32)
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

  // Hover opacity change (linear normalize)
  const hoverOpacity = primaryButton.hover?.opacity
    ? normalizeLinear(primaryButton.hover.opacity, 0.7, 1)
    : 0;
  featureNames.push('cta_hover_opacity');
  interpretable.push(hoverOpacity);

  // Reserved (1D)
  featureNames.push('cta_interaction_reserved_1');
  interpretable.push(0);

  // === UX Features (4D) ===

  // Contrast ratio (linear normalize, WCAG 0-21)
  const contrast = calculateContrast(primaryButton.color, primaryButton.backgroundColor);
  featureNames.push('cta_contrast');
  interpretable.push(normalizeLinear(contrast, 0, 21));

  // Min tap side (linear normalize, typical 20-60px)
  const minTapSide = Math.min(padX, padY) * 2 + primaryButton.fontSize;
  featureNames.push('cta_min_tap_side');
  interpretable.push(normalizeLinear(minTapSide, 20, 60));

  // Reserved (2D)
  featureNames.push('cta_ux_reserved_1', 'cta_ux_reserved_2');
  interpretable.push(0, 0);

  // === Verify Length ===
  if (interpretable.length !== 24) {
    throw new Error(`Interpretable vector must be 24D, got ${interpretable.length}D`);
  }

  // === Visual Features (40D) - Zero-padded for MVP ===
  const visual = Array(40).fill(0);

  // === Combine ===
  const combined = [...interpretable, ...visual];

  // === Metadata ===
  const nonZeroCount = interpretable.filter(x => x !== 0).length;

  return {
    interpretable: Float32Array.from(interpretable),
    visual: Float32Array.from(visual),
    combined: Float32Array.from(combined),
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
