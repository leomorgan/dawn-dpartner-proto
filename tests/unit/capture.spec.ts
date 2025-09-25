import { capture } from '../../pipeline/capture';
import { readFile, rm } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';

describe('Capture Module', () => {
  const testUrl = 'https://example.com';
  let runId: string;

  afterEach(async () => {
    if (runId && existsSync(join(process.cwd(), 'artifacts', runId))) {
      await rm(join(process.cwd(), 'artifacts', runId), { recursive: true });
    }
  });

  it('should capture a website and extract required data', async () => {
    const result = await capture(testUrl);
    runId = result.runId;

    // Check runId format (timestamp_uuid)
    expect(result.runId).toMatch(/\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z_[a-f0-9]{8}/);

    // Check artifacts structure
    expect(result.artifacts.html).toBeTruthy();
    expect(result.artifacts.styles).toBeInstanceOf(Array);
    expect(result.artifacts.screenshot).toBeTruthy();
    expect(result.artifacts.meta).toBeTruthy();

    // Check metadata
    expect(result.artifacts.meta.url).toBe(testUrl);
    expect(result.artifacts.meta.title).toBeTruthy();
    expect(result.artifacts.meta.timestamp).toBeTruthy();
    expect(result.artifacts.meta.userAgent).toBeTruthy();
    expect(result.artifacts.meta.viewport).toEqual({ width: 1280, height: 720 });

    // Check styles array has visible elements
    expect(result.artifacts.styles.length).toBeGreaterThan(0);

    // Check first style node structure
    const firstNode = result.artifacts.styles[0];
    expect(firstNode.id).toMatch(/^node_\d+$/);
    expect(firstNode.tag).toBeTruthy();
    expect(firstNode.bbox.w).toBeGreaterThan(0);
    expect(firstNode.bbox.h).toBeGreaterThan(0);
    expect(firstNode.styles.fontFamily).toBeTruthy();
    expect(firstNode.styles.fontSize).toBeTruthy();
    expect(firstNode.styles.color).toBeTruthy();
  }, 30000);

  it('should save all required files to disk', async () => {
    const result = await capture(testUrl);
    runId = result.runId;

    const artifactDir = join(process.cwd(), 'artifacts', runId, 'raw');

    // Check all files exist
    expect(existsSync(join(artifactDir, 'dom.html'))).toBe(true);
    expect(existsSync(join(artifactDir, 'computed_styles.json'))).toBe(true);
    expect(existsSync(join(artifactDir, 'meta.json'))).toBe(true);
    expect(existsSync(join(artifactDir, 'page.png'))).toBe(true);

    // Check file contents
    const htmlContent = await readFile(join(artifactDir, 'dom.html'), 'utf8');
    const stylesContent = await readFile(join(artifactDir, 'computed_styles.json'), 'utf8');
    const metaContent = await readFile(join(artifactDir, 'meta.json'), 'utf8');

    expect(htmlContent.length).toBeGreaterThan(100);
    expect(JSON.parse(stylesContent)).toBeInstanceOf(Array);
    expect(JSON.parse(metaContent).url).toBe(testUrl);
  }, 30000);

  it('should filter out invisible elements', async () => {
    const result = await capture(testUrl);
    runId = result.runId;

    // All captured elements should have positive dimensions
    result.artifacts.styles.forEach(node => {
      expect(node.bbox.w).toBeGreaterThan(0);
      expect(node.bbox.h).toBeGreaterThan(0);
    });
  }, 30000);
});