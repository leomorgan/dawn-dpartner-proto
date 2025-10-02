import { NextRequest, NextResponse } from 'next/server';
import { capture } from '@/pipeline/capture';
import { extractTokens } from '@/pipeline/tokens';
import { buildVectors } from '@/pipeline/vectors';
import { storeVectors } from '@/pipeline/storage';

export const maxDuration = 300; // 5 minutes

/**
 * POST /api/vectorize
 *
 * Runs the full vectorization pipeline:
 * 1. Capture page
 * 2. Extract tokens
 * 3. Build vectors
 * 4. Store in database
 */
export async function POST(request: NextRequest) {
  try {
    const { url } = await request.json();

    if (!url) {
      return NextResponse.json(
        { error: 'URL is required' },
        { status: 400 }
      );
    }

    console.log(`🚀 Starting vectorization for: ${url}`);

    // Step 1: Capture
    console.log('📸 Step 1: Capturing page...');
    const captureResult = await capture(url);
    console.log(`✓ Captured: ${captureResult.runId}`);

    // Step 2: Extract tokens
    console.log('🎨 Step 2: Extracting design tokens...');
    await extractTokens(captureResult.runId);
    console.log('✓ Tokens extracted');

    // Step 3: Build vectors
    console.log('🔢 Step 3: Building vectors...');
    await buildVectors(captureResult.runId);
    console.log('✓ Vectors built');

    // Step 4: Store in database
    console.log('💾 Step 4: Storing in database...');
    const stored = await storeVectors(captureResult.runId);
    console.log(`✓ Stored: ${stored.styleProfileId}`);

    console.log('✅ Vectorization complete!');

    return NextResponse.json({
      success: true,
      runId: captureResult.runId,
      styleProfileId: stored.styleProfileId,
      stats: stored.stats,
      url: url,
    });

  } catch (error: any) {
    console.error('❌ Vectorization failed:', error);
    return NextResponse.json(
      {
        error: 'Vectorization failed',
        message: error.message
      },
      { status: 500 }
    );
  }
}
