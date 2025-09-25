import { synthesizeLayout } from '../../pipeline/layout';
import { readFile, writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';
import type { Intent } from '../../pipeline/intent';
import type { DesignTokens } from '../../pipeline/tokens';

// Mock data for testing
const mockIntent: Intent = {
  page_type: 'detail',
  primary_entity: 'property',
  required_sections: ['gallery', 'summary', 'price_cta', 'amenities', 'reviews'],
  priority_order: ['hero', 'price_cta', 'gallery', 'trust_signals', 'amenities'],
  confidence: 0.95,
  reasoning: 'Property detail page needs visual gallery, pricing, and trust elements'
};

const mockTokens: DesignTokens = {
  colors: {
    primary: [
      { hex: '#2563eb', usage: 'primary', area: 1000 },
      { hex: '#dc2626', usage: 'accent', area: 500 }
    ],
    neutral: [
      { hex: '#374151', usage: 'text', area: 2000 },
      { hex: '#f3f4f6', usage: 'background', area: 3000 }
    ]
  },
  typography: {
    families: ['Inter', 'sans-serif'],
    sizes: [16, 18, 24, 32],
    lineHeights: [1.4, 1.5, 1.6]
  },
  spacing: [0, 8, 16, 24, 32, 40],
  borderRadius: [0, 4, 8],
  boxShadow: ['none', '0 1px 3px rgba(0,0,0,0.1)'],
  contrast: {
    ratios: [
      { color1: '#2563eb', color2: '#ffffff', ratio: 4.5, passes: { aa: true, aaa: false } }
    ],
    analysis: 'Good contrast overall'
  }
};

describe('Layout Synthesizer', () => {
  const testRunId = 'test-layout-run';
  const testArtifactDir = join(process.cwd(), 'tests', 'fixtures', 'layout');

  beforeAll(async () => {
    // Create test artifact directory
    if (!existsSync(testArtifactDir)) {
      await mkdir(testArtifactDir, { recursive: true });
    }

    const testRunDir = join(testArtifactDir, testRunId);
    if (!existsSync(testRunDir)) {
      await mkdir(testRunDir, { recursive: true });
    }

    // Write test fixtures
    await writeFile(
      join(testRunDir, 'intent.json'),
      JSON.stringify(mockIntent, null, 2)
    );

    await writeFile(
      join(testRunDir, 'design_tokens.json'),
      JSON.stringify(mockTokens, null, 2)
    );
  });

  describe('synthesizeLayout', () => {
    it('should synthesize a layout from intent and tokens', async () => {
      const result = await synthesizeLayout(testRunId, testArtifactDir);

      expect(result).toBeDefined();
      expect(result.runId).toBe(testRunId);
      expect(result.layout).toBeDefined();
      expect(result.sections).toEqual(mockIntent.required_sections);
      expect(result.constraints).toBeDefined();
    });

    it('should create a proper detail page layout', async () => {
      const result = await synthesizeLayout(testRunId, testArtifactDir);

      expect(result.layout.stacks).toBeDefined();
      expect(result.layout.stacks.length).toBeGreaterThan(0);

      // Should have main content stack with gallery and sidebar
      const mainContentStack = result.layout.stacks.find(s => s.id === 'main_content');
      expect(mainContentStack).toBeDefined();
      expect(mainContentStack?.direction).toBe('row');

      // Should have proper frame and grid settings
      expect(result.layout.frame.width).toBe(1280);
      expect(result.layout.grid.columns).toBe(12);
    });

    it('should validate constraints properly', async () => {
      const result = await synthesizeLayout(testRunId, testArtifactDir);

      expect(result.constraints.satisfied).toBeDefined();
      expect(result.constraints.total).toBeDefined();
      expect(result.constraints.violations).toBeDefined();
      expect(Array.isArray(result.constraints.violations)).toBe(true);

      // Should satisfy section requirements
      expect(result.constraints.satisfied).toBeGreaterThan(0);
    });

    it('should save layout.json to artifacts', async () => {
      await synthesizeLayout(testRunId, testArtifactDir);

      const layoutPath = join(testArtifactDir, testRunId, 'layout.json');
      expect(existsSync(layoutPath)).toBe(true);

      const layoutContent = await readFile(layoutPath, 'utf8');
      const layout = JSON.parse(layoutContent);
      expect(layout.frame).toBeDefined();
      expect(layout.stacks).toBeDefined();
    });

    it('should handle different page types', async () => {
      // Create list page intent
      const listIntent: Intent = {
        ...mockIntent,
        page_type: 'list',
        required_sections: ['hero', 'features', 'testimonials']
      };

      const listRunId = 'test-list-run';
      const listRunDir = join(testArtifactDir, listRunId);
      await mkdir(listRunDir, { recursive: true });

      await writeFile(
        join(listRunDir, 'intent.json'),
        JSON.stringify(listIntent, null, 2)
      );

      await writeFile(
        join(listRunDir, 'design_tokens.json'),
        JSON.stringify(mockTokens, null, 2)
      );

      const result = await synthesizeLayout(listRunId, testArtifactDir);

      // Should use list template
      const featuresSection = result.layout.stacks.find(s => s.id === 'features_section');
      expect(featuresSection).toBeDefined();
    });

    it('should adjust gaps based on design tokens', async () => {
      const result = await synthesizeLayout(testRunId, testArtifactDir);

      // All gaps should be from design token spacing scale
      for (const stack of result.layout.stacks) {
        expect(mockTokens.spacing).toContain(stack.gap);
      }
    });
  });
});