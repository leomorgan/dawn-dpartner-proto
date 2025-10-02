-- Migration 005: Update visual_vec to 768D (Replicate CLIP actual dimensions)
-- The Replicate CLIP model returns 768D embeddings, not 512D

-- Drop existing indexes
DROP INDEX IF EXISTS idx_style_profiles_visual;
DROP INDEX IF EXISTS idx_style_profiles_combined;

-- Drop and recreate visual_vec column with correct dimensions
ALTER TABLE style_profiles DROP COLUMN IF EXISTS visual_vec;
ALTER TABLE style_profiles DROP COLUMN IF EXISTS combined_vec;

ALTER TABLE style_profiles ADD COLUMN visual_vec VECTOR(768);
ALTER TABLE style_profiles ADD COLUMN combined_vec VECTOR(832); -- 64D + 768D

-- Recreate indexes
CREATE INDEX IF NOT EXISTS idx_style_profiles_visual
  ON style_profiles USING ivfflat (visual_vec vector_cosine_ops)
  WITH (lists = 100);

CREATE INDEX IF NOT EXISTS idx_style_profiles_combined
  ON style_profiles USING ivfflat (combined_vec vector_cosine_ops)
  WITH (lists = 100);

-- Update comments
COMMENT ON COLUMN style_profiles.visual_vec IS '768D CLIP visual embedding (Replicate andreasjansson/clip-features)';
COMMENT ON COLUMN style_profiles.combined_vec IS '832D concatenated vector [64D interpretable + 768D visual] for hybrid search';
