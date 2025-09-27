import { NextRequest, NextResponse } from 'next/server';
import { capture } from '../../../pipeline/capture';
import { extractTokens } from '../../../pipeline/tokens';
import {
  selectTemplate,
  applyTokensToTemplate,
  cardTemplate,
  bannerTemplate,
  modalTemplate
} from '../../../pipeline/cta-template';

function generateRunId(url?: string): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const uuid = Math.random().toString(36).substring(2, 10);

  if (url) {
    try {
      const urlObj = new URL(url);
      const hostname = urlObj.hostname.replace(/^www\./, '');
      const urlSuffix = hostname.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
      return `${timestamp}_${uuid}_${urlSuffix}_cta`;
    } catch {
      return `${timestamp}_${uuid}_cta`;
    }
  }

  return `${timestamp}_${uuid}_cta`;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { url, template = 'auto' } = body;

    // Validate input
    if (!url) {
      return NextResponse.json({
        success: false,
        error: 'URL is required'
      }, { status: 400 });
    }

    // Validate URL format
    try {
      new URL(url);
    } catch (error) {
      return NextResponse.json({
        success: false,
        error: 'Invalid URL format'
      }, { status: 400 });
    }

    const runId = generateRunId(url);

    console.log(`🚀 Starting CTA generation for: ${url}`);
    console.log(`📝 Template: ${template}`);
    console.log(`🆔 Run ID: ${runId}`);

    // 1. Capture (reuse existing)
    console.log('📸 Capturing website...');
    await capture(url, undefined, runId);
    console.log('✅ Capture completed');

    // 2. Extract tokens (reuse existing)
    console.log('🎨 Extracting design tokens...');
    const tokensResult = await extractTokens(runId);
    console.log('✅ Tokens extracted');

    // 3. Select and apply template
    console.log('🎯 Selecting template...');
    const selectedTemplate = selectTemplate();
    console.log(`✅ Selected template: ${selectedTemplate.type}`);

    console.log('💅 Applying styles to template...');
    const styledTemplate = await applyTokensToTemplate(
      selectedTemplate,
      tokensResult.tokens,
      runId
    );
    console.log('✅ Template styling completed');

    const result = {
      runId,
      url,
      template: styledTemplate,
      tokens: tokensResult.tokens,
      selectedTemplate: selectedTemplate.type,
      preview: `/preview-cta/${runId}`,
      metadata: {
        templateName: selectedTemplate.name,
        templateDescription: selectedTemplate.description,
        totalDuration: Date.now() - parseInt(runId.split('_')[0].replace(/-/g, ':'))
      }
    };

    console.log(`✅ CTA generation completed successfully`);
    console.log(`📁 Run ID: ${result.runId}`);

    return NextResponse.json({
      success: true,
      result
    });

  } catch (error) {
    console.error('❌ CTA generation failed:', error);

    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'CTA generation failed'
    }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    name: 'AI Design Partner CTA API',
    version: '1.0.0',
    description: 'Generate CTA templates with extracted design tokens',
    endpoints: {
      'POST /api/generate-cta': 'Execute CTA template generation',
      'GET /api/cta-templates': 'Get available template information'
    },
    templates: [
      {
        type: 'card',
        name: cardTemplate.name,
        description: cardTemplate.description,
        complexity: cardTemplate.structure.complexity
      },
      {
        type: 'banner',
        name: bannerTemplate.name,
        description: bannerTemplate.description,
        complexity: bannerTemplate.structure.complexity
      },
      {
        type: 'modal',
        name: modalTemplate.name,
        description: modalTemplate.description,
        complexity: modalTemplate.structure.complexity
      }
    ]
  });
}