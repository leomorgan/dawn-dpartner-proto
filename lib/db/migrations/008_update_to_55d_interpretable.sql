-- Migration 008: Update interpretable vector from 58D to 55D
-- Removed 3 dead features (color_background_variation, typo_family_count, brand_color_saturation_energy)

-- Drop old combined vector (it depends on interpretable_vec dimension)
ALTER TABLE style_profiles DROP COLUMN IF EXISTS combined_vec;

-- Update interpretable vector dimension from 58D to 55D
ALTER TABLE style_profiles DROP COLUMN IF EXISTS interpretable_vec;
ALTER TABLE style_profiles ADD COLUMN interpretable_vec VECTOR(55);

-- Re-add combined vector with new dimensions (55D + 768D = 823D)
ALTER TABLE style_profiles ADD COLUMN combined_vec VECTOR(823);

-- Update comments
COMMENT ON COLUMN style_profiles.interpretable_vec IS '55D style token features (color 15D, typography 11D, spacing 7D, shape 7D, brand 15D)';
COMMENT ON COLUMN style_profiles.combined_vec IS '823D concatenated vector [55D interpretable + 768D visual] for hybrid search';

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
