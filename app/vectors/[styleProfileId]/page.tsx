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
            {['overview', 'colors', 'typography', 'layout', 'brand', 'cta'].map(tab => (
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

        {activeTab === 'layout' && (
          <LayoutTab styleVec={styleVec} report={report} />
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
      {/* Vector Health Cards - New Architecture */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Interpretable (Style Tokens) */}
        <div className="bg-white rounded-lg border p-6">
          <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
            🎨 Style Tokens
          </h3>
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="text-3xl font-bold text-gray-900">64D</div>
              <div className="text-xs text-gray-600">Interpretable</div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-semibold text-green-600">{nonZeroCount}</div>
              <div className="text-xs text-gray-600">Active</div>
            </div>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-green-600 h-2 rounded-full"
              style={{ width: `${(nonZeroCount / 64) * 100}%` }}
            ></div>
          </div>
          <p className="text-xs text-gray-500 mt-2">
            Colors, typography, spacing tokens
          </p>
        </div>

        {/* Visual (CLIP) */}
        <div className="bg-white rounded-lg border p-6">
          <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
            👁️ Visual Embedding
          </h3>
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="text-3xl font-bold text-gray-900">768D</div>
              <div className="text-xs text-gray-600">OpenAI CLIP</div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-semibold text-purple-600">✓</div>
              <div className="text-xs text-gray-600">Embedded</div>
            </div>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div className="bg-purple-600 h-2 rounded-full w-full"></div>
          </div>
          <p className="text-xs text-gray-500 mt-2">
            Screenshot visual features (CLIP)
          </p>
        </div>

        {/* Combined */}
        <div className="bg-white rounded-lg border-2 border-blue-500 p-6">
          <h3 className="text-sm font-semibold text-blue-700 mb-4 flex items-center gap-2">
            🔀 Combined
          </h3>
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="text-3xl font-bold text-blue-900">832D</div>
              <div className="text-xs text-blue-600">L2 normalized</div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-semibold text-blue-600">✓</div>
              <div className="text-xs text-blue-600">Hybrid</div>
            </div>
          </div>
          <div className="w-full bg-blue-100 rounded-full h-2">
            <div className="bg-blue-600 h-2 rounded-full w-full"></div>
          </div>
          <p className="text-xs text-blue-600 mt-2">
            64D style + 768D visual (normalized)
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
  const hasNewTierSystem = tokens.colors.foundation !== undefined;

  if (hasNewTierSystem) {
    return <ColorsTabFourTier tokens={tokens} report={report} />;
  } else {
    return <ColorsTabLegacy tokens={tokens} report={report} />;
  }
}

// New 4-Tier Color System Display
function ColorsTabFourTier({ tokens, report }: any) {
  const tierDistribution = report?.realTokenMetrics?.colorHarmony?.tierDistribution;
  const colorHarmony = report?.realTokenMetrics?.colorHarmony;

  return (
    <div className="space-y-6">
      {/* Tier Distribution Stats */}
      {tierDistribution && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-blue-900 mb-3">Color Tier Distribution</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatBox
              label="Brand Colors"
              value={tierDistribution.brandColors}
              color="purple"
              description="Vibrant identity"
            />
            <StatBox
              label="Accent Colors"
              value={tierDistribution.accentColors}
              color="blue"
              description="Muted brand"
            />
            <StatBox
              label="Tinted Neutrals"
              value={tierDistribution.tintedNeutrals}
              color="gray"
              description="Subtle tints"
            />
            <StatBox
              label="Foundation"
              value={tierDistribution.foundation}
              color="slate"
              description="Pure neutrals"
            />
          </div>
        </div>
      )}

      {/* Tier-Specific Saturation Metrics */}
      {colorHarmony && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {colorHarmony.brandColorSaturation !== undefined && (
            <SaturationMetricCard
              title="Brand Saturation"
              value={colorHarmony.brandColorSaturation}
              color="purple"
            />
          )}
          {colorHarmony.accentColorSaturation !== undefined && (
            <SaturationMetricCard
              title="Accent Saturation"
              value={colorHarmony.accentColorSaturation}
              color="blue"
            />
          )}
          {colorHarmony.neutralTint !== undefined && (
            <SaturationMetricCard
              title="Neutral Tint"
              value={colorHarmony.neutralTint}
              color="gray"
            />
          )}
        </div>
      )}

      {/* Brand Colors (Vibrant Identity, Chroma > 50) */}
      <div className="bg-white rounded-lg border-2 border-purple-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-base font-semibold text-gray-900">Brand Colors</h3>
            <p className="text-xs text-gray-600 mt-1">Vibrant identity colors (chroma &gt; 50)</p>
          </div>
          <div className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-xs font-medium">
            {tokens.colors.brandColors.length} colors
          </div>
        </div>
        {tokens.colors.brandColors.length > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {tokens.colors.brandColors.map((color: string, i: number) => (
              <ColorSwatch key={i} color={color} label={`Brand ${i + 1}`} showChroma />
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500 text-sm">
            No vibrant brand colors detected
          </div>
        )}
      </div>

      {/* Accent Colors (Muted Brand, Chroma 20-50) */}
      <div className="bg-white rounded-lg border-2 border-blue-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-base font-semibold text-gray-900">Accent Colors</h3>
            <p className="text-xs text-gray-600 mt-1">Muted brand colors (chroma 20-50)</p>
          </div>
          <div className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">
            {tokens.colors.accentColors.length} colors
          </div>
        </div>
        {tokens.colors.accentColors.length > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {tokens.colors.accentColors.map((color: string, i: number) => (
              <ColorSwatch key={i} color={color} label={`Accent ${i + 1}`} showChroma />
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500 text-sm">
            No accent colors detected
          </div>
        )}
      </div>

      {/* Tinted Neutrals (Subtle Tints, Chroma 5-20) */}
      <div className="bg-white rounded-lg border-2 border-gray-300 p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-base font-semibold text-gray-900">Tinted Neutrals</h3>
            <p className="text-xs text-gray-600 mt-1">Subtle tinted neutrals (chroma 5-20)</p>
          </div>
          <div className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-xs font-medium">
            {tokens.colors.tintedNeutrals.length} colors
          </div>
        </div>
        {tokens.colors.tintedNeutrals.length > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {tokens.colors.tintedNeutrals.map((color: string, i: number) => (
              <ColorSwatch key={i} color={color} label={`Tinted ${i + 1}`} showChroma />
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500 text-sm">
            No tinted neutrals detected
          </div>
        )}
      </div>

      {/* Foundation Colors (Pure Neutrals, Chroma < 5) */}
      <div className="bg-white rounded-lg border-2 border-gray-400 p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-base font-semibold text-gray-900">Foundation Colors</h3>
            <p className="text-xs text-gray-600 mt-1">Pure neutrals (chroma &lt; 5)</p>
          </div>
          <div className="px-3 py-1 bg-gray-200 text-gray-800 rounded-full text-xs font-medium">
            {tokens.colors.foundation.length} colors
          </div>
        </div>
        {tokens.colors.foundation.length > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {tokens.colors.foundation.map((color: string, i: number) => (
              <ColorSwatch key={i} color={color} label={`Foundation ${i + 1}`} showChroma />
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500 text-sm">
            No foundation colors detected
          </div>
        )}
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

// Legacy Color System Display (Backward Compatibility)
function ColorsTabLegacy({ tokens, report }: any) {
  return (
    <div className="space-y-6">
      {/* Legacy System Notice */}
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
        <div className="flex items-center gap-2">
          <span className="px-2 py-1 bg-amber-200 text-amber-900 rounded text-xs font-semibold">
            Legacy
          </span>
          <p className="text-sm text-amber-900">
            This profile uses the legacy 2-tier color classification system.
          </p>
        </div>
      </div>

      {/* Primary Colors */}
      <div className="bg-white rounded-lg border p-6">
        <div className="flex items-center gap-2 mb-4">
          <h3 className="text-base font-semibold text-gray-900">Primary Palette</h3>
          <span className="px-2 py-0.5 bg-gray-200 text-gray-700 rounded text-xs font-medium">
            Legacy
          </span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {tokens.colors.primary.map((color: string, i: number) => (
            <ColorSwatch key={i} color={color} label={`Primary ${i + 1}`} />
          ))}
        </div>
      </div>

      {/* Neutral Colors */}
      <div className="bg-white rounded-lg border p-6">
        <div className="flex items-center gap-2 mb-4">
          <h3 className="text-base font-semibold text-gray-900">Neutral Palette</h3>
          <span className="px-2 py-0.5 bg-gray-200 text-gray-700 rounded text-xs font-medium">
            Legacy
          </span>
        </div>
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

// Helper component for tier distribution stats
function StatBox({ label, value, color, description }: {
  label: string;
  value: number;
  color: 'purple' | 'blue' | 'gray' | 'slate';
  description: string;
}) {
  const colorClasses = {
    purple: 'bg-purple-50 border-purple-200 text-purple-900',
    blue: 'bg-blue-50 border-blue-200 text-blue-900',
    gray: 'bg-gray-50 border-gray-200 text-gray-900',
    slate: 'bg-slate-50 border-slate-200 text-slate-900',
  };

  return (
    <div className={`rounded-lg border p-3 ${colorClasses[color]}`}>
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-xs font-semibold mt-0.5">{label}</div>
      <div className="text-[10px] opacity-75 mt-0.5">{description}</div>
    </div>
  );
}

// Helper component for saturation metrics
function SaturationMetricCard({ title, value, color }: {
  title: string;
  value: number;
  color: 'purple' | 'blue' | 'gray';
}) {
  const colorClasses = {
    purple: 'border-purple-200 text-purple-700 bg-purple-50',
    blue: 'border-blue-200 text-blue-700 bg-blue-50',
    gray: 'border-gray-300 text-gray-700 bg-gray-50',
  };

  const barColorClasses = {
    purple: 'bg-purple-600',
    blue: 'bg-blue-600',
    gray: 'bg-gray-600',
  };

  const percentage = Math.round(value * 100);

  return (
    <div className={`rounded-lg border-2 p-4 ${colorClasses[color]}`}>
      <div className="text-xs font-medium mb-1 opacity-75">{title}</div>
      <div className="text-2xl font-bold mb-2">{percentage}%</div>
      <div className="w-full bg-white/50 rounded-full h-2">
        <div
          className={`h-2 rounded-full transition-all ${barColorClasses[color]}`}
          style={{ width: `${percentage}%` }}
        ></div>
      </div>
    </div>
  );
}

// Enhanced ColorSwatch with optional chroma display
function ColorSwatch({ color, label, showChroma }: {
  color: string;
  label: string;
  showChroma?: boolean;
}) {
  // Calculate proper LCH chroma using culori (same as backend)
  const getChroma = (hexColor: string): number => {
    try {
      // Use culori for accurate LCH chroma calculation
      const { parse, converter } = require('culori');
      const toLch = converter('lch');
      const parsed = parse(hexColor);
      if (!parsed) return 0;

      const lch = toLch(parsed);
      return Math.round((lch as any).c ?? 0);
    } catch {
      return 0;
    }
  };

  const chromaValue = showChroma ? getChroma(color) : null;

  return (
    <div className="flex flex-col gap-2">
      <div
        className="w-full h-20 rounded-lg border-2 border-gray-200 shadow-sm"
        style={{ backgroundColor: color }}
      ></div>
      <div className="text-xs">
        <div className="font-medium text-gray-700 capitalize">{label}</div>
        <div className="font-mono text-gray-500 text-[10px]">{color}</div>
        {showChroma && chromaValue !== null && (
          <div className="text-[10px] text-gray-400 mt-0.5">
            Chroma: {chromaValue}
          </div>
        )}
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

// Layout Tab - New Layout Features
function LayoutTab({ styleVec, report }: any) {
  // Extract layout features from the style vector (64D interpretable vector)
  // Based on global-style-vec.ts structure:
  // 0-15: Color features
  // 16-31: Typography features (includes hierarchy_depth at 22, weight_contrast at 23)
  // 32-39: Spacing features (includes density_score at 35, whitespace_ratio at 36, padding_consistency at 37, image_text_balance at 38)
  // 40-47: Shape features (includes border_heaviness at 43, shadow_depth at 44, grouping_strength at 45, compositional_complexity at 46)
  // 48-63: Brand features (includes saturation_energy at 62, role_distinction at 63)

  const layoutFeatures = {
    // Typography
    hierarchyDepth: styleVec[22] || 0,
    weightContrast: styleVec[23] || 0,

    // Spacing & Density
    densityScore: styleVec[35] || 0,
    whitespaceRatio: styleVec[36] || 0,
    paddingConsistency: styleVec[37] || 0,
    imageTextBalance: styleVec[38] || 0,

    // Shape & Composition
    borderHeaviness: styleVec[43] || 0,
    shadowDepth: styleVec[44] || 0,
    groupingStrength: styleVec[45] || 0,
    compositionalComplexity: styleVec[46] || 0,

    // Color
    saturationEnergy: styleVec[62] || 0,
    roleDistinction: styleVec[63] || 0,
  };

  return (
    <div className="space-y-6">
      {/* Overview Card */}
      <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-lg p-6">
        <div className="flex items-start gap-4">
          <div className="text-4xl">📐</div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Layout Features
            </h3>
            <p className="text-sm text-gray-700">
              12 new layout features extracted from DOM geometry, visual hierarchy, and compositional analysis.
              These features capture spatial relationships, density, and visual organization patterns.
            </p>
          </div>
        </div>
      </div>

      {/* Typography Features */}
      <FeatureCategoryCard
        title="Typography & Hierarchy"
        icon="🔤"
        color="purple"
        features={[
          {
            name: 'Hierarchy Depth',
            value: layoutFeatures.hierarchyDepth,
            labels: ['Flat', 'Deep'],
            description: 'Visual hierarchy complexity (coefficient of variation of font sizes)'
          },
          {
            name: 'Weight Contrast',
            value: layoutFeatures.weightContrast,
            labels: ['Uniform', 'High Contrast'],
            description: 'Font weight variation for emphasis and visual hierarchy'
          }
        ]}
      />

      {/* Spacing & Density Features */}
      <FeatureCategoryCard
        title="Spacing & Density"
        icon="📏"
        color="blue"
        features={[
          {
            name: 'Visual Density',
            value: layoutFeatures.densityScore,
            labels: ['Minimal', 'Dense'],
            description: 'Overall content density and element packing'
          },
          {
            name: 'Whitespace Breathing',
            value: layoutFeatures.whitespaceRatio,
            labels: ['Tight', 'Generous'],
            description: 'Ratio of empty space to content for breathing room'
          },
          {
            name: 'Padding Consistency',
            value: layoutFeatures.paddingConsistency,
            labels: ['Variable', 'Systematic'],
            description: 'Consistency of spacing patterns across elements'
          },
          {
            name: 'Image-Text Balance',
            value: layoutFeatures.imageTextBalance,
            labels: ['Text-Heavy', 'Image-Heavy'],
            description: 'Ratio of visual to textual content'
          }
        ]}
      />

      {/* Shape & Composition Features */}
      <FeatureCategoryCard
        title="Shape & Composition"
        icon="🎨"
        color="indigo"
        features={[
          {
            name: 'Border Heaviness',
            value: layoutFeatures.borderHeaviness,
            labels: ['Minimal', 'Heavy'],
            description: 'Prevalence and weight of borders and dividers'
          },
          {
            name: 'Shadow Depth',
            value: layoutFeatures.shadowDepth,
            labels: ['Flat', 'Elevated'],
            description: 'Average elevation and shadow intensity'
          },
          {
            name: 'Grouping Strength',
            value: layoutFeatures.groupingStrength,
            labels: ['Loose', 'Tight'],
            description: 'Gestalt proximity and visual grouping patterns'
          },
          {
            name: 'Compositional Complexity',
            value: layoutFeatures.compositionalComplexity,
            labels: ['Simple', 'Complex'],
            description: 'Overall layout complexity and element count'
          }
        ]}
      />

      {/* Color Features */}
      <FeatureCategoryCard
        title="Color Expression"
        icon="🌈"
        color="pink"
        features={[
          {
            name: 'Saturation Energy',
            value: layoutFeatures.saturationEnergy,
            labels: ['Muted', 'Vibrant'],
            description: 'Average color vibrancy and saturation intensity'
          },
          {
            name: 'Role Distinction',
            value: layoutFeatures.roleDistinction,
            labels: ['Subtle', 'High Contrast'],
            description: 'Perceptual color difference between semantic roles (ΔE)'
          }
        ]}
      />

      {/* Feature Vector Raw Data */}
      <div className="bg-white rounded-lg border p-6">
        <h3 className="text-base font-semibold text-gray-900 mb-4">Raw Feature Values</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-xs font-mono">
          {Object.entries(layoutFeatures).map(([key, value]) => (
            <div key={key} className="p-2 bg-gray-50 rounded">
              <div className="text-gray-600 mb-1">{key}</div>
              <div className="text-gray-900 font-semibold">{(value as number).toFixed(4)}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// Feature Category Card Component
function FeatureCategoryCard({
  title,
  icon,
  color,
  features
}: {
  title: string;
  icon: string;
  color: 'purple' | 'blue' | 'indigo' | 'pink';
  features: Array<{
    name: string;
    value: number;
    labels: [string, string];
    description: string;
  }>;
}) {
  const colorClasses = {
    purple: 'border-purple-200 bg-purple-50',
    blue: 'border-blue-200 bg-blue-50',
    indigo: 'border-indigo-200 bg-indigo-50',
    pink: 'border-pink-200 bg-pink-50',
  };

  return (
    <div className={`rounded-lg border-2 p-6 ${colorClasses[color]}`}>
      <div className="flex items-center gap-3 mb-4">
        <span className="text-2xl">{icon}</span>
        <h3 className="text-base font-semibold text-gray-900">{title}</h3>
        <span className="ml-auto px-3 py-1 bg-white/70 text-gray-700 rounded-full text-xs font-medium">
          {features.length} features
        </span>
      </div>
      <div className="space-y-4">
        {features.map((feature) => (
          <FeatureBar
            key={feature.name}
            name={feature.name}
            value={feature.value}
            labels={feature.labels}
            description={feature.description}
          />
        ))}
      </div>
    </div>
  );
}

// Feature Bar Component
function FeatureBar({
  name,
  value,
  labels,
  description
}: {
  name: string;
  value: number;
  labels: [string, string];
  description: string;
}) {
  const percentage = Math.round(value * 100);

  return (
    <div className="bg-white rounded-lg p-4 shadow-sm">
      <div className="flex items-center justify-between mb-2">
        <div>
          <div className="font-semibold text-gray-900 text-sm">{name}</div>
          <div className="text-xs text-gray-600 mt-0.5">{description}</div>
        </div>
        <div className="ml-4 text-right">
          <div className="text-xl font-bold text-gray-900">{percentage}%</div>
        </div>
      </div>
      <div className="relative">
        {/* Progress bar background */}
        <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
          <div
            className="bg-gradient-to-r from-blue-500 to-indigo-600 h-2 rounded-full transition-all duration-300"
            style={{ width: `${percentage}%` }}
          ></div>
        </div>
        {/* Labels */}
        <div className="flex items-center justify-between mt-2 text-[10px] text-gray-500">
          <span>{labels[0]}</span>
          <span>{labels[1]}</span>
        </div>
      </div>
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
