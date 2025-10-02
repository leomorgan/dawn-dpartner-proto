-- Migration 004: Add separate visual embedding vectors
-- This migration adds CLIP visual embeddings as separate columns for flexible querying

-- Add new vector columns to style_profiles
ALTER TABLE style_profiles
  ADD COLUMN IF NOT EXISTS interpretable_vec VECTOR(64),
  ADD COLUMN IF NOT EXISTS visual_vec VECTOR(512),
  ADD COLUMN IF NOT EXISTS combined_vec VECTOR(576),
  ADD COLUMN IF NOT EXISTS visual_model VARCHAR(50),
  ADD COLUMN IF NOT EXISTS visual_embedding_date TIMESTAMPTZ;

-- Note: We skip backfilling interpretable_vec from style_vec because:
-- 1. pgvector doesn't support array slicing
-- 2. We'll regenerate all vectors with CLIP anyway
-- 3. New pipeline will populate all three columns correctly

-- Create indexes for similarity search
-- Using ivfflat for approximate nearest neighbor search
-- lists=100 is appropriate for <10K vectors (will tune when we scale)

CREATE INDEX IF NOT EXISTS idx_style_profiles_interpretable
  ON style_profiles USING ivfflat (interpretable_vec vector_cosine_ops)
  WITH (lists = 100);

CREATE INDEX IF NOT EXISTS idx_style_profiles_visual
  ON style_profiles USING ivfflat (visual_vec vector_cosine_ops)
  WITH (lists = 100);

CREATE INDEX IF NOT EXISTS idx_style_profiles_combined
  ON style_profiles USING ivfflat (combined_vec vector_cosine_ops)
  WITH (lists = 100);

-- Add comment to explain the schema
COMMENT ON COLUMN style_profiles.interpretable_vec IS '64D style token features (color, typography, spacing, shape, brand)';
COMMENT ON COLUMN style_profiles.visual_vec IS '512D CLIP visual embedding (perceptual layout/aesthetic similarity)';
COMMENT ON COLUMN style_profiles.combined_vec IS '576D concatenated vector [64D + 512D] for hybrid search';
COMMENT ON COLUMN style_profiles.visual_model IS 'CLIP model used (e.g., clip-vit-base-patch32)';

-- Note: We keep the old style_vec column for backward compatibility
-- It can be dropped in a future migration after confirming new columns work
