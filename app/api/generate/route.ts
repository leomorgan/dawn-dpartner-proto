import { NextRequest, NextResponse } from 'next/server';
import { executeFullPipeline } from '../../../pipeline/orchestration';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { url, prompt, enableDebug = true } = body;

    // Validate input
    if (!url || !prompt) {
      return NextResponse.json({
        success: false,
        error: 'URL and prompt are required'
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

    console.log(`🚀 Starting pipeline execution for: ${url}`);
    console.log(`📝 Prompt: ${prompt}`);

    // Execute the full pipeline
    const result = await executeFullPipeline(
      url,
      prompt,
      {
        enableDebug,
        timeout: 300000 // 5 minutes
      },
      (step) => {
        console.log(`📊 Step update: ${step.name} - ${step.status}`);
      }
    );

    console.log(`✅ Pipeline completed successfully`);
    console.log(`📊 Total duration: ${result.totalDuration}ms`);
    console.log(`📁 Run ID: ${result.runId}`);

    return NextResponse.json({
      success: true,
      result
    });

  } catch (error) {
    console.error('❌ Pipeline execution failed:', error);

    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Pipeline execution failed'
    }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    name: 'AI Design Partner API',
    version: '1.0.0',
    description: 'Generate crafted React + Tailwind components from website analysis',
    endpoints: {
      'POST /api/generate': 'Execute the full design generation pipeline'
    },
    pipeline: {
      steps: [
        'Web Capture',
        'Design Tokens',
        'DOM Scenegraph',
        'Intent Parsing',
        'Layout Synthesis',
        'Styling Engine',
        'Code Generation',
        'Vector Canvas'
      ]
    }
  });
}