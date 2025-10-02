import type { DesignTokens, StyleReport } from '../tokens';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { buildGlobalStyleVec } from './global-style-vec';
import { buildPrimaryCtaVec } from './primary-cta-vec';

export type { GlobalStyleVec, PrimaryCtaVec, VectorResult } from './types';

export interface VectorBuildResult {
  runId: string;
  globalStyleVec: {
    interpretable: Float32Array;
    visual: Float32Array;
    combined: Float32Array;
    metadata: { featureNames: string[]; nonZeroCount: number };
  };
  primaryCtaVec: {
    interpretable: Float32Array;
    visual: Float32Array;
    combined: Float32Array;
    metadata: { featureNames: string[]; nonZeroCount: number; buttonIndex: number };
  };
  tokens: DesignTokens;
  report: StyleReport;
}

export async function buildVectors(
  runId: string,
  artifactDir?: string
): Promise<VectorBuildResult> {
  const baseDir = artifactDir || join(process.cwd(), 'artifacts');
  const runDir = join(baseDir, runId);

  // Read design tokens
  const tokensPath = join(runDir, 'design_tokens.json');
  const tokens: DesignTokens = JSON.parse(
    await readFile(tokensPath, 'utf8')
  );

  // Read style report
  const reportPath = join(runDir, 'style_report.json');
  const report: StyleReport = JSON.parse(
    await readFile(reportPath, 'utf8')
  );

  // Validate inputs
  if (!tokens.colors || !tokens.colors.primary) {
    throw new Error(`Invalid tokens: missing colors.primary`);
  }

  if (!report.brandPersonality) {
    throw new Error(`Invalid report: missing brandPersonality`);
  }

  // Build vectors
  const globalStyleVec = buildGlobalStyleVec(tokens, report);
  const primaryCtaVec = buildPrimaryCtaVec(tokens, report);

  // Verify dimensions
  if (globalStyleVec.combined.length !== 192) {
    throw new Error(`GlobalStyleVec must be 192D, got ${globalStyleVec.combined.length}D`);
  }

  if (primaryCtaVec.combined.length !== 64) {
    throw new Error(`PrimaryCtaVec must be 64D, got ${primaryCtaVec.combined.length}D`);
  }

  return {
    runId,
    globalStyleVec,
    primaryCtaVec,
    tokens,
    report
  };
}
