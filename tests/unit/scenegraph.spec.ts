import { buildSceneGraph } from '../../pipeline/scenegraph';
import { readFile, writeFile, mkdir, rm } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import type { ComputedStyleNode } from '../../pipeline/capture';

describe('Scenegraph Module', () => {
  const testRunId = 'test-scenegraph-run';
  const testArtifactsDir = join(process.cwd(), 'test-artifacts');

  beforeEach(async () => {
    // Create test artifacts
    await mkdir(join(testArtifactsDir, testRunId, 'raw'), { recursive: true });

    // Create mock HTML structure
    const mockHTML = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Test Page</title>
      </head>
      <body>
        <header class="header">
          <h1>AI Design Partner</h1>
          <p>Generate beautiful designs</p>
        </header>
        <main class="main">
          <section class="hero">
            <div class="hero-content">
              <h2>Transform Any Website</h2>
              <p>Our AI analyzes existing designs</p>
              <button class="cta-button">Get Started</button>
            </div>
          </section>
          <section class="features">
            <div class="feature-card">
              <h3>Style Analysis</h3>
              <p>Extract design tokens</p>
            </div>
            <div class="feature-card">
              <h3>Fast Generation</h3>
              <p>Generate components quickly</p>
            </div>
          </section>
        </main>
        <footer class="footer">
          <p>© 2025 AI Design Partner</p>
        </footer>
      </body>
      </html>
    `;

    // Create mock computed styles
    const mockStyles: ComputedStyleNode[] = [
      {
        id: 'node_0',
        tag: 'header',
        bbox: { x: 0, y: 0, w: 1280, h: 100 },
        styles: {
          color: '#ffffff',
          backgroundColor: '#667eea',
          fontFamily: 'system-ui, sans-serif',
          fontSize: '18px',
          lineHeight: '1.6',
          borderRadius: '0px',
          boxShadow: 'none',
          margin: '0px',
          padding: '24px 0px',
        },
        className: 'header',
        textContent: 'AI Design Partner Generate beautiful designs'
      },
      {
        id: 'node_1',
        tag: 'h1',
        bbox: { x: 24, y: 24, w: 400, h: 40 },
        styles: {
          color: '#ffffff',
          backgroundColor: 'transparent',
          fontFamily: 'system-ui, sans-serif',
          fontSize: '32px',
          lineHeight: '1.2',
          borderRadius: '0px',
          boxShadow: 'none',
          margin: '0px 0px 8px 0px',
          padding: '0px',
        },
        textContent: 'AI Design Partner'
      },
      {
        id: 'node_2',
        tag: 'section',
        bbox: { x: 0, y: 100, w: 1280, h: 400 },
        styles: {
          color: '#1a202c',
          backgroundColor: '#f8fafc',
          fontFamily: 'system-ui, sans-serif',
          fontSize: '16px',
          lineHeight: '1.6',
          borderRadius: '0px',
          boxShadow: 'none',
          margin: '0px',
          padding: '64px 0px',
        },
        className: 'hero',
        textContent: 'Transform Any Website Our AI analyzes existing designs Get Started'
      },
      {
        id: 'node_3',
        tag: 'button',
        bbox: { x: 24, y: 400, w: 120, h: 44 },
        styles: {
          color: '#ffffff',
          backgroundColor: '#4299e1',
          fontFamily: 'system-ui, sans-serif',
          fontSize: '16px',
          lineHeight: '1.5',
          borderRadius: '8px',
          boxShadow: '0 4px 14px 0 rgba(66, 153, 225, 0.39)',
          margin: '32px 0px 0px 0px',
          padding: '12px 24px',
        },
        className: 'cta-button',
        textContent: 'Get Started'
      },
      {
        id: 'node_4',
        tag: 'div',
        bbox: { x: 24, y: 500, w: 300, h: 200 },
        styles: {
          color: '#2d3748',
          backgroundColor: '#ffffff',
          fontFamily: 'system-ui, sans-serif',
          fontSize: '16px',
          lineHeight: '1.6',
          borderRadius: '12px',
          boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)',
          margin: '0px',
          padding: '32px',
        },
        className: 'feature-card',
        textContent: 'Style Analysis Extract design tokens'
      }
    ];

    await Promise.all([
      writeFile(join(testArtifactsDir, testRunId, 'raw', 'dom.html'), mockHTML, 'utf8'),
      writeFile(join(testArtifactsDir, testRunId, 'raw', 'computed_styles.json'), JSON.stringify(mockStyles, null, 2), 'utf8'),
    ]);
  });

  afterEach(async () => {
    if (existsSync(testArtifactsDir)) {
      await rm(testArtifactsDir, { recursive: true });
    }
  });

  it('should build scene graph from DOM and styles', async () => {
    const result = await buildSceneGraph(testRunId, testArtifactsDir);

    expect(result.runId).toBe(testRunId);
    expect(result.scenegraph).toBeDefined();

    // Check root node
    expect(result.scenegraph.root).toBeDefined();
    expect(result.scenegraph.root.type).toBe('container');

    // Check metrics
    expect(result.scenegraph.totalNodes).toBeGreaterThan(0);
    expect(result.scenegraph.wrapperReduction).toBeGreaterThanOrEqual(0);
    expect(result.scenegraph.readingOrder).toBeInstanceOf(Array);
  });

  it('should assign meaningful roles to elements', async () => {
    const result = await buildSceneGraph(testRunId, testArtifactsDir);

    function findNodeByRole(node: any, role: string): any {
      if (node.role === role) return node;
      for (const child of node.children || []) {
        const found = findNodeByRole(child, role);
        if (found) return found;
      }
      return null;
    }

    // Should identify semantic roles
    const headerNode = findNodeByRole(result.scenegraph.root, 'Header');
    const heroNode = findNodeByRole(result.scenegraph.root, 'Hero');

    expect(headerNode).toBeDefined();
    expect(heroNode).toBeDefined();
  });

  it('should reduce wrapper elements', async () => {
    const result = await buildSceneGraph(testRunId, testArtifactsDir);

    // Should have fewer nodes than the original DOM due to wrapper reduction
    expect(result.scenegraph.totalNodes).toBeLessThan(5); // Original had 5 computed nodes
    expect(result.scenegraph.wrapperReduction).toBeGreaterThan(0);
  });

  it('should snap bounding boxes to 8px grid', async () => {
    const result = await buildSceneGraph(testRunId, testArtifactsDir);

    function checkGridAlignment(node: any) {
      expect(node.bbox.x % 8).toBe(0);
      expect(node.bbox.y % 8).toBe(0);
      expect(node.bbox.w % 8).toBe(0);
      expect(node.bbox.h % 8).toBe(0);

      node.children?.forEach(checkGridAlignment);
    }

    checkGridAlignment(result.scenegraph.root);
  });

  it('should generate reading order', async () => {
    const result = await buildSceneGraph(testRunId, testArtifactsDir);

    expect(result.scenegraph.readingOrder).toBeInstanceOf(Array);
    expect(result.scenegraph.readingOrder.length).toBeGreaterThan(0);
  });

  it('should save scenegraph artifact', async () => {
    await buildSceneGraph(testRunId, testArtifactsDir);

    const scenegraphPath = join(testArtifactsDir, testRunId, 'scenegraph.json');
    expect(existsSync(scenegraphPath)).toBe(true);

    const scenegraphContent = await readFile(scenegraphPath, 'utf8');
    const scenegraph = JSON.parse(scenegraphContent);

    expect(scenegraph.root).toBeDefined();
    expect(scenegraph.totalNodes).toBeGreaterThan(0);
    expect(scenegraph.wrapperReduction).toBeGreaterThanOrEqual(0);
  });

  it('should preserve meaningful styling information', async () => {
    const result = await buildSceneGraph(testRunId, testArtifactsDir);

    function findStyledNode(node: any): any {
      if (node.styles.backgroundColor || node.styles.borderRadius || node.styles.boxShadow) {
        return node;
      }
      for (const child of node.children || []) {
        const found = findStyledNode(child);
        if (found) return found;
      }
      return null;
    }

    const styledNode = findStyledNode(result.scenegraph.root);
    expect(styledNode).toBeDefined();
  });
});