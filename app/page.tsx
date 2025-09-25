'use client';

import { useState, useCallback } from 'react';
import { PipelineResult, PipelineStep } from '../pipeline/orchestration';

interface StepCardProps {
  step: PipelineStep;
  index: number;
}

function StepCard({ step, index }: StepCardProps) {
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return '✅';
      case 'running': return '🔄';
      case 'error': return '❌';
      default: return '⏸️';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'text-green-600 bg-green-50';
      case 'running': return 'text-blue-600 bg-blue-50';
      case 'error': return 'text-red-600 bg-red-50';
      default: return 'text-gray-400 bg-gray-50';
    }
  };

  return (
    <div className={`p-4 rounded-lg border-2 transition-all duration-200 ${
      step.status === 'running' ? 'border-blue-300 shadow-md' : 'border-gray-200'
    }`}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-3">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${getStatusColor(step.status)}`}>
            {index + 1}
          </div>
          <div>
            <h3 className="font-medium text-gray-900">{step.name}</h3>
            <p className="text-sm text-gray-500">ID: {step.id}</p>
          </div>
        </div>
        <div className="text-2xl">{getStatusIcon(step.status)}</div>
      </div>

      {step.duration && (
        <div className="text-sm text-gray-600 mb-2">
          Duration: {step.duration}ms
        </div>
      )}

      {step.error && (
        <div className="text-sm text-red-600 bg-red-50 p-2 rounded mt-2">
          Error: {step.error}
        </div>
      )}

      {step.outputs && Object.keys(step.outputs).length > 0 && (
        <div className="mt-3 p-3 bg-gray-50 rounded text-xs">
          <div className="font-medium text-gray-700 mb-1">Outputs:</div>
          <div className="space-y-1">
            {Object.entries(step.outputs).map(([key, value]) => (
              <div key={key} className="flex justify-between">
                <span className="text-gray-600">{key}:</span>
                <span className="font-mono text-gray-900">
                  {typeof value === 'boolean' ? (value ? '✅' : '❌') : String(value)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

interface ArtifactViewerProps {
  result: PipelineResult | null;
}

function ArtifactViewer({ result }: ArtifactViewerProps) {
  const [activeTab, setActiveTab] = useState<string>('overview');

  if (!result) return null;

  const tabs = [
    { id: 'overview', name: 'Overview', icon: '📊' },
    { id: 'tokens', name: 'Design Tokens', icon: '🎨' },
    { id: 'layout', name: 'Layout', icon: '📐' },
    { id: 'components', name: 'Components', icon: '⚛️' },
    { id: 'canvas', name: 'Visual Canvas', icon: '🖼️' },
  ];

  const renderTabContent = () => {
    switch (activeTab) {
      case 'overview':
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-blue-50 p-4 rounded-lg">
                <div className="text-2xl font-bold text-blue-600">
                  {result.steps.filter(s => s.status === 'completed').length}
                </div>
                <div className="text-sm text-blue-800">Steps Completed</div>
              </div>
              <div className="bg-green-50 p-4 rounded-lg">
                <div className="text-2xl font-bold text-green-600">
                  {result.totalDuration ? `${Math.round(result.totalDuration / 1000)}s` : '-'}
                </div>
                <div className="text-sm text-green-800">Total Duration</div>
              </div>
              <div className="bg-purple-50 p-4 rounded-lg">
                <div className="text-2xl font-bold text-purple-600">
                  {result.artifacts.components?.components?.length || 0}
                </div>
                <div className="text-sm text-purple-800">Components</div>
              </div>
              <div className="bg-orange-50 p-4 rounded-lg">
                <div className="text-2xl font-bold text-orange-600">
                  {result.artifacts.canvas?.totalElements || 0}
                </div>
                <div className="text-sm text-orange-800">Canvas Elements</div>
              </div>
            </div>
            <div className="bg-gray-50 p-4 rounded-lg">
              <h3 className="font-medium mb-2">Pipeline Configuration</h3>
              <div className="text-sm space-y-1">
                <div><span className="font-medium">URL:</span> {result.url}</div>
                <div><span className="font-medium">Prompt:</span> {result.prompt}</div>
                <div><span className="font-medium">Run ID:</span> <code className="bg-white px-1 rounded">{result.runId}</code></div>
                <div><span className="font-medium">Status:</span> <span className={result.status === 'completed' ? 'text-green-600' : result.status === 'error' ? 'text-red-600' : 'text-blue-600'}>{result.status}</span></div>
              </div>
            </div>
          </div>
        );

      case 'tokens':
        if (!result.artifacts.tokens) return <div>No design tokens available</div>;
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-gray-50 p-4 rounded-lg">
                <h3 className="font-medium mb-3">Primary Colors</h3>
                <div className="flex flex-wrap gap-2">
                  {result.artifacts.tokens.tokens?.colors?.primary?.map((color: string, i: number) => (
                    <div key={i} className="flex items-center gap-2">
                      <div
                        className="w-6 h-6 rounded border"
                        style={{ backgroundColor: color }}
                      ></div>
                      <span className="text-sm font-mono">{color}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="bg-gray-50 p-4 rounded-lg">
                <h3 className="font-medium mb-3">Neutral Colors</h3>
                <div className="flex flex-wrap gap-2">
                  {result.artifacts.tokens.tokens?.colors?.neutral?.map((color: string, i: number) => (
                    <div key={i} className="flex items-center gap-2">
                      <div
                        className="w-6 h-6 rounded border"
                        style={{ backgroundColor: color }}
                      ></div>
                      <span className="text-sm font-mono">{color}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="bg-gray-50 p-4 rounded-lg">
              <h3 className="font-medium mb-3">Typography</h3>
              <div className="space-y-2 text-sm">
                <div><span className="font-medium">Font Families:</span> {result.artifacts.tokens.tokens?.typography?.fontFamilies?.join(', ')}</div>
                <div><span className="font-medium">Font Sizes:</span> {result.artifacts.tokens.tokens?.typography?.fontSizes?.join(', ')}px</div>
                <div><span className="font-medium">Spacing Scale:</span> {result.artifacts.tokens.tokens?.spacing?.join(', ')}px</div>
              </div>
            </div>
          </div>
        );

      case 'layout':
        if (!result.artifacts.layout) return <div>No layout available</div>;
        return (
          <div className="space-y-4">
            <div className="bg-gray-50 p-4 rounded-lg">
              <h3 className="font-medium mb-3">Layout Configuration</h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="font-medium">Frame Width:</span> {result.artifacts.layout.layout?.frame?.width}px
                </div>
                <div>
                  <span className="font-medium">Grid Columns:</span> {result.artifacts.layout.layout?.grid?.columns}
                </div>
                <div>
                  <span className="font-medium">Sections:</span> {result.artifacts.layout.sections?.length}
                </div>
                <div>
                  <span className="font-medium">Layout Stacks:</span> {result.artifacts.layout.layout?.stacks?.length}
                </div>
              </div>
            </div>
            <div className="space-y-3">
              <h3 className="font-medium">Required Sections</h3>
              <div className="flex flex-wrap gap-2">
                {result.artifacts.layout.sections?.map((section: string) => (
                  <span key={section} className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm">
                    {section.replace('_', ' ')}
                  </span>
                ))}
              </div>
            </div>
          </div>
        );

      case 'components':
        if (!result.artifacts.codegen) return <div>No components available</div>;
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {result.artifacts.codegen.components?.map((comp: any) => (
                <div key={comp.name} className="bg-gray-50 p-4 rounded-lg">
                  <h3 className="font-medium text-lg mb-2">⚛️ {comp.name}</h3>
                  <div className="text-sm space-y-1">
                    <div><span className="font-medium">File:</span> {comp.filename}</div>
                    <div><span className="font-medium">Exports:</span> {comp.exports.join(', ')}</div>
                    <div><span className="font-medium">Lines:</span> {comp.code.split('\n').length}</div>
                  </div>
                </div>
              ))}
            </div>
            <div className="bg-green-50 p-4 rounded-lg">
              <h3 className="font-medium mb-2">📊 Code Statistics</h3>
              <div className="text-sm space-y-1">
                <div><span className="font-medium">Total Components:</span> {result.artifacts.codegen.components?.length}</div>
                <div><span className="font-medium">Total Lines:</span> {result.artifacts.codegen.totalLines}</div>
                <div><span className="font-medium">Index File:</span> Generated</div>
              </div>
            </div>
          </div>
        );

      case 'canvas':
        if (!result.artifacts.canvas) return <div>No canvas available</div>;
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-gray-50 p-4 rounded-lg">
                <h3 className="font-medium mb-3">Canvas Properties</h3>
                <div className="text-sm space-y-1">
                  <div><span className="font-medium">Dimensions:</span> {result.artifacts.canvas.canvas?.width}×{result.artifacts.canvas.canvas?.height}px</div>
                  <div><span className="font-medium">Background:</span> {result.artifacts.canvas.canvas?.background}</div>
                  <div><span className="font-medium">Total Elements:</span> {result.artifacts.canvas.totalElements}</div>
                  <div><span className="font-medium">SVG Size:</span> {Math.round((result.artifacts.canvas.svg?.length || 0) / 1024)}KB</div>
                </div>
              </div>
              <div className="bg-gray-50 p-4 rounded-lg">
                <h3 className="font-medium mb-3">SVG Preview</h3>
                <div className="w-full h-48 border rounded bg-white overflow-hidden">
                  {result.artifacts.canvas.svg && (
                    <div
                      className="w-full h-full"
                      style={{ transform: 'scale(0.2)', transformOrigin: 'top left' }}
                      dangerouslySetInnerHTML={{ __html: result.artifacts.canvas.svg }}
                    />
                  )}
                </div>
              </div>
            </div>
          </div>
        );

      default:
        return <div>Select a tab to view details</div>;
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border">
      <div className="border-b">
        <div className="flex overflow-x-auto">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-6 py-4 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.icon} {tab.name}
            </button>
          ))}
        </div>
      </div>
      <div className="p-6">
        {renderTabContent()}
      </div>
    </div>
  );
}

export default function Home() {
  const [url, setUrl] = useState('http://localhost:5050');
  const [prompt, setPrompt] = useState('create a property detail page');
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

  const handleGenerate = async () => {
    if (!url.trim() || !prompt.trim()) return;

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

  const getProgressPercent = () => {
    if (!result) return 0;
    const completed = result.steps.filter(s => s.status === 'completed').length;
    return Math.round((completed / result.steps.length) * 100);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto py-8 px-4">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            🤖 AI Design Partner
          </h1>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Generate crafted React + Tailwind components by analyzing website styles.
            Watch the full 8-stage pipeline in real-time.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Input Panel */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow-sm border p-6 sticky top-8">
              <h2 className="text-lg font-semibold mb-4">⚙️ Pipeline Configuration</h2>
              <div className="space-y-4">
                <div>
                  <label htmlFor="url" className="block text-sm font-medium text-gray-700 mb-2">
                    Website URL
                  </label>
                  <input
                    id="url"
                    type="url"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder="https://www.airbnb.com"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    disabled={isGenerating}
                  />
                </div>

                <div>
                  <label htmlFor="prompt" className="block text-sm font-medium text-gray-700 mb-2">
                    What to create
                  </label>
                  <input
                    id="prompt"
                    type="text"
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder="create a property detail page"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    disabled={isGenerating}
                  />
                </div>

                <button
                  onClick={handleGenerate}
                  disabled={isGenerating || !url.trim() || !prompt.trim()}
                  className="w-full bg-blue-600 text-white py-3 px-4 rounded-md font-medium hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isGenerating ? '🔄 Generating...' : '🚀 Generate Design'}
                </button>

                {isGenerating && result && (
                  <div className="mt-4">
                    <div className="flex justify-between text-sm text-gray-600 mb-2">
                      <span>Progress</span>
                      <span>{getProgressPercent()}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${getProgressPercent()}%` }}
                      ></div>
                    </div>
                    {currentStep && (
                      <div className="mt-2 text-sm text-gray-600">
                        Current: {currentStep.name}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Results Panel */}
          <div className="lg:col-span-2 space-y-8">
            {/* Pipeline Steps */}
            {result && (
              <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-6">
                  🔧 Pipeline Steps
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {result.steps.map((step, index) => (
                    <StepCard key={step.id} step={step} index={index} />
                  ))}
                </div>
              </div>
            )}

            {/* Artifact Viewer */}
            {result && result.status === 'completed' && (
              <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-6">
                  📊 Generated Artifacts
                </h2>
                <ArtifactViewer result={result} />
              </div>
            )}

            {/* Initial State */}
            {!result && !isGenerating && (
              <div className="text-center py-16 text-gray-500">
                <div className="text-6xl mb-4">🎨</div>
                <h3 className="text-xl font-medium mb-2">Ready to Generate</h3>
                <p>Enter a URL and prompt to start the AI design generation pipeline</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}