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
    // Configure Tailwind to include all classes we use - using actual captured design tokens
    tailwind.config = {
      theme: {
        extend: {
          colors: {
            brand: {
              100: '${designTokens?.colors?.primary?.[0] || '#000000'}',
              200: '${designTokens?.colors?.primary?.[1] || '#333333'}',
              300: '${designTokens?.colors?.primary?.[2] || '#666666'}',
              400: '${designTokens?.colors?.primary?.[3] || '#999999'}',
            },
            semantic: {
              text: '${designTokens?.colors?.semantic?.text || '#000000'}',
              background: '${designTokens?.colors?.semantic?.background || '#ffffff'}',
              cta: '${designTokens?.colors?.semantic?.cta || '#0066cc'}',
              accent: '${designTokens?.colors?.semantic?.accent || '#ff6b6b'}',
              muted: '${designTokens?.colors?.semantic?.muted || '#666666'}',
            },
            ${designTokens?.colors?.contextual?.buttons?.length ? `
            button: {
              100: '${designTokens.colors.contextual.buttons[0] || '#0066cc'}',
              200: '${designTokens.colors.contextual.buttons[1] || '#4788ff'}',
              300: '${designTokens.colors.contextual.buttons[2] || '#82b1ff'}',
            },` : ''}
            ${designTokens?.colors?.contextual?.links?.length ? `
            link: {
              100: '${designTokens.colors.contextual.links[0] || '#0066cc'}',
              200: '${designTokens.colors.contextual.links[1] || '#4788ff'}',
              300: '${designTokens.colors.contextual.links[2] || '#82b1ff'}',
            },` : ''}
          },
          spacing: {
            ${designTokens?.spacing?.map((space: number, idx: number) => `'${idx}': '${space}px'`).join(',\n            ') || "'0': '0px'"}
          },
          borderRadius: {
            ${designTokens?.borderRadius?.map((radius: string, idx: number) => `'r${idx}': '${radius}'`).join(',\n            ') || "'4': '4px'"}
          },
          fontFamily: {
            primary: [${designTokens?.typography?.fontFamilies?.map((f: string) => `'${f}'`).join(', ') || "'system-ui'"}]
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

  if (tokens?.colors?.primary?.length) {
    tokens.colors.primary.forEach((color: string, index: number) => {
      vars.push(`--color-primary-${index + 1}: ${color};`);
    });
  }

  if (tokens?.colors?.neutral?.length) {
    tokens.colors.neutral.forEach((color: string, index: number) => {
      vars.push(`--color-neutral-${index + 1}: ${color};`);
    });
  }

  // Enhanced semantic colors
  if (tokens?.colors?.semantic) {
    vars.push(`--color-text: ${tokens.colors.semantic.text || '#000000'};`);
    vars.push(`--color-background: ${tokens.colors.semantic.background || '#ffffff'};`);
    vars.push(`--color-cta: ${tokens.colors.semantic.cta || '#0066cc'};`);
    vars.push(`--color-accent: ${tokens.colors.semantic.accent || '#ff6b6b'};`);
    vars.push(`--color-muted: ${tokens.colors.semantic.muted || '#666666'};`);
  }

  // Contextual colors
  if (tokens?.colors?.contextual?.buttons?.length) {
    tokens.colors.contextual.buttons.forEach((color: string, index: number) => {
      vars.push(`--color-button-${index + 1}: ${color};`);
    });
  }

  if (tokens?.colors?.contextual?.links?.length) {
    tokens.colors.contextual.links.forEach((color: string, index: number) => {
      vars.push(`--color-link-${index + 1}: ${color};`);
    });
  }

  // Typography
  if (tokens?.typography?.fontFamilies?.length) {
    vars.push(`--font-family: ${tokens.typography.fontFamilies.join(', ')};`);
  }

  // Spacing
  if (tokens?.spacing?.length) {
    tokens.spacing.forEach((space: number, index: number) => {
      vars.push(`--spacing-${index}: ${space}px;`);
    });
  }

  // Border radius
  if (tokens?.borderRadius?.length) {
    tokens.borderRadius.forEach((radius: string, index: number) => {
      vars.push(`--radius-${index}: ${radius};`);
    });
  }

  // Shadows
  if (tokens?.boxShadow?.length) {
    tokens.boxShadow.forEach((shadow: string, index: number) => {
      vars.push(`--shadow-${index}: ${shadow};`);
    });
  }

  return vars.join('\n      ');
}