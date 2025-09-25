import { parseIntent } from '../../pipeline/intent';
import { readFile, writeFile, mkdir, rm } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';

describe('Intent Module', () => {
  const testRunId = 'test-intent-run';
  const testArtifactsDir = join(process.cwd(), 'test-artifacts');

  beforeEach(async () => {
    // Create test artifacts directory
    await mkdir(join(testArtifactsDir, testRunId), { recursive: true });

    // Create mock scenegraph (optional for intent parsing)
    const mockScenegraph = {
      root: {
        id: 'root',
        type: 'container' as const,
        role: 'Container',
        bbox: { x: 0, y: 0, w: 1280, h: 800 },
        children: [
          {
            id: 'header',
            type: 'container' as const,
            role: 'Header',
            bbox: { x: 0, y: 0, w: 1280, h: 100 },
            children: [],
            styles: {},
            metadata: { tag: 'header' }
          },
          {
            id: 'hero',
            type: 'container' as const,
            role: 'Hero',
            bbox: { x: 0, y: 100, w: 1280, h: 400 },
            children: [],
            styles: {},
            metadata: { tag: 'section' }
          }
        ],
        styles: {},
        metadata: { tag: 'body' }
      },
      totalNodes: 3,
      wrapperReduction: 0,
      readingOrder: ['header', 'hero']
    };

    await writeFile(
      join(testArtifactsDir, testRunId, 'scenegraph.json'),
      JSON.stringify(mockScenegraph, null, 2)
    );
  });

  afterEach(async () => {
    if (existsSync(testArtifactsDir)) {
      await rm(testArtifactsDir, { recursive: true });
    }
  });

  describe('Mock Provider', () => {
    it('should parse property detail page intent', async () => {
      const result = await parseIntent(
        'create a property detail page',
        testRunId,
        testArtifactsDir,
        'mock'
      );

      expect(result.runId).toBe(testRunId);
      expect(result.provider).toBe('mock');
      expect(result.intent.page_type).toBe('detail');
      expect(result.intent.primary_entity).toBe('property');
      expect(result.intent.required_sections).toContain('gallery');
      expect(result.intent.required_sections).toContain('price_cta');
      expect(result.intent.confidence).toBeGreaterThan(0.9);
    });

    it('should parse user profile page intent', async () => {
      const result = await parseIntent(
        'create a user profile page',
        testRunId,
        testArtifactsDir,
        'mock'
      );

      expect(result.intent.page_type).toBe('profile');
      expect(result.intent.primary_entity).toBe('person');
      expect(result.intent.required_sections).toContain('avatar');
      expect(result.intent.required_sections).toContain('bio');
      expect(result.intent.required_sections).toContain('portfolio');
    });

    it('should parse listing page intent', async () => {
      const result = await parseIntent(
        'create a listing page',
        testRunId,
        testArtifactsDir,
        'mock'
      );

      expect(result.intent.page_type).toBe('list');
      expect(result.intent.primary_entity).toBe('items');
      expect(result.intent.required_sections).toContain('hero');
      expect(result.intent.required_sections).toContain('features');
    });

    it('should handle fuzzy matching for product detail', async () => {
      const result = await parseIntent(
        'I need a product page',
        testRunId,
        testArtifactsDir,
        'mock'
      );

      expect(result.intent.page_type).toBe('detail');
      expect(result.intent.primary_entity).toBe('property');
    });

    it('should provide fallback for unknown prompts', async () => {
      const result = await parseIntent(
        'something completely random',
        testRunId,
        testArtifactsDir,
        'mock'
      );

      expect(result.intent.page_type).toBe('detail');
      expect(result.intent.primary_entity).toBe('item');
      expect(result.intent.confidence).toBeLessThan(0.7);
      expect(result.intent.reasoning).toContain('could not determine specific intent');
    });
  });

  describe('Intent Validation', () => {
    it('should save intent artifact to disk', async () => {
      await parseIntent(
        'create a property detail page',
        testRunId,
        testArtifactsDir,
        'mock'
      );

      const intentPath = join(testArtifactsDir, testRunId, 'intent.json');
      expect(existsSync(intentPath)).toBe(true);

      const intentContent = await readFile(intentPath, 'utf8');
      const intent = JSON.parse(intentContent);

      expect(intent.page_type).toBeDefined();
      expect(intent.primary_entity).toBeDefined();
      expect(intent.required_sections).toBeInstanceOf(Array);
      expect(intent.priority_order).toBeInstanceOf(Array);
      expect(intent.confidence).toBeGreaterThan(0);
      expect(intent.reasoning).toBeDefined();
    });

    it('should validate page types', async () => {
      // Test would validate that invalid page types get corrected
      const result = await parseIntent(
        'create a property detail page',
        testRunId,
        testArtifactsDir,
        'mock'
      );

      expect(['detail', 'list', 'profile']).toContain(result.intent.page_type);
    });

    it('should validate sections are from allowed list', async () => {
      const result = await parseIntent(
        'create a property detail page',
        testRunId,
        testArtifactsDir,
        'mock'
      );

      const allowedSections = ['gallery', 'summary', 'price_cta', 'amenities', 'reviews', 'trust_signals', 'hero', 'features', 'testimonials', 'faq', 'contact', 'avatar', 'bio', 'experience', 'portfolio', 'social_links'];

      result.intent.required_sections.forEach(section => {
        expect(allowedSections).toContain(section);
      });

      result.intent.priority_order.forEach(section => {
        expect(allowedSections).toContain(section);
      });
    });

    it('should ensure confidence is between 0 and 1', async () => {
      const result = await parseIntent(
        'create a property detail page',
        testRunId,
        testArtifactsDir,
        'mock'
      );

      expect(result.intent.confidence).toBeGreaterThanOrEqual(0);
      expect(result.intent.confidence).toBeLessThanOrEqual(1);
    });

    it('should provide defaults for empty sections', async () => {
      const result = await parseIntent(
        'create a property detail page',
        testRunId,
        testArtifactsDir,
        'mock'
      );

      expect(result.intent.required_sections.length).toBeGreaterThan(0);
      expect(result.intent.priority_order.length).toBeGreaterThan(0);
    });
  });

  describe('Scenegraph Context', () => {
    it('should work without scenegraph file', async () => {
      // Remove scenegraph file
      await rm(join(testArtifactsDir, testRunId, 'scenegraph.json'), { force: true });

      const result = await parseIntent(
        'create a property detail page',
        testRunId,
        testArtifactsDir,
        'mock'
      );

      expect(result.intent).toBeDefined();
      expect(result.intent.page_type).toBe('detail');
    });

    it('should handle malformed scenegraph gracefully', async () => {
      // Write invalid JSON
      await writeFile(
        join(testArtifactsDir, testRunId, 'scenegraph.json'),
        'invalid json'
      );

      const result = await parseIntent(
        'create a property detail page',
        testRunId,
        testArtifactsDir,
        'mock'
      );

      expect(result.intent).toBeDefined();
      expect(result.intent.page_type).toBe('detail');
    });
  });
});