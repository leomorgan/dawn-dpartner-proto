import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';

export async function GET(
  request: NextRequest,
  { params }: { params: { runId: string } }
) {
  try {
    const { runId } = params;

    if (!runId) {
      return NextResponse.json({
        success: false,
        error: 'Run ID is required'
      }, { status: 400 });
    }

    const baseDir = join(process.cwd(), 'artifacts');
    const runDir = join(baseDir, runId);
    const previewPath = join(runDir, 'preview.html');

    // Check if run directory exists
    if (!existsSync(runDir)) {
      return NextResponse.json({
        success: false,
        error: 'Run not found'
      }, { status: 404 });
    }

    // First, try to serve the pre-generated preview.html if it exists
    if (existsSync(previewPath)) {
      const htmlContent = await readFile(previewPath, 'utf-8');

      return new NextResponse(htmlContent, {
        status: 200,
        headers: {
          'Content-Type': 'text/html',
        },
      });
    }

    // Fallback to the old method if preview.html doesn't exist
    const componentsDir = join(runDir, 'components');
    const cssPath = join(runDir, 'styles.css');

    if (!existsSync(componentsDir)) {
      return NextResponse.json({
        success: false,
        error: 'No components found for this run. Run codegen to generate preview.html'
      }, { status: 404 });
    }

    // Load CSS styles
    let cssContent = '';
    if (existsSync(cssPath)) {
      cssContent = await readFile(cssPath, 'utf8');
    }

    // Load all components from index.ts
    const indexPath = join(componentsDir, 'index.ts');
    let componentNames: string[] = [];

    if (existsSync(indexPath)) {
      const indexContent = await readFile(indexPath, 'utf8');

      // Extract component names from export statements
      const exportMatches = indexContent.match(/export\s+\{\s*([^}]+)\s*\}/g);

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
    }

    // Fallback: scan for .tsx files if no index.ts or no exports found
    if (componentNames.length === 0) {
      const fs = await import('fs');
      const componentFiles = fs.readdirSync(componentsDir).filter(file => file.endsWith('.tsx'));
      componentNames = componentFiles.map(file => file.replace('.tsx', ''));
    }

    if (componentNames.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No component files found'
      }, { status: 404 });
    }

    // Load and convert all components to HTML
    const htmlParts: string[] = [];
    const componentFiles: string[] = [];

    for (const componentName of componentNames) {
      const componentFile = `${componentName}.tsx`;
      const componentPath = join(componentsDir, componentFile);

      if (existsSync(componentPath)) {
        const componentCode = await readFile(componentPath, 'utf8');
        const componentHtml = await convertComponentToHTML(componentCode, runId, componentName);
        htmlParts.push(componentHtml);
        componentFiles.push(componentFile);
      }
    }

    // Combine all components into a single HTML structure
    const html = `
      <div class="components-container">
        ${htmlParts.join('\n\n')}
      </div>
    `;

    return NextResponse.json({
      success: true,
      html,
      css: cssContent,
      componentFiles: componentFiles
    });

  } catch (error) {
    console.error('❌ Preview generation failed:', error);

    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Preview generation failed'
    }, { status: 500 });
  }
}

async function convertComponentToHTML(componentCode: string, runId: string, componentName?: string): Promise<string> {
  try {
    // Extract the JSX return content from the component
    const jsxMatch = componentCode.match(/return\s*\(\s*([\s\S]*?)\s*\)\s*;/);

    if (!jsxMatch) {
      throw new Error('Could not extract JSX from component');
    }

    let jsxContent = jsxMatch[1].trim();

    // Convert JSX className to class for HTML
    jsxContent = jsxContent.replace(/className=/g, 'class=');

    // Handle style objects (basic conversion)
    jsxContent = jsxContent.replace(/style=\{\{([^}]+)\}\}/g, (match, styleContent) => {
      // Convert JavaScript style object to CSS string
      const cssStyle = styleContent
        .split(',')
        .map((pair: string) => {
          const [key, value] = pair.split(':').map((s: string) => s.trim());
          if (key && value) {
            // Convert camelCase to kebab-case
            const cssKey = key.replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`);
            // Remove quotes from value
            const cssValue = value.replace(/['"]/g, '');
            return `${cssKey}: ${cssValue}`;
          }
          return '';
        })
        .filter(Boolean)
        .join('; ');

      return `style="${cssStyle}"`;
    });

    // Remove React-specific syntax that doesn't work in HTML
    jsxContent = jsxContent.replace(/\{\/\*.*?\*\/\}/g, ''); // Remove JSX comments

    // Wrap with component identifier if provided
    if (componentName) {
      return `
        <div class="component-section" data-component="${componentName}">
          <div class="component-header" style="background: #f3f4f6; padding: 8px 16px; border-bottom: 1px solid #e5e7eb; margin-bottom: 16px;">
            <h3 style="margin: 0; font-size: 16px; font-weight: 600; color: #374151;">${componentName}</h3>
          </div>
          <div class="component-content">
            ${jsxContent}
          </div>
        </div>
      `;
    }

    return jsxContent;

  } catch (error) {
    console.error('❌ JSX to HTML conversion failed:', error);
    return `<div class="p-8 text-center">
      <div class="text-red-600 font-medium">Preview Error</div>
      <div class="text-gray-600 text-sm mt-2">Could not render component: ${error instanceof Error ? error.message : 'Unknown error'}</div>
      <details class="mt-4 text-left">
        <summary class="cursor-pointer text-blue-600">Show Component Code</summary>
        <pre class="mt-2 p-4 bg-gray-100 text-xs overflow-auto"><code>${componentCode}</code></pre>
      </details>
    </div>`;
  }
}