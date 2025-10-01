import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';
import {
  selectTemplate,
  applyTokensToTemplate
} from '../../../pipeline/cta-template';
import type { DesignTokens } from '../../../pipeline/tokens';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { runId } = body;

    // Validate input
    if (!runId) {
      return NextResponse.json({
        success: false,
        error: 'Run ID is required'
      }, { status: 400 });
    }

    console.log(`🔄 Starting CTA regeneration for runId: ${runId}`);

    const baseDir = join(process.cwd(), 'artifacts');
    const runDir = join(baseDir, runId);

    // Check if run directory exists
    if (!existsSync(runDir)) {
      return NextResponse.json({
        success: false,
        error: 'Run ID not found. Artifacts do not exist.'
      }, { status: 404 });
    }

    // Load existing design tokens
    const tokensPath = join(runDir, 'design_tokens.json');
    if (!existsSync(tokensPath)) {
      return NextResponse.json({
        success: false,
        error: 'Design tokens not found. Cannot regenerate without existing tokens.'
      }, { status: 404 });
    }

    console.log('📦 Loading existing design tokens...');
    const tokensJson = await readFile(tokensPath, 'utf8');
    const tokens: DesignTokens = JSON.parse(tokensJson);
    console.log('✅ Tokens loaded');

    // Select and apply template (this is the only step that regenerates)
    console.log('🎯 Selecting new template...');
    const selectedTemplate = selectTemplate();
    console.log(`✅ Selected template: ${selectedTemplate.type}`);

    console.log('💅 Applying styles to template...');
    const styledTemplate = await applyTokensToTemplate(
      selectedTemplate,
      tokens,
      runId
    );
    console.log('✅ Template styling completed');

    const result = {
      runId,
      template: styledTemplate,
      tokens,
      selectedTemplate: selectedTemplate.type,
      metadata: {
        templateName: selectedTemplate.name,
        templateDescription: selectedTemplate.description,
        regeneratedAt: new Date().toISOString()
      }
    };

    console.log(`✅ CTA regeneration completed successfully`);
    console.log(`📁 Run ID: ${runId}`);

    return NextResponse.json({
      success: true,
      result
    });

  } catch (error) {
    console.error('❌ CTA regeneration failed:', error);

    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'CTA regeneration failed'
    }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    name: 'AI Design Partner CTA Regeneration API',
    version: '1.0.0',
    description: 'Regenerate CTA templates using existing artifacts (no web scraping)',
    endpoints: {
      'POST /api/regenerate-cta': 'Regenerate CTA template from existing runId'
    },
    usage: {
      note: 'This endpoint reuses existing capture and tokens from a previous run, and only regenerates the CTA template.'
    }
  });
}
