import { generateCanvas } from '../../pipeline/canvas';
import { readFile, writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';
import type { StyledComponent } from '../../pipeline/styling';
import type { DesignTokens } from '../../pipeline/tokens';

// Mock styled components for testing
const mockStyledComponents: StyledComponent[] = [
  {
    id: 'hero_section',
    element: 'div',
    className: 'flex flex-col justify-center items-center gap-6 hero-section',
    styles: {
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      gap: '24px',
      backgroundColor: '#2563eb',
      padding: '32px'
    },
    children: [
      {
        id: 'hero_area',
        section: 'hero',
        element: 'section',
        className: 'hero-section section-hero',
        styles: {
          gridColumn: '1 / -1',
          backgroundColor: '#2563eb',
          padding: '32px'
        }
      }
    ]
  },
  {
    id: 'main_content',
    element: 'div',
    className: 'flex flex-row items-start gap-8 main-content',
    styles: {
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: '32px'
    },
    children: [
      {
        id: 'gallery_area',
        section: 'gallery',
        element: 'section',
        className: 'gallery-section section-gallery',
        styles: {
          gridColumn: 'span 7',
          backgroundColor: '#ffffff',
          borderRadius: '8px',
          boxShadow: 'none',
          padding: '16px'
        }
      },
      {
        id: 'sidebar',
        element: 'div',
        className: 'flex flex-col items-stretch gap-4 sidebar',
        styles: {
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'stretch',
          gap: '16px'
        },
        children: [
          {
            id: 'price_cta_area',
            section: 'price_cta',
            element: 'section',
            className: 'price-cta section-price-cta',
            styles: {
              gridColumn: 'span 5',
              minHeight: '120px',
              backgroundColor: '#f8fafc',
              borderRadius: '8px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
              padding: '16px'
            }
          }
        ]
      }
    ]
  }
];

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

describe('Vector Canvas Generator', () => {
  const testRunId = 'test-canvas-run';
  const testArtifactDir = join(process.cwd(), 'tests', 'fixtures', 'canvas');

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
      join(testRunDir, 'styled_components.json'),
      JSON.stringify(mockStyledComponents, null, 2)
    );

    await writeFile(
      join(testRunDir, 'design_tokens.json'),
      JSON.stringify(mockTokens, null, 2)
    );
  });

  describe('generateCanvas', () => {
    it('should generate canvas from styled components', async () => {
      const result = await generateCanvas(testRunId, testArtifactDir);

      expect(result).toBeDefined();
      expect(result.runId).toBe(testRunId);
      expect(result.canvas).toBeDefined();
      expect(result.svg).toBeDefined();
      expect(result.totalElements).toBeGreaterThan(0);
    });

    it('should create canvas with proper dimensions', async () => {
      const result = await generateCanvas(testRunId, testArtifactDir);

      expect(result.canvas.width).toBe(1280);
      expect(result.canvas.height).toBeGreaterThanOrEqual(1024);
      expect(result.canvas.background).toBe(mockTokens.colors.semantic.background);
    });

    it('should convert styled components to canvas groups', async () => {
      const result = await generateCanvas(testRunId, testArtifactDir);

      expect(result.canvas.elements.length).toBe(2); // hero_section and main_content
      expect(result.canvas.elements[0]).toHaveProperty('id', 'hero_section');
      expect(result.canvas.elements[1]).toHaveProperty('id', 'main_content');
    });

    it('should generate groups with proper children structure', async () => {
      const result = await generateCanvas(testRunId, testArtifactDir);

      const heroSection = result.canvas.elements.find(e => e.id === 'hero_section');
      expect(heroSection).toBeDefined();
      if (heroSection && 'children' in heroSection) {
        expect(heroSection.children.length).toBeGreaterThan(0);
      }

      const mainContent = result.canvas.elements.find(e => e.id === 'main_content');
      expect(mainContent).toBeDefined();
      if (mainContent && 'children' in mainContent) {
        expect(mainContent.children.length).toBe(2); // gallery and sidebar
      }
    });

    it('should add section-specific visual content', async () => {
      const result = await generateCanvas(testRunId, testArtifactDir);

      const mainContent = result.canvas.elements.find(e => e.id === 'main_content');
      if (mainContent && 'children' in mainContent) {
        const gallerySection = mainContent.children.find(c => c.id === 'gallery_area');
        expect(gallerySection).toBeDefined();

        if (gallerySection && 'children' in gallerySection) {
          // Should have gallery images and text
          const hasImageElements = gallerySection.children.some(child =>
            child.id.includes('image') || ('text' in child && child.text.includes('Image'))
          );
          expect(hasImageElements).toBe(true);
        }
      }
    });

    it('should generate valid SVG output', async () => {
      const result = await generateCanvas(testRunId, testArtifactDir);

      expect(result.svg).toContain('<svg');
      expect(result.svg).toContain('xmlns="http://www.w3.org/2000/svg"');
      expect(result.svg).toContain(`width="${result.canvas.width}"`);
      expect(result.svg).toContain(`height="${result.canvas.height}"`);
      expect(result.svg).toContain('</svg>');
    });

    it('should include background rectangle in SVG', async () => {
      const result = await generateCanvas(testRunId, testArtifactDir);

      expect(result.svg).toContain('<rect width="100%" height="100%"');
      expect(result.svg).toContain(`fill="${mockTokens.colors.semantic.background}"`);
    });

    it('should handle hero section content', async () => {
      const result = await generateCanvas(testRunId, testArtifactDir);

      // Should contain hero elements like title and button
      expect(result.svg).toContain('Welcome');
      expect(result.svg).toContain('Get Started');
      expect(result.svg).toContain('font-weight="bold"');
    });

    it('should handle gallery section content', async () => {
      const result = await generateCanvas(testRunId, testArtifactDir);

      // Should contain image placeholders
      expect(result.svg).toContain('Image 1');
      expect(result.svg).toContain('Image 2');
      expect(result.svg).toContain('Image 3');
    });

    it('should handle price CTA section content', async () => {
      const result = await generateCanvas(testRunId, testArtifactDir);

      // Should contain price and CTA elements
      expect(result.svg).toContain('$299');
      expect(result.svg).toContain('/night');
      expect(result.svg).toContain('Book Now');
    });

    it('should calculate correct total element count', async () => {
      const result = await generateCanvas(testRunId, testArtifactDir);

      expect(result.totalElements).toBeGreaterThan(20); // Should have many nested elements
    });

    it('should save canvas and SVG files', async () => {
      await generateCanvas(testRunId, testArtifactDir);

      const canvasPath = join(testArtifactDir, testRunId, 'canvas.json');
      const svgPath = join(testArtifactDir, testRunId, 'design.svg');

      expect(existsSync(canvasPath)).toBe(true);
      expect(existsSync(svgPath)).toBe(true);

      // Verify content of generated files
      const canvasContent = await readFile(canvasPath, 'utf8');
      const canvasData = JSON.parse(canvasContent);
      expect(canvasData.width).toBe(1280);
      expect(canvasData.elements).toBeDefined();

      const svgContent = await readFile(svgPath, 'utf8');
      expect(svgContent).toContain('<svg');
      expect(svgContent).toContain('</svg>');
    });

    it('should handle nested layout structures', async () => {
      const result = await generateCanvas(testRunId, testArtifactDir);

      const mainContent = result.canvas.elements.find(e => e.id === 'main_content');
      if (mainContent && 'children' in mainContent) {
        // Should have sidebar as nested group
        const sidebar = mainContent.children.find(c => c.id === 'sidebar');
        expect(sidebar).toBeDefined();

        if (sidebar && 'children' in sidebar) {
          // Sidebar should have price_cta section
          const priceCTA = sidebar.children.find(c => c.id === 'price_cta_area');
          expect(priceCTA).toBeDefined();
        }
      }
    });

    it('should apply design tokens correctly', async () => {
      const result = await generateCanvas(testRunId, testArtifactDir);

      expect(result.canvas.background).toBe(mockTokens.colors.semantic.background);

      // Should use primary color from design tokens
      const heroElements = result.canvas.elements.find(e => e.id === 'hero_section');
      if (heroElements && 'children' in heroElements) {
        const backgroundRect = heroElements.children.find(c => 'fill' in c && c.fill === '#2563eb');
        expect(backgroundRect).toBeDefined();
      }
    });
  });
});