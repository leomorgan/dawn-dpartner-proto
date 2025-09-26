'use client';

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';

interface PreviewData {
  success: boolean;
  html: string;
  css: string;
  componentFiles: string[];
  error?: string;
}

export default function ViewArtifactPage() {
  const params = useParams();
  const runId = params.runId as string;
  const [previewData, setPreviewData] = useState<PreviewData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadPreview() {
      try {
        setLoading(true);
        const response = await fetch(`/api/preview/${runId}`);
        const data = await response.json();
        setPreviewData(data);
      } catch (err) {
        setPreviewData({
          success: false,
          html: '',
          css: '',
          componentFile: '',
          error: err instanceof Error ? err.message : 'Failed to load preview'
        });
      } finally {
        setLoading(false);
      }
    }

    if (runId) {
      loadPreview();
    }
  }, [runId]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading preview...</p>
        </div>
      </div>
    );
  }

  if (!previewData?.success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center max-w-md">
          <div className="text-red-600 text-xl font-semibold mb-2">Preview Error</div>
          <p className="text-gray-600 mb-4">{previewData?.error || 'Failed to generate preview'}</p>
          <div className="space-y-2">
            <a
              href={`/artifacts/${runId}/components/index.ts`}
              target="_blank"
              className="block text-blue-600 hover:underline"
            >
              View index.ts →
            </a>
            <a
              href={`/preview/${runId}`}
              className="block text-blue-600 hover:underline"
            >
              Try existing preview →
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Inject the CSS styles */}
      <style dangerouslySetInnerHTML={{ __html: previewData.css }} />

      {/* Header with controls */}
      <div className="bg-gray-100 border-b px-6 py-3 print:hidden">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-gray-800">
              Component Preview
            </h1>
            <p className="text-sm text-gray-600">
              Run: {runId} | Components: {previewData.componentFiles?.join(', ') || 'Loading...'}
            </p>
          </div>
          <div className="flex gap-2">
            <a
              href={`/preview/${runId}`}
              className="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700"
            >
              Debug View
            </a>
            <a
              href={`/artifacts/${runId}/components/`}
              target="_blank"
              className="bg-gray-600 text-white px-3 py-1 rounded text-sm hover:bg-gray-700"
            >
              Browse Components
            </a>
          </div>
        </div>
      </div>

      {/* Rendered component */}
      <div
        className="w-full"
        dangerouslySetInnerHTML={{ __html: previewData.html }}
      />
    </div>
  );
}