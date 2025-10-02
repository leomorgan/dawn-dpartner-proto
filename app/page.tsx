'use client';

import { useState, useCallback, useEffect } from 'react';
import { PipelineResult, PipelineStep } from '../pipeline/orchestration';

// Define the CTA result type
interface CTAResult {
  runId: string;
  url: string;
  template: {
    html: string;
    componentCode: string;
    appliedStyles: any;
    cssVariables: string;
    templateType: string;
    safeColors: any;
    buttonVariant?: {
      type: 'primary' | 'secondary' | 'outline' | 'ghost';
      backgroundColor: string;
      color: string;
      padding: string;
      fontSize: number;
      fontWeight: number;
      hover?: {
        backgroundColor?: string;
        color?: string;
        opacity?: number;
        transform?: string;
        transition?: string;
      };
    };
  };
  tokens: any;
  selectedTemplate: string;
  preview: string;
  metadata: {
    templateName: string;
    templateDescription: string;
    totalDuration: number;
  };
}

// Union type for both result types
type GenerationResult = PipelineResult | CTAResult;

// Type guard to check if result is a PipelineResult
function isPipelineResult(result: GenerationResult): result is PipelineResult {
  return 'steps' in result && Array.isArray((result as PipelineResult).steps);
}
import { PipelineInput } from '@/components/pipeline-input';
import { PipelineStage } from '@/components/pipeline-stage';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';

// Component to safely render CTA templates with CSS variables
function CTATemplateRenderer({ html, cssVariables }: { html: string; cssVariables?: string }) {
  // Inject CSS variables into the page when component mounts
  useEffect(() => {
    if (!cssVariables) return;

    const styleId = 'cta-template-css-vars';
    let styleElement = document.getElementById(styleId) as HTMLStyleElement;

    if (!styleElement) {
      styleElement = document.createElement('style');
      styleElement.id = styleId;
      document.head.appendChild(styleElement);
    }

    styleElement.textContent = cssVariables;

    return () => {
      // Cleanup on unmount
      const el = document.getElementById(styleId);
      if (el) {
        el.remove();
      }
    };
  }, [cssVariables]);

  // Clean the HTML to remove any script tags for security
  const cleanHtml = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');

  return (
    <div
      dangerouslySetInnerHTML={{ __html: cleanHtml }}
      className="cta-template-container"
    />
  );
}

// Hidden div to force Tailwind to include arbitrary value patterns used by generated templates
function TailwindClassIncluder() {
  return (
    <div className="hidden">
      {/* Common arbitrary value patterns to ensure they're included in CSS bundle */}
      <div className="bg-[#635bff] text-[#ffffff] hover:bg-[#0a2540] font-[sohne-var] rounded-[16.5px] text-[15px] font-[425] py-[6px] px-[16px] p-[24px] gap-[8px] mb-[16px]" />
      <div className="bg-[#425466] text-[#425466] bg-[#ffffff] bg-[#0a2540] border-[#635bff] border-[#0a2540] hover:bg-[#ffffff]" />
    </div>
  );
}

// Main page component - no artifact viewer needed anymore

export default function Home() {
  const [isGenerating, setIsGenerating] = useState(false);
  const [result, setResult] = useState<GenerationResult | null>(null);
  const [showImageModal, setShowImageModal] = useState(false);
  const [vectorizedCaptures, setVectorizedCaptures] = useState<any[]>([]);

  useEffect(() => {
    // Load vectorized captures on mount
    const loadVectorizedCaptures = async () => {
      try {
        const response = await fetch('/api/vectors/list');
        if (response.ok) {
          const data = await response.json();
          setVectorizedCaptures(data.profiles || []);
        }
      } catch (err) {
        console.error('Failed to load vectorized captures:', err);
      }
    };
    loadVectorizedCaptures();
  }, []);

  const handleGenerate = async (url: string, prompt: string, mode: 'full' | 'cta' = 'full') => {
    setIsGenerating(true);
    setResult(null);

    try {
      const endpoint = mode === 'cta' ? '/api/generate-cta' : '/api/generate';
      const body = mode === 'cta'
        ? { url: url.trim() }
        : { url: url.trim(), prompt: prompt.trim(), enableDebug: true };

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      if (data.success) {
        // For CTA mode, navigate to preview page with runId in URL
        if (mode === 'cta') {
          window.location.href = `/preview-cta/${data.result.runId}`;
        } else {
          setResult(data.result);
        }
      } else {
        throw new Error(data.error || 'Generation failed');
      }

    } catch (error) {
      console.error('Generation failed:', error);
      alert(`Generation failed: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
        {/* Header */}
        <div className="text-center space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Dawn: Design Partner</h1>
          <p className="text-sm text-muted-foreground">Generate React + Tailwind components from any website</p>
        </div>

        {/* Vectorized Captures List */}
        {vectorizedCaptures.length > 0 && (
          <div className="bg-white border rounded-lg p-4">
            <h2 className="text-sm font-semibold text-gray-900 mb-3">Vector Database ({vectorizedCaptures.length})</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {vectorizedCaptures.map((capture) => (
                <a
                  key={capture.id}
                  href={`/vectors/${capture.id}`}
                  className="group block p-3 border rounded-lg hover:border-blue-500 hover:shadow-sm transition-all cursor-pointer"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-900 truncate">
                        {new URL(capture.source_url).hostname.replace('www.', '')}
                      </div>
                      <div className="text-xs text-gray-500 truncate">
                        {capture.source_url}
                      </div>
                    </div>
                  </div>
                  {capture.brand_tone && (
                    <div className="inline-block px-2 py-1 bg-blue-50 text-blue-700 text-xs rounded capitalize">
                      {capture.brand_tone}
                    </div>
                  )}
                  <div className="text-xs text-gray-400 mt-2">
                    {new Date(capture.created_at).toLocaleDateString()}
                  </div>
                </a>
              ))}
            </div>
          </div>
        )}

        {/* Input */}
        <PipelineInput onGenerate={handleGenerate} isGenerating={isGenerating} />

        {/* Results Display */}
        {result && (
          <div className="space-y-5">
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-semibold tracking-tight">
                {isPipelineResult(result) ? 'Pipeline Execution' : 'CTA Generation'}
              </h2>
              <div className="text-xs text-muted-foreground font-mono px-2 py-1 bg-muted rounded">
                {result.runId}
              </div>
            </div>

            {isPipelineResult(result) ? (
              // Pipeline Result UI
              <>
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

                {/* Pipeline Final Actions */}
                {result.status === 'completed' && (
                  <div className="flex gap-2 pt-4">
                    <Button
                      onClick={() => window.open(`/preview/${result.runId}`, '_blank')}
                      variant="default"
                    >
                      Preview Components
                    </Button>
                    <Button
                      onClick={() => window.open(`/api/download/${result.runId}`, '_blank')}
                      variant="secondary"
                    >
                      Download ZIP
                    </Button>
                  </div>
                )}
              </>
            ) : (
              // CTA Result UI
              <>
                {/* Generated CTA Component - FIRST */}
                <div className="p-6 border-2 border-dashed border-muted-foreground/30 rounded-lg bg-background">
                  <div className="mb-4">
                    <h3 className="font-semibold text-sm text-muted-foreground">✨ Generated Component</h3>
                  </div>
                  {/* Render the component with CSS variables injected */}
                  <CTATemplateRenderer
                    html={result.template?.html || ''}
                    cssVariables={result.template?.cssVariables || ''}
                  />
                </div>

                {/* Captured Page Screenshot */}
                <div className="space-y-3 p-4 border rounded-lg bg-muted/50">
                  <h3 className="font-semibold text-sm">📸 Captured Page</h3>
                  <div className="flex justify-center">
                    <img
                      src={`/api/artifact/${result.runId}/raw/page.png`}
                      alt="Captured webpage screenshot"
                      className="max-w-sm max-h-64 object-contain border rounded shadow-sm bg-white cursor-pointer hover:opacity-80 transition-opacity"
                      onClick={() => setShowImageModal(true)}
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.style.display = 'none';
                      }}
                    />
                  </div>
                  <div className="text-xs text-muted-foreground text-center">
                    Source: <span className="font-mono">{result.url}</span> • Click to zoom
                  </div>
                </div>

                <div className="space-y-6 p-6 border rounded-lg bg-muted/50">
                  <h3 className="font-semibold text-lg">Design Analysis & Extracted Tokens</h3>

                  {/* Brand Personality Analysis */}
                  {result.tokens?.brandPersonality && (
                    <div className="space-y-3 p-4 bg-background rounded border">
                      <h4 className="font-medium text-sm flex items-center gap-2">
                        🎨 Brand Personality
                        <span className="text-xs px-2 py-1 bg-primary/10 text-primary rounded">
                          {Math.round(result.tokens.brandPersonality.confidence * 100)}% confidence
                        </span>
                      </h4>
                      <div className="grid grid-cols-2 gap-4 text-xs">
                        <div>
                          <span className="text-muted-foreground">Tone:</span> <span className="font-medium capitalize">{result.tokens.brandPersonality.tone}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Energy:</span> <span className="font-medium capitalize">{result.tokens.brandPersonality.energy}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Trust Level:</span> <span className="font-medium capitalize">{result.tokens.brandPersonality.trustLevel}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Color Mood:</span> <span className="font-medium capitalize">{result.tokens.brandPersonality.colorPsychology.dominantMood}</span>
                        </div>
                      </div>
                      <div className="pt-2">
                        <span className="text-muted-foreground text-xs">Brand Adjectives:</span>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {result.tokens.brandPersonality.colorPsychology.brandAdjectives.map((adj: string, i: number) => (
                            <span key={i} className="text-xs px-2 py-1 bg-secondary/50 text-secondary-foreground rounded capitalize">
                              {adj}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Design System Analysis */}
                  {result.tokens?.designSystemAnalysis && (
                    <div className="space-y-3 p-4 bg-background rounded border">
                      <h4 className="font-medium text-sm">📐 Design System Maturity</h4>
                      <div className="grid grid-cols-2 gap-4 text-xs">
                        <div>
                          <span className="text-muted-foreground">Maturity:</span> <span className="font-medium capitalize">{result.tokens.designSystemAnalysis.maturityLevel}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Complexity:</span> <span className="font-medium capitalize">{result.tokens.designSystemAnalysis.patternComplexity}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Systematic:</span> <span className="font-medium">{result.tokens.designSystemAnalysis.systematicApproach ? 'Yes' : 'No'}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Overall Consistency:</span> <span className="font-medium">{Math.round(result.tokens.designSystemAnalysis.consistency.overall * 100)}%</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Enhanced Color Palette */}
                  <div className="space-y-3">
                    <h4 className="font-medium text-sm">🎨 Color Palette</h4>

                    {/* Semantic Colors */}
                    <div className="space-y-2">
                      <h5 className="text-xs font-medium text-muted-foreground">Semantic Colors</h5>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        {Object.entries(result.template.safeColors).map(([key, color]) => (
                          <div key={key} className="flex items-center gap-2">
                            <div
                              className="w-4 h-4 rounded border shadow-sm"
                              style={{ backgroundColor: color as string }}
                            />
                            <span className="capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}:</span>
                            <span className="font-mono">{color as string}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Primary & Neutral Palettes */}
                    {result.tokens.colors && (
                      <>
                        <div className="space-y-2">
                          <h5 className="text-xs font-medium text-muted-foreground">Primary Palette</h5>
                          <div className="flex gap-1">
                            {result.tokens.colors.primary.map((color: string, i: number) => (
                              <div key={i} className="flex flex-col items-center gap-1">
                                <div
                                  className="w-8 h-8 rounded border shadow-sm"
                                  style={{ backgroundColor: color }}
                                />
                                <span className="text-xs font-mono">{color}</span>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className="space-y-2">
                          <h5 className="text-xs font-medium text-muted-foreground">Neutral Palette</h5>
                          <div className="flex gap-1">
                            {result.tokens.colors.neutral.map((color: string, i: number) => (
                              <div key={i} className="flex flex-col items-center gap-1">
                                <div
                                  className="w-8 h-8 rounded border shadow-sm"
                                  style={{ backgroundColor: color }}
                                />
                                <span className="text-xs font-mono">{color}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </>
                    )}
                  </div>

                  {/* Button Variants */}
                  {result.tokens.buttons?.variants?.length > 0 && (
                    <div className="space-y-3">
                      <h4 className="font-medium text-sm">🔘 Button Variants (Ordered by Count)</h4>

                      {/* Solid/Non-Ghost Buttons */}
                      {result.tokens.buttons.variants.filter((button: any) => button.type !== 'ghost').length > 0 && (
                        <div className="space-y-4">
                          {result.tokens.buttons.variants.filter((button: any) => button.type !== 'ghost').map((button: any, i: number) => {
                            // Check if this is the selected button for generation
                            const isSelected = i === 0; // First non-ghost button is selected

                            return (
                              <div key={i} className="p-4 bg-background rounded border space-y-3">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs px-1 py-1 bg-accent/20 text-accent rounded font-mono">
                                      #{i + 1}
                                    </span>
                                    <span className="font-medium text-sm capitalize">{button.type} Button</span>
                                    <span className="text-xs px-2 py-1 bg-primary/10 text-primary rounded">
                                      {button.count} detected
                                    </span>
                                    {isSelected && (
                                      <span className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded font-medium">
                                        ⭐ Used in Generation
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <div
                                      className="w-4 h-4 rounded border"
                                      style={{
                                        backgroundColor: button.backgroundColor,
                                      }}
                                    />
                                    <span className="text-xs font-mono">{button.backgroundColor}</span>
                                  </div>
                                </div>

                                {/* Rendered Button Example */}
                                <div className="flex justify-center py-3">
                                  <div className="relative">
                                    <button
                                      className="font-mono text-sm"
                                      style={{
                                        backgroundColor: button.backgroundColor,
                                        color: button.color,
                                        padding: button.padding,
                                        fontSize: `${button.fontSize}px`,
                                        fontWeight: button.fontWeight,
                                        borderRadius: button.borderRadius,
                                        border: button.borderColor ? `1px solid ${button.borderColor}` : 'none',
                                        display: button.display,
                                        alignItems: button.alignItems,
                                        justifyContent: button.justifyContent,
                                        textAlign: button.textAlign,
                                        lineHeight: 1,
                                        cursor: 'default'
                                      }}
                                    >
                                      {button.type === 'primary' ? 'Primary Action' :
                                       button.type === 'secondary' ? 'Secondary' :
                                       button.type === 'outline' ? 'Outline Button' :
                                       'Ghost Button'}
                                    </button>
                                    {isSelected && (
                                      <span className="absolute -top-2 -right-2 text-green-600 text-lg">*</span>
                                    )}
                                  </div>
                                </div>

                                <div className="grid grid-cols-2 gap-2 text-xs">
                                  <div><span className="text-muted-foreground">Text Color:</span> {button.color}</div>
                                  <div><span className="text-muted-foreground">Font Size:</span> {button.fontSize}px</div>
                                  <div><span className="text-muted-foreground">Font Weight:</span> {button.fontWeight}</div>
                                  <div><span className="text-muted-foreground">Border Radius:</span> {button.borderRadius}</div>
                                  <div><span className="text-muted-foreground">Padding:</span> {button.padding}</div>
                                  <div><span className="text-muted-foreground">Display:</span> {button.display}</div>
                                  <div><span className="text-muted-foreground">Alignment:</span> {button.alignItems} / {button.justifyContent}</div>
                                  <div><span className="text-muted-foreground">Text Align:</span> {button.textAlign}</div>
                                </div>

                                {/* Hover Effects */}
                                {button.hover && (
                                  <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded">
                                    <h5 className="text-xs font-medium text-blue-800 mb-2">✨ Hover Effects Detected</h5>
                                    <div className="grid grid-cols-2 gap-2 text-xs">
                                      {button.hover.backgroundColor && (
                                        <div className="flex items-center gap-2">
                                          <span className="text-muted-foreground">Hover Background:</span>
                                          <div className="flex items-center gap-1">
                                            <div
                                              className="w-3 h-3 rounded border"
                                              style={{ backgroundColor: button.hover.backgroundColor }}
                                            />
                                            <span className="font-mono">{button.hover.backgroundColor}</span>
                                          </div>
                                        </div>
                                      )}
                                      {button.hover.color && (
                                        <div><span className="text-muted-foreground">Hover Text:</span> {button.hover.color}</div>
                                      )}
                                      {button.hover.opacity && (
                                        <div><span className="text-muted-foreground">Hover Opacity:</span> {button.hover.opacity}</div>
                                      )}
                                      {button.hover.transform && (
                                        <div><span className="text-muted-foreground">Transform:</span> {button.hover.transform}</div>
                                      )}
                                      {button.hover.transition && (
                                        <div className="col-span-2"><span className="text-muted-foreground">Transition:</span> {button.hover.transition}</div>
                                      )}
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* Transparent Buttons Accordion */}
                      {result.tokens.buttons.variants.filter((button: any) => button.type === 'ghost').length > 0 && (
                        <details className="group">
                          <summary className="cursor-pointer list-none">
                            <div className="flex items-center gap-2 p-3 bg-muted/30 rounded border">
                              <span className="text-sm font-medium">
                                👻 Transparent Buttons ({result.tokens.buttons.variants.filter((button: any) => button.type === 'ghost').length})
                              </span>
                              <span className="text-xs text-muted-foreground ml-auto group-open:rotate-180 transition-transform">
                                ▼
                              </span>
                            </div>
                          </summary>
                          <div className="mt-3 space-y-4">
                            {result.tokens.buttons.variants.filter((button: any) => button.type === 'ghost').map((button: any, i: number) => (
                              <div key={i} className="p-4 bg-background rounded border space-y-3">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs px-2 py-1 bg-primary/10 text-primary rounded">
                                      {button.count} detected
                                    </span>
                                    <span className="text-xs px-2 py-1 bg-muted/50 text-muted-foreground rounded">
                                      Transparent
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <div
                                      className="w-4 h-4 rounded border-2 border-dashed border-muted-foreground/50"
                                    />
                                    <span className="text-xs font-mono">transparent</span>
                                  </div>
                                </div>

                                {/* Rendered Button Example */}
                                <div className="flex justify-center py-3">
                                  <button
                                    className="font-mono text-sm"
                                    style={{
                                      backgroundColor: 'transparent',
                                      color: button.color,
                                      padding: button.padding,
                                      fontSize: `${button.fontSize}px`,
                                      fontWeight: button.fontWeight,
                                      borderRadius: button.borderRadius,
                                      border: `1px solid ${button.color}`,
                                      display: button.display,
                                      alignItems: button.alignItems,
                                      justifyContent: button.justifyContent,
                                      textAlign: button.textAlign,
                                      lineHeight: 1,
                                      cursor: 'default'
                                    }}
                                  >
                                    Ghost Button
                                  </button>
                                </div>

                                <div className="grid grid-cols-2 gap-2 text-xs">
                                  <div><span className="text-muted-foreground">Text Color:</span> {button.color}</div>
                                  <div><span className="text-muted-foreground">Font Size:</span> {button.fontSize}px</div>
                                  <div><span className="text-muted-foreground">Font Weight:</span> {button.fontWeight}</div>
                                  <div><span className="text-muted-foreground">Border Radius:</span> {button.borderRadius}</div>
                                  <div><span className="text-muted-foreground">Padding:</span> {button.padding}</div>
                                  <div><span className="text-muted-foreground">Display:</span> {button.display}</div>
                                  <div><span className="text-muted-foreground">Alignment:</span> {button.alignItems} / {button.justifyContent}</div>
                                  <div><span className="text-muted-foreground">Text Align:</span> {button.textAlign}</div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </details>
                      )}
                    </div>
                  )}

                  {/* Enhanced Typography */}
                  {result.tokens.typography && (
                    <div className="space-y-3">
                      <h4 className="font-medium text-sm">📝 Typography System</h4>
                      <div className="grid grid-cols-1 gap-3 text-xs">
                        <div>
                          <span className="text-muted-foreground">Font Families:</span>
                          <div className="mt-1 space-y-1">
                            {result.tokens.typography.fontFamilies?.map((font: string, i: number) => (
                              <div key={i} className="px-2 py-1 bg-background rounded border font-mono text-xs">
                                {font}
                              </div>
                            ))}
                          </div>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Font Sizes:</span>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {result.tokens.typography.fontSizes?.map((size: number, i: number) => (
                              <span key={i} className="px-2 py-1 bg-background rounded border text-xs font-mono">
                                {size}px
                              </span>
                            ))}
                          </div>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Font Weights:</span>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {result.tokens.typography.fontWeights?.map((weight: number, i: number) => (
                              <span key={i} className="px-2 py-1 bg-background rounded border text-xs font-mono">
                                {weight}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Enhanced Spacing System */}
                  <div className="space-y-3">
                    <h4 className="font-medium text-sm">📏 Spacing System</h4>
                    <div className="space-y-2">
                      <div className="text-xs">
                        <span className="text-muted-foreground">Template Spacing:</span>
                        <div className="grid grid-cols-3 gap-2 mt-1">
                          <div className="p-2 bg-background rounded border text-center">
                            <div className="text-muted-foreground">Container</div>
                            <div className="font-mono">{result.template.appliedStyles.spacing.container}</div>
                          </div>
                          <div className="p-2 bg-background rounded border text-center">
                            <div className="text-muted-foreground">Section</div>
                            <div className="font-mono">{result.template.appliedStyles.spacing.section}</div>
                          </div>
                          <div className="p-2 bg-background rounded border text-center">
                            <div className="text-muted-foreground">Element</div>
                            <div className="font-mono">{result.template.appliedStyles.spacing.element}</div>
                          </div>
                        </div>
                      </div>
                      {result.tokens.spacing && (
                        <div className="text-xs">
                          <span className="text-muted-foreground">Detected Scale:</span>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {result.tokens.spacing.map((space: number, i: number) => (
                              <span key={i} className="px-2 py-1 bg-background rounded border font-mono">
                                {space}px
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Applied Styling Decisions */}
                  <div className="space-y-3 p-4 bg-background rounded border">
                    <h4 className="font-medium text-sm">⚙️ Applied Styling Decisions</h4>
                    <div className="text-xs space-y-2">
                      <div>
                        <span className="text-muted-foreground">Template Type:</span> <span className="font-medium capitalize">{result.template.templateType}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Button Display:</span> <span className="font-mono">{result.template.appliedStyles.button?.display || 'inline-flex'}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Button Alignment:</span> <span className="font-mono">{result.template.appliedStyles.button?.alignItems || 'center'} / {result.template.appliedStyles.button?.justifyContent || 'center'}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Text Centering:</span> <span className="font-mono">{result.template.appliedStyles.button?.textAlign || 'center'} + line-height: 1</span>
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* Image Modal */}
        {showImageModal && result && !isPipelineResult(result) && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-background rounded-lg max-w-4xl max-h-[90vh] overflow-auto">
              <div className="p-4 border-b flex justify-between items-center">
                <h3 className="font-semibold tracking-tight">Captured Page</h3>
                <Button
                  onClick={() => setShowImageModal(false)}
                  variant="ghost"
                  size="sm"
                >
                  ✕
                </Button>
              </div>
              <div className="p-4">
                <img
                  src={`/api/artifact/${result.runId}/raw/page.png`}
                  alt="Captured webpage screenshot"
                  className="w-full h-auto border rounded shadow-sm bg-white"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.style.display = 'none';
                  }}
                />
                <div className="mt-2 text-sm text-muted-foreground text-center">
                  Source: <span className="font-mono">{result.url}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Initial State */}
        {!result && !isGenerating && (
          <div className="text-center py-16 text-muted-foreground">
            <div className="text-4xl mb-4">⚡</div>
            <h3 className="text-lg font-medium mb-2">Ready</h3>
            <p className="text-sm">Enter URL and prompt to start pipeline</p>
          </div>
        )}
      </div>
    </div>
  );
}