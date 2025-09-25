import { applyStyling } from '../../pipeline/styling';
import { readFile, writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';
import type { Layout } from '../../pipeline/layout';
import type { DesignTokens } from '../../pipeline/tokens';

// Mock data for testing
const mockLayout: Layout = {
  frame: {
    width: 1280,
    maxWidth: 1280,
    padding: 24,
  },
  grid: {
    columns: 12,
    gutter: 24,
  },
  stacks: [
    {
      id: 'main_content',
      direction: 'row',
      gap: 32,
      areas: [
        { section: 'gallery', cols: 7 },
        {
          id: 'sidebar',
          direction: 'column',
          gap: 16,
          areas: [
            { section: 'summary', cols: 5 },
            { section: 'price_cta', cols: 5, minHeight: 120 }
          ],
          align: 'stretch'
        }
      ],
      align: 'start'
    },
    {
      id: 'amenities_section',
      direction: 'column',
      gap: 24,
      areas: [{ section: 'amenities', cols: 12 }]
    }
  ],
  sections: {
    gallery: { minWidth: 400, minHeight: 300, preferredCols: 7 },
    summary: { minWidth: 300, minHeight: 200, preferredCols: 5 },
    price_cta: { minWidth: 280, minHeight: 120, preferredCols: 4 },
    amenities: { minWidth: 600, minHeight: 200, preferredCols: 12 },
    reviews: { minWidth: 600, minHeight: 300, preferredCols: 12 },
    trust_signals: { minWidth: 200, minHeight: 80, preferredCols: 3 },
    hero: { minWidth: 800, minHeight: 400, preferredCols: 12 },
    features: { minWidth: 900, minHeight: 400, preferredCols: 12 },
    testimonials: { minWidth: 800, minHeight: 300, preferredCols: 12 },
    faq: { minWidth: 600, minHeight: 400, preferredCols: 8 },
    contact: { minWidth: 400, minHeight: 300, preferredCols: 6 },
    avatar: { minWidth: 200, minHeight: 200, preferredCols: 3 },
    bio: { minWidth: 400, minHeight: 150, preferredCols: 6 },
    experience: { minWidth: 500, minHeight: 300, preferredCols: 8 },
    portfolio: { minWidth: 600, minHeight: 400, preferredCols: 9 },
    social_links: { minWidth: 300, minHeight: 60, preferredCols: 4 },
  }
};

const mockTokens: DesignTokens = {
  colors: {
    primary: ['#2563eb', '#dc2626'],
    neutral: ['#374151', '#f3f4f6'],
    semantic: {
      text: '#374151',
      background: '#ffffff'
    }
  },
  typography: {
    fontFamilies: ['Inter', 'sans-serif'],
    fontSizes: [16, 18, 24, 32],
    lineHeights: [1.4, 1.5, 1.6]
  },
  spacing: [0, 8, 16, 24, 32, 40],
  borderRadius: ['0px', '4px', '8px'],
  boxShadow: ['none', '0 1px 3px rgba(0,0,0,0.1)']
};

describe('Styling Engine', () => {
  const testRunId = 'test-styling-run';
  const testArtifactDir = join(process.cwd(), 'tests', 'fixtures', 'styling');

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
      join(testRunDir, 'layout.json'),
      JSON.stringify(mockLayout, null, 2)
    );

    await writeFile(
      join(testRunDir, 'design_tokens.json'),
      JSON.stringify(mockTokens, null, 2)
    );
  });

  describe('applyStyling', () => {
    it('should apply styling to layout components', async () => {
      const result = await applyStyling(testRunId, testArtifactDir);

      expect(result).toBeDefined();
      expect(result.runId).toBe(testRunId);
      expect(result.components).toBeDefined();
      expect(result.css).toBeDefined();
      expect(result.tailwindClasses).toBeDefined();
    });

    it('should generate styled components from layout stacks', async () => {
      const result = await applyStyling(testRunId, testArtifactDir);

      expect(result.components.length).toBe(2); // main_content and amenities_section

      // Check main content component
      const mainComponent = result.components.find(c => c.id === 'main_content');
      expect(mainComponent).toBeDefined();
      expect(mainComponent?.element).toBe('div');
      expect(mainComponent?.styles.display).toBe('flex');
      expect(mainComponent?.styles.flexDirection).toBe('row');
      expect(mainComponent?.children).toBeDefined();
      expect(mainComponent?.children?.length).toBe(2); // gallery and sidebar
    });

    it('should apply correct styles to sections', async () => {
      const result = await applyStyling(testRunId, testArtifactDir);

      const mainComponent = result.components.find(c => c.id === 'main_content');
      const gallerySection = mainComponent?.children?.find(c => 'section' in c && c.section === 'gallery');

      expect(gallerySection).toBeDefined();
      if (gallerySection && 'section' in gallerySection) {
        expect(gallerySection.section).toBe('gallery');
        expect(gallerySection.styles.gridColumn).toBe('span 7');
        expect(gallerySection.className).toContain('gallery-section');
      }
    });

    it('should generate CSS with design token variables', async () => {
      const result = await applyStyling(testRunId, testArtifactDir);

      expect(result.css).toContain(':root');
      expect(result.css).toContain('--color-primary-1');
      expect(result.css).toContain('--spacing-');
      expect(result.css).toContain('--font-family');
    });

    it('should extract relevant Tailwind classes', async () => {
      const result = await applyStyling(testRunId, testArtifactDir);

      expect(result.tailwindClasses).toContain('flex');
      expect(result.tailwindClasses.some(cls => cls.startsWith('gap-'))).toBe(true);
      expect(result.tailwindClasses.some(cls => cls.startsWith('flex-'))).toBe(true);
    });

    it('should apply appropriate backgrounds to sections', async () => {
      const result = await applyStyling(testRunId, testArtifactDir);

      const mainComponent = result.components.find(c => c.id === 'main_content');
      const sidebar = mainComponent?.children?.find(c => 'id' in c && c.id === 'sidebar');

      if (sidebar && 'children' in sidebar) {
        const priceCta = sidebar.children?.find(c => 'section' in c && c.section === 'price_cta');

        if (priceCta && 'section' in priceCta) {
          // Price CTA should get accent color
          expect(priceCta.styles.backgroundColor).toBeDefined();
        }
      }
    });

    it('should save styled components and CSS files', async () => {
      await applyStyling(testRunId, testArtifactDir);

      const styledComponentsPath = join(testArtifactDir, testRunId, 'styled_components.json');
      const stylesPath = join(testArtifactDir, testRunId, 'styles.css');

      expect(existsSync(styledComponentsPath)).toBe(true);
      expect(existsSync(stylesPath)).toBe(true);

      const styledContent = await readFile(styledComponentsPath, 'utf8');
      const styledComponents = JSON.parse(styledContent);
      expect(Array.isArray(styledComponents)).toBe(true);

      const cssContent = await readFile(stylesPath, 'utf8');
      expect(cssContent).toContain(':root');
      expect(cssContent).toContain('flex');
    });

    it('should handle nested layout stacks properly', async () => {
      const result = await applyStyling(testRunId, testArtifactDir);

      const mainComponent = result.components.find(c => c.id === 'main_content');
      const sidebar = mainComponent?.children?.find(c => 'id' in c && c.id === 'sidebar');

      expect(sidebar).toBeDefined();
      if (sidebar && 'children' in sidebar) {
        expect(sidebar.styles.flexDirection).toBe('column');
        expect(sidebar.children).toBeDefined();
        expect(sidebar.children?.length).toBe(2); // summary and price_cta
      }
    });
  });
});