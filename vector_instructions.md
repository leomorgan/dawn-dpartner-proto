# Vector Storage System - Quick Start Guide

## Overview

The vector storage system captures design styles from websites and converts them into searchable mathematical vectors. This enables semantic search for similar brands and button styles.

### How It Works

1. **Capture**: Playwright extracts DOM, CSS, and screenshots from a URL
2. **Tokenize**: Design tokens extracted (colors, typography, spacing, buttons)
3. **Vectorize**: Tokens → 192D global style vector + 64D CTA button vector
4. **Store**: Vectors saved to Postgres with pgvector for similarity search
5. **Query**: Find k-nearest neighbors using L2 distance

### Vector Dimensions

**Global Style Vector (192D)**
- 64D interpretable features:
  - Color (16D): palette diversity, contrast, harmony
  - Typography (16D): font families, sizes, weights, coherence
  - Spacing (8D): scale, consistency
  - Shape (8D): border radius, shadows
  - Brand Personality (16D): tone, energy, trust level
- 128D visual features (reserved for future CLIP embeddings)

**PrimaryCTA Vector (64D)**
- 24D interpretable features:
  - Color (6D): background/foreground LCH
  - Typography (4D): size, weight, casing
  - Shape (6D): radius, padding, stroke
  - Interaction (4D): hover states
  - UX (4D): contrast, tap target size
- 40D visual features (reserved for future button crop embeddings)

---

## Setup

### 1. Start Database

```bash
docker-compose up -d
npm run db:migrate
```

**Verify**:
```bash
docker-compose ps  # Check services are healthy
psql -h localhost -U dawn -d dawn -c "\dt"  # Check tables exist
```

### 2. Environment Variables

Already configured in `.env.local`:
```bash
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB=dawn
POSTGRES_USER=dawn
POSTGRES_PASSWORD=dawn
```

---

## Usage

### Capture & Store Vectors

**Single URL**:
```bash
# Full pipeline (capture → tokens → vectors → storage)
npm run generate -- --url https://stripe.com --prompt "cta extraction"
```

**Store vectors for existing artifact**:
```bash
npm run store-vectors -- <runId>
```

**Batch ingestion**:
```bash
npm run batch-ingest -- https://stripe.com https://dojo.tech https://airbnb.com https://monzo.com
```

### Query Similarity

**Start dev server**:
```bash
npm run dev
```

**API Endpoints**:

1. **List all profiles**:
```bash
curl "http://localhost:3000/api/vectors/list" | jq
```

2. **Find similar brands** (get runId from list above):
```bash
curl "http://localhost:3000/api/vectors/nearest-styles?runId=<runId>&limit=5" | jq
```

3. **Find similar CTAs**:
```bash
curl "http://localhost:3000/api/vectors/nearest-ctas?runId=<runId>&limit=5" | jq
```

### Direct SQL Queries

```bash
# Connect to DB
PGPASSWORD=dawn psql -h localhost -U dawn -d dawn

# Count vectors
SELECT COUNT(*) FROM style_profiles;
SELECT COUNT(*) FROM role_vectors_primarycta;

# View stored brands
SELECT
  c.run_id,
  c.source_url,
  (sp.ux_summary->>'brandPersonality')::jsonb->>'tone' as tone
FROM captures c
JOIN style_profiles sp ON sp.capture_id = c.id;

# k-NN similarity (Stripe vs others)
SELECT
  sp2.source_url,
  sp2.style_vec <-> sp1.style_vec AS distance
FROM style_profiles sp1, style_profiles sp2
WHERE sp1.source_url LIKE '%stripe%' AND sp2.id != sp1.id
ORDER BY distance ASC
LIMIT 3;
```

---

## Demo Flow

### 1. Ingest Sample Brands

```bash
npm run batch-ingest -- \
  https://stripe.com \
  https://dojo.tech \
  https://airbnb.com \
  https://monzo.com
```

### 2. Verify Storage

```bash
PGPASSWORD=dawn psql -h localhost -U dawn -d dawn -c "
SELECT
  c.source_url,
  sp.ux_summary->>'brandPersonality' as personality,
  LENGTH(sp.style_vec::text) as vector_size
FROM captures c
JOIN style_profiles sp ON sp.capture_id = c.id;"
```

### 3. Test Clustering

Financial brands (Stripe, Dojo, Monzo) should cluster closer than Airbnb:

```bash
# Start server
npm run dev

# In another terminal - get Stripe runId
STRIPE_RUN=$(curl -s "http://localhost:3000/api/vectors/list" | jq -r '.profiles[] | select(.source_url | contains("stripe")) | .run_id' | head -1)

# Find nearest neighbors
curl "http://localhost:3000/api/vectors/nearest-styles?runId=$STRIPE_RUN&limit=3" | jq '.nearest[] | {url: .source_url, distance: .distance}'
```

**Expected Result**:
```json
{"url": "https://dojo.tech", "distance": 1.72}
{"url": "https://monzo.com", "distance": 1.65}
{"url": "https://airbnb.com", "distance": 1.80}
```

Financial brands have lower distance (more similar) than Airbnb.

---

## Key Features

### Deterministic Vectors
Same URL → same vector (no randomness)

```bash
# Capture twice
npm run generate -- --url https://stripe.com --prompt "cta"
npm run generate -- --url https://stripe.com --prompt "cta"

# Check distance (should be < 0.01)
PGPASSWORD=dawn psql -h localhost -U dawn -d dawn -c "
SELECT sp1.style_vec <-> sp2.style_vec AS distance
FROM style_profiles sp1, style_profiles sp2
WHERE sp1.id != sp2.id
LIMIT 1;"
```

### Robust Null Handling
Handles missing `colorHarmony` data gracefully with defaults

### Interpretable Features
Every dimension has a named feature:
```bash
PGPASSWORD=dawn psql -h localhost -U dawn -d dawn -c "
SELECT ux_summary->'featureNames'
FROM style_profiles
LIMIT 1;" | jq
```

---

## Troubleshooting

### Database Connection Error
```bash
# Restart services
docker-compose restart
docker-compose ps
```

### No Vectors Found
```bash
# Check if storage happened
PGPASSWORD=dawn psql -h localhost -U dawn -d dawn -c "SELECT COUNT(*) FROM style_profiles;"

# Re-run storage for artifact
npm run store-vectors -- <runId>
```

### API Errors
```bash
# Check Next.js logs
npm run dev

# Test endpoints
curl -v "http://localhost:3000/api/vectors/list"
```

---

## Architecture

```
┌─────────────┐
│   Browser   │  Playwright captures DOM/CSS/screenshots
└──────┬──────┘
       │
       ▼
┌─────────────┐
│   Tokens    │  Extract colors, typography, spacing, buttons
└──────┬──────┘
       │
       ▼
┌─────────────┐
│   Vectors   │  192D global + 64D CTA vectors
└──────┬──────┘
       │
       ▼
┌─────────────┐
│  Postgres   │  Store with pgvector extension
│  + pgvector │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│   k-NN API  │  Similarity search via L2 distance
└─────────────┘
```

---

## Files Reference

**Database**:
- `docker-compose.yml` - Services (Postgres, MinIO)
- `lib/db/schema.sql` - Table definitions
- `lib/db/client.ts` - Connection pool
- `lib/db/queries.ts` - Query helpers

**Vectors**:
- `pipeline/vectors/index.ts` - Main entry
- `pipeline/vectors/global-style-vec.ts` - 192D builder
- `pipeline/vectors/primary-cta-vec.ts` - 64D builder
- `pipeline/vectors/utils.ts` - Normalization, LCH, contrast

**Storage**:
- `pipeline/storage/index.ts` - DB persistence

**API**:
- `app/api/vectors/nearest-styles/route.ts` - Style similarity
- `app/api/vectors/nearest-ctas/route.ts` - CTA similarity
- `app/api/vectors/list/route.ts` - List profiles

**Scripts**:
- `scripts/db-migrate.js` - Run migrations
- `scripts/store-vectors.js` - Store single artifact
- `scripts/batch-ingest.js` - Batch ingestion

---

## Performance

- Vector building: < 1s per site
- DB insertion: < 500ms per site
- k-NN query (brute force): < 100ms for <1000 vectors

**Future optimizations** (when >1000 vectors):
- Add IVFFlat indexes
- Tune `lists` parameter
- Consider HNSW for even faster queries
