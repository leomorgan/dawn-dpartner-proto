import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db/client';
import { explainCosineSimple, INTERPRETABLE_FEATURE_NAMES, humanizeFeatureName } from '@/lib/vectors/cosine-explainer';
import { extractRawInterpretableValues } from '@/lib/vectors/raw-values-extractor';
import fs from 'fs';
import path from 'path';

export async function GET(
  request: NextRequest,
  { params }: { params: { styleProfileId: string } }
) {
  try {
    const { styleProfileId } = params;

    // First, get the source profile's vector, tokens, and capture info
    const sourceResult = await query(
      `SELECT
        sp.interpretable_vec,
        sp.tokens_json,
        c.run_id
      FROM style_profiles sp
      LEFT JOIN captures c ON c.id = sp.capture_id
      WHERE sp.id = $1`,
      [styleProfileId]
    );

    if (sourceResult.rows.length === 0) {
      return NextResponse.json(
        { error: 'Profile not found' },
        { status: 404 }
      );
    }

    // Convert pgvector to number array (pgvector returns as string "[1,2,3]")
    let sourceVec = sourceResult.rows[0].interpretable_vec;
    if (typeof sourceVec === 'string') {
      sourceVec = JSON.parse(sourceVec);
    }
    sourceVec = Array.from(sourceVec).map(Number);

    // Load source style report from artifacts
    const sourceRunId = sourceResult.rows[0].run_id;
    const sourceTokens = sourceResult.rows[0].tokens_json;
    let sourceReport = null;
    let sourceRawResult = null;

    if (sourceRunId && sourceTokens) {
      try {
        const sourceReportPath = path.join(process.cwd(), 'artifacts', sourceRunId, 'style_report.json');
        if (fs.existsSync(sourceReportPath)) {
          sourceReport = JSON.parse(fs.readFileSync(sourceReportPath, 'utf-8'));
          sourceRawResult = extractRawInterpretableValues(sourceTokens, sourceReport);
        }
      } catch (err) {
        console.warn('Could not load source report:', err);
      }
    }

    // Get similarity scores and vectors for all other profiles
    const result = await query(
      `SELECT
        sp2.id,
        sp2.source_url,
        sp2.created_at,
        sp2.interpretable_vec,
        sp2.tokens_json,
        c.run_id,
        1 - (sp2.interpretable_vec <=> sp1.interpretable_vec) AS style_similarity,
        1 - (sp2.visual_vec <=> sp1.visual_vec) AS clip_similarity
      FROM style_profiles sp1
      CROSS JOIN style_profiles sp2
      LEFT JOIN captures c ON c.id = sp2.capture_id
      WHERE sp1.id = $1
        AND sp2.id != $1
        AND sp2.interpretable_vec IS NOT NULL
        AND sp2.visual_vec IS NOT NULL
      ORDER BY style_similarity DESC`,
      [styleProfileId]
    );

    // Compute feature explanations for each comparison
    const similarities = result.rows.map(row => {
      // Convert pgvector to number array (pgvector returns as string "[1,2,3]")
      let targetVec = row.interpretable_vec;
      if (typeof targetVec === 'string') {
        targetVec = JSON.parse(targetVec);
      }
      targetVec = Array.from(targetVec).map(Number);

      // Load target style report and compute raw values
      const targetRunId = row.run_id;
      const targetTokens = row.tokens_json;
      let targetRawResult = null;

      if (targetRunId && targetTokens) {
        try {
          const targetReportPath = path.join(process.cwd(), 'artifacts', targetRunId, 'style_report.json');
          if (fs.existsSync(targetReportPath)) {
            const targetReport = JSON.parse(fs.readFileSync(targetReportPath, 'utf-8'));
            targetRawResult = extractRawInterpretableValues(targetTokens, targetReport);
          }
        } catch (err) {
          console.warn('Could not load target report:', err);
        }
      }

      // Explain the similarity
      const explanation = explainCosineSimple(
        sourceVec,
        targetVec,
        INTERPRETABLE_FEATURE_NAMES,
        3
      );

      return {
        id: row.id,
        sourceUrl: row.source_url,
        createdAt: row.created_at,
        runId: row.run_id,
        styleSimilarity: parseFloat(row.style_similarity),
        clipSimilarity: parseFloat(row.clip_similarity),
        sourceVector: sourceVec,
        targetVector: targetVec,
        sourceVectorRaw: sourceRawResult?.raw || null,
        targetVectorRaw: targetRawResult?.raw || null,
        rawUnits: sourceRawResult?.units || null,
        rawLabels: sourceRawResult?.labels || null,
        topFeatures: explanation.top.map(f => ({
          name: f.featureName,
          label: humanizeFeatureName(f.featureName),
          weight: f.weightRelative,
          contribution: f.contribution
        })),
        bottomFeatures: explanation.bottom.map(f => ({
          name: f.featureName,
          label: humanizeFeatureName(f.featureName),
          weight: f.weightRelative,
          rawDifference: f.rawDifference || 0
        }))
      };
    });

    return NextResponse.json({
      styleProfileId,
      similarities
    });
  } catch (error: any) {
    console.error('Error fetching similarities:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch similarities' },
      { status: 500 }
    );
  }
}
