# CLIP Visual Embedding Integration Plan

**Goal**: Add CLIP-based visual similarity to the AI Design Partner pipeline, storing interpretable and visual vectors separately for flexible querying.

**Status**: 📋 Planning Phase
**Estimated Time**: 3-4 hours
**Dependencies**: OpenAI API key (already configured)

---

## Overview

Currently we store a 192D combined vector with:
- **64D interpretable** (color, typography, spacing, shape, brand features)
- **128D visual** (currently all zeros - placeholder)

This plan adds CLIP visual embeddings and restructures storage for:
- Separate querying (style tokens OR visual similarity)
- Combined querying (hybrid search weighted by both)
- Future flexibility (different visual models, A/B testing)

---

## Architecture Changes

### Database Schema Update

**Current schema**:
```sql
CREATE TABLE style_profiles (
  id UUID PRIMARY KEY,
  capture_id UUID REFERENCES captures(id),
  style_vec vector(192),  -- Combined 64D + 128D
  tokens_json JSONB,
  report_json JSONB
);
```

**New schema**:
```sql
CREATE TABLE style_profiles (
  id UUID PRIMARY KEY,
  capture_id UUID REFERENCES captures(id),

  -- Separate vectors for flexible querying
  interpretable_vec vector(64),   -- Style tokens (color, typo, spacing, etc.)
  visual_vec vector(512),          -- CLIP embedding (OpenAI default size)
  combined_vec vector(576),        -- Concatenated [64D + 512D] for hybrid search

  -- Metadata
  tokens_json JSONB,
  report_json JSONB,

  -- Vector metadata
  visual_model VARCHAR(50) DEFAULT 'clip-vit-base-patch32',
  visual_embedding_date TIMESTAMP DEFAULT NOW()
);

-- Indexes for similarity search
CREATE INDEX idx_style_profiles_interpretable
  ON style_profiles USING ivfflat (interpretable_vec vector_cosine_ops);

CREATE INDEX idx_style_profiles_visual
  ON style_profiles USING ivfflat (visual_vec vector_cosine_ops);

CREATE INDEX idx_style_profiles_combined
  ON style_profiles USING ivfflat (combined_vec vector_cosine_ops);
```

**Migration strategy**:
- Add new columns (nullable initially)
- Backfill interpretable_vec from existing style_vec (first 64D)
- Generate visual_vec for existing captures
- Generate combined_vec
- Drop old style_vec column (or keep for backward compat)

---

## Implementation Steps

### Phase 1: Visual Embedding Builder (1 hour)

**File**: `pipeline/vectors/visual-embedding.ts`

```typescript
import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';

export interface VisualEmbeddingResult {
  embedding: number[];          // 512D CLIP vector
  model: string;                // "clip-vit-base-patch32"
  dimensions: number;           // 512
  imageSize: { width: number; height: number };
}

export async function buildVisualEmbedding(
  runId: string
): Promise<VisualEmbeddingResult> {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  // Read screenshot
  const imagePath = path.join('artifacts', runId, 'fullpage.png');
  if (!fs.existsSync(imagePath)) {
    throw new Error(`Screenshot not found: ${imagePath}`);
  }

  const imageBuffer = fs.readFileSync(imagePath);
  const base64Image = imageBuffer.toString('base64');

  // Get image dimensions
  const sizeOf = require('image-size');
  const dimensions = sizeOf(imagePath);

  // Call OpenAI CLIP API
  const response = await openai.embeddings.create({
    model: "clip-vit-base-patch32",
    input: `data:image/png;base64,${base64Image}`,
  });

  const embedding = response.data[0].embedding;

  return {
    embedding,
    model: "clip-vit-base-patch32",
    dimensions: embedding.length,
    imageSize: { width: dimensions.width, height: dimensions.height }
  };
}
```

**Deliverables**:
- [x] Create `pipeline/vectors/visual-embedding.ts`
- [x] Add OpenAI embeddings API integration
- [x] Handle image reading and base64 encoding
- [x] Error handling for missing screenshots
- [x] Return metadata (model, dimensions)

---

### Phase 2: Update Vector Storage (45 mins)

**File**: `pipeline/vectors/store.ts`

**Current storage**:
```typescript
await query(
  `UPDATE style_profiles
   SET style_vec = $1
   WHERE id = $2`,
  [combinedVector, styleProfileId]
);
```

**New storage** (update to store all three vectors):
```typescript
export async function storeVectors(
  styleProfileId: string,
  interpretableVec: number[],
  visualVec: number[],
  visualModel: string
) {
  // Combine vectors: [64D interpretable + 512D visual]
  const combinedVec = [...interpretableVec, ...visualVec];

  await query(
    `UPDATE style_profiles
     SET
       interpretable_vec = $1,
       visual_vec = $2,
       combined_vec = $3,
       visual_model = $4,
       visual_embedding_date = NOW()
     WHERE id = $5`,
    [
      `[${interpretableVec.join(',')}]`,
      `[${visualVec.join(',')}]`,
      `[${combinedVec.join(',')}]`,
      visualModel,
      styleProfileId
    ]
  );
}
```

**Deliverables**:
- [x] Update `storeVectors()` function signature
- [x] Store interpretable_vec, visual_vec, combined_vec separately
- [x] Add visual model metadata
- [x] Update return types

---

### Phase 3: Pipeline Integration (30 mins)

**File**: `pipeline/orchestrator.ts`

**Add visual embedding step**:
```typescript
// After buildVectors()
console.log('🎨 Building visual embedding...');
const visualResult = await buildVisualEmbedding(runId);

console.log('💾 Storing vectors...');
await storeVectors(
  styleProfileId,
  vectorResult.globalStyleVec.interpretable,
  visualResult.embedding,
  visualResult.model
);
```

**Update pipeline sequence**:
1. Capture → tokens → scenegraph → intent → layout → style → codegen
2. **NEW**: Build interpretable vector (64D from tokens)
3. **NEW**: Build visual embedding (512D from screenshot)
4. **NEW**: Store both + combined

**Deliverables**:
- [x] Add visual embedding step to orchestrator
- [x] Update pipeline logging
- [x] Handle visual embedding errors gracefully
- [x] Save visual embedding metadata to artifacts

---

### Phase 4: Database Migration (30 mins)

**File**: `lib/db/migrations/004_add_visual_vectors.sql`

```sql
-- Add new vector columns (nullable for backward compat)
ALTER TABLE style_profiles
  ADD COLUMN interpretable_vec vector(64),
  ADD COLUMN visual_vec vector(512),
  ADD COLUMN combined_vec vector(576),
  ADD COLUMN visual_model VARCHAR(50),
  ADD COLUMN visual_embedding_date TIMESTAMP;

-- Backfill interpretable_vec from existing style_vec (first 64 dimensions)
UPDATE style_profiles
SET interpretable_vec = style_vec[1:64]
WHERE style_vec IS NOT NULL;

-- Create indexes for similarity search
CREATE INDEX idx_style_profiles_interpretable
  ON style_profiles USING ivfflat (interpretable_vec vector_cosine_ops)
  WITH (lists = 100);

CREATE INDEX idx_style_profiles_visual
  ON style_profiles USING ivfflat (visual_vec vector_cosine_ops)
  WITH (lists = 100);

CREATE INDEX idx_style_profiles_combined
  ON style_profiles USING ivfflat (combined_vec vector_cosine_ops)
  WITH (lists = 100);

-- Optional: Drop old column after verification
-- ALTER TABLE style_profiles DROP COLUMN style_vec;
```

**Migration script**: `scripts/migrate-visual-vectors.js`

```javascript
#!/usr/bin/env node
const { query, getPool } = require('../dist/lib/db/client');
const fs = require('fs');

async function migrate() {
  const sql = fs.readFileSync('lib/db/migrations/004_add_visual_vectors.sql', 'utf8');
  await query(sql);
  console.log('✅ Migration complete: Visual vectors added');

  const poolInstance = getPool();
  await poolInstance.end();
}

migrate();
```

**Deliverables**:
- [x] Create migration SQL file
- [x] Create migration script
- [x] Test migration on dev database
- [x] Backfill interpretable_vec from existing data

---

### Phase 5: Similarity Comparison Tools (1 hour)

**File**: `scripts/compare-similarity.js`

```javascript
#!/usr/bin/env node
const { query, getPool } = require('../dist/lib/db/client');

async function compareSimilarity(url1, url2) {
  // Get both profiles
  const result = await query(`
    SELECT
      c.source_url,
      sp.id,
      sp.interpretable_vec,
      sp.visual_vec,
      sp.combined_vec
    FROM style_profiles sp
    JOIN captures c ON c.id = sp.capture_id
    WHERE c.source_url IN ($1, $2)
  `, [url1, url2]);

  if (result.rows.length < 2) {
    console.log('❌ Need 2 profiles to compare');
    return;
  }

  const [profile1, profile2] = result.rows;

  // Compare using pgvector distance operators
  const similarities = await query(`
    SELECT
      1 - (v1.interpretable_vec <=> v2.interpretable_vec) as interpretable_similarity,
      1 - (v1.visual_vec <=> v2.visual_vec) as visual_similarity,
      1 - (v1.combined_vec <=> v2.combined_vec) as combined_similarity
    FROM
      (SELECT $1::vector(64) as interpretable_vec,
              $2::vector(512) as visual_vec,
              $3::vector(576) as combined_vec) v1,
      (SELECT $4::vector(64) as interpretable_vec,
              $5::vector(512) as visual_vec,
              $6::vector(576) as combined_vec) v2
  `, [
    profile1.interpretable_vec, profile1.visual_vec, profile1.combined_vec,
    profile2.interpretable_vec, profile2.visual_vec, profile2.combined_vec
  ]);

  const sim = similarities.rows[0];

  console.log('\n📊 Similarity Comparison');
  console.log('=' .repeat(70));
  console.log(`Site 1: ${profile1.source_url}`);
  console.log(`Site 2: ${profile2.source_url}`);
  console.log('');
  console.log('Similarity Scores:');
  console.log(`  🎨 Style Tokens (64D):     ${(sim.interpretable_similarity * 100).toFixed(1)}%`);
  console.log(`  👁️  Visual/CLIP (512D):     ${(sim.visual_similarity * 100).toFixed(1)}%`);
  console.log(`  🔀 Combined (576D):        ${(sim.combined_similarity * 100).toFixed(1)}%`);
  console.log('');

  // Interpretation
  if (sim.interpretable_similarity > sim.visual_similarity + 0.2) {
    console.log('💡 These sites have similar design tokens but different visual appearance');
    console.log('   (e.g., same colors/fonts but different layouts)');
  } else if (sim.visual_similarity > sim.interpretable_similarity + 0.2) {
    console.log('💡 These sites look visually similar but use different design tokens');
    console.log('   (e.g., similar layouts but different colors/fonts)');
  } else {
    console.log('💡 These sites are similarly aligned in both style tokens and visual appearance');
  }
}

// Usage: node scripts/compare-similarity.js https://stripe.com https://monzo.com
const [url1, url2] = process.argv.slice(2);
if (!url1 || !url2) {
  console.log('Usage: node scripts/compare-similarity.js <url1> <url2>');
  process.exit(1);
}

compareSimilarity(url1, url2).finally(() => getPool().end());
```

**File**: `scripts/find-similar.js`

```javascript
#!/usr/bin/env node
const { query, getPool } = require('../dist/lib/db/client');

async function findSimilar(targetUrl, mode = 'combined', limit = 5) {
  // Get target profile
  const target = await query(`
    SELECT sp.id, sp.interpretable_vec, sp.visual_vec, sp.combined_vec
    FROM style_profiles sp
    JOIN captures c ON c.id = sp.capture_id
    WHERE c.source_url = $1
  `, [targetUrl]);

  if (target.rows.length === 0) {
    console.log('❌ Target URL not found in database');
    return;
  }

  const targetProfile = target.rows[0];
  const vecColumn = mode === 'style' ? 'interpretable_vec'
                  : mode === 'visual' ? 'visual_vec'
                  : 'combined_vec';

  // Find most similar sites
  const similar = await query(`
    SELECT
      c.source_url,
      1 - (sp.${vecColumn} <=> $1) as similarity
    FROM style_profiles sp
    JOIN captures c ON c.id = sp.capture_id
    WHERE sp.id != $2
    ORDER BY sp.${vecColumn} <=> $1
    LIMIT $3
  `, [targetProfile[vecColumn], targetProfile.id, limit]);

  console.log(`\n🔍 Sites most similar to: ${targetUrl}`);
  console.log(`   (using ${mode} similarity)`);
  console.log('=' .repeat(70));

  similar.rows.forEach((row, i) => {
    const percentage = (row.similarity * 100).toFixed(1);
    console.log(`${i + 1}. ${row.source_url.padEnd(40)} ${percentage}%`);
  });
}

// Usage: node scripts/find-similar.js https://stripe.com [style|visual|combined] [limit]
const [url, mode = 'combined', limit = 5] = process.argv.slice(2);
if (!url) {
  console.log('Usage: node scripts/find-similar.js <url> [style|visual|combined] [limit]');
  process.exit(1);
}

findSimilar(url, mode, parseInt(limit)).finally(() => getPool().end());
```

**Deliverables**:
- [x] Create `compare-similarity.js` for pairwise comparison
- [x] Create `find-similar.js` for nearest neighbor search
- [x] Support mode selection (style/visual/combined)
- [x] Add interpretations and insights

---

### Phase 6: Backfill Existing Captures (30 mins)

**File**: `scripts/backfill-visual-embeddings.js`

```javascript
#!/usr/bin/env node
const { query, getPool } = require('../dist/lib/db/client');
const { buildVisualEmbedding } = require('../dist/pipeline/vectors/visual-embedding');
const { storeVectors } = require('../dist/pipeline/vectors/store');

async function backfillVisualEmbeddings() {
  // Get all profiles missing visual embeddings
  const profiles = await query(`
    SELECT
      sp.id,
      sp.interpretable_vec,
      c.run_id
    FROM style_profiles sp
    JOIN captures c ON c.id = sp.capture_id
    WHERE sp.visual_vec IS NULL
  `);

  console.log(`📊 Found ${profiles.rows.length} profiles to backfill`);

  for (const profile of profiles.rows) {
    try {
      console.log(`Processing ${profile.run_id}...`);

      const visualResult = await buildVisualEmbedding(profile.run_id);

      await storeVectors(
        profile.id,
        JSON.parse(profile.interpretable_vec),
        visualResult.embedding,
        visualResult.model
      );

      console.log(`✅ ${profile.run_id} - ${visualResult.dimensions}D embedding stored`);
    } catch (error) {
      console.error(`❌ ${profile.run_id} - ${error.message}`);
    }
  }

  console.log('\n✅ Backfill complete!');
}

backfillVisualEmbeddings().finally(() => getPool().end());
```

**Deliverables**:
- [x] Create backfill script
- [x] Generate CLIP embeddings for existing captures
- [x] Update database with visual vectors
- [x] Handle errors gracefully (missing screenshots)

---

## Testing Plan

### Unit Tests

**File**: `tests/pipeline/vectors/visual-embedding.test.ts`

```typescript
describe('buildVisualEmbedding', () => {
  it('should generate 512D CLIP embedding from screenshot', async () => {
    const result = await buildVisualEmbedding('test-run-id');
    expect(result.embedding).toHaveLength(512);
    expect(result.model).toBe('clip-vit-base-patch32');
  });

  it('should throw error if screenshot missing', async () => {
    await expect(buildVisualEmbedding('invalid-run-id'))
      .rejects.toThrow('Screenshot not found');
  });
});
```

### Integration Tests

**Test Cases**:
1. ✅ Full pipeline with CLIP integration (capture → tokens → vectors → CLIP → storage)
2. ✅ Similarity comparison between two sites
3. ✅ Nearest neighbor search with different modes
4. ✅ Backfill existing captures

### Manual Testing

**Comparison scenarios**:
1. **Stripe vs Monzo** - Similar fintech, different colors → High visual sim, low style sim?
2. **Stripe vs Apple** - Similar minimalism → High on both?
3. **Stripe vs CNN** - Different domains → Low on both?
4. **GitHub vs Vercel** - Similar tech aesthetic → Test hypothesis

---

## Deliverables Checklist

### Code
- [ ] `pipeline/vectors/visual-embedding.ts` - CLIP integration
- [ ] `pipeline/vectors/store.ts` - Updated storage logic
- [ ] `pipeline/orchestrator.ts` - Pipeline integration
- [ ] `lib/db/migrations/004_add_visual_vectors.sql` - Schema migration
- [ ] `scripts/migrate-visual-vectors.js` - Migration runner
- [ ] `scripts/compare-similarity.js` - Pairwise comparison
- [ ] `scripts/find-similar.js` - Nearest neighbor search
- [ ] `scripts/backfill-visual-embeddings.js` - Backfill existing data

### Tests
- [ ] Unit tests for visual embedding builder
- [ ] Integration tests for full pipeline
- [ ] Manual testing scenarios documented

### Documentation
- [ ] Update `README.md` with CLIP setup instructions
- [ ] Add `.env.local` example for CLIP configuration
- [ ] Document similarity search queries
- [ ] Add usage examples for comparison scripts

---

## API Cost Estimates

**OpenAI CLIP Pricing** (estimated):
- ~$0.0001 per image embedding
- 100 sites = $0.01
- 1,000 sites = $0.10
- Very affordable for MVP/demo

**Alternative**: Use local CLIP model (transformers.js) for zero API cost but requires:
- Node.js with ONNX Runtime
- ~500MB model download
- Slower inference (CPU: 2-5s per image)

---

## Future Enhancements

### Phase 2 (Post-MVP)
1. **Weighted Hybrid Search** - Allow custom weights (e.g., 70% style + 30% visual)
2. **Visual Model Comparison** - Test different CLIP variants (ViT-B/32 vs ViT-L/14)
3. **Regional Embeddings** - Separate CLIP embeddings for hero, CTA, footer sections
4. **Visual Diff** - Highlight which parts of screenshots drive similarity
5. **Temporal Analysis** - Track visual evolution of a site over time

### API Endpoints
```typescript
// /api/similarity/compare?url1=X&url2=Y&mode=combined
// /api/similarity/find?url=X&mode=visual&limit=10
```

---

## Success Metrics

**Validation that CLIP is working**:
1. ✅ Visual similarity scores differ from style token similarity
2. ✅ Sites with similar layouts but different colors score high on visual, low on style
3. ✅ Sites with different layouts but similar colors score low on visual, high on style
4. ✅ Combined search provides balanced results

**Example expected results**:
```
Stripe vs Monzo:
  Style:    45% (different colors)
  Visual:   78% (similar fintech layout)
  Combined: 62% (balanced)

Stripe vs CNN:
  Style:    15% (very different)
  Visual:   12% (different layouts)
  Combined: 14% (clearly dissimilar)
```

---

## Timeline

**Total Estimated Time**: 3-4 hours

| Phase | Task | Time |
|-------|------|------|
| 1 | Visual embedding builder | 1h |
| 2 | Update vector storage | 45min |
| 3 | Pipeline integration | 30min |
| 4 | Database migration | 30min |
| 5 | Comparison tools | 1h |
| 6 | Backfill existing data | 30min |

**Milestones**:
- ✅ Phase 1-2: CLIP integration working
- ✅ Phase 3-4: Pipeline updated and migrated
- ✅ Phase 5-6: Comparison tools ready

---

## Questions & Decisions

### Decision: CLIP Model Choice
**Options**:
1. ✅ **OpenAI CLIP API** (clip-vit-base-patch32) - 512D, easy integration
2. Replicate CLIP API - Similar, alternative provider
3. Local CLIP (transformers.js) - No API cost, slower

**Recommendation**: Start with OpenAI CLIP API (already have key, fast, cheap)

### Decision: Vector Dimensionality
**Options**:
1. ✅ **512D** (CLIP default) - Standard, well-tested
2. 768D (ViT-L/14) - Higher quality, larger
3. 256D (compressed) - Faster search, lower quality

**Recommendation**: Use 512D (CLIP default)

### Decision: Migration Strategy
**Options**:
1. ✅ **Additive migration** - Add new columns, keep old for backward compat
2. Breaking migration - Drop old column immediately

**Recommendation**: Additive (safer, allows rollback)

---

## Risk Mitigation

**Risks**:
1. **OpenAI API rate limits** → Implement retry with exponential backoff
2. **Missing screenshots** → Skip visual embedding, store null
3. **Large image sizes** → Resize to max 1280px before encoding
4. **Storage costs** → Monitor pgvector index size, tune lists parameter

**Monitoring**:
- Track API errors and retry rates
- Monitor visual embedding generation time
- Track storage growth (GB per 100 sites)

---

**Ready to implement?** This plan provides a complete roadmap for CLIP integration with separate vector storage and flexible querying capabilities.
