import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db/client';
import { PCA } from 'ml-pca';

export const dynamic = 'force-dynamic';

interface VectorProjection {
  id: string;
  sourceUrl: string;
  x: number;
  y: number;
  brandTone: string;
  brandEnergy: string;
  visualModel: string;
  capturedAt: string;
  runId: string;
}

/**
 * GET /api/vectors/pca?type=interpretable|visual|combined
 *
 * Computes PCA projection (high-D → 2D) for all style profiles
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const type = searchParams.get('type') || 'interpretable';

    // Validate type
    if (!['interpretable', 'visual', 'combined'].includes(type)) {
      return NextResponse.json(
        { error: 'Invalid type. Must be: interpretable, visual, or combined' },
        { status: 400 }
      );
    }

    // Fetch all profiles with vectors
    const result = await query(`
      SELECT
        sp.id,
        sp.source_url,
        sp.interpretable_vec,
        sp.visual_vec,
        sp.combined_vec,
        sp.visual_model,
        sp.ux_summary,
        c.captured_at,
        c.run_id
      FROM style_profiles sp
      JOIN captures c ON c.id = sp.capture_id
      WHERE sp.visual_vec IS NOT NULL
      ORDER BY c.captured_at DESC
    `);

    if (result.rows.length < 2) {
      return NextResponse.json(
        { error: 'Need at least 2 profiles to compute PCA' },
        { status: 400 }
      );
    }

    // Extract vectors based on type
    let vectors: number[][] = [];
    const columnMap = {
      interpretable: 'interpretable_vec',
      visual: 'visual_vec',
      combined: 'combined_vec',
    };

    const column = columnMap[type as keyof typeof columnMap];

    for (const row of result.rows) {
      const vecStr = row[column];
      if (!vecStr) continue;

      // pgvector returns as string like "[1,2,3]"
      const vec = JSON.parse(vecStr.toString());
      vectors.push(vec);
    }

    if (vectors.length < 2) {
      return NextResponse.json(
        { error: 'Insufficient vectors for PCA computation' },
        { status: 400 }
      );
    }

    // Compute PCA (high-D → 2D)
    const pca = new PCA(vectors);
    const projections = pca.predict(vectors, { nComponents: 2 });
    const projectionArray = projections.to2DArray();
    const explainedVariance = pca.getExplainedVariance();

    // Map projections back to profile metadata
    const output: VectorProjection[] = result.rows.map((row, i) => {
      const uxSummary = row.ux_summary || {};

      return {
        id: row.id,
        sourceUrl: row.source_url,
        x: projectionArray[i][0],
        y: projectionArray[i][1],
        brandTone: uxSummary.brandPersonality,
        brandEnergy: uxSummary.designSystemMaturity,
        visualModel: row.visual_model || 'none',
        capturedAt: row.captured_at,
        runId: row.run_id,
      };
    });

    return NextResponse.json({
      type,
      dimensions: vectors[0].length,
      projections: output,
      explainedVariance: {
        pc1: Math.round(explainedVariance[0] * 100),
        pc2: Math.round(explainedVariance[1] * 100),
        total: Math.round((explainedVariance[0] + explainedVariance[1]) * 100),
      },
      count: output.length,
    });

  } catch (error) {
    console.error('PCA computation failed:', error);
    return NextResponse.json(
      {
        error: 'PCA computation failed',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
