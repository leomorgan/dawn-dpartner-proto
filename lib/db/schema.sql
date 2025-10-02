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

  -- 192D fixed vector
  style_vec VECTOR(192) NOT NULL,

  -- UX/brand summary from style_report.json
  ux_summary JSONB,

  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_style_profiles_url ON style_profiles(source_url);
CREATE INDEX IF NOT EXISTS idx_style_profiles_tokens_gin ON style_profiles USING GIN (tokens_json);
-- No IVFFlat index yet - wait for 1000+ vectors

-- PrimaryCTA role vectors (one per URL/capture)
CREATE TABLE IF NOT EXISTS role_vectors_primarycta (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  style_profile_id UUID REFERENCES style_profiles(id) ON DELETE CASCADE,

  -- 64D fixed vector
  vec VECTOR(64) NOT NULL,

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
