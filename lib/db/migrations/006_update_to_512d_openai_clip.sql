-- Migration 006: Update to 512D for OpenAI CLIP model
-- openai/clip model returns 512D embeddings

DROP INDEX IF EXISTS idx_style_profiles_visual;
DROP INDEX IF EXISTS idx_style_profiles_combined;

ALTER TABLE style_profiles DROP COLUMN IF EXISTS visual_vec;
ALTER TABLE style_profiles DROP COLUMN IF EXISTS combined_vec;

ALTER TABLE style_profiles ADD COLUMN visual_vec VECTOR(512);
ALTER TABLE style_profiles ADD COLUMN combined_vec VECTOR(576); -- 64D + 512D

CREATE INDEX IF NOT EXISTS idx_style_profiles_visual
  ON style_profiles USING ivfflat (visual_vec vector_cosine_ops)
  WITH (lists = 100);

CREATE INDEX IF NOT EXISTS idx_style_profiles_combined
  ON style_profiles USING ivfflat (combined_vec vector_cosine_ops)
  WITH (lists = 100);

COMMENT ON COLUMN style_profiles.visual_vec IS '512D CLIP visual embedding (Replicate openai/clip model)';
COMMENT ON COLUMN style_profiles.combined_vec IS '576D concatenated vector [64D interpretable + 512D visual]';
