-- Migration 007: Update interpretable vector from 64D to 58D
-- Removed 6 reserved slots (typo_reserved_1-4, spacing_reserved_1, shape_reserved_1)

-- Drop old combined vector (it depends on interpretable_vec dimension)
ALTER TABLE style_profiles DROP COLUMN IF EXISTS combined_vec;

-- Update interpretable vector dimension from 64D to 58D
ALTER TABLE style_profiles DROP COLUMN IF EXISTS interpretable_vec;
ALTER TABLE style_profiles ADD COLUMN interpretable_vec VECTOR(58);

-- Re-add combined vector with new dimensions (58D + 768D = 826D)
ALTER TABLE style_profiles ADD COLUMN combined_vec VECTOR(826);

-- Update comments
COMMENT ON COLUMN style_profiles.interpretable_vec IS '58D style token features (color 16D, typography 12D, spacing 7D, shape 7D, brand 16D)';
COMMENT ON COLUMN style_profiles.combined_vec IS '826D concatenated vector [58D interpretable + 768D visual] for hybrid search';

-- Drop old indexes (they reference the old dimensions)
DROP INDEX IF EXISTS idx_style_profiles_interpretable;
DROP INDEX IF EXISTS idx_style_profiles_combined;

-- Recreate indexes with new dimensions
CREATE INDEX idx_style_profiles_interpretable ON style_profiles
  USING ivfflat (interpretable_vec vector_cosine_ops)
  WITH (lists = 100);

CREATE INDEX idx_style_profiles_combined ON style_profiles
  USING ivfflat (combined_vec vector_cosine_ops)
  WITH (lists = 100);
