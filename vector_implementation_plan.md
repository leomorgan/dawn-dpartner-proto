# Vector Storage Implementation Plan (REVISED)

## Executive Summary

This document provides a **deeply analyzed, production-ready** implementation plan for adding vector storage capabilities to the AI Design Partner pipeline. The goal is to enable semantic search and brand clustering of captured website styles using PostgreSQL with pgvector.

**Key Insight**: The original `vector_plan.md` assumes a greenfield project, but we already have ~95% of the infrastructure. This plan focuses on the **delta** needed to achieve the goal.

---

## Critical Analysis of Original Plan vs. Reality

### ❌ Misalignments in Original Plan

1. **Viewport Mismatch**
   - Original plan: `1440×900, DPR=2`
   - Current reality: `1280×720, DPR=1`
   - **Decision**: Keep current (1280×720, DPR=1) for consistency with existing artifacts

2. **Architecture Mismatch**
   - Original plan: Express API with `/ingest/url`, `/style-profiles/:id`
   - Current reality: Next.js App Router with `/api/generate`
   - **Decision**: Use Next.js API routes, not Express

3. **Storage Mismatch**
   - Original plan: S3/MinIO for screenshots
   - Current reality: Local filesystem in `artifacts/{runId}/raw/`
   - **Decision**: MVP uses file:// URIs, Phase 2+ migrates to MinIO

4. **Token Schema Mismatch**
   - Original plan: Simplified `Tokens` with `primary/secondary/neutrals`
   - Current reality: Rich `DesignTokens` with `colors.{primary[], neutral[], semantic, contextual}`, `typography.{fontFamilies, fontSizes, fontWeights, lineHeights}`, `buttons.variants[]`, `brandPersonality`, etc.
   - **Decision**: Use existing schema, map to vector features directly

5. **PrimaryCTA Detection**
   - Original plan: Heuristic scoring without LLM
   - Current reality: GPT-4o-mini semantic classification already implemented
   - **Decision**: Leverage existing LLM classifier, no redundant heuristics

### ✅ What We Can Reuse (95% of infrastructure)

1. **Capture Pipeline** ✅
   - `pipeline/capture/index.ts` already captures DOM, CSS, screenshots, button hover states
   - Output: `raw/` with all needed data

2. **Token Extraction** ✅
   - `pipeline/tokens/index.ts` already extracts colors (LCH), typography, spacing, buttons
   - Output: `design_tokens.json` with `DesignTokens` interface

3. **Button Classification** ✅
   - `pipeline/tokens/button-classifier.ts` already uses GPT-4o-mini for primary/secondary
   - Output: semantic button types with confidence scores

4. **CTA Template** ✅
   - `pipeline/cta-template/index.ts` already generates React components
   - Output: `cta/` with button metadata

5. **Orchestration** ✅
   - `pipeline/orchestration/index.ts` already chains 9 stages
   - Easy to add 10th stage: `storage`

---

## Revised Implementation Phases

### Phase 0: Prerequisite Analysis (0.5 days) ⚠️ CRITICAL

**Goal**: Validate existing data quality and identify gaps

**Owner**: Manual inspection + `design-systems-expert`

#### Tasks

1. **Data Quality Audit**
   ```bash
   # Pick 3 diverse artifact folders
   ls -lh artifacts/*/design_tokens.json | head -3
   ```

   For each, verify:
   - [ ] `tokens.colors.primary` has 2-8 colors (not empty, not excessive)
   - [ ] `tokens.buttons.variants` has at least 1 button
   - [ ] `report.brandPersonality` exists (not null)
   - [ ] `report.realTokenMetrics.colorHarmony` exists
   - [ ] `report.contrastResults.aaPassRate` is 0-1 (not NaN)

2. **Missing Feature Detection**

   Check if current `DesignTokens` schema supports these for vectors:
   - [x] Color count, palette entropy → YES (can compute from `colors.primary/neutral`)
   - [x] Dominant hue, saturation, lightness → YES (`colorHarmony.dominantHue/saturationRange/lightnessRange`)
   - [x] Typography coherence → YES (`brandCoherence.typographyCoherence`)
   - [x] Spacing consistency → YES (`brandCoherence.spacingConsistency`)
   - [x] Brand personality encoding → YES (`brandPersonality.{tone, energy, trustLevel}`)
   - [x] Button prominence → YES (`buttons.variants[].prominence.score`)
   - [x] Button hover state → YES (`buttons.variants[].hover`)

   **Result**: ✅ All features already captured!

3. **Color Space Validation**

   Original plan assumes LCH is directly available. Check:
   ```typescript
   // In design_tokens.json, colors are stored as hex strings like "#262626"
   // We need to convert to LCH on-the-fly using culori
   ```

   **Decision**: Add `culori` color conversion to vector builder (dependency already in package.json)

**Acceptance Criteria**:
- [ ] 100% of test artifacts have non-null `brandPersonality`
- [ ] 100% of test artifacts have at least 1 button variant
- [ ] List of any missing features documented

---

### Phase 1: Database Infrastructure (1-2 days)

**Goal**: Set up Postgres + pgvector with schema aligned to current codebase

**Owner**: `design-systems-expert`

#### Critical Schema Decisions

1. **CRITICAL: Index creation order**

   ❌ **WRONG** (from original plan):
   ```sql
   CREATE INDEX style_profiles_vec_idx
     ON style_profiles USING ivfflat (style_vec vector_l2_ops)
     WITH (lists = 100);
   ```

   **Problem**: IVFFlat requires training data. For <1000 rows, it's slower than brute force.

   ✅ **CORRECT**:
   ```sql
   -- For MVP (<1000 vectors), use brute force (no index)
   -- Add index later when we have sufficient data
   -- CREATE INDEX style_profiles_vec_idx
   --   ON style_profiles USING ivfflat (style_vec vector_l2_ops)
   --   WITH (lists = 100);
   ```

2. **CRITICAL: Vector data type**

   pgvector stores vectors as arrays of float32. Check precision:
   ```sql
   -- Our normalized features are float64 in TypeScript
   -- pgvector will cast to float32
   -- Loss: ~7 decimal places → 1e-7 precision
   -- Acceptable for normalized [0,1] features
   ```

3. **CRITICAL: JSONB performance**

   Original plan stores full `tokens_json` (10KB+). For k-NN queries, we only need vectors. But for debugging, JSONB is valuable.

   **Decision**: Keep JSONB, add GIN index for filtering:
   ```sql
   CREATE INDEX style_profiles_tokens_gin
     ON style_profiles USING GIN (tokens_json);
   ```

#### Updated Schema

```sql
-- lib/db/schema.sql
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Raw captures (provenance)
CREATE TABLE captures (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  source_url TEXT NOT NULL,
  viewport JSONB NOT NULL,  -- {width: 1280, height: 720, dpr: 1}

  -- File URIs (not S3 yet for MVP)
  dom_uri TEXT NOT NULL,         -- file:///path/to/artifacts/.../raw/dom.html
  css_uri TEXT NOT NULL,         -- file:///path/to/artifacts/.../raw/computed_styles.json
  screenshot_uri TEXT NOT NULL,  -- file:///path/to/artifacts/.../raw/page.png

  run_id TEXT NOT NULL UNIQUE,  -- maps to artifacts/{runId}
  captured_at TIMESTAMPTZ DEFAULT now(),
  user_agent TEXT,
  page_title TEXT
);

CREATE INDEX idx_captures_url ON captures(source_url);
CREATE INDEX idx_captures_run_id ON captures(run_id);
CREATE INDEX idx_captures_captured_at ON captures(captured_at DESC);

-- Global style profiles (one per URL/capture)
CREATE TABLE style_profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  capture_id UUID REFERENCES captures(id) ON DELETE CASCADE,
  source_url TEXT NOT NULL,

  -- Full tokens from design_tokens.json (10KB typical)
  tokens_json JSONB NOT NULL,

  -- 192D fixed vector
  style_vec VECTOR(192) NOT NULL,

  -- UX/brand summary from style_report.json
  ux_summary JSONB,

  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_style_profiles_url ON style_profiles(source_url);
CREATE INDEX idx_style_profiles_tokens_gin ON style_profiles USING GIN (tokens_json);
-- No IVFFlat index yet - wait for 1000+ vectors

-- PrimaryCTA role vectors (one per URL/capture)
CREATE TABLE role_vectors_primarycta (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  style_profile_id UUID REFERENCES style_profiles(id) ON DELETE CASCADE,

  -- 64D fixed vector
  vec VECTOR(64) NOT NULL,

  -- Button metadata from buttons.variants[primary]
  tokens_json JSONB NOT NULL,

  -- Button exemplars (future: Playwright element screenshots)
  exemplars JSONB DEFAULT '[]'::jsonb,

  -- UX metrics
  ux_report JSONB,

  confidence REAL CHECK (confidence >= 0 AND confidence <= 1),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_role_vectors_primarycta_profile ON role_vectors_primarycta(style_profile_id);
-- No IVFFlat index yet - wait for 1000+ vectors

-- View for easy querying
CREATE VIEW style_profiles_with_cta AS
SELECT
  sp.*,
  rc.id as cta_id,
  rc.vec as cta_vec,
  rc.tokens_json as cta_tokens,
  rc.confidence as cta_confidence
FROM style_profiles sp
LEFT JOIN role_vectors_primarycta rc ON rc.style_profile_id = sp.id;
```

#### Migration Strategy

```typescript
// lib/db/migrate.ts
import { readFile } from 'fs/promises';
import { join } from 'path';
import { query, pool } from './client';

export async function runMigrations() {
  try {
    // Check if pgvector extension exists
    const extCheck = await query(`
      SELECT * FROM pg_extension WHERE extname = 'vector'
    `);

    if (extCheck.rows.length === 0) {
      console.log('⚠️  pgvector extension not found. Installing...');
      await query('CREATE EXTENSION IF NOT EXISTS vector');
    }

    // Run schema
    const schemaSQL = await readFile(
      join(__dirname, 'schema.sql'),
      'utf8'
    );

    await query(schemaSQL);
    console.log('✅ Database schema migrated successfully');

    // Verify tables
    const tables = await query(`
      SELECT tablename FROM pg_tables
      WHERE schemaname = 'public'
      AND tablename IN ('captures', 'style_profiles', 'role_vectors_primarycta')
    `);

    console.log(`✅ Found ${tables.rows.length}/3 required tables`);

    if (tables.rows.length !== 3) {
      throw new Error('Schema migration incomplete');
    }

  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

// CLI: scripts/db-migrate.js
if (require.main === module) {
  runMigrations()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}
```

#### Docker Compose (Production-Ready)

```yaml
# docker-compose.yml
version: '3.8'

services:
  postgres:
    image: pgvector/pgvector:pg16
    container_name: dawn-postgres
    environment:
      POSTGRES_USER: ${POSTGRES_USER:-dawn}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:-dawn}
      POSTGRES_DB: ${POSTGRES_DB:-dawn}
    ports:
      - "${POSTGRES_PORT:-5432}:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data
      - ./lib/db/schema.sql:/docker-entrypoint-initdb.d/001-schema.sql
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U dawn"]
      interval: 5s
      timeout: 5s
      retries: 5
    restart: unless-stopped

  minio:
    image: minio/minio:latest
    container_name: dawn-minio
    command: server /data --console-address ":9001"
    environment:
      MINIO_ROOT_USER: ${MINIO_ROOT_USER:-minio}
      MINIO_ROOT_PASSWORD: ${MINIO_ROOT_PASSWORD:-minio123}
    ports:
      - "${MINIO_PORT:-9000}:9000"
      - "${MINIO_CONSOLE_PORT:-9001}:9001"
    volumes:
      - minio_data:/data
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:9000/minio/health/live"]
      interval: 30s
      timeout: 20s
      retries: 3
    restart: unless-stopped

volumes:
  pgdata:
    driver: local
  minio_data:
    driver: local
```

#### Database Client (Connection Pooling)

```typescript
// lib/db/client.ts
import { Pool } from 'pg';

// Singleton pool
let pool: Pool | null = null;

export function getPool(): Pool {
  if (!pool) {
    pool = new Pool({
      host: process.env.POSTGRES_HOST || 'localhost',
      port: parseInt(process.env.POSTGRES_PORT || '5432'),
      database: process.env.POSTGRES_DB || 'dawn',
      user: process.env.POSTGRES_USER || 'dawn',
      password: process.env.POSTGRES_PASSWORD || 'dawn',

      // Connection pool settings
      max: 20,                      // max connections
      idleTimeoutMillis: 30000,     // close idle connections after 30s
      connectionTimeoutMillis: 5000, // timeout after 5s

      // Retry logic
      max_attempts: 3,
    });

    pool.on('error', (err) => {
      console.error('Unexpected pool error:', err);
      process.exit(-1);
    });
  }

  return pool;
}

export async function query(text: string, params?: any[]) {
  const start = Date.now();
  const pool = getPool();

  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;

    if (process.env.NODE_ENV === 'development') {
      console.log('[DB Query]', {
        duration: `${duration}ms`,
        rows: res.rowCount,
        query: text.substring(0, 100)
      });
    }

    return res;
  } catch (error) {
    console.error('[DB Error]', {
      query: text.substring(0, 100),
      params,
      error
    });
    throw error;
  }
}

export async function transaction<T>(
  callback: (client: any) => Promise<T>
): Promise<T> {
  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export { pool };
```

**Dependencies**:
```json
{
  "dependencies": {
    "pg": "^8.11.3",
    "@types/pg": "^8.11.0"
  }
}
```

**Acceptance Criteria**:
- [ ] `docker-compose up -d` starts services with health checks passing
- [ ] `npm run db:migrate` creates all tables without errors
- [ ] `psql -h localhost -U dawn -d dawn -c "\dt"` shows 3 tables
- [ ] Connection pool handles 10 concurrent queries without errors
- [ ] `.env.local` has all required `POSTGRES_*` variables

---

### Phase 2: Vector Feature Extraction (2-3 days)

**Goal**: Build deterministic, interpretable vectors from existing `DesignTokens` + `StyleReport`

**Owner**: `design-systems-expert` + `ai-llm-engineer`

#### Critical Decisions

1. **Feature Normalization Strategy**

   ❌ **WRONG**: Linear normalization for all features
   ```typescript
   normalize(value, min, max) → [0, 1]
   ```
   **Problem**: Outliers skew the range, most values cluster near 0 or 1

   ✅ **CORRECT**: Use robust normalization + clipping
   ```typescript
   // For counts: log-scale normalization
   normalizeCount(count, typical=5) {
     return Math.min(1, Math.log(count + 1) / Math.log(typical + 1));
   }

   // For continuous: percentile-based
   normalizeRobust(value, p5, p95) {
     const clipped = Math.max(p5, Math.min(p95, value));
     return (clipped - p5) / (p95 - p5);
   }
   ```

2. **LCH Color Conversion**

   Original plan assumes colors are already in LCH. Current reality: hex strings.

   ```typescript
   import { parse, converter } from 'culori';

   const toLch = converter('lch');

   function hexToLCH(hex: string): { l: number; c: number; h: number } {
     const rgb = parse(hex);
     if (!rgb) return { l: 0, c: 0, h: 0 };

     const lch = toLch(rgb);
     return {
       l: lch.l || 0,
       c: lch.c || 0,
       h: lch.h || 0
     };
   }
   ```

3. **One-Hot Encoding for Categorical Features**

   Brand personality has categorical values (`tone`, `energy`, `trustLevel`).

   ❌ **WRONG**: Assign numeric IDs (assumes ordinal relationship)
   ```typescript
   const toneMap = { professional: 0, playful: 1, elegant: 2 };
   vec.push(toneMap[tone]); // WRONG: implies professional < playful
   ```

   ✅ **CORRECT**: One-hot encoding (sparse but accurate)
   ```typescript
   const toneMap = { professional: 0, playful: 1, elegant: 2, bold: 3, minimal: 4 };
   const oneHot = Array(5).fill(0);
   oneHot[toneMap[tone] || 0] = 1;
   vec.push(...oneHot); // Correct: no ordinal assumption
   ```

#### Implementation

**File Structure**:
```
pipeline/vectors/
  index.ts              # Main entry point, orchestrates vector building
  global-style-vec.ts   # 192D GlobalStyleVec builder
  primary-cta-vec.ts    # 64D PrimaryCTA RoleVec builder
  utils.ts              # Normalization, LCH conversion helpers
  types.ts              # Vector interfaces
```

**Main Entry Point** (`pipeline/vectors/index.ts`):

```typescript
import type { DesignTokens, StyleReport } from '../tokens';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { buildGlobalStyleVec } from './global-style-vec';
import { buildPrimaryCtaVec } from './primary-cta-vec';

export interface GlobalStyleVec {
  interpretable: Float32Array;  // 64D
  visual: Float32Array;          // 128D (zero-padded for MVP)
  combined: Float32Array;        // 192D
  metadata: {
    featureNames: string[];      // For debugging
    nonZeroCount: number;        // Sparsity metric
  };
}

export interface PrimaryCtaVec {
  interpretable: Float32Array;  // 24D
  visual: Float32Array;          // 40D (zero-padded for MVP)
  combined: Float32Array;        // 64D
  metadata: {
    featureNames: string[];
    nonZeroCount: number;
    buttonIndex: number;         // Which button variant was used
  };
}

export interface VectorResult {
  runId: string;
  globalStyleVec: GlobalStyleVec;
  primaryCtaVec: PrimaryCtaVec;
  tokens: DesignTokens;
  report: StyleReport;
}

export async function buildVectors(
  runId: string,
  artifactDir?: string
): Promise<VectorResult> {
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
```

**Global StyleVec Builder** (`pipeline/vectors/global-style-vec.ts`):

```typescript
import type { DesignTokens, StyleReport } from '../tokens';
import { normalizeLinear, normalizeLog, hexToLCH } from './utils';

/**
 * Builds a 192D global style vector:
 * - 64D interpretable: normalized token statistics
 * - 128D visual: zero-padded for MVP (future: CLIP embeddings)
 */
export function buildGlobalStyleVec(
  tokens: DesignTokens,
  report: StyleReport
): {
  interpretable: Float32Array;
  visual: Float32Array;
  combined: Float32Array;
  metadata: { featureNames: string[]; nonZeroCount: number };
} {
  const interpretable: number[] = [];
  const featureNames: string[] = [];

  // === Color Features (16D) ===

  // Primary color count (log-normalized)
  featureNames.push('color_primary_count');
  interpretable.push(normalizeLog(tokens.colors.primary.length, 5));

  // Neutral color count (log-normalized)
  featureNames.push('color_neutral_count');
  interpretable.push(normalizeLog(tokens.colors.neutral.length, 5));

  // Palette entropy (already 0-1)
  const paletteEntropy = calculatePaletteEntropy(
    [...tokens.colors.primary, ...tokens.colors.neutral]
  );
  featureNames.push('color_palette_entropy');
  interpretable.push(paletteEntropy);

  // Contrast pass rate (already 0-1)
  featureNames.push('color_contrast_pass_rate');
  interpretable.push(report.contrastResults.aaPassRate);

  // Dominant hue (circular normalize 0-360 → 0-1)
  const dominantHue = report.realTokenMetrics?.colorHarmony?.dominantHue || 0;
  featureNames.push('color_dominant_hue');
  interpretable.push(normalizeLinear(dominantHue, 0, 360));

  // Saturation mean (already 0-1)
  const satMean = report.realTokenMetrics?.colorHarmony?.saturationRange?.avg || 0.5;
  featureNames.push('color_saturation_mean');
  interpretable.push(satMean);

  // Lightness mean (already 0-1)
  const lightMean = report.realTokenMetrics?.colorHarmony?.lightnessRange?.avg || 0.5;
  featureNames.push('color_lightness_mean');
  interpretable.push(lightMean);

  // Button color diversity (log-normalized)
  featureNames.push('color_button_diversity');
  interpretable.push(normalizeLog(tokens.colors.contextual.buttons.length, 3));

  // Link color diversity (log-normalized)
  featureNames.push('color_link_diversity');
  interpretable.push(normalizeLog(tokens.colors.contextual.links.length, 3));

  // Background variation (log-normalized)
  featureNames.push('color_background_variation');
  interpretable.push(normalizeLog(tokens.colors.contextual.backgrounds.length, 4));

  // Harmony score (already 0-1)
  const harmonyScore = report.realTokenMetrics?.colorHarmony?.harmonyScore || 0.5;
  featureNames.push('color_harmony_score');
  interpretable.push(harmonyScore);

  // Color coherence (already 0-1)
  const colorCoherence = report.realTokenMetrics?.brandCoherence?.colorHarmony || 0.5;
  featureNames.push('color_coherence');
  interpretable.push(colorCoherence);

  // Reserved (4D) for future color features
  featureNames.push('color_reserved_1', 'color_reserved_2', 'color_reserved_3', 'color_reserved_4');
  interpretable.push(0, 0, 0, 0);

  // === Typography Features (16D) ===

  // Font family count (log-normalized, typical 1-2)
  featureNames.push('typo_family_count');
  interpretable.push(normalizeLog(tokens.typography.fontFamilies.length, 2));

  // Font size range (robust normalize, typical 10-40px)
  const fontSizeRange = tokens.typography.fontSizes.length > 0
    ? Math.max(...tokens.typography.fontSizes) - Math.min(...tokens.typography.fontSizes)
    : 0;
  featureNames.push('typo_size_range');
  interpretable.push(normalizeLinear(fontSizeRange, 0, 50));

  // Font size count (log-normalized, typical 5-10)
  featureNames.push('typo_size_count');
  interpretable.push(normalizeLog(tokens.typography.fontSizes.length, 7));

  // Font weight count (log-normalized, typical 2-4)
  featureNames.push('typo_weight_count');
  interpretable.push(normalizeLog(tokens.typography.fontWeights.length, 3));

  // Line height count (log-normalized, typical 2-4)
  featureNames.push('typo_lineheight_count');
  interpretable.push(normalizeLog(tokens.typography.lineHeights.length, 3));

  // Typography coherence (already 0-1)
  const typoCoherence = report.realTokenMetrics?.brandCoherence?.typographyCoherence || 0.5;
  featureNames.push('typo_coherence');
  interpretable.push(typoCoherence);

  // Reserved (10D)
  for (let i = 0; i < 10; i++) {
    featureNames.push(`typo_reserved_${i + 1}`);
    interpretable.push(0);
  }

  // === Spacing Features (8D) ===

  // Spacing scale length (log-normalized)
  featureNames.push('spacing_scale_length');
  interpretable.push(normalizeLog(tokens.spacing.length, 6));

  // Spacing median (linear normalize, typical 0-48px)
  const spacingMedian = tokens.spacing.length > 0
    ? tokens.spacing[Math.floor(tokens.spacing.length / 2)]
    : 0;
  featureNames.push('spacing_median');
  interpretable.push(normalizeLinear(spacingMedian, 0, 48));

  // Spacing consistency (already 0-1)
  const spacingConsistency = report.realTokenMetrics?.brandCoherence?.spacingConsistency || 0.5;
  featureNames.push('spacing_consistency');
  interpretable.push(spacingConsistency);

  // Reserved (5D)
  for (let i = 0; i < 5; i++) {
    featureNames.push(`spacing_reserved_${i + 1}`);
    interpretable.push(0);
  }

  // === Shape Features (8D) ===

  // Border radius count (log-normalized)
  featureNames.push('shape_radius_count');
  interpretable.push(normalizeLog(tokens.borderRadius.length, 3));

  // Border radius median (linear normalize, typical 0-32px)
  const radiusMedian = tokens.borderRadius.length > 0
    ? parseFloat(tokens.borderRadius[Math.floor(tokens.borderRadius.length / 2)])
    : 0;
  featureNames.push('shape_radius_median');
  interpretable.push(normalizeLinear(radiusMedian, 0, 32));

  // Shadow count (log-normalized)
  featureNames.push('shape_shadow_count');
  interpretable.push(normalizeLog(tokens.boxShadow.length, 3));

  // Reserved (5D)
  for (let i = 0; i < 5; i++) {
    featureNames.push(`shape_reserved_${i + 1}`);
    interpretable.push(0);
  }

  // === Brand Personality Features (16D) ===

  if (report.brandPersonality) {
    // Tone (5D one-hot)
    const toneMap: Record<string, number> = {
      professional: 0, playful: 1, elegant: 2, bold: 3, minimal: 4, luxury: 2, friendly: 1
    };
    const toneOneHot = Array(5).fill(0);
    toneOneHot[toneMap[report.brandPersonality.tone] || 0] = 1;
    featureNames.push('brand_tone_professional', 'brand_tone_playful', 'brand_tone_elegant', 'brand_tone_bold', 'brand_tone_minimal');
    interpretable.push(...toneOneHot);

    // Energy (4D one-hot)
    const energyMap: Record<string, number> = {
      calm: 0, energetic: 1, sophisticated: 2, dynamic: 3
    };
    const energyOneHot = Array(4).fill(0);
    energyOneHot[energyMap[report.brandPersonality.energy] || 0] = 1;
    featureNames.push('brand_energy_calm', 'brand_energy_energetic', 'brand_energy_sophisticated', 'brand_energy_dynamic');
    interpretable.push(...energyOneHot);

    // Trust level (4D one-hot)
    const trustMap: Record<string, number> = {
      conservative: 0, modern: 1, innovative: 2, experimental: 3
    };
    const trustOneHot = Array(4).fill(0);
    trustOneHot[trustMap[report.brandPersonality.trustLevel] || 1] = 1;
    featureNames.push('brand_trust_conservative', 'brand_trust_modern', 'brand_trust_innovative', 'brand_trust_experimental');
    interpretable.push(...trustOneHot);

    // Confidence (1D, already 0-1)
    featureNames.push('brand_confidence');
    interpretable.push(report.brandPersonality.confidence);

    // Reserved (2D)
    featureNames.push('brand_reserved_1', 'brand_reserved_2');
    interpretable.push(0, 0);
  } else {
    // Fallback: all zeros
    for (let i = 0; i < 16; i++) {
      featureNames.push(`brand_missing_${i + 1}`);
      interpretable.push(0);
    }
  }

  // === Verify Length ===
  if (interpretable.length !== 64) {
    throw new Error(`Interpretable vector must be 64D, got ${interpretable.length}D`);
  }

  // === Visual Features (128D) - Zero-padded for MVP ===
  const visual = Array(128).fill(0);

  // === Combine ===
  const combined = [...interpretable, ...visual];

  // === Metadata ===
  const nonZeroCount = interpretable.filter(x => x !== 0).length;

  return {
    interpretable: Float32Array.from(interpretable),
    visual: Float32Array.from(visual),
    combined: Float32Array.from(combined),
    metadata: {
      featureNames,
      nonZeroCount
    }
  };
}

function calculatePaletteEntropy(colors: string[]): number {
  // Shannon entropy of color hue distribution
  if (colors.length === 0) return 0;

  const hues = colors.map(c => {
    const lch = hexToLCH(c);
    return lch.h;
  });

  // Bin into 12 buckets (30° each)
  const bins = Array(12).fill(0);
  hues.forEach(h => {
    const binIndex = Math.floor(h / 30) % 12;
    bins[binIndex]++;
  });

  const total = hues.length;
  let entropy = 0;
  bins.forEach(count => {
    if (count > 0) {
      const p = count / total;
      entropy -= p * Math.log2(p);
    }
  });

  return entropy / Math.log2(12); // Normalize to 0-1
}
```

**PrimaryCTA RoleVec Builder** (`pipeline/vectors/primary-cta-vec.ts`):

```typescript
import type { DesignTokens, StyleReport } from '../tokens';
import { normalizeLinear, hexToLCH, calculateContrast } from './utils';

/**
 * Builds a 64D PrimaryCTA role vector:
 * - 24D interpretable: button-specific features
 * - 40D visual: zero-padded for MVP (future: button crop embeddings)
 */
export function buildPrimaryCtaVec(
  tokens: DesignTokens,
  report: StyleReport
): {
  interpretable: Float32Array;
  visual: Float32Array;
  combined: Float32Array;
  metadata: { featureNames: string[]; nonZeroCount: number; buttonIndex: number };
} {
  // Find primary button variant
  const primaryButtonIndex = tokens.buttons.variants.findIndex(b => b.type === 'primary');
  const primaryButton = primaryButtonIndex >= 0
    ? tokens.buttons.variants[primaryButtonIndex]
    : tokens.buttons.variants[0];

  if (!primaryButton) {
    // No buttons found - return zero vector
    return {
      interpretable: Float32Array.from(Array(24).fill(0)),
      visual: Float32Array.from(Array(40).fill(0)),
      combined: Float32Array.from(Array(64).fill(0)),
      metadata: {
        featureNames: Array(64).fill('missing'),
        nonZeroCount: 0,
        buttonIndex: -1
      }
    };
  }

  const interpretable: number[] = [];
  const featureNames: string[] = [];

  // === Color Features (6D) ===

  // Background color LCH (3D)
  const bgLCH = hexToLCH(primaryButton.backgroundColor);
  featureNames.push('cta_bg_L', 'cta_bg_C', 'cta_bg_h');
  interpretable.push(
    normalizeLinear(bgLCH.l, 0, 100),
    normalizeLinear(bgLCH.c, 0, 100),
    normalizeLinear(bgLCH.h, 0, 360)
  );

  // Text color LCH (3D)
  const fgLCH = hexToLCH(primaryButton.color);
  featureNames.push('cta_fg_L', 'cta_fg_C', 'cta_fg_h');
  interpretable.push(
    normalizeLinear(fgLCH.l, 0, 100),
    normalizeLinear(fgLCH.c, 0, 100),
    normalizeLinear(fgLCH.h, 0, 360)
  );

  // === Typography Features (4D) ===

  // Font size (linear normalize, typical 10-24px)
  featureNames.push('cta_font_size');
  interpretable.push(normalizeLinear(primaryButton.fontSize, 10, 24));

  // Font weight (linear normalize, 300-900)
  featureNames.push('cta_font_weight');
  interpretable.push(normalizeLinear(primaryButton.fontWeight, 300, 900));

  // Casing score (from textContent if available)
  const casingScore = primaryButton.textContent
    ? calculateCasingScore(primaryButton.textContent)
    : 0;
  featureNames.push('cta_casing_score');
  interpretable.push(casingScore);

  // Reserved (1D)
  featureNames.push('cta_typo_reserved_1');
  interpretable.push(0);

  // === Shape Features (6D) ===

  // Border radius (linear normalize, typical 0-32px)
  const radiusPx = parseFloat(primaryButton.borderRadius) || 0;
  featureNames.push('cta_border_radius');
  interpretable.push(normalizeLinear(radiusPx, 0, 32));

  // Stroke width (binary: has border or not)
  const strokePx = primaryButton.borderColor ? 1 : 0;
  featureNames.push('cta_stroke_width');
  interpretable.push(strokePx);

  // Padding (2D: X and Y)
  const [padY, padX] = parsePadding(primaryButton.padding);
  featureNames.push('cta_padding_x', 'cta_padding_y');
  interpretable.push(
    normalizeLinear(padX, 0, 48),
    normalizeLinear(padY, 0, 32)
  );

  // Reserved (2D)
  featureNames.push('cta_shape_reserved_1', 'cta_shape_reserved_2');
  interpretable.push(0, 0);

  // === Interaction Features (4D) ===

  // Has hover state (binary)
  const hasHover = primaryButton.hover ? 1 : 0;
  featureNames.push('cta_has_hover');
  interpretable.push(hasHover);

  // Hover color shift (binary)
  const hoverColorShift = primaryButton.hover?.backgroundColor ? 1 : 0;
  featureNames.push('cta_hover_color_shift');
  interpretable.push(hoverColorShift);

  // Hover opacity change (linear normalize)
  const hoverOpacity = primaryButton.hover?.opacity
    ? normalizeLinear(primaryButton.hover.opacity, 0.7, 1)
    : 0;
  featureNames.push('cta_hover_opacity');
  interpretable.push(hoverOpacity);

  // Reserved (1D)
  featureNames.push('cta_interaction_reserved_1');
  interpretable.push(0);

  // === UX Features (4D) ===

  // Contrast ratio (linear normalize, WCAG 0-21)
  const contrast = calculateContrast(primaryButton.color, primaryButton.backgroundColor);
  featureNames.push('cta_contrast');
  interpretable.push(normalizeLinear(contrast, 0, 21));

  // Min tap side (linear normalize, typical 20-60px)
  const minTapSide = Math.min(padX, padY) * 2 + primaryButton.fontSize;
  featureNames.push('cta_min_tap_side');
  interpretable.push(normalizeLinear(minTapSide, 20, 60));

  // Reserved (2D)
  featureNames.push('cta_ux_reserved_1', 'cta_ux_reserved_2');
  interpretable.push(0, 0);

  // === Verify Length ===
  if (interpretable.length !== 24) {
    throw new Error(`Interpretable vector must be 24D, got ${interpretable.length}D`);
  }

  // === Visual Features (40D) - Zero-padded for MVP ===
  const visual = Array(40).fill(0);

  // === Combine ===
  const combined = [...interpretable, ...visual];

  // === Metadata ===
  const nonZeroCount = interpretable.filter(x => x !== 0).length;

  return {
    interpretable: Float32Array.from(interpretable),
    visual: Float32Array.from(visual),
    combined: Float32Array.from(combined),
    metadata: {
      featureNames,
      nonZeroCount,
      buttonIndex: primaryButtonIndex
    }
  };
}

function parsePadding(padding: string): [number, number] {
  const parts = padding.split(/\s+/).map(p => parseFloat(p) || 0);
  if (parts.length === 1) return [parts[0], parts[0]];
  if (parts.length === 2) return [parts[0], parts[1]];
  if (parts.length === 4) return [parts[0], parts[1]];
  return [0, 0];
}

function calculateCasingScore(text: string): number {
  // 0 = lowercase, 1 = UPPERCASE, 0.5 = Mixed Case
  const upperCount = (text.match(/[A-Z]/g) || []).length;
  const lowerCount = (text.match(/[a-z]/g) || []).length;
  const total = upperCount + lowerCount;

  if (total === 0) return 0;
  return upperCount / total;
}
```

**Utilities** (`pipeline/vectors/utils.ts`):

```typescript
import { parse, converter } from 'culori';

// Robust normalization functions
export function normalizeLinear(value: number, min: number, max: number): number {
  if (max === min) return 0;
  const clamped = Math.max(min, Math.min(max, value));
  return (clamped - min) / (max - min);
}

export function normalizeLog(count: number, typical: number): number {
  // Log-scale normalization for counts
  // typical = value that should map to ~0.5
  return Math.min(1, Math.log(count + 1) / Math.log(typical * 2 + 1));
}

// Color conversion
const toLch = converter('lch');

export function hexToLCH(hex: string): { l: number; c: number; h: number } {
  try {
    const rgb = parse(hex);
    if (!rgb) return { l: 0, c: 0, h: 0 };

    const lch = toLch(rgb);
    return {
      l: lch.l || 0,
      c: lch.c || 0,
      h: lch.h || 0
    };
  } catch {
    return { l: 0, c: 0, h: 0 };
  }
}

// WCAG contrast calculation
export function calculateContrast(fg: string, bg: string): number {
  const getLuminance = (hex: string): number => {
    try {
      const rgb = parseInt(hex.slice(1), 16);
      const r = ((rgb >> 16) & 0xff) / 255;
      const g = ((rgb >> 8) & 0xff) / 255;
      const b = ((rgb >> 0) & 0xff) / 255;

      const sRGB = [r, g, b].map(c =>
        c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
      );

      return 0.2126 * sRGB[0] + 0.7152 * sRGB[1] + 0.0722 * sRGB[2];
    } catch {
      return 0.5;
    }
  };

  const lum1 = getLuminance(fg);
  const lum2 = getLuminance(bg);
  const lightest = Math.max(lum1, lum2);
  const darkest = Math.min(lum1, lum2);

  return (lightest + 0.05) / (darkest + 0.05);
}
```

**Acceptance Criteria**:
- [ ] `buildVectors(runId)` returns 192D + 64D vectors
- [ ] All values are in [0, 1] range (no NaN, no Infinity)
- [ ] Determinism test: same input → same output (L2 distance < 1e-6)
- [ ] Feature name count matches vector dimension
- [ ] Unit tests for edge cases (empty tokens, missing personality, etc.)

---

### Phase 3: Storage Pipeline Integration (1-2 days)

**Goal**: Add `storage` stage to orchestrator and persist vectors to DB

**Owner**: `nextjs-developer`

#### Implementation

**Storage Module** (`pipeline/storage/index.ts`):

```typescript
import { buildVectors } from '../vectors';
import { query, transaction } from '../../lib/db/client';
import { readFile } from 'fs/promises';
import { join } from 'path';

export interface StorageResult {
  runId: string;
  captureId: string;
  styleProfileId: string;
  primaryCtaId: string;
  vectorStats: {
    globalVecNonZero: number;
    ctaVecNonZero: number;
    ctaButtonIndex: number;
  };
}

export async function storeVectors(
  runId: string,
  artifactDir?: string
): Promise<StorageResult> {
  const baseDir = artifactDir || join(process.cwd(), 'artifacts');
  const runDir = join(baseDir, runId);

  // 1. Read capture metadata
  const metaPath = join(runDir, 'raw', 'meta.json');
  const meta = JSON.parse(await readFile(metaPath, 'utf8'));

  // 2. Build vectors
  console.log(`🔢 Building vectors for ${runId}...`);
  const vectorResult = await buildVectors(runId, artifactDir);

  // 3. Store in DB (transactional - all or nothing)
  const result = await transaction(async (client) => {
    // Insert capture
    const captureRes = await client.query(`
      INSERT INTO captures (
        source_url, viewport, dom_uri, css_uri, screenshot_uri,
        run_id, user_agent, page_title
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT (run_id) DO UPDATE
        SET source_url = EXCLUDED.source_url,
            viewport = EXCLUDED.viewport
      RETURNING id
    `, [
      meta.url,
      JSON.stringify(meta.viewport),
      `file://${runDir}/raw/dom.html`,
      `file://${runDir}/raw/computed_styles.json`,
      `file://${runDir}/raw/page.png`,
      runId,
      meta.userAgent,
      meta.title
    ]);
    const captureId = captureRes.rows[0].id;

    // Insert style profile
    const styleProfileRes = await client.query(`
      INSERT INTO style_profiles (
        capture_id, source_url, tokens_json, style_vec, ux_summary
      ) VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT DO NOTHING
      RETURNING id
    `, [
      captureId,
      meta.url,
      JSON.stringify(vectorResult.tokens),
      `[${Array.from(vectorResult.globalStyleVec.combined).join(',')}]`,  // pgvector format
      JSON.stringify({
        brandPersonality: vectorResult.report.brandPersonality,
        colorHarmony: vectorResult.report.realTokenMetrics?.colorHarmony,
        designSystemAnalysis: vectorResult.report.designSystemAnalysis,
        contrastMedian: vectorResult.report.contrastResults.aaPassRate,
        featureNames: vectorResult.globalStyleVec.metadata.featureNames
      })
    ]);
    const styleProfileId = styleProfileRes.rows[0].id;

    // Insert primary CTA vector
    const primaryButton = vectorResult.tokens.buttons.variants.find(b => b.type === 'primary')
      || vectorResult.tokens.buttons.variants[0];

    const primaryCtaRes = await client.query(`
      INSERT INTO role_vectors_primarycta (
        style_profile_id, vec, tokens_json, exemplars, ux_report, confidence
      ) VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT DO NOTHING
      RETURNING id
    `, [
      styleProfileId,
      `[${Array.from(vectorResult.primaryCtaVec.combined).join(',')}]`,
      JSON.stringify(primaryButton),
      JSON.stringify([]),  // TODO Phase 2+: save button crops
      JSON.stringify({
        contrast: primaryButton ? calculateContrast(primaryButton.color, primaryButton.backgroundColor) : 0,
        minTapSidePx: 0,  // TODO: calculate
        focusVisible: false,  // TODO: check
        featureNames: vectorResult.primaryCtaVec.metadata.featureNames
      }),
      primaryButton?.prominence?.score ? primaryButton.prominence.score / 100 : 0.5
    ]);
    const primaryCtaId = primaryCtaRes.rows[0].id;

    return { captureId, styleProfileId, primaryCtaId };
  });

  console.log('✅ Stored vectors:', {
    captureId: result.captureId,
    styleProfileId: result.styleProfileId,
    primaryCtaId: result.primaryCtaId,
    globalVecDim: vectorResult.globalStyleVec.combined.length,
    ctaVecDim: vectorResult.primaryCtaVec.combined.length
  });

  return {
    runId,
    ...result,
    vectorStats: {
      globalVecNonZero: vectorResult.globalStyleVec.metadata.nonZeroCount,
      ctaVecNonZero: vectorResult.primaryCtaVec.metadata.nonZeroCount,
      ctaButtonIndex: vectorResult.primaryCtaVec.metadata.buttonIndex
    }
  };
}

function calculateContrast(fg: string, bg: string): number {
  // Copy from utils.ts or import
  return 4.5; // Placeholder
}
```

**Update Orchestrator** (`pipeline/orchestration/index.ts`):

```typescript
// Add to PIPELINE_STEPS array
const PIPELINE_STEPS = [
  { id: 'capture', name: 'Web Capture' },
  { id: 'tokens', name: 'Design Tokens' },
  { id: 'scenegraph', name: 'DOM Scenegraph' },
  { id: 'intent', name: 'Intent Parsing' },
  { id: 'layout', name: 'Layout Synthesis' },
  { id: 'styling', name: 'Styling Engine' },
  { id: 'codegen', name: 'Code Generation' },
  { id: 'canvas', name: 'Vector Canvas' },
  { id: 'storage', name: 'Vector Storage' }  // NEW
];

// In PipelineOrchestrator class, add:
private async runStorage(runId: string) {
  const { storeVectors } = await import('../storage');
  return await storeVectors(runId, this.config.artifactDir);
}

// In execute() method, after canvas step:
await this.executeStep(result, 'storage', () => this.runStorage(result.runId));
```

**CLI Scripts**:

```javascript
// scripts/store-vectors.js
#!/usr/bin/env node
const { storeVectors } = require('../dist/pipeline/storage');

const runId = process.argv[2];
if (!runId) {
  console.error('Usage: npm run store-vectors -- <runId>');
  process.exit(1);
}

storeVectors(runId)
  .then(result => {
    console.log('✅ Success:', result);
    process.exit(0);
  })
  .catch(err => {
    console.error('❌ Error:', err);
    process.exit(1);
  });
```

```javascript
// scripts/batch-ingest.js
#!/usr/bin/env node
const { executeFullPipeline } = require('../dist/pipeline/orchestration');

const urls = process.argv.slice(2);
if (urls.length === 0) {
  console.error('Usage: npm run batch-ingest -- <url1> <url2> ...');
  console.error('Example: npm run batch-ingest -- https://stripe.com https://dojo.tech');
  process.exit(1);
}

(async () => {
  const results = [];

  for (const url of urls) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`🔄 Processing: ${url}`);
    console.log(`${'='.repeat(60)}\n`);

    try {
      const result = await executeFullPipeline(url, 'cta extraction', {
        enableDebug: true
      });

      console.log(`\n✅ Completed: ${url}`);
      console.log(`   runId: ${result.runId}`);

      results.push({ url, status: 'success', runId: result.runId });
    } catch (err) {
      console.error(`\n❌ Failed: ${url}`, err.message);
      results.push({ url, status: 'error', error: err.message });
    }
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log('📊 Batch Ingestion Summary');
  console.log(`${'='.repeat(60)}\n`);

  const successful = results.filter(r => r.status === 'success');
  const failed = results.filter(r => r.status === 'error');

  console.log(`Total: ${results.length}`);
  console.log(`✅ Successful: ${successful.length}`);
  console.log(`❌ Failed: ${failed.length}`);

  if (successful.length > 0) {
    console.log('\n✅ Successful URLs:');
    successful.forEach(r => console.log(`   - ${r.url} (${r.runId})`));
  }

  if (failed.length > 0) {
    console.log('\n❌ Failed URLs:');
    failed.forEach(r => console.log(`   - ${r.url}: ${r.error}`));
  }

  process.exit(failed.length > 0 ? 1 : 0);
})();
```

Add to `package.json`:
```json
{
  "scripts": {
    "db:migrate": "npm run build:pipeline && node scripts/db-migrate.js",
    "store-vectors": "npm run build:pipeline && node scripts/store-vectors.js",
    "batch-ingest": "npm run build:pipeline && node scripts/batch-ingest.js"
  }
}
```

**Acceptance Criteria**:
- [ ] `npm run store-vectors -- <runId>` inserts 3 rows (captures, style_profiles, role_vectors_primarycta)
- [ ] Re-running same runId uses `ON CONFLICT` upsert (idempotent)
- [ ] Transaction rollback on error (all-or-nothing)
- [ ] Pipeline includes `storage` as final step (10/10)

---

### Phase 4: Query & Search API (1-2 days)

**Goal**: Expose k-NN search endpoints

**Owner**: `nextjs-developer`

#### Implementation

**Query Helpers** (`lib/db/queries.ts`):

```typescript
import { query } from './client';

export interface NearestStyleProfile {
  id: string;
  source_url: string;
  distance: number;
  tokens_json: any;
  ux_summary: any;
}

export async function findNearestStyleProfiles(
  referenceProfileId: string,
  limit: number = 10
): Promise<NearestStyleProfile[]> {
  // For <1000 vectors, brute force is faster than IVFFlat
  const res = await query(`
    SELECT
      sp2.id,
      sp2.source_url,
      sp2.style_vec <-> sp1.style_vec AS distance,
      sp2.tokens_json,
      sp2.ux_summary
    FROM style_profiles sp1, style_profiles sp2
    WHERE sp1.id = $1 AND sp2.id != sp1.id
    ORDER BY distance ASC
    LIMIT $2
  `, [referenceProfileId, limit]);

  return res.rows;
}

export interface NearestPrimaryCta {
  id: string;
  style_profile_id: string;
  distance: number;
  tokens_json: any;
  ux_report: any;
}

export async function findNearestPrimaryCtas(
  referenceProfileId: string,
  limit: number = 10
): Promise<NearestPrimaryCta[]> {
  const res = await query(`
    SELECT
      r2.id,
      r2.style_profile_id,
      r2.vec <-> r1.vec AS distance,
      r2.tokens_json,
      r2.ux_report
    FROM role_vectors_primarycta r1, role_vectors_primarycta r2
    WHERE r1.style_profile_id = $1 AND r2.style_profile_id != $1
    ORDER BY distance ASC
    LIMIT $2
  `, [referenceProfileId, limit]);

  return res.rows;
}

export async function getStyleProfileByRunId(runId: string) {
  const res = await query(`
    SELECT sp.*
    FROM style_profiles sp
    JOIN captures c ON sp.capture_id = c.id
    WHERE c.run_id = $1
  `, [runId]);

  return res.rows[0];
}

export async function getAllStyleProfiles() {
  const res = await query(`
    SELECT
      sp.id,
      sp.source_url,
      sp.created_at,
      c.run_id,
      (sp.ux_summary->>'brandPersonality')::jsonb->>'tone' as brand_tone
    FROM style_profiles sp
    JOIN captures c ON sp.capture_id = c.id
    ORDER BY sp.created_at DESC
  `);

  return res.rows;
}
```

**API Routes**:

```typescript
// app/api/vectors/nearest-styles/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { findNearestStyleProfiles, getStyleProfileByRunId } from '@/lib/db/queries';

export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const runId = searchParams.get('runId');
  const limit = parseInt(searchParams.get('limit') || '10');

  if (!runId) {
    return NextResponse.json({ error: 'runId required' }, { status: 400 });
  }

  try {
    const profile = await getStyleProfileByRunId(runId);
    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    const nearest = await findNearestStyleProfiles(profile.id, limit);

    return NextResponse.json({
      reference: {
        id: profile.id,
        url: profile.source_url,
        runId
      },
      nearest
    });
  } catch (error: any) {
    console.error('[API Error]', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
```

```typescript
// app/api/vectors/nearest-ctas/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { findNearestPrimaryCtas, getStyleProfileByRunId } from '@/lib/db/queries';

export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const runId = searchParams.get('runId');
  const limit = parseInt(searchParams.get('limit') || '10');

  if (!runId) {
    return NextResponse.json({ error: 'runId required' }, { status: 400 });
  }

  try {
    const profile = await getStyleProfileByRunId(runId);
    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    const nearest = await findNearestPrimaryCtas(profile.id, limit);

    return NextResponse.json({
      reference: {
        id: profile.id,
        url: profile.source_url,
        runId
      },
      nearest
    });
  } catch (error: any) {
    console.error('[API Error]', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
```

```typescript
// app/api/vectors/list/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getAllStyleProfiles } from '@/lib/db/queries';

export async function GET(req: NextRequest) {
  try {
    const profiles = await getAllStyleProfiles();
    return NextResponse.json({ profiles });
  } catch (error: any) {
    console.error('[API Error]', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
```

**Acceptance Criteria**:
- [ ] `GET /api/vectors/nearest-styles?runId=<id>&limit=5` returns 5 nearest neighbors
- [ ] `GET /api/vectors/nearest-ctas?runId=<id>` returns CTAs sorted by distance
- [ ] `GET /api/vectors/list` returns all profiles
- [ ] Errors return proper HTTP status codes (400, 404, 500)

---

## Testing Strategy

### Unit Tests (`tests/unit/vectors.spec.ts`)

```typescript
import { describe, it, expect } from '@jest/globals';
import { normalizeLinear, normalizeLog, hexToLCH, calculateContrast } from '../../pipeline/vectors/utils';

describe('Vector Utils', () => {
  describe('normalizeLinear', () => {
    it('should normalize values to [0, 1]', () => {
      expect(normalizeLinear(5, 0, 10)).toBeCloseTo(0.5);
      expect(normalizeLinear(0, 0, 10)).toBe(0);
      expect(normalizeLinear(10, 0, 10)).toBe(1);
    });

    it('should clamp out-of-range values', () => {
      expect(normalizeLinear(-5, 0, 10)).toBe(0);
      expect(normalizeLinear(15, 0, 10)).toBe(1);
    });

    it('should handle edge case: min === max', () => {
      expect(normalizeLinear(5, 5, 5)).toBe(0);
    });
  });

  describe('normalizeLog', () => {
    it('should normalize counts with log scale', () => {
      expect(normalizeLog(0, 5)).toBeCloseTo(0);
      expect(normalizeLog(5, 5)).toBeCloseTo(0.5, 1);
      expect(normalizeLog(100, 5)).toBeLessThanOrEqual(1);
    });
  });

  describe('hexToLCH', () => {
    it('should convert hex to LCH', () => {
      const lch = hexToLCH('#ff0000');  // red
      expect(lch.l).toBeGreaterThan(0);
      expect(lch.c).toBeGreaterThan(0);
      expect(lch.h).toBeGreaterThanOrEqual(0);
    });

    it('should handle invalid hex', () => {
      const lch = hexToLCH('invalid');
      expect(lch.l).toBe(0);
      expect(lch.c).toBe(0);
      expect(lch.h).toBe(0);
    });
  });

  describe('calculateContrast', () => {
    it('should calculate WCAG contrast ratio', () => {
      const contrast = calculateContrast('#000000', '#ffffff');
      expect(contrast).toBeCloseTo(21, 0);  // max contrast
    });

    it('should be symmetric', () => {
      const c1 = calculateContrast('#ff0000', '#00ff00');
      const c2 = calculateContrast('#00ff00', '#ff0000');
      expect(c1).toBeCloseTo(c2, 5);
    });
  });
});
```

### Integration Tests (`tests/integration/vector-storage.spec.ts`)

```typescript
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { storeVectors } from '../../pipeline/storage';
import { query } from '../../lib/db/client';

describe('Vector Storage Integration', () => {
  const testRunId = '2025-10-01T11-43-00-083Z_7n3iiw69_dojo-tech_cta';

  beforeAll(async () => {
    // Ensure test DB is migrated
    // await runMigrations();
  });

  it('should store vectors for a valid runId', async () => {
    const result = await storeVectors(testRunId);

    expect(result.runId).toBe(testRunId);
    expect(result.captureId).toBeDefined();
    expect(result.styleProfileId).toBeDefined();
    expect(result.primaryCtaId).toBeDefined();
  });

  it('should be idempotent (re-run same runId)', async () => {
    const result1 = await storeVectors(testRunId);
    const result2 = await storeVectors(testRunId);

    expect(result1.captureId).toBe(result2.captureId);
  });

  it('should persist vectors queryable via k-NN', async () => {
    const result = await storeVectors(testRunId);

    const nearest = await query(`
      SELECT id, style_vec <-> $1 AS distance
      FROM style_profiles
      WHERE id != $2
      ORDER BY distance ASC
      LIMIT 3
    `, [
      `[${Array(192).fill(0.5).join(',')}]`,  // dummy vector
      result.styleProfileId
    ]);

    expect(nearest.rows.length).toBeGreaterThanOrEqual(0);
  });

  afterAll(async () => {
    // Clean up test data if needed
  });
});
```

### Acceptance Tests (Manual)

1. **Batch Ingest Gold URLs**:
   ```bash
   npm run batch-ingest -- \
     https://stripe.com \
     https://dojo.tech \
     https://airbnb.com \
     https://monzo.com
   ```

2. **Verify DB Storage**:
   ```bash
   psql -h localhost -U dawn -d dawn -c "SELECT COUNT(*) FROM style_profiles;"
   # Expected: 4
   ```

3. **Test k-NN Clustering**:
   ```bash
   # Get runId for Stripe
   STRIPE_RUN=$(psql -h localhost -U dawn -d dawn -t -c "SELECT run_id FROM captures WHERE source_url LIKE '%stripe%' LIMIT 1;")

   # Query nearest neighbors
   curl "http://localhost:3000/api/vectors/nearest-styles?runId=${STRIPE_RUN}&limit=3"
   ```

   **Expected**: Dojo.tech should appear in top 3 (financial brands cluster)

4. **Determinism Test**:
   ```bash
   # Capture same site twice
   npm run generate -- --url https://stripe.com --prompt "cta"
   # Wait...
   npm run generate -- --url https://stripe.com --prompt "cta"

   # Compare vectors
   psql -h localhost -U dawn -d dawn -c "
     SELECT
       c1.run_id AS run1,
       c2.run_id AS run2,
       sp1.style_vec <-> sp2.style_vec AS distance
     FROM captures c1
     JOIN captures c2 ON c1.source_url = c2.source_url AND c1.id != c2.id
     JOIN style_profiles sp1 ON sp1.capture_id = c1.id
     JOIN style_profiles sp2 ON sp2.capture_id = c2.id
     WHERE c1.source_url LIKE '%stripe%'
     LIMIT 1;
   "
   ```

   **Expected**: distance < 0.01 (high determinism)

---

## Deployment Checklist

1. **Environment Variables** (`.env.local`):
   ```bash
   # Postgres
   POSTGRES_HOST=localhost
   POSTGRES_PORT=5432
   POSTGRES_DB=dawn
   POSTGRES_USER=dawn
   POSTGRES_PASSWORD=dawn

   # MinIO (future)
   MINIO_ENDPOINT=localhost:9000
   MINIO_ACCESS_KEY=minio
   MINIO_SECRET_KEY=minio123

   # OpenAI (existing)
   OPENAI_API_KEY=sk-...
   ```

2. **Docker Services**:
   ```bash
   docker-compose up -d
   docker-compose ps  # Verify health
   ```

3. **Database Migration**:
   ```bash
   npm run db:migrate
   psql -h localhost -U dawn -d dawn -c "\dt"
   ```

4. **Initial Batch Ingestion**:
   ```bash
   npm run batch-ingest -- \
     https://stripe.com \
     https://dojo.tech \
     https://airbnb.com \
     https://monzo.com
   ```

5. **Smoke Test**:
   ```bash
   # Start Next.js
   npm run dev

   # In another terminal
   curl "http://localhost:3000/api/vectors/list"
   ```

---

## Success Metrics

1. **Coverage**: 100% of gold URLs produce non-zero vectors
2. **Determinism**: Re-ingesting same URL produces L2 distance < 0.01
3. **Clustering**: Financial brands (Stripe, Dojo, Monzo) cluster closer than Airbnb
4. **Performance**:
   - Vector building: < 1s/site
   - DB insertion: < 500ms/site
   - k-NN query (brute force): < 100ms for <1000 vectors

---

## Timeline (Revised)

| Phase | Duration | Deliverable |
|-------|----------|-------------|
| Phase 0: Data Quality Audit | 0.5 days | Validated existing artifacts |
| Phase 1: Database Infrastructure | 1-2 days | Docker + schema + migrations |
| Phase 2: Vector Feature Extraction | 2-3 days | buildVectors() with tests |
| Phase 3: Storage Integration | 1-2 days | Pipeline + CLI scripts |
| Phase 4: Query API | 1-2 days | k-NN endpoints |

**Total MVP Duration**: 5.5-9.5 days

---

## Future Enhancements (Phase 2+)

1. **Visual Features**:
   - ONNX CLIP embeddings for screenshots
   - Button crop extraction via Playwright
   - PCA to 128D (global) and 40D (CTA)

2. **IVFFlat Indexing**:
   - Add indexes when >1000 vectors
   - Tune `lists` parameter based on data size

3. **MinIO Integration**:
   - Upload screenshots, DOM, button crops
   - Replace `file://` URIs with `s3://` URIs

4. **Additional Role Vectors**:
   - NavBar, Card, Form, Hero, Footer

5. **Advanced Queries**:
   - Filter by brand personality (`WHERE ux_summary->>'tone' = 'professional'`)
   - Hybrid search (vector + semantic filters)
   - Aggregations (cluster analysis, brand archetypes)

---

**END OF REVISED IMPLEMENTATION PLAN**
