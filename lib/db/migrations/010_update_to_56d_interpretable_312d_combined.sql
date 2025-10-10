-- Migration: Update vector dimensions from 53D→56D (interpretable) and 309D→312D (combined)
-- Reason: Added 3 new color coverage features (brand_color_coverage, accent_color_coverage, foundation_color_coverage)
-- Date: 2025-10-10

-- Drop existing vector indexes (they'll be recreated with new dimensions)
DROP INDEX IF EXISTS idx_style_profiles_interpretable;
DROP INDEX IF EXISTS idx_style_profiles_combined;

-- Recreate interpretable_vec column (53D → 56D)
ALTER TABLE style_profiles DROP COLUMN IF EXISTS interpretable_vec CASCADE;
ALTER TABLE style_profiles ADD COLUMN interpretable_vec VECTOR(56);

-- Recreate combined_vec column (309D → 312D)
ALTER TABLE style_profiles DROP COLUMN IF EXISTS combined_vec CASCADE;
ALTER TABLE style_profiles ADD COLUMN combined_vec VECTOR(312);

-- Recreate vector indexes
CREATE INDEX idx_style_profiles_interpretable ON style_profiles
  USING ivfflat (interpretable_vec vector_cosine_ops)
  WITH (lists = 100);

CREATE INDEX idx_style_profiles_combined ON style_profiles
  USING ivfflat (combined_vec vector_cosine_ops)
  WITH (lists = 100);

-- Update comments on the table for documentation
COMMENT ON COLUMN style_profiles.interpretable_vec IS '56D interpretable vector: colors 17D, color stats 3D, color coverage 3D, typography 14D, spacing 11D, shape 6D, coherence 2D';
COMMENT ON COLUMN style_profiles.combined_vec IS '312D combined vector: 56D interpretable + 256D font embedding for hybrid search';
