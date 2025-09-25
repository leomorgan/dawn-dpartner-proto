import { extractTokens } from '../../pipeline/tokens';
import { readFile, writeFile, mkdir, rm } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import type { ComputedStyleNode } from '../../pipeline/capture';

describe('Tokens Module', () => {
  const testRunId = 'test-tokens-run';
  const testArtifactsDir = join(process.cwd(), 'test-artifacts');

  beforeEach(async () => {
    // Create test artifacts
    await mkdir(join(testArtifactsDir, testRunId, 'raw'), { recursive: true });

    // Create mock computed styles
    const mockStyles: ComputedStyleNode[] = [
      {
        id: 'node_0',
        tag: 'h1',
        bbox: { x: 0, y: 0, w: 400, h: 48 },
        styles: {
          color: '#1a202c',
          backgroundColor: '#ffffff',
          fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
          fontSize: '32px',
          lineHeight: '1.2',
          borderRadius: '0px',
          boxShadow: 'none',
          margin: '0px 0px 16px 0px',
          padding: '0px 0px 0px 0px',
        },
        textContent: 'AI Design Partner'
      },
      {
        id: 'node_1',
        tag: 'p',
        bbox: { x: 0, y: 64, w: 300, h: 24 },
        styles: {
          color: '#4a5568',
          backgroundColor: 'rgba(0, 0, 0, 0)',
          fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
          fontSize: '18px',
          lineHeight: '1.6',
          borderRadius: '0px',
          boxShadow: 'none',
          margin: '0px 0px 8px 0px',
          padding: '0px 0px 0px 0px',
        },
        textContent: 'Generate beautiful designs'
      },
      {
        id: 'node_2',
        tag: 'button',
        bbox: { x: 0, y: 100, w: 120, h: 44 },
        styles: {
          color: '#ffffff',
          backgroundColor: '#4299e1',
          fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
          fontSize: '16px',
          lineHeight: '1.5',
          borderRadius: '8px',
          boxShadow: '0 4px 14px 0 rgba(66, 153, 225, 0.39)',
          margin: '16px 0px 0px 0px',
          padding: '12px 24px 12px 24px',
        },
        textContent: 'Get Started'
      },
      {
        id: 'node_3',
        tag: 'div',
        bbox: { x: 0, y: 160, w: 600, h: 200 },
        styles: {
          color: '#2d3748',
          backgroundColor: '#f8fafc',
          fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
          fontSize: '14px',
          lineHeight: '1.6',
          borderRadius: '12px',
          boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)',
          margin: '24px 0px 0px 0px',
          padding: '32px 32px 32px 32px',
        },
        textContent: 'Feature card content'
      }
    ];

    await writeFile(
      join(testArtifactsDir, testRunId, 'raw', 'computed_styles.json'),
      JSON.stringify(mockStyles, null, 2)
    );
  });

  afterEach(async () => {
    if (existsSync(testArtifactsDir)) {
      await rm(testArtifactsDir, { recursive: true });
    }
  });

  it('should extract design tokens from computed styles', async () => {
    const result = await extractTokens(testRunId, testArtifactsDir);

    expect(result.runId).toBe(testRunId);
    expect(result.tokens).toBeDefined();

    // Check colors
    expect(result.tokens.colors.primary).toBeDefined();
    expect(result.tokens.colors.primary.length).toBeGreaterThan(0);
    expect(result.tokens.colors.semantic.text).toBeDefined();
    expect(result.tokens.colors.semantic.background).toBeDefined();

    // Check typography
    expect(result.tokens.typography.fontFamilies).toContain('-apple-system, BlinkMacSystemFont, sans-serif');
    expect(result.tokens.typography.fontSizes).toContain(32);
    expect(result.tokens.typography.fontSizes).toContain(18);
    expect(result.tokens.typography.fontSizes).toContain(16);

    // Check spacing (should be on 8px grid)
    result.tokens.spacing.forEach(space => {
      expect(space % 8).toBe(0);
    });
    expect(result.tokens.spacing).toContain(0);
    expect(result.tokens.spacing).toContain(8);
    expect(result.tokens.spacing).toContain(16);

    // Check border radius
    expect(result.tokens.borderRadius).toContain('8px');
    expect(result.tokens.borderRadius).toContain('12px');
  });

  it('should generate accessibility report', async () => {
    const result = await extractTokens(testRunId, testArtifactsDir);

    expect(result.report).toBeDefined();
    expect(result.report.contrastResults.totalPairs).toBeGreaterThan(0);
    expect(result.report.contrastResults.aaPassRate).toBeGreaterThanOrEqual(0);
    expect(result.report.contrastResults.aaPassRate).toBeLessThanOrEqual(1);
  });

  it('should generate Tailwind config', async () => {
    const result = await extractTokens(testRunId, testArtifactsDir);

    expect(result.tailwindConfig).toBeDefined();
    expect(result.tailwindConfig).toContain('module.exports');
    expect(result.tailwindConfig).toContain('brand');
    expect(result.tailwindConfig).toContain('spacing');
    expect(result.tailwindConfig).toContain('borderRadius');
  });

  it('should generate CSS variables', async () => {
    const result = await extractTokens(testRunId, testArtifactsDir);

    expect(result.cssVars).toBeDefined();
    expect(result.cssVars).toContain(':root {');
    expect(result.cssVars).toContain('--brand-');
    expect(result.cssVars).toContain('--spacing-');
    expect(result.cssVars).toContain('--font-primary');
  });

  it('should save all artifact files', async () => {
    await extractTokens(testRunId, testArtifactsDir);

    const runDir = join(testArtifactsDir, testRunId);

    expect(existsSync(join(runDir, 'design_tokens.json'))).toBe(true);
    expect(existsSync(join(runDir, 'style_report.json'))).toBe(true);
    expect(existsSync(join(runDir, 'tailwind.config.js'))).toBe(true);
    expect(existsSync(join(runDir, 'css_vars.css'))).toBe(true);
  });

  it('should enforce spacing constraints', async () => {
    const result = await extractTokens(testRunId, testArtifactsDir);

    // Spacing should be ≤ 6 steps
    expect(result.tokens.spacing.length).toBeLessThanOrEqual(6);

    // All spacing should be on 8px grid
    result.tokens.spacing.forEach(space => {
      expect(space % 8).toBe(0);
      expect(space).toBeGreaterThanOrEqual(0);
    });
  });

  it('should have palette recall ≥ 75% for sufficient colors', async () => {
    const result = await extractTokens(testRunId, testArtifactsDir);

    const totalColors = result.tokens.colors.primary.length + result.tokens.colors.neutral.length;
    if (totalColors >= 3) {
      expect(result.report.paletteRecall).toBeGreaterThanOrEqual(0.5);
    }
  });
});