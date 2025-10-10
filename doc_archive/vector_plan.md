Awesome—here’s a clean, **TypeScript-first MVP plan** you can hand to a new dev. It explains the **goal**, the **components to build**, **schemas**, **interfaces**, **pipelines**, and **acceptance**—and keeps scope tight to just:

1. **Global Style Vector** per URL
2. **PrimaryCTA Role Vector** per URL
3. **Vector DB** you can query/explore

(Everything else is out of scope.)

---

# Goal (single sentence)

Given a URL, deterministically capture its styles and produce:

* a **Global StyleVec** (brand vibe) and
* a **PrimaryCTA RoleVec** (canonical primary button),
  then index both in **Postgres + pgvector** for nearest-neighbour exploration. 

---

# High-level architecture (TS/Node only)

* **API (Express)**: `/ingest/url`, `/style-profiles/:id`, `/primarycta/nearest`.
* **Capture (Playwright)**: DOM + CSSOM + **computed styles** + full-page screenshot at fixed viewport/DPR.
* **Analyzer (pure TS)**:

  * **Token extractor** → color (LCH), typography, simple spacing/shape stats → **tokens_json**.
  * **PrimaryCTA finder** → detect candidate buttons, score “primary-ness”, select **one canonical**.
  * **Vector builder** → fixed-dim **StyleVec** and **PrimaryCTA RoleVec**.
* **Storage**: Postgres (+ **pgvector** ext) for vectors/metadata; S3/R2 (or local) for screenshot and button crops.
* **No Redis** for this phase (run ingestion inline or as a simple background task in the same process). 

---

# Repo layout

```
/apps/api            # Express server
/packages/capture    # Playwright capture helpers
/packages/analyze    # token extractor, CTA finder, vector builder
/packages/db         # Prisma/SQL helpers, migrations (pgvector)
```

---

# Environment & infra

* **Postgres 15+** with `pgvector` extension.
* **S3-compatible** blob store (MinIO locally).
* Fixed **viewport=1440×900**, **DPR=2**, animations disabled. 

`docker-compose.yml` (excerpt):

```yaml
services:
  db:
    image: pgvector/pgvector:pg16
    environment:
      POSTGRES_PASSWORD: dawn
      POSTGRES_DB: dawn
    ports: ["5432:5432"]
  minio:
    image: minio/minio
    command: server /data
    environment:
      MINIO_ROOT_USER: minio
      MINIO_ROOT_PASSWORD: minio123
    ports: ["9000:9000","9001:9001"]
```

---

# Database schema (SQL)

```sql
CREATE EXTENSION IF NOT EXISTS vector;

-- Raw captures (provenance)
CREATE TABLE captures (
  id UUID PRIMARY KEY,
  source_url TEXT NOT NULL,
  viewport JSONB NOT NULL,
  dom_uri TEXT NOT NULL,
  css_uri TEXT NOT NULL,
  screenshot_uri TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- One row per URL/brand: the Global StyleVec
CREATE TABLE style_profiles (
  id UUID PRIMARY KEY,
  capture_id UUID REFERENCES captures(id),
  source_url TEXT NOT NULL,
  tokens_json JSONB NOT NULL,      -- palette/type/spacing/radius/shadows summary
  style_vec VECTOR(192) NOT NULL,  -- fixed-dim global vector
  ux_summary JSONB,                -- e.g., {contrast_median:..., palette_entropy:...}
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX style_profiles_vec_idx
  ON style_profiles USING ivfflat (style_vec vector_l2_ops);

-- Exactly one canonical PrimaryCTA per URL (MVP)
CREATE TABLE role_vectors_primarycta (
  id UUID PRIMARY KEY,
  style_profile_id UUID REFERENCES style_profiles(id),
  vec VECTOR(64) NOT NULL,         -- fixed-dim CTA vector
  tokens_json JSONB NOT NULL,      -- interpretable per-button features
  exemplars JSONB,                 -- [{crop_uri,bbox,dom_path,label}]
  ux_report JSONB,                 -- {contrast:..., tap_area:...}
  confidence REAL,                 -- 0..1 from cluster/heuristics
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX role_vectors_primarycta_vec_idx
  ON role_vectors_primarycta USING ivfflat (vec vector_l2_ops);
```

Why pgvector/IVFFLAT: fast k-NN over fixed dims; simple to run; aligns with the MVP tech plan. 

---

# TypeScript interfaces (shared types)

/packages/analyze/src/types.ts

```ts
export type Viewport = { width: number; height: number; dpr: number };

export type CaptureBundle = {
  domUri: string; cssUri: string; screenshotUri: string;
  sourceUrl: string; viewport: Viewport;
};

export type Tokens = {
  color: {
    primary: { L: number; C: number; h: number };
    secondary?: { L: number; C: number; h: number };
    neutrals: { lightnessMean: number };
    contrastMedian: number;
    entropy: number;
  };
  typography: {
    primaryFamily: string;
    familyEmbedding2D: [number, number]; // PCA of family features
    weightMean: number;
    headingBodyRatio: number;
    letterSpacingMean: number;
  };
  spacingShape: {
    marginMedian: number;
    paddingMedian: number;
    radiusMedian: number;
    shadowIntensityMean: number;
  };
};

export type StyleProfile = {
  id: string;
  sourceUrl: string;
  tokens: Tokens;
  styleVec: number[]; // length 192
};

export type CtaFeatures = {
  bg: { L: number; C: number; h: number };
  fg: { L: number; C: number; h: number };
  contrast: number;
  fontWeight: number;
  fontSizePxNorm: number;
  letterSpacingEm: number;
  casingScore: number;       // 0..1 uppercase-ness
  radiusPxNorm: number;
  strokePx: number;
  shadowIntensity: number;
  shadowBlurPxNorm: number;
  padXNorm: number;
  padYNorm: number;
  minTapSidePx: number;
  iconPresence: 0 | 1;
  iconPosition: -1 | 0 | 1;  // left/none/right
};

export type PrimaryCtaVector = {
  id: string;
  styleProfileId: string;
  vec: number[]; // length 64
  tokens: CtaFeatures;
  exemplars?: Array<{ cropUri: string; bbox: [number,number,number,number]; domPath: string; label?: string }>;
  confidence: number;
};
```

---

# Pipeline (exact steps)

## 1) Capture (deterministic)

* Playwright:

  * Set `{width:1440, height:900, dpr:2}`.
  * `document.startViewTransition` off; `prefers-reduced-motion` on.
  * Wait for fonts; inline computed styles per node; full-page screenshot.
* Persist to S3/MinIO; write a `captures` row.
  This mirrors the plan’s “deterministic DOM snapshot; CSSOM resolution”. 

## 2) Token extraction → `tokens_json`

* **Color**: parse CSS color tokens; sample screenshot; convert to **LCH**; k-means (k≈6) to identify primary/secondary; compute neutral lightness mean; **median contrast**; **palette entropy**.
* **Typography**: from computed styles—family string; map to a small family embedding (serif vs sans etc.), **mean weight**, **H1:body ratio**, **letter-spacing mean**.
* **Spacing/shape**: **medians** for padding/margin; **radius** and **shadow** intensity means.
  Outputs align to “DesignTokens{ palette, type, spacing, radius, shadows }”. 

## 3) PrimaryCTA discovery (no ML required)

* **Candidates**: `<button>`, `[role=button]`, `<a>` with `display:inline-block/block` and button-like styles.
* **Score** each candidate:

  * Filled vs outline (+1 if filled),
  * Color close to `tokens.color.primary` (+1),
  * Size/contrast above sibling buttons (+1),
  * Text verb set (“Buy”, “Start”, “Sign up”, “Continue”) (+1),
  * Min tap area ≥44px (+1),
  * Penalise low contrast (<4.5:1).
* **Pick the top** scoring element on the page (break ties by contrast, then size).
  Store 2–3 **exemplars** (crops + domPath) along with the chosen canonical.
  This is a subset of the “Component Capture” objective without heavy clustering/LLM. 

## 4) Vector building

### Global StyleVec (fixed 192D)

* **~64D interpretable**: flatten `Tokens` stats (normalized).
* **~128D “vision-lite” (optional)**:

  * If you want zero ML in v0: compute simple image descriptors on 3 crops (nav slice + 2 buttons): intensity histograms, edge density, local contrast → PCA to 128D.
  * If you’re OK with a tiny model: run **ONNX CLIP** in Node and PCA to 128D.
    Concatenate → `style_vec`. Insert into `style_profiles`. The plan calls for combined token + visual embeddings; both options keep MVP simple. 

### PrimaryCTA RoleVec (fixed 64D)

* **~24D interpretable** from the chosen button’s computed styles & box metrics (see `CtaFeatures`).
* **~40D vision-lite** from the button crop (PCA of descriptors, or CLIP→PCA if used).
  Concatenate → `vec`. Insert into `role_vectors_primarycta`. (Confidence = min of heuristics score normalization, contrast pass, and size adequacy.)

## 5) UX basics (record, don’t fix)

* Compute and store in `ux_report`: `contrast`, `minTapSidePx`, `focusVisible` (yes/no via :focus-visible outline check).
  MVP only records; later phases add “UX Library” auto-fixes. 

## 6) Index & query

* Create IVFFLAT indexes on `style_profiles.style_vec` and `role_vectors_primarycta.vec`.
* Expose k-NN queries with optional filters.
  This implements the “Style Embedding (Moat)… pgvector” piece for v1. 

---

# API endpoints (minimal)

```http
POST /ingest/url
Body: { "url": "https://example.com" }
→ 201 { "style_profile_id": "sp_...", "primarycta_id": "cta_...", "metrics": { "contrast": 7.8 } }

GET /style-profiles/:id
→ 200 { "style_profile": {...}, "nearest": [{id, source_url, distance}, ...] }

GET /primarycta/nearest?style_profile_id=sp_...&k=10
→ 200 [{ "id": "cta_...", "style_profile_id":"sp_...", "distance":0.18,
         "exemplars":[{"cropUri": "..."}], "tokens": {...} }]

GET /primarycta/:id/exemplars
→ 200 [{ "cropUri":"...", "domPath":"...", "label":"..." }]
```

---

# Developer tasks (checklist)

**Day 1–2**

* Bring up Docker Postgres (with `pgvector`) + MinIO.
* Write migrations above; wire Prisma/pg library.

**Day 3–4**

* Implement **Playwright capture** helper:

  * fixed viewport/DPR; computed styles; screenshot; save to MinIO.
  * persist `captures` row.

**Day 5–6**

* Implement **token extractor** (culori for LCH; small helpers for contrast).
* Implement **PrimaryCTA finder** (heuristics above) and **crop** saving.

**Day 7–8**

* Implement **StyleVec** & **RoleVec** builders (pure TS; PCA via numeric lib).
* Insert rows in `style_profiles` and `role_vectors_primarycta`.

**Day 9**

* Implement API endpoints + simple k-NN queries via SQL (`ORDER BY style_vec <-> $1 LIMIT k`).

**Day 10**

* Seed 10 “gold URLs”; write a small CLI `yarn ingest <url>`.
* Add tests: re-ingest drift < epsilon; CTA found once; contrast recorded.

This mirrors the “Capture → Style Capture → Style Embedding (pgvector)” thin slice from the broader plan, trimmed to MVP.

---

# k-NN query examples (SQL)

Nearest global styles to a profile:

```sql
SELECT sp2.id, sp2.source_url, (sp2.style_vec <-> sp1.style_vec) AS dist
FROM style_profiles sp1, style_profiles sp2
WHERE sp1.id = $1 AND sp2.id <> sp1.id
ORDER BY dist ASC
LIMIT $2;
```

Nearest PrimaryCTA to a given URL’s CTA:

```sql
SELECT r2.id, r2.style_profile_id, (r2.vec <-> r1.vec) AS dist
FROM role_vectors_primarycta r1, role_vectors_primarycta r2
WHERE r1.style_profile_id = $1 AND r2.style_profile_id <> $1
ORDER BY dist ASC
LIMIT $2;
```

---

# Acceptance criteria (tight)

* **Determinism**: Re-ingesting the same gold URL produces `style_vec` and `cta.vec` within a small epsilon (vector L2 < 1e-3).
* **Coverage**: 100% of gold URLs produce **one** StyleVec and **one** PrimaryCTA RoleVec.
* **UX basics**: 100% of CTAs report contrast and min tap side.
* **Retrieval sanity**: For 5 hand-picked brands, top-5 neighbours (global, CTA) look more on-brand than random in a quick human check (≥30% better)—matching the style-embedding intent. 

---

# What’s deliberately **not** included

* No other roles (NavBar/Card/etc.), no semantic region mapping, no generation, no UX auto-fix. Those are in the larger tech plan but **out of scope** here. 
