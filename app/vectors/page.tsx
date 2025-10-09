'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { VectorScatterPlot } from '@/components/vector-scatter-plot';
import { Button } from '@/components/ui/button';

interface PCAData {
  type: string;
  dimensions: number;
  projections: Array<{
    id: string;
    runId: string;
    sourceUrl: string;
    x: number;
    y: number;
    brandTone: string;
    brandEnergy: string;
    visualModel: string;
    capturedAt: string;
  }>;
  explainedVariance: {
    pc1: number;
    pc2: number;
    total: number;
  };
  count: number;
}

export default function VectorsPage() {
  const router = useRouter();
  const [interpretableData, setInterpretableData] = useState<PCAData | null>(null);
  const [visualData, setVisualData] = useState<PCAData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchPCAData = async () => {
      try {
        setLoading(true);

        // Fetch both PCA projections in parallel
        const [interpretableRes, visualRes] = await Promise.all([
          fetch('/api/vectors/pca?type=interpretable'),
          fetch('/api/vectors/pca?type=visual'),
        ]);

        if (!interpretableRes.ok || !visualRes.ok) {
          throw new Error('Failed to fetch PCA data');
        }

        const [interpretable, visual] = await Promise.all([
          interpretableRes.json(),
          visualRes.json(),
        ]);

        setInterpretableData(interpretable);
        setVisualData(visual);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };

    fetchPCAData();
  }, []);

  const handlePointClick = (id: string) => {
    router.push(`/vectors/${id}`);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Computing PCA projections...</p>
        </div>
      </div>
    );
  }

  if (error || !interpretableData || !visualData) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-600 text-xl mb-4">⚠️</div>
          <h1 className="text-xl font-semibold text-gray-900 mb-2">Error Loading Vectors</h1>
          <p className="text-gray-600 text-sm mb-4">{error}</p>
          <Button onClick={() => window.location.reload()} variant="default">
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between mb-2">
            <div>
              <h1 className="text-2xl font-semibold text-gray-900 tracking-tight">
                Vector Space Visualization
              </h1>
              <p className="text-sm text-gray-600 mt-1">
                PCA projection of brand style vectors • {interpretableData.count} brands
              </p>
            </div>
            <Button
              onClick={() => router.push('/')}
              variant="ghost"
              size="sm"
            >
              ← Back to Home
            </Button>
          </div>

          {/* Stats Row */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-6">
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="text-xs font-medium text-green-700 mb-1">Style Embeddings</div>
              <div className="text-2xl font-bold text-green-900">{interpretableData.dimensions}D → 2D</div>
              <div className="text-xs text-green-600 mt-1">
                {interpretableData.explainedVariance.total}% variance captured
              </div>
            </div>

            <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
              <div className="text-xs font-medium text-purple-700 mb-1">Visual Embeddings</div>
              <div className="text-2xl font-bold text-purple-900">{visualData.dimensions}D → 2D</div>
              <div className="text-xs text-purple-600 mt-1">
                {visualData.explainedVariance.total}% variance captured
              </div>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="text-xs font-medium text-blue-700 mb-1">Visual Model</div>
              <div className="text-lg font-bold text-blue-900">OpenAI CLIP</div>
              <div className="text-xs text-blue-600 mt-1">
                {visualData.projections[0]?.visualModel || 'openai-clip'}
              </div>
            </div>

            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              <div className="text-xs font-medium text-gray-700 mb-1">Total Brands</div>
              <div className="text-2xl font-bold text-gray-900">{interpretableData.count}</div>
              <div className="text-xs text-gray-600 mt-1">
                Click point to view details
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Brand Thumbnails Grid */}
      <div className="max-w-7xl mx-auto px-6 py-6">
        <div className="bg-white border rounded-lg p-6">
          <h3 className="text-base font-semibold text-gray-900 mb-4">Brand Screenshots</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {interpretableData.projections.map((projection) => {
              const hostname = new URL(projection.sourceUrl).hostname.replace('www.', '');

              return (
                <button
                  key={projection.id}
                  onClick={() => handlePointClick(projection.id)}
                  className="group relative overflow-hidden rounded-lg border-2 border-gray-200 hover:border-blue-500 transition-all cursor-pointer bg-white"
                >
                  {/* Thumbnail */}
                  <div className="relative w-full h-24 bg-gray-100 overflow-hidden">
                    <img
                      src={`/api/artifact/${projection.runId}/raw/page.png`}
                      alt={hostname}
                      className="w-full h-full object-cover object-top group-hover:scale-105 transition-transform duration-200"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.style.display = 'none';
                      }}
                    />
                  </div>

                  {/* Label */}
                  <div className="p-2 bg-white border-t">
                    <div className="text-xs font-medium text-gray-900 truncate text-center">
                      {hostname}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* PCA Plots */}
      <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">
        {/* Interpretable (Style Tokens) Plot */}
        <VectorScatterPlot
          data={interpretableData.projections}
          title="🎨 Style Token Embeddings (55D)"
          explainedVariance={{
            pc1: interpretableData.explainedVariance.pc1,
            pc2: interpretableData.explainedVariance.pc2,
          }}
          onPointClick={handlePointClick}
        />

        {/* Visual (CLIP) Plot */}
        <VectorScatterPlot
          data={visualData.projections}
          title="👁️ Visual Embeddings (768D CLIP)"
          explainedVariance={{
            pc1: visualData.explainedVariance.pc1,
            pc2: visualData.explainedVariance.pc2,
          }}
          onPointClick={handlePointClick}
        />


      </div>
    </div>
  );
}
