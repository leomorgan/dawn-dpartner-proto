'use client';

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';

interface ComponentModule {
  [key: string]: React.ComponentType<any>;
  default?: any;
}

export default function RenderArtifactPage() {
  const params = useParams();
  const runId = params.runId as string;
  const [components, setComponents] = useState<ComponentModule | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadComponents() {
      try {
        setLoading(true);

        // Dynamically import the components from the artifact
        const response = await fetch(`/artifacts/${runId}/components/index.ts`);
        if (!response.ok) {
          throw new Error(`Failed to load components: ${response.statusText}`);
        }

        const indexContent = await response.text();

        // Parse the exports to get component names
        const exportMatches = indexContent.match(/export\s+\{\s*([^}]+)\s*\}/g);
        const componentNames: string[] = [];

        if (exportMatches) {
          exportMatches.forEach(match => {
            const names = match.replace(/export\s+\{\s*/, '').replace(/\s*\}/, '');
            names.split(',').forEach(name => {
              const componentName = name.trim().split(/\s+/)[0];
              if (componentName && !componentName.includes('type') && !componentName.includes('Props')) {
                componentNames.push(componentName);
              }
            });
          });
        }

        // Load each component
        const loadedComponents: ComponentModule = {};

        for (const componentName of componentNames) {
          try {
            const componentResponse = await fetch(`/artifacts/${runId}/components/${componentName}.tsx`);
            if (componentResponse.ok) {
              const componentCode = await componentResponse.text();

              // Create a dynamic component (simplified approach)
              // This is a basic implementation - in production you'd want proper compilation
              const ComponentPreview = () => (
                <div className="border border-gray-200 rounded-lg p-4 mb-4">
                  <h3 className="text-lg font-semibold mb-2">{componentName}</h3>
                  <div className="bg-gray-50 p-4 rounded">
                    <pre className="text-xs overflow-auto max-h-64">
                      <code>{componentCode}</code>
                    </pre>
                  </div>
                </div>
              );

              loadedComponents[componentName] = ComponentPreview;
            }
          } catch (err) {
            console.warn(`Failed to load component ${componentName}:`, err);
          }
        }

        setComponents(loadedComponents);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load components');
      } finally {
        setLoading(false);
      }
    }

    if (runId) {
      loadComponents();
    }
  }, [runId]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-gray-900 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading components...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-600 text-xl font-semibold mb-2">Error</div>
          <p className="text-gray-600">{error}</p>
          <div className="mt-4">
            <a
              href={`/artifacts/${runId}/components/index.ts`}
              target="_blank"
              className="text-blue-600 hover:underline"
            >
              View raw index.ts file
            </a>
          </div>
        </div>
      </div>
    );
  }

  if (!components || Object.keys(components).length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-gray-600 text-xl font-semibold mb-2">No Components Found</div>
          <p className="text-gray-500">No renderable components found in this artifact.</p>
          <div className="mt-4">
            <a
              href={`/artifacts/${runId}/components/`}
              target="_blank"
              className="text-blue-600 hover:underline"
            >
              Browse artifact files
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-6xl mx-auto px-4">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Artifact Components
          </h1>
          <p className="text-gray-600">Run ID: {runId}</p>
          <div className="mt-4 flex gap-4">
            <a
              href={`/preview/${runId}`}
              className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
            >
              View Live Preview
            </a>
            <a
              href={`/artifacts/${runId}/components/`}
              target="_blank"
              className="bg-gray-600 text-white px-4 py-2 rounded hover:bg-gray-700"
            >
              Browse Files
            </a>
          </div>
        </div>

        <div className="space-y-6">
          {Object.entries(components).map(([name, Component]) => (
            <div key={name} className="bg-white rounded-lg shadow-lg overflow-hidden">
              <div className="bg-gray-100 px-6 py-3 border-b">
                <h2 className="text-xl font-semibold text-gray-800">{name}</h2>
                <a
                  href={`/artifacts/${runId}/components/${name}.tsx`}
                  target="_blank"
                  className="text-sm text-blue-600 hover:underline"
                >
                  View source →
                </a>
              </div>
              <div className="p-6">
                <Component />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}