'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';

interface CTAResult {
  runId: string;
  url: string;
  template: {
    componentCode: string;
    cssVariables: string;
    templateType: 'card' | 'banner' | 'modal';
    html: string;
    safeColors: {
      primary: string;
      secondary: string;
      background: string;
      text: string;
      accent: string;
      ctaPrimary: string;
      ctaSecondary: string;
      muted: string;
    };
    appliedStyles: any;
  };
  tokens?: any;
  selectedTemplate: string;
  metadata: {
    templateName: string;
    templateDescription: string;
  };
}

// Component to safely render CTA templates with CSS variables
function DynamicCTAComponent({ html, cssVariables }: { html: string; cssVariables: string }) {
  useEffect(() => {
    // Inject CSS variables into the page
    const styleId = 'cta-preview-css-vars';
    let styleElement = document.getElementById(styleId) as HTMLStyleElement;

    if (!styleElement) {
      styleElement = document.createElement('style');
      styleElement.id = styleId;
      document.head.appendChild(styleElement);
    }

    styleElement.textContent = cssVariables;

    return () => {
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

export default function CTAPreview() {
  const params = useParams();
  const runId = params.runId as string;
  const [ctaData, setCTAData] = useState<CTAResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [showImageModal, setShowImageModal] = useState(false);

  const loadCTAData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Try to load the artifacts from the file system via API
      const response = await fetch(`/api/cta-artifacts/${runId}`);

      if (!response.ok) {
        throw new Error(`Failed to load CTA data: ${response.statusText}`);
      }

      const data = await response.json();
      setCTAData(data);
    } catch (err) {
      console.error('Error loading CTA data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load CTA template');
    } finally {
      setLoading(false);
    }
  };

  const handleRegenerate = async () => {
    try {
      setIsRegenerating(true);
      setError(null);

      const response = await fetch('/api/regenerate-cta', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ runId }),
      });

      if (!response.ok) {
        throw new Error(`Failed to regenerate: ${response.statusText}`);
      }

      const data = await response.json();

      if (data.success) {
        // Reload the CTA data after successful regeneration
        await loadCTAData();
      } else {
        throw new Error(data.error || 'Regeneration failed');
      }
    } catch (err) {
      console.error('Error regenerating CTA:', err);
      setError(err instanceof Error ? err.message : 'Failed to regenerate CTA template');
    } finally {
      setIsRegenerating(false);
    }
  };

  useEffect(() => {
    if (runId) {
      loadCTAData();
    }
  }, [runId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading CTA template...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-600 text-xl mb-4">⚠️</div>
          <h1 className="text-xl font-semibold text-gray-900 mb-2">Error Loading Template</h1>
          <p className="text-gray-600 text-sm">{error}</p>
          <Button
            onClick={() => window.history.back()}
            variant="default"
            className="mt-4 bg-blue-600 hover:bg-blue-700"
          >
            Go Back
          </Button>
        </div>
      </div>
    );
  }

  if (!ctaData) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600">No CTA data found</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="max-w-6xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-lg font-semibold text-gray-900 tracking-tight">
                CTA Template Preview
              </h1>
              <p className="text-xs text-gray-600 mt-0.5">
                {ctaData.metadata.templateName} • {ctaData.selectedTemplate}
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={() => window.history.back()}
                variant="ghost"
                size="sm"
              >
                ← Back
              </Button>
              <Button
                onClick={handleRegenerate}
                disabled={isRegenerating}
                variant="default"
                size="sm"
                className="bg-green-600 hover:bg-green-700"
              >
                {isRegenerating ? 'Regenerating...' : '🔄 Regenerate'}
              </Button>
              <Button
                onClick={() => window.open(`/api/download-cta/${runId}`, '_blank')}
                variant="default"
                size="sm"
                className="bg-blue-600 hover:bg-blue-700"
              >
                Download
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Preview Content */}
      <div className="max-w-6xl mx-auto px-4 py-6">
        {/* Source Screenshot - Compact */}
        {ctaData.tokens && (
          <div className="bg-white rounded-lg shadow-sm border p-5 mb-5">
            <h2 className="text-base font-semibold text-gray-900 mb-4 tracking-tight">
              📸 Source Page Capture
            </h2>
            <div
              className="border rounded-lg overflow-hidden bg-gray-50 cursor-pointer hover:opacity-90 transition-opacity"
              onClick={() => setShowImageModal(true)}
            >
              <img
                src={`/api/artifact/${runId}/raw/page.png`}
                alt="Source page screenshot"
                className="w-full h-auto max-h-48 object-cover object-top"
              />
            </div>
            <p className="text-xs text-gray-600 mt-2">
              Source: <span className="font-mono">{ctaData.url}</span> • Click to zoom
            </p>
          </div>
        )}

        {/* Design Tokens */}
        {ctaData.tokens && (
          <div className="bg-white rounded-lg shadow-sm border p-5 mb-5">
            <h2 className="text-base font-semibold text-gray-900 mb-4 tracking-tight">
              🎨 Extracted Design Tokens
            </h2>
            <div className="space-y-4">
              {/* Color System */}
              <div>
                <h3 className="text-sm font-semibold text-gray-900 mb-2">Colors</h3>
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(ctaData.tokens.colors.semantic).map(([name, color]) => (
                    <div key={name} className="flex items-center gap-2">
                      <div
                        className="w-4 h-4 rounded border"
                        style={{ backgroundColor: color as string }}
                      />
                      <span className="text-xs text-gray-600 capitalize">{name}</span>
                      <span className="text-xs font-mono text-gray-500">{color as string}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Typography */}
              <div>
                <h3 className="text-sm font-semibold text-gray-900 mb-2">Typography</h3>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-gray-600">Fonts:</span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {ctaData.tokens.typography.fontFamilies.slice(0, 3).map((font: string, i: number) => (
                        <span key={i} className="px-2 py-1 bg-gray-100 rounded text-xs">
                          {font.split(',')[0].replace(/['"]/g, '')}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div>
                    <span className="text-gray-600">Weights:</span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {ctaData.tokens.typography.fontWeights.map((weight: number, i: number) => (
                        <span key={i} className="px-2 py-1 bg-gray-100 rounded text-xs font-mono">
                          {weight}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Spacing */}
              <div>
                <h3 className="text-sm font-semibold text-gray-900 mb-2">Spacing</h3>
                <div className="flex flex-wrap gap-1">
                  {ctaData.tokens.spacing.map((space: number, i: number) => (
                    <span key={i} className="px-2 py-1 bg-gray-100 rounded text-xs font-mono">
                      {space}px
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Template Preview */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg shadow-sm border p-5">
              <h2 className="text-base font-semibold text-gray-900 mb-4 tracking-tight">
                Live Preview
              </h2>
              <div className="border rounded-lg p-8 bg-gray-50 min-h-[400px] flex items-center justify-center">
                <DynamicCTAComponent
                  html={ctaData.template.html}
                  cssVariables={ctaData.template.cssVariables}
                />
              </div>
            </div>
          </div>

          {/* Metadata */}
          <div className="space-y-4">
            {/* Template Info */}
            <div className="bg-white rounded-lg shadow-sm border p-4">
              <h3 className="text-sm font-semibold text-gray-900 mb-3 tracking-tight">
                Template Info
              </h3>
              <div className="space-y-2 text-sm">
                <div>
                  <span className="font-medium text-gray-700">Type:</span>
                  <span className="ml-2 text-gray-600">{ctaData.template.templateType}</span>
                </div>
                <div>
                  <span className="font-medium text-gray-700">Name:</span>
                  <span className="ml-2 text-gray-600">{ctaData.metadata.templateName}</span>
                </div>
                <div>
                  <span className="font-medium text-gray-700">Description:</span>
                  <span className="ml-2 text-gray-600">{ctaData.metadata.templateDescription}</span>
                </div>
                <div>
                  <span className="font-medium text-gray-700">Source URL:</span>
                  <a
                    href={ctaData.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ml-2 text-blue-600 hover:underline text-xs break-all"
                  >
                    {ctaData.url}
                  </a>
                </div>
              </div>
            </div>

            {/* Color Palette */}
            <div className="bg-white rounded-lg shadow-sm border p-4">
              <h3 className="text-sm font-semibold text-gray-900 mb-3 tracking-tight">
                Extracted Colors
              </h3>
              <div className="grid grid-cols-2 gap-3">
                {Object.entries(ctaData.template.safeColors).map(([name, color]) => (
                  <div key={name} className="flex items-center gap-2">
                    <div
                      className="w-4 h-4 rounded border"
                      style={{ backgroundColor: color }}
                    />
                    <span className="text-xs font-mono text-gray-600">
                      {name}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Button Variants (if tokens available) */}
            {ctaData.tokens?.buttons?.variants && ctaData.tokens.buttons.variants.length > 0 && (
              <div className="bg-white rounded-lg shadow-sm border p-4">
                <h3 className="text-sm font-semibold text-gray-900 mb-3 tracking-tight">
                  Detected Buttons
                </h3>
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {ctaData.tokens.buttons.variants
                    .filter((button: any) => button.type !== 'ghost')
                    .slice(0, 5)
                    .map((button: any, i: number) => (
                    <div key={i} className="p-3 bg-gray-50 rounded border text-xs">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium capitalize">{button.type}</span>
                        <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded">
                          {button.count}x
                        </span>
                      </div>
                      <div className="flex justify-center mb-2">
                        <button
                          className="font-mono"
                          style={{
                            backgroundColor: button.backgroundColor,
                            color: button.color,
                            padding: button.padding,
                            fontSize: `${button.fontSize}px`,
                            fontWeight: button.fontWeight,
                            borderRadius: button.borderRadius,
                            border: button.borderColor ? `1px solid ${button.borderColor}` : 'none',
                            cursor: 'default'
                          }}
                        >
                          Button
                        </button>
                      </div>
                      <div className="text-xs text-gray-600">
                        <span className="font-mono">{button.backgroundColor}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="bg-white rounded-lg shadow-sm border p-4">
              <h3 className="text-sm font-semibold text-gray-900 mb-3 tracking-tight">
                Actions
              </h3>
              <div className="space-y-1.5">
                <Button
                  onClick={() => navigator.clipboard.writeText(ctaData.template.componentCode)}
                  variant="secondary"
                  size="sm"
                  className="w-full justify-start"
                >
                  Copy Component Code
                </Button>
                <Button
                  onClick={() => navigator.clipboard.writeText(ctaData.template.cssVariables)}
                  variant="secondary"
                  size="sm"
                  className="w-full justify-start"
                >
                  Copy CSS Variables
                </Button>
                <Button
                  onClick={() => window.open(`/`, '_self')}
                  variant="secondary"
                  size="sm"
                  className="w-full justify-start bg-blue-50 hover:bg-blue-100 text-blue-700"
                >
                  Generate Another
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}