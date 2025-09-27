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
    const ctaDir = join(runDir, 'cta');

    // Check if CTA artifacts exist
    if (!existsSync(ctaDir)) {
      return NextResponse.json({
        success: false,
        error: 'CTA artifacts not found'
      }, { status: 404 });
    }

    // Load all CTA artifacts
    const [
      componentCode,
      stylesJson,
      cssVariables,
      metadata,
      tokensJson
    ] = await Promise.all([
      readFile(join(ctaDir, 'CTATemplate.tsx'), 'utf8').catch(() => null),
      readFile(join(ctaDir, 'styles.json'), 'utf8').catch(() => null),
      readFile(join(ctaDir, 'template.css'), 'utf8').catch(() => null),
      readFile(join(ctaDir, 'metadata.json'), 'utf8').catch(() => null),
      readFile(join(runDir, 'design_tokens.json'), 'utf8').catch(() => null)
    ]);

    if (!componentCode || !stylesJson || !cssVariables || !metadata) {
      return NextResponse.json({
        success: false,
        error: 'Incomplete CTA artifacts'
      }, { status: 404 });
    }

    const styles = JSON.parse(stylesJson);
    const metadataObj = JSON.parse(metadata);
    const tokens = tokensJson ? JSON.parse(tokensJson) : null;

    // Extract template type and other info from metadata
    const templateType = metadataObj.templateType || 'card';

    // Create safe colors object from styles and tokens
    const safeColors = {
      primary: styles.primary || '#000000',
      secondary: styles.secondary || '#666666',
      background: styles.background || '#ffffff',
      text: styles.text || '#000000',
      accent: styles.accent || '#0066cc',
      ctaPrimary: styles.primary || '#ff385c',
      ctaSecondary: styles.secondary || '#f7f7f7',
      muted: tokens?.colors?.semantic?.muted || '#666666'
    };

    // Get template name and description based on type
    const templateInfo = {
      card: { name: 'Product Card', description: 'Professional service offering with features and pricing' },
      banner: { name: 'Banner CTA', description: 'Horizontal call-to-action for minimal designs' },
      modal: { name: 'Modal Offer', description: 'Bold, attention-grabbing promotional template' }
    };

    const templateMeta = templateInfo[templateType as keyof typeof templateInfo] || templateInfo.card;

    const result = {
      runId,
      url: extractUrlFromRunId(runId),
      template: {
        componentCode,
        cssVariables,
        templateType,
        safeColors
      },
      selectedTemplate: templateType,
      metadata: {
        templateName: templateMeta.name,
        templateDescription: templateMeta.description,
        generatedAt: metadataObj.generatedAt
      }
    };

    return NextResponse.json(result);

  } catch (error) {
    console.error('Error loading CTA artifacts:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to load CTA artifacts'
    }, { status: 500 });
  }
}

function extractUrlFromRunId(runId: string): string {
  // Extract URL from runId format: timestamp_uuid_hostname_cta
  const parts = runId.split('_');
  if (parts.length >= 3) {
    const hostname = parts.slice(2, -1).join('_').replace(/-/g, '.');
    return `https://${hostname}`;
  }
  return 'Unknown URL';
}