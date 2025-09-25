import { PipelineOrchestrator, executeFullPipeline } from '../../pipeline/orchestration';

// Mock all the pipeline modules
jest.mock('../../pipeline/capture', () => ({
  capture: jest.fn().mockResolvedValue({
    runId: 'test-run',
    artifacts: {
      html: '<div>test</div>',
      styles: [],
      screenshot: 'screenshot.png',
      meta: { url: 'http://test.com', timestamp: '2023-01-01' }
    }
  })
}));

jest.mock('../../pipeline/tokens', () => ({
  extractTokens: jest.fn().mockResolvedValue({
    runId: 'test-run',
    tokens: {
      colors: { primary: ['#000'], neutral: ['#fff'] },
      typography: { fontFamilies: ['Arial'], fontSizes: [16], lineHeights: [1.4] },
      spacing: [0, 8, 16],
      borderRadius: ['0px', '4px'],
      boxShadow: ['none']
    },
    report: { tokenCoverage: 85, paletteRecall: 90 }
  })
}));

jest.mock('../../pipeline/scenegraph', () => ({
  buildSceneGraph: jest.fn().mockResolvedValue({
    runId: 'test-run',
    nodes: [
      { id: 'node1', role: 'Header', type: 'container' },
      { id: 'node2', role: 'Section', type: 'container' }
    ],
    rootId: 'node1'
  })
}));

jest.mock('../../pipeline/intent', () => ({
  parseIntent: jest.fn().mockResolvedValue({
    runId: 'test-run',
    intent: {
      page_type: 'detail',
      primary_entity: 'property',
      required_sections: ['gallery', 'summary'],
      confidence: 0.95
    },
    provider: 'mock'
  })
}));

jest.mock('../../pipeline/layout', () => ({
  synthesizeLayout: jest.fn().mockResolvedValue({
    runId: 'test-run',
    layout: {
      frame: { width: 1280, maxWidth: 1280, padding: 24 },
      grid: { columns: 12, gutter: 24 },
      stacks: []
    },
    sections: ['gallery', 'summary'],
    constraints: { satisfied: 10, total: 10, violations: [] }
  })
}));

jest.mock('../../pipeline/styling', () => ({
  applyStyling: jest.fn().mockResolvedValue({
    runId: 'test-run',
    components: [
      { id: 'main', element: 'div', className: 'main', styles: {} }
    ],
    css: '.main { display: flex; }',
    tailwindClasses: ['flex']
  })
}));

jest.mock('../../pipeline/codegen', () => ({
  generateCode: jest.fn().mockResolvedValue({
    runId: 'test-run',
    components: [
      { name: 'MainComponent', filename: 'MainComponent.tsx', code: 'code', imports: [], exports: [] }
    ],
    indexFile: 'export * from "./MainComponent"',
    totalLines: 50
  })
}));

jest.mock('../../pipeline/canvas', () => ({
  generateCanvas: jest.fn().mockResolvedValue({
    runId: 'test-run',
    canvas: {
      width: 1280,
      height: 1140,
      background: '#ffffff',
      elements: []
    },
    svg: '<svg></svg>',
    totalElements: 25
  })
}));

describe('Pipeline Orchestration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('PipelineOrchestrator', () => {
    it('should create orchestrator with default config', () => {
      const orchestrator = new PipelineOrchestrator();
      expect(orchestrator).toBeDefined();
    });

    it('should execute all pipeline steps in sequence', async () => {
      const orchestrator = new PipelineOrchestrator({ enableDebug: false });

      const result = await orchestrator.execute('http://test.com', 'create a test page');

      expect(result).toBeDefined();
      expect(result.url).toBe('http://test.com');
      expect(result.prompt).toBe('create a test page');
      expect(result.status).toBe('completed');
      expect(result.steps.length).toBe(8);

      // All steps should be completed
      expect(result.steps.every(step => step.status === 'completed')).toBe(true);
    });

    it('should track step progress and timing', async () => {
      const stepUpdates: any[] = [];
      const orchestrator = new PipelineOrchestrator(
        { enableDebug: false },
        (step) => stepUpdates.push({ ...step })
      );

      const result = await orchestrator.execute('http://test.com', 'create a test page');

      // Should have received step updates
      expect(stepUpdates.length).toBeGreaterThan(0);

      // Each step should have duration
      result.steps.forEach(step => {
        expect(step.duration).toBeDefined();
        expect(step.duration).toBeGreaterThanOrEqual(0);
      });

      expect(result.totalDuration).toBeDefined();
      expect(result.totalDuration).toBeGreaterThan(0);
    });

    it('should handle step failures gracefully', async () => {
      // Mock a failure in the tokens step
      const mockTokens = require('../../pipeline/tokens');
      mockTokens.extractTokens.mockRejectedValueOnce(new Error('Token extraction failed'));

      const orchestrator = new PipelineOrchestrator({ enableDebug: false });

      await expect(orchestrator.execute('http://test.com', 'create a test page'))
        .rejects.toThrow('Token extraction failed');
    });

    it('should skip steps when configured', async () => {
      const orchestrator = new PipelineOrchestrator({
        enableDebug: false,
        skipSteps: ['canvas', 'codegen']
      });

      const result = await orchestrator.execute('http://test.com', 'create a test page');

      const canvasStep = result.steps.find(s => s.id === 'canvas');
      const codegenStep = result.steps.find(s => s.id === 'codegen');

      expect(canvasStep?.status).toBe('completed');
      expect(canvasStep?.outputs?.skipped).toBe(true);
      expect(codegenStep?.status).toBe('completed');
      expect(codegenStep?.outputs?.skipped).toBe(true);
    });

    it('should extract meaningful outputs from each step', async () => {
      const orchestrator = new PipelineOrchestrator({ enableDebug: false });

      const result = await orchestrator.execute('http://test.com', 'create a test page');

      const intentStep = result.steps.find(s => s.id === 'intent');
      expect(intentStep?.outputs?.pageType).toBe('detail');
      expect(intentStep?.outputs?.confidence).toBe(0.95);

      const layoutStep = result.steps.find(s => s.id === 'layout');
      expect(layoutStep?.outputs?.constraintsSatisfied).toBe(10);

      const canvasStep = result.steps.find(s => s.id === 'canvas');
      expect(canvasStep?.outputs?.totalElements).toBe(25);
    });

    it('should calculate progress correctly', async () => {
      const orchestrator = new PipelineOrchestrator({ enableDebug: false });

      const result = await orchestrator.execute('http://test.com', 'create a test page');
      const progress = orchestrator.getProgress(result);

      expect(progress).toBe(100);
    });

    it('should generate step summaries', async () => {
      const orchestrator = new PipelineOrchestrator({ enableDebug: false });

      const result = await orchestrator.execute('http://test.com', 'create a test page');
      const summary = orchestrator.getStepSummary(result);

      expect(summary).toContain('8 steps completed successfully');
    });
  });

  describe('executeFullPipeline convenience function', () => {
    it('should execute pipeline with default config', async () => {
      const result = await executeFullPipeline('http://test.com', 'create a test page');

      expect(result).toBeDefined();
      expect(result.status).toBe('completed');
      expect(result.steps.length).toBe(8);
    });

    it('should call step update callback', async () => {
      const stepUpdates: any[] = [];

      await executeFullPipeline(
        'http://test.com',
        'create a test page',
        { enableDebug: false },
        (step) => stepUpdates.push(step)
      );

      expect(stepUpdates.length).toBeGreaterThan(0);
    });
  });

  describe('Artifact Management', () => {
    it('should store all step results in artifacts', async () => {
      const result = await executeFullPipeline('http://test.com', 'create a test page');

      expect(result.artifacts.capture).toBeDefined();
      expect(result.artifacts.tokens).toBeDefined();
      expect(result.artifacts.scenegraph).toBeDefined();
      expect(result.artifacts.intent).toBeDefined();
      expect(result.artifacts.layout).toBeDefined();
      expect(result.artifacts.styling).toBeDefined();
      expect(result.artifacts.codegen).toBeDefined();
      expect(result.artifacts.canvas).toBeDefined();
    });

    it('should generate unique run IDs', async () => {
      const result1 = await executeFullPipeline('http://test.com', 'create a test page');
      const result2 = await executeFullPipeline('http://test.com', 'create a test page');

      expect(result1.runId).toBeDefined();
      expect(result2.runId).toBeDefined();
      expect(result1.runId).not.toBe(result2.runId);
    });
  });
});