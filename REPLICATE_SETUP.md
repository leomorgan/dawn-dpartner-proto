# Replicate CLIP Setup Guide

This guide shows how to configure Replicate's CLIP API for visual embeddings.

---

## 1. Get Your Replicate API Token

1. Go to [https://replicate.com](https://replicate.com)
2. Sign up or log in
3. Navigate to [Account Settings → API Tokens](https://replicate.com/account/api-tokens)
4. Create a new token or copy your existing token
5. It will look like: `r8_xxxxxxxxxxxxxxxxxxxxxxxxxxxxx`

---

## 2. Add Token to Environment

Add your token to `.env.local`:

```bash
# Visual Embedding / CLIP Configuration
REPLICATE_API_TOKEN=r8_your_actual_token_here
```

**Important**: Never commit `.env.local` to git (it's already in `.gitignore`)

---

## 3. CLIP Model Information

**Model**: `andreasjansson/clip-features`
- **Model ID**: `75b33f253f7714a281ad3e9b28f63e3232d583716ef6718f2e46641077ea040a`
- **Input**: Base64-encoded PNG image
- **Output**: 512-dimensional embedding vector
- **Cost**: ~$0.0005 per image

**Alternative Models**:
- `openai/clip-vit-large-patch14-336` - Higher quality, 768D, slower
- `pharmapsychotic/clip-interrogator` - Image-to-text CLIP

---

## 4. Verify Setup

Test your configuration:

```bash
# Build pipeline
npm run build:pipeline

# Test on one site (won't call Replicate yet, just verifies setup)
node -e "console.log(process.env.REPLICATE_API_TOKEN ? '✅ Token configured' : '❌ Missing token')"
```

---

## 5. Generate Real CLIP Embeddings

### For New Captures

The pipeline will automatically generate CLIP embeddings:

```bash
npm run capture -- https://example.com
npm run storage -- <runId>  # Auto-generates CLIP embedding
```

### For Existing Captures (Backfill)

Regenerate embeddings for all existing captures:

```bash
node scripts/backfill-visual-embeddings.js
```

This will:
- Find all profiles without visual embeddings
- Call Replicate CLIP API for each screenshot
- Store 512D embeddings in database
- Cost: ~$0.004 for 8 captures (8 × $0.0005)

---

## 6. Usage Examples

After backfill completes:

```bash
# Compare visual similarity between two sites
node scripts/compare-similarity.js https://stripe.com https://monzo.com

# Find visually similar sites
node scripts/find-similar.js https://stripe.com visual

# Find sites similar by style AND visual
node scripts/find-similar.js https://stripe.com combined
```

---

## Cost Calculator

| Captures | Cost (Replicate) |
|----------|------------------|
| 10       | $0.005           |
| 100      | $0.05            |
| 1,000    | $0.50            |
| 10,000   | $5.00            |

**Very affordable for production use.**

---

## Troubleshooting

### Error: "No API token found"
- Check `.env.local` has `REPLICATE_API_TOKEN=r8_...`
- Restart terminal/rebuild: `npm run build:pipeline`

### Error: "Model not found"
- Replicate model may have changed
- Update model ID in `pipeline/vectors/replicate-clip.ts`

### Error: "Rate limit exceeded"
- Replicate free tier: 50 requests/month
- Upgrade at: https://replicate.com/pricing

### Slow Performance
- Replicate API: ~500-1000ms per image
- Consider batching or caching for large datasets

---

## Alternative: Local CLIP (No API Key)

If you prefer not to use Replicate:

1. Install transformers.js: `npm install @xenova/transformers`
2. Update `visual-embedding.ts` to use local model
3. Trade-off: No API cost, but slower CPU inference

---

**Next Steps**: See `CLIP_IMPLEMENTATION_SUMMARY.md` for architecture details
