-- Migration: Drop legacy style_vec column
-- Reason: Replaced by interpretable_vec (56D) + combined_vec (312D)
-- Date: 2025-10-10

-- Drop the legacy style_vec column from style_profiles
ALTER TABLE style_profiles DROP COLUMN IF EXISTS style_vec CASCADE;

-- Add comment for documentation
COMMENT ON TABLE style_profiles IS 'Style profiles use interpretable_vec (56D), font_embedding_vec (256D), and combined_vec (312D)';
