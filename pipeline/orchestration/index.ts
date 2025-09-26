import { capture } from '../capture';
import { extractTokens } from '../tokens';
import { buildSceneGraph } from '../scenegraph';
import { parseIntent } from '../intent';
import { synthesizeLayout } from '../layout';
import { applyStyling } from '../styling';
import { generateCode } from '../codegen';
import { generateCanvas } from '../canvas';

export interface PipelineStep {
  id: string;
  name: string;
  status: 'pending' | 'running' | 'completed' | 'error';
  duration?: number;
  error?: string;
  outputs?: Record<string, any>;
}

export interface PipelineResult {
  runId: string;
  url: string;
  prompt: string;
  status: 'running' | 'completed' | 'error';
  steps: PipelineStep[];
  artifacts: {
    capture?: any;
    tokens?: any;
    scenegraph?: any;
    intent?: any;
    layout?: any;
    styling?: any;
    codegen?: any;
    canvas?: any;
  };
  startTime: string;
  endTime?: string;
  totalDuration?: number;
}

export interface OrchestrationConfig {
  artifactDir?: string;
  enableDebug?: boolean;
  skipSteps?: string[];
  timeout?: number;
}

const PIPELINE_STEPS: Omit<PipelineStep, 'status' | 'duration' | 'error' | 'outputs'>[] = [
  { id: 'capture', name: 'Web Capture' },
  { id: 'tokens', name: 'Design Tokens' },
  { id: 'scenegraph', name: 'DOM Scenegraph' },
  { id: 'intent', name: 'Intent Parsing' },
  { id: 'layout', name: 'Layout Synthesis' },
  { id: 'styling', name: 'Styling Engine' },
  { id: 'codegen', name: 'Code Generation' },
  { id: 'canvas', name: 'Vector Canvas' }
];

export class PipelineOrchestrator {
  private config: OrchestrationConfig;
  private onStepUpdate?: (step: PipelineStep) => void;

  constructor(config: OrchestrationConfig = {}, onStepUpdate?: (step: PipelineStep) => void) {
    this.config = {
      enableDebug: true,
      timeout: 300000, // 5 minutes
      ...config
    };
    this.onStepUpdate = onStepUpdate;
  }

  private createUrlSuffix(url: string): string {
    try {
      const urlObj = new URL(url);
      // Extract hostname and remove 'www.' if present
      const hostname = urlObj.hostname.replace(/^www\./, '');
      // Convert to safe directory name: replace dots and special chars with dashes
      return hostname.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
    } catch {
      // Fallback for invalid URLs
      return url.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase().substring(0, 20);
    }
  }

  async execute(url: string, prompt: string): Promise<PipelineResult> {
    const startTime = new Date().toISOString();
    const urlSuffix = this.createUrlSuffix(url);
    const runId = `${new Date().toISOString().replace(/[:.]/g, '-').replace('Z', 'Z')}_${Math.random().toString(36).substr(2, 8)}_${urlSuffix}`;

    const result: PipelineResult = {
      runId,
      url,
      prompt,
      status: 'running',
      steps: PIPELINE_STEPS.map(step => ({ ...step, status: 'pending' as const })),
      artifacts: {},
      startTime
    };

    try {
      // Execute each step in sequence
      await this.executeStep(result, 'capture', () => this.runCapture(url, result.runId));
      await this.executeStep(result, 'tokens', () => this.runTokens(result.runId));
      await this.executeStep(result, 'scenegraph', () => this.runScenegraph(result.runId));
      await this.executeStep(result, 'intent', () => this.runIntent(prompt, result.runId));
      await this.executeStep(result, 'layout', () => this.runLayout(result.runId));
      await this.executeStep(result, 'styling', () => this.runStyling(result.runId));
      await this.executeStep(result, 'codegen', () => this.runCodegen(result.runId));
      await this.executeStep(result, 'canvas', () => this.runCanvas(result.runId));

      result.status = 'completed';
      result.endTime = new Date().toISOString();
      result.totalDuration = new Date(result.endTime).getTime() - new Date(result.startTime).getTime();

    } catch (error) {
      result.status = 'error';
      result.endTime = new Date().toISOString();
      result.totalDuration = new Date(result.endTime).getTime() - new Date(result.startTime).getTime();

      // Mark current step as error
      const currentStep = result.steps.find(s => s.status === 'running');
      if (currentStep) {
        currentStep.status = 'error';
        currentStep.error = error instanceof Error ? error.message : String(error);
        this.onStepUpdate?.(currentStep);
      }

      throw error;
    }

    return result;
  }

  private async executeStep(
    result: PipelineResult,
    stepId: string,
    executor: () => Promise<any>
  ): Promise<void> {
    // Skip if configured to skip this step
    if (this.config.skipSteps?.includes(stepId)) {
      const step = result.steps.find(s => s.id === stepId);
      if (step) {
        step.status = 'completed';
        step.outputs = { skipped: true };
        this.onStepUpdate?.(step);
      }
      return;
    }

    const step = result.steps.find(s => s.id === stepId);
    if (!step) return;

    const stepStart = Date.now();

    try {
      step.status = 'running';
      this.onStepUpdate?.(step);

      if (this.config.enableDebug) {
        console.log(`🔄 Starting step: ${step.name}`);
      }

      // Execute with timeout
      const stepResult = await Promise.race([
        executor(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error(`Step ${stepId} timed out`)), this.config.timeout)
        )
      ]);

      step.status = 'completed';
      step.duration = Date.now() - stepStart;
      step.outputs = this.extractStepOutputs(stepResult);

      // Store in artifacts
      result.artifacts[stepId as keyof typeof result.artifacts] = stepResult;

      if (this.config.enableDebug) {
        console.log(`✅ Completed step: ${step.name} (${step.duration}ms)`);
      }

      this.onStepUpdate?.(step);

    } catch (error) {
      step.status = 'error';
      step.duration = Date.now() - stepStart;
      step.error = error instanceof Error ? error.message : String(error);

      if (this.config.enableDebug) {
        console.error(`❌ Failed step: ${step.name}`, error);
      }

      this.onStepUpdate?.(step);
      throw error;
    }
  }

  private async runCapture(url: string, runId: string) {
    return await capture(url, this.config.artifactDir, runId);
  }

  private async runTokens(runId: string) {
    return await extractTokens(runId, this.config.artifactDir);
  }

  private async runScenegraph(runId: string) {
    return await buildSceneGraph(runId, this.config.artifactDir);
  }

  private async runIntent(prompt: string, runId: string) {
    return await parseIntent(prompt, runId, this.config.artifactDir);
  }

  private async runLayout(runId: string) {
    return await synthesizeLayout(runId, this.config.artifactDir);
  }

  private async runStyling(runId: string) {
    return await applyStyling(runId, this.config.artifactDir);
  }

  private async runCodegen(runId: string) {
    return await generateCode(runId, this.config.artifactDir);
  }

  private async runCanvas(runId: string) {
    return await generateCanvas(runId, this.config.artifactDir);
  }

  private extractStepOutputs(result: any): Record<string, any> {
    if (!result) return {};

    // Extract key metrics from each step result
    const outputs: Record<string, any> = {};

    if (result.runId) outputs.runId = result.runId;
    if (result.artifacts) outputs.artifactCount = Object.keys(result.artifacts).length;
    if (result.tokens) outputs.tokensExtracted = true;
    if (result.report) outputs.report = result.report;
    if (result.layout) outputs.layoutGenerated = true;
    if (result.components) outputs.componentsCount = result.components.length;
    if (result.totalLines) outputs.totalLines = result.totalLines;
    if (result.canvas) outputs.canvasGenerated = true;
    if (result.totalElements) outputs.totalElements = result.totalElements;
    if (result.nodes && Array.isArray(result.nodes)) outputs.nodesCount = result.nodes.length;
    if (result.intent) {
      outputs.pageType = result.intent.page_type;
      outputs.sectionsCount = result.intent.required_sections?.length || 0;
      outputs.confidence = result.intent.confidence;
    }
    if (result.constraints) {
      outputs.constraintsSatisfied = result.constraints.satisfied;
      outputs.constraintsTotal = result.constraints.total;
    }

    return outputs;
  }

  getProgress(result: PipelineResult): number {
    const completedSteps = result.steps.filter(s => s.status === 'completed').length;
    return Math.round((completedSteps / result.steps.length) * 100);
  }

  getStepSummary(result: PipelineResult): string {
    const completed = result.steps.filter(s => s.status === 'completed').length;
    const total = result.steps.length;
    const failed = result.steps.filter(s => s.status === 'error').length;

    if (failed > 0) {
      return `${completed}/${total} steps completed, ${failed} failed`;
    } else if (result.status === 'completed') {
      return `All ${total} steps completed successfully`;
    } else {
      return `${completed}/${total} steps completed`;
    }
  }

  getCurrentStep(result: PipelineResult): PipelineStep | null {
    return result.steps.find(s => s.status === 'running') || null;
  }

  getNextStep(result: PipelineResult): PipelineStep | null {
    return result.steps.find(s => s.status === 'pending') || null;
  }
}

// Convenience function for simple execution
export async function executeFullPipeline(
  url: string,
  prompt: string,
  config?: OrchestrationConfig,
  onStepUpdate?: (step: PipelineStep) => void
): Promise<PipelineResult> {
  const orchestrator = new PipelineOrchestrator(config, onStepUpdate);
  return await orchestrator.execute(url, prompt);
}