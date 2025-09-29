'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';

interface CTAResult {
  runId: string;
  url: string;
  template: {
    componentCode: string;
    cssVariables: string;
    templateType: 'card' | 'banner' | 'modal';
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
  };
  selectedTemplate: string;
  metadata: {
    templateName: string;
    templateDescription: string;
  };
}

// Phase 3.2: Fix Preview Rendering with React.createElement() approach
function DynamicCTAComponent({ cssVariables }: { cssVariables: string }) {
  useEffect(() => {
    // Inject CSS variables into the page
    const style = document.createElement('style');
    style.textContent = cssVariables;
    document.head.appendChild(style);

    return () => {
      document.head.removeChild(style);
    };
  }, [cssVariables]);

  // Phase 3.2: Create clean component with React.createElement instead of JSX-to-HTML conversion
  return (
    <div
      style={{
        backgroundColor: 'var(--cta-background)',
        color: 'var(--cta-text)',
        padding: 'var(--cta-container-padding)',
        borderRadius: 'var(--cta-button-radius)',
        fontFamily: 'var(--cta-font-family)'
      }}
      className="max-w-sm mx-auto shadow-lg"
    >
      <header
        style={{ marginBottom: 'var(--cta-section-spacing)' }}
        className="text-center"
      >
        <h1
          style={{ color: 'var(--cta-text)' }}
          className="text-2xl font-semibold m-0"
        >
          Header
        </h1>
      </header>

      <div
        style={{ gap: 'var(--cta-element-spacing)' }}
        className="flex justify-center"
      >
        <button
          style={{
            backgroundColor: 'var(--cta-secondary-bg)',
            color: 'var(--cta-secondary-text)',
            padding: 'var(--cta-button-padding)',
            borderRadius: 'var(--cta-button-radius)',
            border: 'var(--cta-button-border)',
            fontSize: 'var(--cta-button-font-size)',
            fontWeight: 'var(--cta-button-font-weight)',
            lineHeight: 'var(--cta-button-line-height)',
            transition: 'var(--cta-transition)'
          }}
          className="cursor-pointer inline-flex items-center justify-center text-center transition-all duration-200 ease-in-out"
          onMouseOver={(e) => {
            const target = e.target as HTMLButtonElement;
            target.style.backgroundColor = 'var(--cta-secondary-hover-bg)';
            target.style.color = 'var(--cta-secondary-hover-color)';
            target.style.opacity = 'var(--cta-secondary-hover-opacity)';
            target.style.transform = 'var(--cta-secondary-hover-transform)';
          }}
          onMouseOut={(e) => {
            const target = e.target as HTMLButtonElement;
            target.style.backgroundColor = 'var(--cta-secondary-bg)';
            target.style.color = 'var(--cta-secondary-text)';
            target.style.opacity = '1';
            target.style.transform = 'none';
          }}
        >
          Cancel
        </button>
        <button
          style={{
            backgroundColor: 'var(--cta-primary-bg)',
            color: 'var(--cta-primary-text)',
            padding: 'var(--cta-button-padding)',
            borderRadius: 'var(--cta-button-radius)',
            border: 'var(--cta-button-border)',
            fontSize: 'var(--cta-button-font-size)',
            fontWeight: 'var(--cta-button-font-weight)',
            lineHeight: 'var(--cta-button-line-height)',
            transition: 'var(--cta-transition)'
          }}
          className="cursor-pointer inline-flex items-center justify-center text-center transition-all duration-200 ease-in-out"
          onMouseOver={(e) => {
            const target = e.target as HTMLButtonElement;
            target.style.backgroundColor = 'var(--cta-primary-hover-bg)';
            target.style.color = 'var(--cta-primary-hover-color)';
            target.style.opacity = 'var(--cta-primary-hover-opacity)';
            target.style.transform = 'var(--cta-primary-hover-transform)';
          }}
          onMouseOut={(e) => {
            const target = e.target as HTMLButtonElement;
            target.style.backgroundColor = 'var(--cta-primary-bg)';
            target.style.color = 'var(--cta-primary-text)';
            target.style.opacity = '1';
            target.style.transform = 'none';
          }}
        >
          Accept
        </button>
      </div>
    </div>
  );
}

export default function CTAPreview() {
  const params = useParams();
  const runId = params.runId as string;
  const [ctaData, setCTAData] = useState<CTAResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadCTAData() {
      try {
        setLoading(true);

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
    }

    if (runId) {
      loadCTAData();
    }
  }, [runId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 font-mono">Loading CTA template...</p>
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
          <p className="text-gray-600 font-mono text-sm">{error}</p>
          <button
            onClick={() => window.history.back()}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 font-mono text-sm"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  if (!ctaData) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600 font-mono">No CTA data found</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="max-w-6xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-semibold text-gray-900 font-mono">
                CTA Template Preview
              </h1>
              <p className="text-sm text-gray-600 font-mono">
                {ctaData.metadata.templateName} • {ctaData.selectedTemplate} • {runId}
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => window.history.back()}
                className="px-4 py-2 text-gray-600 hover:text-gray-900 font-mono text-sm"
              >
                ← Back
              </button>
              <button
                onClick={() => window.open(`/api/download-cta/${runId}`, '_blank')}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 font-mono text-sm"
              >
                Download
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Preview Content */}
      <div className="max-w-6xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Template Preview */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg shadow-sm border p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4 font-mono">
                Live Preview
              </h2>
              <div className="border rounded-lg p-8 bg-gray-50 min-h-[400px] flex items-center justify-center">
                <DynamicCTAComponent
                  cssVariables={ctaData.template.cssVariables}
                />
              </div>
            </div>
          </div>

          {/* Metadata */}
          <div className="space-y-6">
            {/* Template Info */}
            <div className="bg-white rounded-lg shadow-sm border p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 font-mono">
                Template Info
              </h3>
              <div className="space-y-3 text-sm">
                <div>
                  <span className="font-medium text-gray-700">Type:</span>
                  <span className="ml-2 font-mono text-gray-600">{ctaData.template.templateType}</span>
                </div>
                <div>
                  <span className="font-medium text-gray-700">Name:</span>
                  <span className="ml-2 font-mono text-gray-600">{ctaData.metadata.templateName}</span>
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
                    className="ml-2 text-blue-600 hover:underline font-mono text-xs break-all"
                  >
                    {ctaData.url}
                  </a>
                </div>
              </div>
            </div>

            {/* Color Palette */}
            <div className="bg-white rounded-lg shadow-sm border p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 font-mono">
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

            {/* Actions */}
            <div className="bg-white rounded-lg shadow-sm border p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 font-mono">
                Actions
              </h3>
              <div className="space-y-2">
                <button
                  onClick={() => navigator.clipboard.writeText(ctaData.template.componentCode)}
                  className="w-full px-3 py-2 text-left text-sm bg-gray-50 hover:bg-gray-100 rounded font-mono"
                >
                  Copy Component Code
                </button>
                <button
                  onClick={() => navigator.clipboard.writeText(ctaData.template.cssVariables)}
                  className="w-full px-3 py-2 text-left text-sm bg-gray-50 hover:bg-gray-100 rounded font-mono"
                >
                  Copy CSS Variables
                </button>
                <button
                  onClick={() => window.open(`/`, '_self')}
                  className="w-full px-3 py-2 text-left text-sm bg-blue-50 hover:bg-blue-100 text-blue-700 rounded font-mono"
                >
                  Generate Another
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}