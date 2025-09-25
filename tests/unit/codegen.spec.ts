import { generateCode } from '../../pipeline/codegen';
import { readFile, writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';
import type { StyledComponent } from '../../pipeline/styling';

// Mock styled components for testing
const mockStyledComponents: StyledComponent[] = [
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
          borderRadius: '4px',
          boxShadow: 'none',
          padding: '24px'
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
            id: 'summary_area',
            section: 'summary',
            element: 'section',
            className: 'summary-section section-summary',
            styles: {
              gridColumn: 'span 5',
              backgroundColor: '#f8fafc',
              borderRadius: '4px',
              boxShadow: 'none',
              padding: '24px'
            }
          }
        ]
      }
    ]
  },
  {
    id: 'hero_section',
    element: 'div',
    className: 'flex flex-col justify-center items-center gap-6 hero-section',
    styles: {
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      gap: '24px'
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
  }
];

describe('Code Generator', () => {
  const testRunId = 'test-codegen-run';
  const testArtifactDir = join(process.cwd(), 'tests', 'fixtures', 'codegen');

  beforeAll(async () => {
    // Create test artifact directory
    if (!existsSync(testArtifactDir)) {
      await mkdir(testArtifactDir, { recursive: true });
    }

    const testRunDir = join(testArtifactDir, testRunId);
    if (!existsSync(testRunDir)) {
      await mkdir(testRunDir, { recursive: true });
    }

    // Write test styled components fixture
    await writeFile(
      join(testRunDir, 'styled_components.json'),
      JSON.stringify(mockStyledComponents, null, 2)
    );
  });

  describe('generateCode', () => {
    it('should generate React components from styled components', async () => {
      const result = await generateCode(testRunId, testArtifactDir);

      expect(result).toBeDefined();
      expect(result.runId).toBe(testRunId);
      expect(result.components).toBeDefined();
      expect(result.indexFile).toBeDefined();
      expect(result.totalLines).toBeGreaterThan(0);
    });

    it('should create the correct number of components', async () => {
      const result = await generateCode(testRunId, testArtifactDir);

      expect(result.components.length).toBe(2); // MainContent and HeroSection
      expect(result.components.map(c => c.name)).toContain('MainContent');
      expect(result.components.map(c => c.name)).toContain('HeroSection');
    });

    it('should generate valid React component code', async () => {
      const result = await generateCode(testRunId, testArtifactDir);

      const mainContentComponent = result.components.find(c => c.name === 'MainContent');
      expect(mainContentComponent).toBeDefined();

      if (mainContentComponent) {
        expect(mainContentComponent.code).toContain('import React from \'react\';');
        expect(mainContentComponent.code).toContain('export interface MainContentProps');
        expect(mainContentComponent.code).toContain('export const MainContent: React.FC<MainContentProps>');
        expect(mainContentComponent.code).toContain('export default MainContent;');
      }
    });

    it('should generate components with correct TypeScript types', async () => {
      const result = await generateCode(testRunId, testArtifactDir);

      const component = result.components[0];
      expect(component.exports).toContain(component.name);
      expect(component.exports).toContain(`${component.name}Props`);
    });

    it('should include section content templates', async () => {
      const result = await generateCode(testRunId, testArtifactDir);

      const mainContentComponent = result.components.find(c => c.name === 'MainContent');
      expect(mainContentComponent).toBeDefined();

      if (mainContentComponent) {
        // Should contain gallery section content
        expect(mainContentComponent.code).toContain('grid grid-cols-2 md:grid-cols-3');
        expect(mainContentComponent.code).toContain('Image 1');

        // Should contain summary section content
        expect(mainContentComponent.code).toContain('Property Summary');
        expect(mainContentComponent.code).toContain('Beautiful modern property');
      }
    });

    it('should generate proper JSX structure', async () => {
      const result = await generateCode(testRunId, testArtifactDir);

      const heroComponent = result.components.find(c => c.name === 'HeroSection');
      expect(heroComponent).toBeDefined();

      if (heroComponent) {
        expect(heroComponent.code).toContain('<div className="flex flex-col justify-center items-center gap-6 hero-section"');
        expect(heroComponent.code).toContain('<section className="hero-section section-hero"');
        expect(heroComponent.code).toContain('Welcome');
      }
    });

    it('should generate an index file with exports', async () => {
      const result = await generateCode(testRunId, testArtifactDir);

      expect(result.indexFile).toContain('export { MainContent, type MainContentProps }');
      expect(result.indexFile).toContain('export { HeroSection, type HeroSectionProps }');
      expect(result.indexFile).toContain('export default {');
      expect(result.indexFile).toContain('MainContent,');
      expect(result.indexFile).toContain('HeroSection');
    });

    it('should save component files to the file system', async () => {
      await generateCode(testRunId, testArtifactDir);

      const componentsDir = join(testArtifactDir, testRunId, 'components');
      expect(existsSync(componentsDir)).toBe(true);

      const indexPath = join(componentsDir, 'index.ts');
      expect(existsSync(indexPath)).toBe(true);

      const mainContentPath = join(componentsDir, 'MainContent.tsx');
      expect(existsSync(mainContentPath)).toBe(true);

      const heroSectionPath = join(componentsDir, 'HeroSection.tsx');
      expect(existsSync(heroSectionPath)).toBe(true);

      // Verify content of generated files
      const mainContentCode = await readFile(mainContentPath, 'utf8');
      expect(mainContentCode).toContain('export const MainContent');

      const indexContent = await readFile(indexPath, 'utf8');
      expect(indexContent).toContain('Generated component exports');
    });

    it('should handle nested components properly', async () => {
      const result = await generateCode(testRunId, testArtifactDir);

      const mainContentComponent = result.components.find(c => c.name === 'MainContent');
      expect(mainContentComponent).toBeDefined();

      if (mainContentComponent) {
        // Should contain nested sidebar div
        expect(mainContentComponent.code).toContain('flex flex-col items-stretch gap-4 sidebar');

        // Should contain nested sections
        expect(mainContentComponent.code).toContain('gallery-section section-gallery');
        expect(mainContentComponent.code).toContain('summary-section section-summary');
      }
    });

    it('should generate inline styles correctly', async () => {
      const result = await generateCode(testRunId, testArtifactDir);

      const component = result.components.find(c => c.name === 'MainContent');
      expect(component).toBeDefined();

      if (component) {
        expect(component.code).toContain('display: \'flex\'');
        expect(component.code).toContain('flexDirection: \'row\'');
        expect(component.code).toContain('gap: \'32px\'');
      }
    });
  });
});