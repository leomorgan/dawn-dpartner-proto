import { readFile } from 'fs/promises';
import { join } from 'path';
import type { GeneratedComponent } from './index';

export async function generatePreviewHTML(
  components: GeneratedComponent[],
  runId: string,
  designTokens?: any
): Promise<string> {
  // Find the PageLayout component
  const pageLayout = components.find(c => c.name === 'PageLayout');
  if (!pageLayout) {
    throw new Error('PageLayout component not found');
  }

  // Extract all component code
  const componentCode = components
    .filter(c => !c.isOrchestrator)
    .map(c => {
      // Convert TypeScript/JSX to JavaScript for browser
      // Remove TypeScript types and interfaces
      let jsCode = c.code
        .replace(/export interface.*?\{[\s\S]*?\}\n\n/g, '')
        .replace(/: React\.FC<.*?>/g, '')
        .replace(/: string/g, '')
        .replace(/: number/g, '')
        .replace(/: boolean/g, '')
        .replace(/: any/g, '')
        .replace(/className\?: ?/g, 'className')
        .replace(/export const/g, 'const')
        .replace(/export default.*;/g, '');

      return jsCode;
    })
    .join('\n\n');

  // Process PageLayout separately
  const pageLayoutCode = pageLayout.code
    .replace(/export interface.*?\{[\s\S]*?\}\n\n/g, '')
    .replace(/import \{.*?\} from.*?;\n/g, '') // Remove component imports
    .replace(/: React\.FC<.*?>/g, '')
    .replace(/: string/g, '')
    .replace(/className\?: ?/g, 'className')
    .replace(/export const/g, 'const')
    .replace(/export default.*;/g, '');

  // Get CSS variables from design tokens
  const cssVariables = designTokens ? generateCSSVariables(designTokens) : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Preview - ${runId}</title>
  <script crossorigin src="https://unpkg.com/react@18/umd/react.production.min.js"></script>
  <script crossorigin src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"></script>
  <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    :root {
      ${cssVariables}
    }
    body {
      margin: 0;
      padding: 0;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif;
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
      background: #f9fafb;
    }
    #root {
      min-height: 100vh;
      padding: 20px;
    }
    /* Custom component styles */
    .component-summary { transition: all 0.3s ease; }
    .component-data-table { transition: all 0.3s ease; }
    .component-chart { transition: all 0.3s ease; }
    .component-form { transition: all 0.3s ease; }
    .component-support { transition: all 0.3s ease; }
  </style>
  <script>
    // Configure Tailwind to include all classes we use
    tailwind.config = {
      theme: {
        extend: {
          colors: {
            brand: {
              50: '#f0f9ff',
              100: '#e0f2fe',
              200: '#bae6fd',
              300: '#7dd3fc',
              400: '#38bdf8',
              500: '#635bff',
              600: '#425466',
              700: '#0a2540',
              800: '#1e40af',
              900: '#1e3a8a',
            }
          },
          borderRadius: {
            '4': '4px',
            '8': '8px',
            '16.5': '16.5px'
          }
        }
      }
    }
  </script>
</head>
<body>
  <div id="root"></div>

  <script type="text/babel">
    const { useState, useEffect } = React;
    const { createRoot } = ReactDOM;

    // Component definitions
    ${componentCode}

    // PageLayout component
    ${pageLayoutCode}

    // App wrapper
    const App = () => {
      return (
        <div className="container mx-auto">
          <div className="mb-4 p-4 bg-white rounded-lg shadow-sm">
            <h1 className="text-xl font-semibold text-gray-800">Component Preview</h1>
            <p className="text-sm text-gray-600">Run ID: ${runId}</p>
          </div>
          <PageLayout />
        </div>
      );
    };

    // Mount the app
    const container = document.getElementById('root');
    const root = createRoot(container);
    root.render(<App />);
  </script>
</body>
</html>`;
}

function generateCSSVariables(tokens: any): string {
  const vars: string[] = [];

  if (tokens.colors) {
    // Primary colors
    if (tokens.colors.primary && Array.isArray(tokens.colors.primary)) {
      tokens.colors.primary.forEach((color: string, i: number) => {
        vars.push(`--color-primary-${i + 1}: ${color};`);
      });
    }

    // Neutral colors
    if (tokens.colors.neutral && Array.isArray(tokens.colors.neutral)) {
      tokens.colors.neutral.forEach((color: string, i: number) => {
        vars.push(`--color-neutral-${i + 1}: ${color};`);
      });
    }

    // Semantic colors
    if (tokens.colors.semantic) {
      Object.entries(tokens.colors.semantic).forEach(([key, value]) => {
        vars.push(`--color-${key}: ${value};`);
      });
    }
  }

  return vars.join('\n      ');
}