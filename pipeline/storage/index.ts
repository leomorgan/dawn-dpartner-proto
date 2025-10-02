import { readFile } from 'fs/promises';
import { join } from 'path';
import { parse, converter } from 'culori';
import { buildVectors } from '../vectors';
import { buildVisualEmbedding } from '../vectors/visual-embedding';
import { normalizeL2 } from '../vectors/utils';
import { transaction } from '../../lib/db/client';
import type { DesignTokens, StyleReport } from '../tokens';

export interface StorageResult {
  runId: string;
  captureId: string;
  styleProfileId: string;
  primaryCtaId: string | null;
  stats: {
    globalVecDim: number;
    ctaVecDim: number;
    tokensSize: number;
    hasCtaButton: boolean;
  };
}

interface CaptureMetadata {
  url: string;
  viewport: { width: number; height: number };
  timestamp: string;
  userAgent?: string;
  title?: string;
}

function floatArrayToPgVector(vec: Float32Array): string {
  return `[${Array.from(vec).join(',')}]`;
}

function calculateContrast(l1: number, l2: number): number {
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

export async function storeVectors(
  runId: string,
  artifactDir?: string
): Promise<StorageResult> {
  const baseDir = artifactDir || join(process.cwd(), 'artifacts');
  const runDir = join(baseDir, runId);

  // 1. Read metadata from raw/meta.json
  const metaPath = join(runDir, 'raw', 'meta.json');
  const meta: CaptureMetadata = JSON.parse(await readFile(metaPath, 'utf8'));

  // 2. Build interpretable vectors
  console.log(`Building interpretable vectors for ${runId}...`);
  const vectorResult = await buildVectors(runId, artifactDir);

  // 3. Build visual embedding (CLIP)
  console.log(`Building visual embedding (CLIP) for ${runId}...`);
  let visualEmbedding: number[] | null = null;
  let visualModel: string | null = null;

  try {
    const visualResult = await buildVisualEmbedding(runId);
    visualEmbedding = visualResult.embedding;
    visualModel = visualResult.model;
    console.log(`✓ Visual embedding: ${visualResult.dimensions}D from ${visualResult.model}`);
  } catch (error) {
    console.warn(`⚠️  Visual embedding failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    console.warn(`   Continuing with interpretable vectors only...`);
  }

  // 4. Read tokens and report for DB storage
  const tokensPath = join(runDir, 'design_tokens.json');
  const tokens: DesignTokens = JSON.parse(await readFile(tokensPath, 'utf8'));

  const reportPath = join(runDir, 'style_report.json');
  const report: StyleReport = JSON.parse(await readFile(reportPath, 'utf8'));

  // 5. Build combined vector with proper L2 normalization
  // Normalize each vector separately before concatenation to ensure equal contribution
  const interpretableVec = Array.from(vectorResult.globalStyleVec.interpretable);
  const visualVec = visualEmbedding || new Array(768).fill(0); // Use zeros if CLIP failed (768D from openai/clip)

  // L2 normalize both vectors to unit length (CLIP is already normalized, but normalize explicitly for consistency)
  const interpretableNorm = normalizeL2(interpretableVec);
  const visualNorm = normalizeL2(visualVec);

  // Concatenate normalized vectors - each contributes equally
  const combinedVec = [...interpretableNorm, ...visualNorm];

  // 6. Build UX summary for style_profiles
  const uxSummary = {
    contrastMedian: report.contrastResults?.aaPassRate || 0,
    brandPersonality: report.brandPersonality?.tone || 'professional',
    designSystemMaturity: report.designSystemAnalysis?.maturityLevel || 'developing',
    consistencyScore: report.designSystemAnalysis?.consistency?.overall || 0
  };

  // 7. Prepare CTA data (handle missing primary button gracefully)
  const primaryButton = tokens.buttons?.variants?.find((v: any) => v.type === 'primary');
  const hasCtaButton = !!primaryButton;

  let ctaTokensJson = null;
  let ctaUxReport = null;
  let ctaConfidence = null;

  if (hasCtaButton && primaryButton) {
    // Parse background and color to get luminance
    const toLab = converter('lab');
    const bgColor = toLab(parse(primaryButton.backgroundColor));
    const fgColor = toLab(parse(primaryButton.color));

    const bgL = bgColor?.l !== undefined ? bgColor.l : 50;
    const fgL = fgColor?.l !== undefined ? fgColor.l : 50;
    const contrast = calculateContrast(bgL / 100, fgL / 100);

    ctaTokensJson = {
      backgroundColor: primaryButton.backgroundColor,
      color: primaryButton.color,
      borderColor: primaryButton.borderColor,
      fontWeight: primaryButton.fontWeight || 500,
      fontSize: primaryButton.fontSize || 16,
      borderRadius: primaryButton.borderRadius || '4px',
      padding: primaryButton.padding || '8px 16px',
      textContent: primaryButton.textContent || null
    };

    // Parse padding to extract x and y (e.g., "8px 16px")
    const paddingParts = primaryButton.padding.split(' ').map(p => parseFloat(p));
    const paddingY = paddingParts[0] || 8;
    const paddingX = paddingParts[1] || paddingParts[0] || 16;

    ctaUxReport = {
      contrast,
      wcagLevel: contrast >= 7 ? 'AAA' : contrast >= 4.5 ? 'AA' : 'fail',
      minTapSidePx: Math.min(
        paddingX * 2 + 100,
        paddingY * 2 + 20
      ),
      prominence: primaryButton.prominence?.score || 0
    };

    // Simple confidence score based on contrast and prominence
    const contrastScore = Math.min(Math.max(contrast / 7, 0), 1);
    const prominenceScore = Math.min(Math.max(primaryButton.prominence?.score || 0.5, 0), 1);
    ctaConfidence = Math.min(Math.max((contrastScore + prominenceScore) / 2, 0), 1);
  }

  // 8. Build file:// URIs for artifacts
  const domUri = `file://${join(runDir, 'raw', 'dom.html')}`;
  const cssUri = `file://${join(runDir, 'raw', 'computed_styles.json')}`;
  const screenshotUri = `file://${join(runDir, 'raw', 'page.png')}`;

  // 9. Transaction: insert all rows atomically
  console.log(`Storing vectors in database...`);

  const result = await transaction(async (client) => {
    // Insert capture
    const captureRes = await client.query(
      `INSERT INTO captures (
        run_id, source_url, viewport, dom_uri, css_uri, screenshot_uri,
        captured_at, user_agent, page_title
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      ON CONFLICT (run_id) DO UPDATE SET
        source_url = EXCLUDED.source_url,
        viewport = EXCLUDED.viewport,
        dom_uri = EXCLUDED.dom_uri,
        css_uri = EXCLUDED.css_uri,
        screenshot_uri = EXCLUDED.screenshot_uri
      RETURNING id`,
      [
        runId,
        meta.url,
        JSON.stringify(meta.viewport),
        domUri,
        cssUri,
        screenshotUri,
        meta.timestamp,
        meta.userAgent || null,
        meta.title || null
      ]
    );
    const captureId = captureRes.rows[0].id;

    // Insert style_profile
    // First check if one exists for this capture_id
    const existingProfile = await client.query(
      `SELECT id FROM style_profiles WHERE capture_id = $1`,
      [captureId]
    );

    let styleProfileId;
    if (existingProfile.rows.length > 0) {
      // Update existing
      const updateRes = await client.query(
        `UPDATE style_profiles SET
          tokens_json = $2,
          style_vec = $3,
          interpretable_vec = $4,
          visual_vec = $5,
          combined_vec = $6,
          visual_model = $7,
          visual_embedding_date = NOW(),
          ux_summary = $8
        WHERE capture_id = $1
        RETURNING id`,
        [
          captureId,
          JSON.stringify(tokens),
          floatArrayToPgVector(vectorResult.globalStyleVec.combined), // Keep old 192D for backward compat
          `[${interpretableVec.join(',')}]`,  // New: 64D interpretable
          `[${visualVec.join(',')}]`,         // New: 512D visual
          `[${combinedVec.join(',')}]`,       // New: 576D combined
          visualModel,
          JSON.stringify(uxSummary)
        ]
      );
      styleProfileId = updateRes.rows[0].id;
    } else {
      // Insert new
      const styleProfileRes = await client.query(
        `INSERT INTO style_profiles (
          capture_id, source_url, tokens_json, style_vec,
          interpretable_vec, visual_vec, combined_vec, visual_model, visual_embedding_date,
          ux_summary
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), $9)
        RETURNING id`,
        [
          captureId,
          meta.url,
          JSON.stringify(tokens),
          floatArrayToPgVector(vectorResult.globalStyleVec.combined), // Keep old 192D for backward compat
          `[${interpretableVec.join(',')}]`,  // New: 64D interpretable
          `[${visualVec.join(',')}]`,         // New: 512D visual
          `[${combinedVec.join(',')}]`,       // New: 576D combined
          visualModel,
          JSON.stringify(uxSummary)
        ]
      );
      styleProfileId = styleProfileRes.rows[0].id;
    }

    // Insert role_vectors_primarycta (if we have a primary button)
    let primaryCtaId: string | null = null;

    if (hasCtaButton && ctaTokensJson) {
      // Check if one exists for this style_profile_id
      const existingCta = await client.query(
        `SELECT id FROM role_vectors_primarycta WHERE style_profile_id = $1`,
        [styleProfileId]
      );

      if (existingCta.rows.length > 0) {
        // Update existing
        const updateRes = await client.query(
          `UPDATE role_vectors_primarycta SET
            vec = $2,
            tokens_json = $3,
            exemplars = $4,
            ux_report = $5,
            confidence = $6
          WHERE style_profile_id = $1
          RETURNING id`,
          [
            styleProfileId,
            floatArrayToPgVector(vectorResult.primaryCtaVec.combined),
            JSON.stringify(ctaTokensJson),
            JSON.stringify([]),
            JSON.stringify(ctaUxReport),
            ctaConfidence
          ]
        );
        primaryCtaId = updateRes.rows[0].id;
      } else {
        // Insert new
        const ctaRes = await client.query(
          `INSERT INTO role_vectors_primarycta (
            style_profile_id, vec, tokens_json, exemplars, ux_report, confidence
          ) VALUES ($1, $2, $3, $4, $5, $6)
          RETURNING id`,
          [
            styleProfileId,
            floatArrayToPgVector(vectorResult.primaryCtaVec.combined),
            JSON.stringify(ctaTokensJson),
            JSON.stringify([]),
            JSON.stringify(ctaUxReport),
            ctaConfidence
          ]
        );
        primaryCtaId = ctaRes.rows[0].id;
      }
    }

    return { captureId, styleProfileId, primaryCtaId };
  });

  console.log(`✅ Stored vectors for ${runId}`);
  console.log(`  - Capture ID: ${result.captureId}`);
  console.log(`  - Style Profile ID: ${result.styleProfileId}`);
  console.log(`  - Primary CTA ID: ${result.primaryCtaId || 'N/A (no primary button)'}`);

  return {
    runId,
    captureId: result.captureId,
    styleProfileId: result.styleProfileId,
    primaryCtaId: result.primaryCtaId,
    stats: {
      globalVecDim: vectorResult.globalStyleVec.combined.length,
      ctaVecDim: vectorResult.primaryCtaVec.combined.length,
      tokensSize: JSON.stringify(tokens).length,
      hasCtaButton
    }
  };
}
