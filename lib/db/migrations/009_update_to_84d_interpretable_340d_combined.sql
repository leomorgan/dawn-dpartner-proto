-- Migration 009: Update to new vector architecture
-- 84D interpretable (color 24D, typography 14D, spacing 16D, shape 10D, personality 20D)
-- 256D font embedding (text-embedding-3-small)
-- 340D combined (84D + 256D)
-- Removes 768D visual CLIP embeddings entirely

-- Drop old combined vector first (depends on other dimensions)
ALTER TABLE style_profiles DROP COLUMN IF EXISTS combined_vec;

-- Drop old visual embedding columns (CLIP removed)
ALTER TABLE style_profiles DROP COLUMN IF EXISTS visual_vec;
ALTER TABLE style_profiles DROP COLUMN IF EXISTS visual_model;
ALTER TABLE style_profiles DROP COLUMN IF EXISTS visual_embedding_date;

-- Update interpretable vector from 55D to 84D
ALTER TABLE style_profiles DROP COLUMN IF EXISTS interpretable_vec;
ALTER TABLE style_profiles ADD COLUMN interpretable_vec VECTOR(84);

-- Add font embedding vector (256D)
ALTER TABLE style_profiles ADD COLUMN font_embedding_vec VECTOR(256);

-- Add combined vector (84D + 256D = 340D)
ALTER TABLE style_profiles ADD COLUMN combined_vec VECTOR(340);

-- Add font description metadata
ALTER TABLE style_profiles ADD COLUMN font_description TEXT;

-- Update comments
COMMENT ON COLUMN style_profiles.interpretable_vec IS '84D style token features (color 24D, typography 14D, spacing 16D, shape 10D, personality 20D)';
COMMENT ON COLUMN style_profiles.font_embedding_vec IS '256D text embedding of font characteristics (OpenAI text-embedding-3-small)';
COMMENT ON COLUMN style_profiles.combined_vec IS '340D concatenated vector [84D interpretable + 256D font] for hybrid search';
COMMENT ON COLUMN style_profiles.font_description IS 'Human-readable font description used to generate embedding';

-- Drop old indexes
DROP INDEX IF EXISTS idx_style_profiles_interpretable;
DROP INDEX IF EXISTS idx_style_profiles_combined;

-- Recreate indexes with new dimensions
CREATE INDEX idx_style_profiles_interpretable ON style_profiles
  USING ivfflat (interpretable_vec vector_cosine_ops)
  WITH (lists = 100);

CREATE INDEX idx_style_profiles_combined ON style_profiles
  USING ivfflat (combined_vec vector_cosine_ops)
  WITH (lists = 100);

CREATE INDEX idx_style_profiles_font_embedding ON style_profiles
  USING ivfflat (font_embedding_vec vector_cosine_ops)
  WITH (lists = 100);

-- Update PrimaryCTA vector from 64D to 24D (interpretable only, no visual)
ALTER TABLE role_vectors_primarycta DROP COLUMN IF EXISTS vec;
ALTER TABLE role_vectors_primarycta ADD COLUMN vec VECTOR(24) NOT NULL;

COMMENT ON COLUMN role_vectors_primarycta.vec IS '24D interpretable color features only (no visual embedding)';
