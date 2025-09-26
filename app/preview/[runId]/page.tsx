'use client';

import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';

interface ComponentPreviewProps {
  runId: string;
}

function ComponentPreview({ runId }: ComponentPreviewProps) {
  const [componentHtml, setComponentHtml] = useState<string>('');
  const [cssContent, setCssContent] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadComponentPreview = async () => {
      try {
        const response = await fetch(`/api/preview/${runId}`);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        if (data.success) {
          setComponentHtml(data.html);
          setCssContent(data.css);
        } else {
          throw new Error(data.error || 'Failed to load preview');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load preview');
      } finally {
        setLoading(false);
      }
    };

    loadComponentPreview();
  }, [runId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-4">🔄</div>
          <div className="text-xl font-medium text-gray-600">Loading Component Preview...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-4">❌</div>
          <div className="text-xl font-medium text-red-600 mb-2">Preview Error</div>
          <div className="text-gray-600">{error}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Preview Header */}
      <div className="bg-white border-b shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Component Preview</h1>
              <p className="text-sm text-gray-500">Run ID: {runId}</p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => window.open(`/api/download/${runId}`, '_blank')}
                className="bg-blue-600 text-white px-4 py-2 rounded-md font-medium hover:bg-blue-700 transition-colors"
              >
                📦 Download Components
              </button>
              <button
                onClick={() => window.close()}
                className="bg-gray-600 text-white px-4 py-2 rounded-md font-medium hover:bg-gray-700 transition-colors"
              >
                ✕ Close
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Component Preview Area */}
      <div className="max-w-7xl mx-auto p-6">
        <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
          <div className="border-b bg-gray-50 px-4 py-2">
            <div className="text-sm font-medium text-gray-700">Generated Component</div>
          </div>

          {/* Render the component with styles */}
          <div className="p-6">
            <style dangerouslySetInnerHTML={{ __html: cssContent }} />
            <div dangerouslySetInnerHTML={{ __html: componentHtml }} />
          </div>
        </div>

        {/* CSS Code Viewer */}
        <div className="mt-6 bg-white rounded-lg shadow-sm border overflow-hidden">
          <div className="border-b bg-gray-50 px-4 py-2">
            <div className="text-sm font-medium text-gray-700">Generated CSS</div>
          </div>
          <div className="p-4">
            <pre className="text-sm bg-gray-900 text-green-400 p-4 rounded overflow-auto max-h-96">
              <code>{cssContent}</code>
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function PreviewPage() {
  const params = useParams();
  const runId = params?.runId as string;

  if (!runId) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-4">❌</div>
          <div className="text-xl font-medium text-red-600">Invalid Run ID</div>
        </div>
      </div>
    );
  }

  return <ComponentPreview runId={runId} />;
}