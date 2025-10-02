'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';

interface VectorData {
  styleProfile: {
    id: string;
    source_url: string;
    tokens: any;
    style_vec: number[];
    ux_summary: any;
    created_at: string;
  };
  ctaVector: {
    id: string;
    vec: number[];
    tokens: any;
    confidence: number;
    ux_report: any;
  } | null;
  capture: {
    runId: string;
    screenshot_uri: string;
    captured_at: string;
    viewport: any;
  };
  artifacts: {
    designTokens: any;
    styleReport: any;
  };
}

export default function VectorPage() {
  const params = useParams();
  const styleProfileId = params.styleProfileId as string;

  const [data, setData] = useState<VectorData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [showImageModal, setShowImageModal] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/vectors/${styleProfileId}`);

        if (!response.ok) {
          throw new Error('Failed to fetch vector data');
        }

        const result = await response.json();
        setData(result);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [styleProfileId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading vector analysis...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-600 text-xl mb-4">⚠️</div>
          <h1 className="text-xl font-semibold text-gray-900 mb-2">Error Loading Vector</h1>
          <p className="text-gray-600 text-sm">{error}</p>
          <Button
            onClick={() => window.history.back()}
            variant="default"
            className="mt-4"
          >
            Go Back
          </Button>
        </div>
      </div>
    );
  }

  const tokens = data.artifacts.designTokens;
  const report = data.artifacts.styleReport;
  const styleVec = data.styleProfile.style_vec;
  const ctaVec = data.ctaVector?.vec;

  const nonZeroCount = styleVec.filter(v => v !== 0).length;
  const ctaNonZeroCount = ctaVec ? ctaVec.filter(v => v !== 0).length : 0;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header with Screenshot */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h1 className="text-2xl font-semibold text-gray-900 tracking-tight">
                Vector Analysis
              </h1>
              <p className="text-sm text-gray-600 mt-1">
                <a
                  href={data.styleProfile.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline"
                >
                  {data.styleProfile.source_url}
                </a>
                <span className="mx-2">•</span>
                <span className="text-gray-500">
                  Captured {new Date(data.capture.captured_at).toLocaleString()}
                </span>
              </p>
            </div>
            <Button
              onClick={() => window.history.back()}
              variant="ghost"
              size="sm"
            >
              ← Back
            </Button>
          </div>

          {/* Screenshot Preview */}
          <div
            className="border rounded-lg overflow-hidden bg-gray-100 cursor-pointer hover:opacity-90 transition-opacity"
            onClick={() => setShowImageModal(true)}
          >
            <img
              src={`/api/artifact/${data.capture.runId}/raw/page.png`}
              alt="Captured page"
              className="w-full h-48 object-cover object-top"
            />
          </div>
          <p className="text-xs text-gray-500 mt-2">
            Click to view fullscreen • Run ID: <span className="font-mono">{data.capture.runId}</span>
          </p>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex gap-6">
            {['overview', 'colors', 'typography', 'brand', 'cta'].map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`
                  py-3 px-1 border-b-2 text-sm font-medium capitalize transition-colors
                  ${activeTab === tab
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
                  }
                `}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Tab Content */}
      <div className="max-w-7xl mx-auto px-6 py-6">
        {activeTab === 'overview' && (
          <OverviewTab
            styleVec={styleVec}
            ctaVec={ctaVec}
            nonZeroCount={nonZeroCount}
            ctaNonZeroCount={ctaNonZeroCount}
            report={report}
          />
        )}

        {activeTab === 'colors' && tokens && (
          <ColorsTab tokens={tokens} report={report} />
        )}

        {activeTab === 'typography' && tokens && (
          <TypographyTab tokens={tokens} report={report} />
        )}

        {activeTab === 'brand' && report?.brandPersonality && (
          <BrandTab brandPersonality={report.brandPersonality} />
        )}

        {activeTab === 'cta' && data.ctaVector && (
          <CtaTab ctaVector={data.ctaVector} tokens={tokens} />
        )}
      </div>

      {/* Image Modal */}
      {showImageModal && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setShowImageModal(false)}
        >
          <div className="bg-white rounded-lg max-w-6xl max-h-[90vh] overflow-auto">
            <div className="p-4 border-b flex justify-between items-center sticky top-0 bg-white">
              <h3 className="font-semibold">Captured Page</h3>
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
                src={`/api/artifact/${data.capture.runId}/raw/page.png`}
                alt="Full captured page"
                className="w-full h-auto"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Overview Tab Component
function OverviewTab({ styleVec, ctaVec, nonZeroCount, ctaNonZeroCount, report }: any) {
  return (
    <div className="space-y-6">
      {/* Vector Health Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white rounded-lg border p-6">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Global Style Vector</h3>
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="text-3xl font-bold text-gray-900">192D</div>
              <div className="text-sm text-gray-600">Total dimensions</div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-semibold text-green-600">{nonZeroCount}</div>
              <div className="text-sm text-gray-600">Active features</div>
            </div>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-green-600 h-2 rounded-full"
              style={{ width: `${(nonZeroCount / 192) * 100}%` }}
            ></div>
          </div>
          <p className="text-xs text-gray-500 mt-2">
            Feature Density: {nonZeroCount}/192 ({Math.round((nonZeroCount / 192) * 100)}%)
          </p>
        </div>

        {ctaVec && (
          <div className="bg-white rounded-lg border p-6">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">CTA Vector</h3>
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="text-3xl font-bold text-gray-900">64D</div>
                <div className="text-sm text-gray-600">Total dimensions</div>
              </div>
              <div className="text-right">
                <div className="text-2xl font-semibold text-blue-600">{ctaNonZeroCount}</div>
                <div className="text-sm text-gray-600">Active features</div>
              </div>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-blue-600 h-2 rounded-full"
                style={{ width: `${(ctaNonZeroCount / 64) * 100}%` }}
              ></div>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Feature Density: {ctaNonZeroCount}/64 ({Math.round((ctaNonZeroCount / 64) * 100)}%)
            </p>
          </div>
        )}
      </div>

      {/* Key Metrics */}
      {report && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <MetricCard
            title="Contrast Pass Rate"
            value={`${Math.round((report.contrastResults?.aaPassRate || 0) * 100)}%`}
            score={report.contrastResults?.aaPassRate || 0}
          />
          {report.realTokenMetrics?.brandCoherence && (
            <>
              <MetricCard
                title="Spacing Consistency"
                value={`${Math.round((report.realTokenMetrics.brandCoherence.spacingConsistency || 0) * 100)}%`}
                score={report.realTokenMetrics.brandCoherence.spacingConsistency || 0}
              />
              <MetricCard
                title="Typography Coherence"
                value={`${Math.round((report.realTokenMetrics.brandCoherence.typographyCoherence || 0) * 100)}%`}
                score={report.realTokenMetrics.brandCoherence.typographyCoherence || 0}
              />
            </>
          )}
          {report.brandPersonality && (
            <MetricCard
              title="Brand Confidence"
              value={`${Math.round((report.brandPersonality.confidence || 0) * 100)}%`}
              score={report.brandPersonality.confidence || 0}
            />
          )}
        </div>
      )}
    </div>
  );
}

function MetricCard({ title, value, score }: { title: string; value: string; score: number }) {
  const getColor = (s: number) => {
    if (s >= 0.8) return 'text-green-600 bg-green-50 border-green-200';
    if (s >= 0.6) return 'text-yellow-600 bg-yellow-50 border-yellow-200';
    return 'text-red-600 bg-red-50 border-red-200';
  };

  return (
    <div className={`rounded-lg border p-4 ${getColor(score)}`}>
      <div className="text-xs font-medium mb-1">{title}</div>
      <div className="text-2xl font-bold">{value}</div>
      <div className="w-full bg-white/50 rounded-full h-1 mt-2">
        <div
          className="bg-current h-1 rounded-full"
          style={{ width: `${score * 100}%` }}
        ></div>
      </div>
    </div>
  );
}

// Colors Tab Component
function ColorsTab({ tokens, report }: any) {
  return (
    <div className="space-y-6">
      {/* Primary Colors */}
      <div className="bg-white rounded-lg border p-6">
        <h3 className="text-base font-semibold text-gray-900 mb-4">Primary Palette</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {tokens.colors.primary.map((color: string, i: number) => (
            <ColorSwatch key={i} color={color} label={`Primary ${i + 1}`} />
          ))}
        </div>
      </div>

      {/* Neutral Colors */}
      <div className="bg-white rounded-lg border p-6">
        <h3 className="text-base font-semibold text-gray-900 mb-4">Neutral Palette</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {tokens.colors.neutral.map((color: string, i: number) => (
            <ColorSwatch key={i} color={color} label={`Neutral ${i + 1}`} />
          ))}
        </div>
      </div>

      {/* Semantic Colors */}
      <div className="bg-white rounded-lg border p-6">
        <h3 className="text-base font-semibold text-gray-900 mb-4">Semantic Colors</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Object.entries(tokens.colors.semantic).map(([name, color]) => (
            <ColorSwatch key={name} color={color as string} label={name} />
          ))}
        </div>
      </div>

      {/* Color Harmony */}
      {report?.realTokenMetrics?.colorHarmony && (
        <div className="bg-white rounded-lg border p-6">
          <h3 className="text-base font-semibold text-gray-900 mb-4">Color Harmony</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <div className="text-gray-600">Palette Type</div>
              <div className="font-semibold capitalize mt-1">
                {report.realTokenMetrics.colorHarmony.paletteType}
              </div>
            </div>
            <div>
              <div className="text-gray-600">Harmony Score</div>
              <div className="font-semibold mt-1">
                {(report.realTokenMetrics.colorHarmony.harmonyScore * 100).toFixed(0)}%
              </div>
            </div>
            <div>
              <div className="text-gray-600">Dominant Hue</div>
              <div className="font-semibold mt-1">
                {Math.round(report.realTokenMetrics.colorHarmony.dominantHue)}°
              </div>
            </div>
            <div>
              <div className="text-gray-600">Saturation Avg</div>
              <div className="font-semibold mt-1">
                {(report.realTokenMetrics.colorHarmony.saturationRange.avg * 100).toFixed(0)}%
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ColorSwatch({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex flex-col gap-2">
      <div
        className="w-full h-20 rounded-lg border-2 border-gray-200 shadow-sm"
        style={{ backgroundColor: color }}
      ></div>
      <div className="text-xs">
        <div className="font-medium text-gray-700 capitalize">{label}</div>
        <div className="font-mono text-gray-500 text-[10px]">{color}</div>
      </div>
    </div>
  );
}

// Typography Tab
function TypographyTab({ tokens, report }: any) {
  return (
    <div className="space-y-6">
      {/* Font Families */}
      <div className="bg-white rounded-lg border p-6">
        <h3 className="text-base font-semibold text-gray-900 mb-4">Font Families</h3>
        <div className="space-y-3">
          {tokens.typography.fontFamilies.slice(0, 3).map((font: string, i: number) => (
            <div key={i} className="p-4 bg-gray-50 rounded border">
              <div className="text-sm font-mono text-gray-600 mb-2">{font}</div>
              <div style={{ fontFamily: font }} className="text-lg">
                The quick brown fox jumps over the lazy dog
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Type Scale */}
      <div className="bg-white rounded-lg border p-6">
        <h3 className="text-base font-semibold text-gray-900 mb-4">Type Scale</h3>
        <div className="space-y-2">
          {tokens.typography.fontSizes
            .slice()
            .sort((a: number, b: number) => a - b)
            .map((size: number, i: number) => (
              <div key={i} className="flex items-baseline gap-3">
                <span className="text-xs font-mono text-gray-500 w-12">{size}px</span>
                <div
                  style={{ fontSize: `${size}px` }}
                  className="text-gray-900"
                >
                  Sample Text
                </div>
              </div>
            ))}
        </div>
      </div>

      {/* Font Weights */}
      <div className="bg-white rounded-lg border p-6">
        <h3 className="text-base font-semibold text-gray-900 mb-4">Font Weights</h3>
        <div className="flex flex-wrap gap-2">
          {tokens.typography.fontWeights.map((weight: number, i: number) => (
            <div
              key={i}
              className="px-4 py-2 bg-gray-100 rounded border"
              style={{ fontWeight: weight }}
            >
              {weight}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// Brand Tab
function BrandTab({ brandPersonality }: any) {
  return (
    <div className="space-y-6">
      {/* Personality Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg border p-6">
          <div className="text-sm text-gray-600 mb-2">Tone</div>
          <div className="text-2xl font-bold capitalize">{brandPersonality.tone}</div>
        </div>
        <div className="bg-white rounded-lg border p-6">
          <div className="text-sm text-gray-600 mb-2">Energy</div>
          <div className="text-2xl font-bold capitalize">{brandPersonality.energy}</div>
        </div>
        <div className="bg-white rounded-lg border p-6">
          <div className="text-sm text-gray-600 mb-2">Trust Level</div>
          <div className="text-2xl font-bold capitalize">{brandPersonality.trustLevel}</div>
        </div>
      </div>

      {/* Confidence Meter */}
      <div className="bg-white rounded-lg border p-6">
        <h3 className="text-base font-semibold text-gray-900 mb-4">Brand Confidence</h3>
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <div className="w-full bg-gray-200 rounded-full h-3">
              <div
                className="bg-blue-600 h-3 rounded-full transition-all"
                style={{ width: `${brandPersonality.confidence * 100}%` }}
              ></div>
            </div>
          </div>
          <div className="text-2xl font-bold text-blue-600">
            {Math.round(brandPersonality.confidence * 100)}%
          </div>
        </div>
      </div>

      {/* Color Psychology */}
      {brandPersonality.colorPsychology && (
        <div className="bg-white rounded-lg border p-6">
          <h3 className="text-base font-semibold text-gray-900 mb-4">Color Psychology</h3>
          <div className="space-y-4">
            <div>
              <div className="text-sm text-gray-600 mb-2">Dominant Mood</div>
              <div className="text-lg font-semibold capitalize">
                {brandPersonality.colorPsychology.dominantMood}
              </div>
            </div>
            <div>
              <div className="text-sm text-gray-600 mb-2">Emotional Response</div>
              <div className="flex flex-wrap gap-2">
                {brandPersonality.colorPsychology.emotionalResponse.map((emotion: string, i: number) => (
                  <span key={i} className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm">
                    {emotion}
                  </span>
                ))}
              </div>
            </div>
            <div>
              <div className="text-sm text-gray-600 mb-2">Brand Adjectives</div>
              <div className="flex flex-wrap gap-2">
                {brandPersonality.colorPsychology.brandAdjectives.map((adj: string, i: number) => (
                  <span key={i} className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-sm">
                    {adj}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Spacing Personality */}
      {brandPersonality.spacingPersonality && (
        <div className="bg-white rounded-lg border p-6">
          <h3 className="text-base font-semibold text-gray-900 mb-4">Spacing Personality</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-sm text-gray-600 mb-1">Rhythm</div>
              <div className="text-lg font-semibold capitalize">
                {brandPersonality.spacingPersonality.rhythm}
              </div>
            </div>
            <div>
              <div className="text-sm text-gray-600 mb-1">Consistency</div>
              <div className="text-lg font-semibold capitalize">
                {brandPersonality.spacingPersonality.consistency}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// CTA Tab
function CtaTab({ ctaVector, tokens }: any) {
  const primaryButton = tokens?.buttons?.variants?.find((b: any) => b.type === 'primary') ||
                       tokens?.buttons?.variants?.[0];

  if (!primaryButton) {
    return (
      <div className="bg-white rounded-lg border p-6">
        <p className="text-gray-600">No CTA button data available</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Button Showcase */}
      <div className="bg-white rounded-lg border p-6">
        <h3 className="text-base font-semibold text-gray-900 mb-4">Primary Button</h3>
        <div className="flex flex-col items-center gap-4 p-8 bg-gray-50 rounded-lg">
          <button
            style={{
              backgroundColor: primaryButton.backgroundColor === '#transparent' ? 'transparent' : primaryButton.backgroundColor,
              color: primaryButton.color,
              padding: primaryButton.padding,
              fontSize: `${primaryButton.fontSize}px`,
              fontWeight: primaryButton.fontWeight,
              fontFamily: primaryButton.fontFamily || 'system-ui',
              borderRadius: primaryButton.borderRadius,
              border: primaryButton.borderColor ? `1px solid ${primaryButton.borderColor}` : 'none',
              cursor: 'default'
            }}
            className="transition-transform hover:scale-105"
          >
            {primaryButton.textContent || 'Call to Action'}
          </button>
          <p className="text-xs text-gray-500">
            Confidence: {Math.round((ctaVector.confidence || 0) * 100)}%
          </p>
        </div>
      </div>

      {/* CTA Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg border p-4">
          <div className="text-xs text-gray-600 mb-1">Font Size</div>
          <div className="text-xl font-bold">{primaryButton.fontSize}px</div>
        </div>
        <div className="bg-white rounded-lg border p-4">
          <div className="text-xs text-gray-600 mb-1">Font Weight</div>
          <div className="text-xl font-bold">{primaryButton.fontWeight}</div>
        </div>
        <div className="bg-white rounded-lg border p-4">
          <div className="text-xs text-gray-600 mb-1">Border Radius</div>
          <div className="text-xl font-bold">{primaryButton.borderRadius}</div>
        </div>
        <div className="bg-white rounded-lg border p-4">
          <div className="text-xs text-gray-600 mb-1">Padding</div>
          <div className="text-xl font-bold">{primaryButton.padding}</div>
        </div>
      </div>

      {/* Colors */}
      <div className="bg-white rounded-lg border p-6">
        <h3 className="text-base font-semibold text-gray-900 mb-4">Button Colors</h3>
        <div className="grid grid-cols-2 gap-4">
          <ColorSwatch color={primaryButton.backgroundColor} label="Background" />
          <ColorSwatch color={primaryButton.color} label="Text" />
        </div>
      </div>

      {/* Hover State */}
      {primaryButton.hover && (
        <div className="bg-white rounded-lg border p-6">
          <h3 className="text-base font-semibold text-gray-900 mb-4">Hover State</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
            {primaryButton.hover.backgroundColor && (
              <div>
                <div className="text-gray-600 mb-1">Background</div>
                <div className="flex items-center gap-2">
                  <div
                    className="w-6 h-6 rounded border"
                    style={{ backgroundColor: primaryButton.hover.backgroundColor }}
                  ></div>
                  <span className="font-mono text-xs">{primaryButton.hover.backgroundColor}</span>
                </div>
              </div>
            )}
            {primaryButton.hover.color && (
              <div>
                <div className="text-gray-600 mb-1">Text Color</div>
                <div className="flex items-center gap-2">
                  <div
                    className="w-6 h-6 rounded border"
                    style={{ backgroundColor: primaryButton.hover.color }}
                  ></div>
                  <span className="font-mono text-xs">{primaryButton.hover.color}</span>
                </div>
              </div>
            )}
            {primaryButton.hover.transform && (
              <div>
                <div className="text-gray-600 mb-1">Transform</div>
                <div className="font-mono text-xs">{primaryButton.hover.transform}</div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
