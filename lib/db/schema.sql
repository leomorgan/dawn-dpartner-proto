-- lib/db/schema.sql
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Raw captures (provenance)
CREATE TABLE IF NOT EXISTS captures (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  source_url TEXT NOT NULL,
  viewport JSONB NOT NULL,  -- {width: 1280, height: 720, dpr: 1}

  -- File URIs (not S3 yet for MVP)
  dom_uri TEXT NOT NULL,         -- file:///path/to/artifacts/.../raw/dom.html
  css_uri TEXT NOT NULL,         -- file:///path/to/artifacts/.../raw/computed_styles.json
  screenshot_uri TEXT NOT NULL,  -- file:///path/to/artifacts/.../raw/page.png

  run_id TEXT NOT NULL UNIQUE,  -- maps to artifacts/{runId}
  captured_at TIMESTAMPTZ DEFAULT now(),
  user_agent TEXT,
  page_title TEXT
);

CREATE INDEX IF NOT EXISTS idx_captures_url ON captures(source_url);
CREATE INDEX IF NOT EXISTS idx_captures_run_id ON captures(run_id);
CREATE INDEX IF NOT EXISTS idx_captures_captured_at ON captures(captured_at DESC);

-- Global style profiles (one per URL/capture)
CREATE TABLE IF NOT EXISTS style_profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  capture_id UUID REFERENCES captures(id) ON DELETE CASCADE,
  source_url TEXT NOT NULL,

  -- Full tokens from design_tokens.json (10KB typical)
  tokens_json JSONB NOT NULL,

  -- 192D fixed vector (legacy - nullable, deprecated)
  style_vec VECTOR(192),

  -- 53D interpretable vector (colors 17D, color stats 3D, typography 14D, spacing 11D, shape 6D, coherence 2D)
  interpretable_vec VECTOR(53),

  -- 256D font embedding (text-embedding-3-small)
  font_embedding_vec VECTOR(256),

  -- 309D combined vector [53D interpretable + 256D font] for hybrid search
  combined_vec VECTOR(309),

  -- Font description used to generate embedding
  font_description TEXT,

  -- UX/brand summary from style_report.json
  ux_summary JSONB,

  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_style_profiles_url ON style_profiles(source_url);
CREATE INDEX IF NOT EXISTS idx_style_profiles_tokens_gin ON style_profiles USING GIN (tokens_json);

-- Vector indexes (IVFFlat for approximate nearest neighbor search)
CREATE INDEX IF NOT EXISTS idx_style_profiles_interpretable ON style_profiles
  USING ivfflat (interpretable_vec vector_cosine_ops)
  WITH (lists = 100);

CREATE INDEX IF NOT EXISTS idx_style_profiles_combined ON style_profiles
  USING ivfflat (combined_vec vector_cosine_ops)
  WITH (lists = 100);

CREATE INDEX IF NOT EXISTS idx_style_profiles_font_embedding ON style_profiles
  USING ivfflat (font_embedding_vec vector_cosine_ops)
  WITH (lists = 100);

-- PrimaryCTA role vectors (one per URL/capture)
CREATE TABLE IF NOT EXISTS role_vectors_primarycta (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  style_profile_id UUID REFERENCES style_profiles(id) ON DELETE CASCADE,

  -- 26D interpretable features (8D colors with circular hue + 4D typography + 6D shape + 4D interaction + 4D UX)
  vec VECTOR(26) NOT NULL,

  -- Button metadata from buttons.variants[primary]
  tokens_json JSONB NOT NULL,

  -- Button exemplars (future: Playwright element screenshots)
  exemplars JSONB DEFAULT '[]'::jsonb,

  -- UX metrics
  ux_report JSONB,

  confidence REAL CHECK (confidence >= 0 AND confidence <= 1),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_role_vectors_primarycta_profile ON role_vectors_primarycta(style_profile_id);
-- No IVFFlat index yet - wait for 1000+ vectors

-- View for easy querying
CREATE OR REPLACE VIEW style_profiles_with_cta AS
SELECT
  sp.*,
  rc.id as cta_id,
  rc.vec as cta_vec,
  rc.tokens_json as cta_tokens,
  rc.confidence as cta_confidence
FROM style_profiles sp
LEFT JOIN role_vectors_primarycta rc ON rc.style_profile_id = sp.id;
