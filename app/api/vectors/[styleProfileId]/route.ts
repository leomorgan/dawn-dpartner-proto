import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { query } from '@/lib/db/client';

export async function GET(
  request: NextRequest,
  { params }: { params: { styleProfileId: string } }
) {
  try {
    const { styleProfileId } = params;

    // Fetch vector profile with capture and CTA data
    const result = await query(`
      SELECT
        sp.id as style_profile_id,
        sp.source_url,
        sp.tokens_json,
        sp.interpretable_vec,
        sp.visual_vec,
        sp.combined_vec,
        sp.ux_summary,
        sp.created_at,
        c.id as capture_id,
        c.run_id,
        c.screenshot_uri,
        c.dom_uri,
        c.captured_at,
        c.viewport,
        rc.id as cta_id,
        rc.vec as cta_vec,
        rc.tokens_json as cta_tokens,
        rc.confidence as cta_confidence,
        rc.ux_report as cta_ux_report
      FROM style_profiles sp
      JOIN captures c ON c.id = sp.capture_id
      LEFT JOIN role_vectors_primarycta rc ON rc.style_profile_id = sp.id
      WHERE sp.id = $1
    `, [styleProfileId]);

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: 'Vector profile not found' },
        { status: 404 }
      );
    }

    const profile = result.rows[0];

    // Load artifacts from filesystem
    const baseDir = join(process.cwd(), 'artifacts');
    const runDir = join(baseDir, profile.run_id);

    let designTokens = null;
    let styleReport = null;

    try {
      const tokensPath = join(runDir, 'design_tokens.json');
      const reportPath = join(runDir, 'style_report.json');

      designTokens = JSON.parse(await readFile(tokensPath, 'utf-8'));
      styleReport = JSON.parse(await readFile(reportPath, 'utf-8'));
    } catch (err) {
      console.warn('Could not load artifact files:', err);
    }

    // Parse the vector arrays from string format
    const parseVector = (vecString: string): number[] => {
      if (!vecString) return [];
      // Remove brackets and split by comma
      return vecString
        .replace(/^\[|\]$/g, '')
        .split(',')
        .map(v => parseFloat(v.trim()));
    };

    return NextResponse.json({
      styleProfile: {
        id: profile.style_profile_id,
        source_url: profile.source_url,
        tokens: profile.tokens_json,
        interpretable_vec: parseVector(profile.interpretable_vec),
        visual_vec: parseVector(profile.visual_vec),
        combined_vec: parseVector(profile.combined_vec),
        ux_summary: profile.ux_summary,
        created_at: profile.created_at
      },
      ctaVector: profile.cta_id ? {
        id: profile.cta_id,
        vec: parseVector(profile.cta_vec),
        tokens: profile.cta_tokens,
        confidence: profile.cta_confidence,
        ux_report: profile.cta_ux_report
      } : null,
      capture: {
        id: profile.capture_id,
        runId: profile.run_id,
        screenshot_uri: profile.screenshot_uri,
        dom_uri: profile.dom_uri,
        captured_at: profile.captured_at,
        viewport: profile.viewport
      },
      artifacts: {
        designTokens,
        styleReport
      }
    });
  } catch (error) {
    console.error('Error fetching vector profile:', error);
    return NextResponse.json(
      { error: 'Failed to fetch vector profile' },
      { status: 500 }
    );
  }
}
