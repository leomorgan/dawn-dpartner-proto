import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';
import { getSystemFontFallback } from '@/pipeline/cta-template/font-fallbacks';

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
      tokensJson,
      html
    ] = await Promise.all([
      readFile(join(ctaDir, 'CTATemplate.tsx'), 'utf8').catch(() => null),
      readFile(join(ctaDir, 'styles.json'), 'utf8').catch(() => null),
      readFile(join(ctaDir, 'template.css'), 'utf8').catch(() => null),
      readFile(join(ctaDir, 'metadata.json'), 'utf8').catch(() => null),
      readFile(join(runDir, 'design_tokens.json'), 'utf8').catch(() => null),
      readFile(join(ctaDir, 'template.html'), 'utf8').catch(() => null)
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

    // Apply system font fallbacks to button variants
    if (tokens?.buttons?.variants) {
      tokens.buttons.variants = tokens.buttons.variants.map((button: any) => {
        if (button.fontFamily) {
          return {
            ...button,
            fontFamily: getSystemFontFallback(button.fontFamily)
          };
        }
        return button;
      });
    }

    // Extract template type and other info from metadata
    const templateType = metadataObj.templateType || 'card';

    // Create safe colors object from styles and tokens
    // Use extracted tokens as fallbacks instead of hardcoded values
    const safeColors = {
      primary: styles.primary || tokens?.colors?.primary?.[0] || tokens?.colors?.semantic?.cta || '#0066cc',
      secondary: styles.secondary || tokens?.colors?.neutral?.[0] || '#666666',
      background: styles.background || tokens?.colors?.semantic?.background || '#ffffff',
      text: styles.text || tokens?.colors?.semantic?.text || '#1a1a1a',
      accent: styles.accent || tokens?.colors?.semantic?.accent || '#0066cc',
      ctaPrimary: styles.primary || tokens?.colors?.semantic?.cta || '#0066cc',
      ctaSecondary: styles.secondary || tokens?.colors?.neutral?.[0] || '#f7f7f7',
      muted: tokens?.colors?.semantic?.muted || tokens?.colors?.neutral?.[1] || '#666666'
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
        safeColors,
        html: html || '',
        appliedStyles: styles
      },
      tokens: tokens,
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