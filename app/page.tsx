'use client';

import { useState } from 'react';

export default function Home() {
  const [url, setUrl] = useState('');
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [runId, setRunId] = useState<string | null>(null);

  const handleGenerate = async () => {
    if (!url.trim() || !prompt.trim()) return;

    setIsGenerating(true);
    try {
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url: url.trim(), prompt: prompt.trim() }),
      });

      const data = await response.json();
      if (data.runId) {
        setRunId(data.runId);
      }
    } catch (error) {
      console.error('Generation failed:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto py-12 px-4">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            AI Design Partner
          </h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Generate crafted React + Tailwind components by analyzing website styles.
            Paste a URL and describe what you want to create.
          </p>
        </div>

        <div className="bg-white rounded-lg shadow-sm border p-8 mb-8">
          <div className="space-y-6">
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
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-500"
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
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>

            <button
              onClick={handleGenerate}
              disabled={isGenerating || !url.trim() || !prompt.trim()}
              className="w-full bg-brand-500 text-white py-3 px-4 rounded-md font-medium hover:bg-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isGenerating ? 'Generating...' : 'Generate Design'}
            </button>
          </div>
        </div>

        {runId && (
          <div className="bg-white rounded-lg shadow-sm border p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">
              Generation Complete
            </h2>
            <p className="text-gray-600 mb-4">
              Run ID: <code className="bg-gray-100 px-2 py-1 rounded">{runId}</code>
            </p>
            <div className="text-sm text-gray-500">
              Debug UI coming soon - pipeline stages will be accessible via tabs.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}