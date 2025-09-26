'use client';

import { useState, useCallback } from 'react';
import { PipelineResult, PipelineStep } from '../pipeline/orchestration';
import { PipelineInput } from '@/components/pipeline-input';
import { PipelineStage } from '@/components/pipeline-stage';
import { Separator } from '@/components/ui/separator';

// Main page component - no artifact viewer needed anymore

export default function Home() {
  const [isGenerating, setIsGenerating] = useState(false);
  const [result, setResult] = useState<PipelineResult | null>(null);
  const [currentStep, setCurrentStep] = useState<PipelineStep | null>(null);

  const handleStepUpdate = useCallback((step: PipelineStep) => {
    setCurrentStep(step);
    if (result) {
      const updatedSteps = result.steps.map(s => s.id === step.id ? step : s);
      setResult({ ...result, steps: updatedSteps });
    }
  }, [result]);

  const handleGenerate = async (url: string, prompt: string) => {
    setIsGenerating(true);
    setResult(null);
    setCurrentStep(null);

    try {
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url: url.trim(),
          prompt: prompt.trim(),
          enableDebug: true
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      if (data.success) {
        setResult(data.result);
      } else {
        throw new Error(data.error || 'Generation failed');
      }

    } catch (error) {
      console.error('Generation failed:', error);
      alert(`Generation failed: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setIsGenerating(false);
      setCurrentStep(null);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-5xl mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-mono font-bold">AI Design Partner</h1>
          <p className="text-sm text-muted-foreground font-mono">
            Generate React components from website analysis → 8-stage pipeline
          </p>
        </div>

        <Separator />

        {/* Input */}
        <PipelineInput onGenerate={handleGenerate} isGenerating={isGenerating} />

        {/* Pipeline Progress */}
        {result && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-mono font-semibold">Pipeline Execution</h2>
              <div className="text-sm text-muted-foreground font-mono">
                Run ID: {result.runId}
              </div>
            </div>

            <div className="space-y-3">
              {result.steps.map((step, index) => (
                <PipelineStage
                  key={step.id}
                  step={step}
                  index={index}
                  artifacts={result.artifacts[step.id as keyof typeof result.artifacts]}
                />
              ))}
            </div>

            {/* Final Actions */}
            {result.status === 'completed' && (
              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => window.open(`/preview/${result.runId}`, '_blank')}
                  className="px-4 py-2 bg-primary text-primary-foreground rounded font-mono text-sm hover:bg-primary/90 transition-colors"
                >
                  Preview Components
                </button>
                <button
                  onClick={() => window.open(`/api/download/${result.runId}`, '_blank')}
                  className="px-4 py-2 bg-secondary text-secondary-foreground rounded font-mono text-sm hover:bg-secondary/80 transition-colors"
                >
                  Download ZIP
                </button>
              </div>
            )}
          </div>
        )}

        {/* Initial State */}
        {!result && !isGenerating && (
          <div className="text-center py-16 text-muted-foreground">
            <div className="text-4xl mb-4 font-mono">⚡</div>
            <h3 className="text-lg font-mono font-medium mb-2">Ready</h3>
            <p className="font-mono text-sm">Enter URL and prompt to start pipeline</p>
          </div>
        )}
      </div>
    </div>
  );
}