-- Migration: Update vector dimensions
-- Date: 2025-10-10
-- Reason:
--   1. Refactored global-style-vec to remove duplicate features and use color-encoding-v2
--      84D/340D → 53D/309D
--   2. Fixed CTA vector color encoding (circular hue, correct chroma range)
--      24D → 26D

-- === GLOBAL STYLE VECTORS ===

-- Drop existing vector indexes (they're tied to the column dimensions)
DROP INDEX IF EXISTS idx_style_profiles_interpretable;
DROP INDEX IF EXISTS idx_style_profiles_combined;

-- Drop old vector columns
ALTER TABLE style_profiles DROP COLUMN IF EXISTS interpretable_vec;
ALTER TABLE style_profiles DROP COLUMN IF EXISTS combined_vec;

-- Add new vector columns with updated dimensions
ALTER TABLE style_profiles ADD COLUMN interpretable_vec VECTOR(53);
ALTER TABLE style_profiles ADD COLUMN combined_vec VECTOR(309);

-- Add column comments
COMMENT ON COLUMN style_profiles.interpretable_vec IS '53D interpretable vector (colors 17D, color stats 3D, typography 14D, spacing 11D, shape 6D, coherence 2D)';
COMMENT ON COLUMN style_profiles.combined_vec IS '309D concatenated vector [53D interpretable + 256D font] for hybrid search';

-- Recreate vector indexes with new dimensions
CREATE INDEX idx_style_profiles_interpretable ON style_profiles
  USING ivfflat (interpretable_vec vector_cosine_ops)
  WITH (lists = 100);

CREATE INDEX idx_style_profiles_combined ON style_profiles
  USING ivfflat (combined_vec vector_cosine_ops)
  WITH (lists = 100);

-- === PRIMARY CTA VECTORS ===

-- Drop existing CTA vector index
DROP INDEX IF EXISTS idx_role_vectors_primarycta_vec;

-- Drop old CTA vector column
ALTER TABLE role_vectors_primarycta DROP COLUMN IF EXISTS vec;

-- Add new CTA vector column with updated dimension
ALTER TABLE role_vectors_primarycta ADD COLUMN vec VECTOR(26) NOT NULL DEFAULT '[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]';

-- Remove default after adding column
ALTER TABLE role_vectors_primarycta ALTER COLUMN vec DROP DEFAULT;

-- Add column comment
COMMENT ON COLUMN role_vectors_primarycta.vec IS '26D interpretable features (8D colors with circular hue + 4D typography + 6D shape + 4D interaction + 4D UX)';

-- Recreate CTA vector index with new dimension
CREATE INDEX idx_role_vectors_primarycta_vec ON role_vectors_primarycta
  USING ivfflat (vec vector_cosine_ops)
  WITH (lists = 100);

-- Note: Existing data will need to be re-vectorized with the new encoding
-- Run: npm run vectorize -- --re-vectorize-all
