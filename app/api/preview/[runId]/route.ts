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

    // Check if run directory exists
    if (!existsSync(runDir)) {
      return NextResponse.json({
        success: false,
        error: 'Run not found'
      }, { status: 404 });
    }

    // Try to load the main generated component
    const componentsDir = join(runDir, 'components');
    const cssPath = join(runDir, 'styles.css');

    if (!existsSync(componentsDir)) {
      return NextResponse.json({
        success: false,
        error: 'No components found for this run'
      }, { status: 404 });
    }

    // Load CSS styles
    let cssContent = '';
    if (existsSync(cssPath)) {
      cssContent = await readFile(cssPath, 'utf8');
    }

    // Load the main component (assume it's the first one or named MainColumnContainer)
    const fs = await import('fs');
    const componentFiles = fs.readdirSync(componentsDir).filter(file => file.endsWith('.tsx'));

    if (componentFiles.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No component files found'
      }, { status: 404 });
    }

    // Find the main component file (usually the largest or container component)
    const mainComponentFile = componentFiles.find(file =>
      file.includes('MainColumn') || file.includes('Container')
    ) || componentFiles[0];

    const componentPath = join(componentsDir, mainComponentFile);
    const componentCode = await readFile(componentPath, 'utf8');

    // Extract the JSX content from the component to render as HTML
    const html = await convertComponentToHTML(componentCode, runId);

    return NextResponse.json({
      success: true,
      html,
      css: cssContent,
      componentFile: mainComponentFile
    });

  } catch (error) {
    console.error('❌ Preview generation failed:', error);

    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Preview generation failed'
    }, { status: 500 });
  }
}

async function convertComponentToHTML(componentCode: string, runId: string): Promise<string> {
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