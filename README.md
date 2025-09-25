# AI Design Partner — First Demo

**README (for humans and developers)**

This README is written to be understandable by anyone curious about what the project does, while also being specific enough for developers to clone, run, and extend it. If you only read one thing, read the **Quick Start** and **What Happens Under the Hood** sections.

---

## What this project does (in plain language)

Paste the URL of an existing product page (e.g., Airbnb’s homepage) and say what you want (e.g., “create a property detail page”). The tool will:

1. **Study the page’s style** — its colors, fonts, spacing, and shapes.
2. **Understand your goal** — e.g., “detail page” means gallery, price + CTA, amenities, reviews.
3. **Lay out a new page** using simple, battle-tested UX rules.
4. **Apply the original style** so the new page looks like it belongs to that product.
5. **Output real React + Tailwind code** and an **editable vector canvas (SVG)**.

This is a demo. It’s fast, opinionated, and deliberately scoped: **URL-only**, **desktop-only**, small component set, and a single process (no microservices).

---

## Who this is for

* **Product folks / designers**: See how AI can extend your design system to new screens.
* **Developers**: Run an end-to-end pipeline that produces working React code and SVG output.
* **Investors / stakeholders**: Watch the “absorb style → generate page → output code” loop live in a browser.

---

## Quick Start

### Prerequisites

* Node.js ≥ 18, npm or pnpm
* (Optional) OpenAI/Anthropic API key if you want live LLM calls (we provide a mock mode too)
* macOS, Linux, or WSL2 (Windows)

### 1) Clone & install

```bash
git clone https://github.com/your-org/ai-design-partner-demo.git
cd ai-design-partner-demo
npm install
```

### 2) Configure environment

Create `.env.local` at the repo root (you can start with mock intent and enable real LLM later):

```bash
# LLM (choose one or keep mock mode)
OPENAI_API_KEY=sk-...              # optional
ANTHROPIC_API_KEY=sk-ant-...       # optional
INTENT_PROVIDER=mock               # mock | openai | anthropic

# Server
PORT=3000

# Tailwind safelist (keep deterministic classes)
TAILWIND_SAFELIST=text-xl,text-2xl,text-3xl,bg-brand-500,bg-brand-600,rounded-r0,shadow-s0,shadow-s1,shadow-s2
```

### 3) Start the app

```bash
npm run dev
# open http://localhost:3000
```

### 4) Try a generation

* URL: `https://www.airbnb.com/` (or use our offline fixture below)
* Prompt: `create a property detail page`

You should see tabs for each pipeline stage: **Capture → Tokens → Scenegraph → Intent → Layout → Styled → Code → Canvas → Metrics**.

---

## What happens under the hood (the pipeline)

```
URL
  └── [1] Capture & Normalize
        └── raw/dom.html, raw/computed_styles.json, raw/page.png
  └── [2] Style Token Extractor
        └── design_tokens.json, tailwind.config.js, css_vars.css
  └── [3] DOM Scenegraph Builder
        └── scenegraph.json
  └── [4] Intent Parser (LLM or mock)
        └── intent.json
  └── [5] Layout Synthesizer (Flexbox heuristics)
        └── layout.json
  └── [6] Styling & Accessibility Applier
        └── styled_layout.json, lint_report.json
  └── [7] Component Code Generator (+ AST pass)
        └── /components/*.tsx, /pages/GeneratedPage.tsx
  └── [8] Vector Canvas & SVG Export
        └── canvas.json, canvas.svg
  └── [9] Orchestration & Debug UI
        └── run_logs.json, timings.json
```

Each step produces files in `artifacts/<runId>/...`. You can inspect these to understand or debug the system.

---

## Directory structure

```
/app                     # Next.js app (UI + API routes + debug UI)
/pipeline                # Pipeline modules (Node/TS)
  /capture
  /tokens
  /scenegraph
  /intent
  /layout
  /styling
  /codegen
  /vector
/artifacts/{runId}/...   # All pipeline outputs per run
/tests                   # Unit & integration tests
/scripts                 # CLI wrappers to run steps individually
/fixtures                # Offline demo site for tests & no-internet demos
```

---

## Commands you’ll use

### One-click end-to-end

```bash
npm run generate -- --url https://airbnb.com --prompt "create a property detail page"
```

### Step-by-step (debugging)

```bash
npm run capture -- https://airbnb.com
npm run tokens -- artifacts/<runId>
npm run scenegraph -- artifacts/<runId>
npm run intent -- "create a property detail page" --scenegraph artifacts/<runId>/scenegraph.json
npm run layout -- artifacts/<runId>
npm run style -- artifacts/<runId>
npm run codegen -- artifacts/<runId>
```

### Run tests

```bash
npm test                 # all unit & integration tests
npm run test:e2e         # end-to-end against fixtures
```

---

## Module details, with how to test

### 1) Capture & Normalize

* **Goal:** Load URL in headless browser; extract HTML, computed CSS for visible nodes, and a full-page PNG.
* **Tech:** Playwright (Chromium).
* **Outputs:** `raw/dom.html`, `raw/computed_styles.json`, `raw/page.png`, `raw/meta.json`.
* **Manual test:** Open the PNG and confirm it matches the site. Check `computed_styles.json` has many elements with `bbox` and `styles`.
* **Automated test (`tests/capture.spec.ts`):**

  * Serve `/fixtures/site` locally.
  * Assert: ≥ N visible nodes, each with `fontFamily`, `fontSize`, `color`, `bbox.w/h > 0`.
* **Acceptance:** >95% visible nodes captured; P95 capture < 1.2s on fixture.

**Snippet (Playwright)**

```ts
import { chromium } from 'playwright';

export async function capture(url: string, outDir: string) {
  const browser = await chromium.launch();
  const page = await browser.newPage({ deviceScaleFactor: 2 });
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.addStyleTag({ content: `*{transition:none!important;animation:none!important}` });

  const html = await page.content();
  const styles = await page.evaluate(() => {
    const out:any[] = [];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT);
    let el = walker.currentNode as Element | null;
    while (el) {
      const cs = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) {
        out.push({
          tag: el.tagName.toLowerCase(),
          bbox: { x: r.x, y: r.y, w: r.width, h: r.height },
          styles: {
            color: cs.color, backgroundColor: cs.backgroundColor,
            fontFamily: cs.fontFamily, fontSize: cs.fontSize, lineHeight: cs.lineHeight,
            borderRadius: cs.borderRadius, boxShadow: cs.boxShadow,
            margin: `${cs.marginTop} ${cs.marginRight} ${cs.marginBottom} ${cs.marginLeft}`,
            padding: `${cs.paddingTop} ${cs.paddingRight} ${cs.paddingBottom} ${cs.paddingLeft}`
          },
          role: el.getAttribute('role'), class: el.getAttribute('class')
        });
      }
      el = walker.nextNode() as Element | null;
    }
    return out;
  });

  await page.screenshot({ path: `${outDir}/raw/page.png`, fullPage: true });
  await browser.close();
  return { html, styles };
}
```

---

### 2) Style Token Extractor

* **Goal:** Distill the site’s look into **design tokens** (palette, fonts, spacing, radii, shadows).
* **Tech:** TypeScript utils (`culori`/`colorjs.io`), simple clustering; WCAG AA contrast checker.
* **Outputs:** `design_tokens.json`, `tailwind.config.js`, `css_vars.css`, `style_report.json`.
* **Manual test:** Open the **Tokens** tab; check palette and type look right. `style_report.json` shows `aa_pass: true` for body text.
* **Automated test:** Feed a canned `computed_styles.json` with known values. Assert:

  * Palette contains ≥ 3 of top 4 CSS colors,
  * Spacing steps ≤ 6 (8px grid),
  * Body text contrast ≥ 4.5:1 (AA).
* **Acceptance:** Token coverage ≥ 95%; AA passes for body text.

**Snippet (spacing & colors)**

```ts
import { parse, formatHex } from 'culori';

export function aggregateTokens(nodes:any[]) {
  const colorArea = new Map<string, number>();
  const sizes = new Map<number, number>();
  const fontFamilies = new Map<string, number>();
  const spacings:number[] = [];
  const radii = new Map<string, number>();
  const shadows = new Map<string, number>();

  for (const n of nodes) {
    const a = n.bbox.w * n.bbox.h;
    [n.styles.color, n.styles.backgroundColor].forEach(c => {
      const p = parse(c); if (!p) return;
      const key = formatHex(p);
      colorArea.set(key, (colorArea.get(key) || 0) + a);
    });
    fontFamilies.set(n.styles.fontFamily, (fontFamilies.get(n.styles.fontFamily) || 0) + 1);
    sizes.set(parseFloat(n.styles.fontSize), (sizes.get(parseFloat(n.styles.fontSize)) || 0) + 1);

    const m = n.styles.margin.split(' ').map(parseFloat);
    const p = n.styles.padding.split(' ').map(parseFloat);
    spacings.push(...[...m, ...p].filter(Number.isFinite));

    radii.set(n.styles.borderRadius, (radii.get(n.styles.borderRadius) || 0) + 1);
    shadows.set(n.styles.boxShadow, (shadows.get(n.styles.boxShadow) || 0) + 1);
  }

  const spacingSteps = Array.from(new Set(spacings.map(v => Math.round(v/8)*8)))
    .filter(v => v >= 0).sort((a,b)=>a-b).slice(0,6);

  const colors = Array.from(colorArea.entries()).sort((a,b)=>b[1]-a[1]).slice(0,8).map(([hex])=>hex);

  return {
    colors, spacing: spacingSteps,
    fontFamilies: Array.from(fontFamilies.keys()).slice(0,2),
    fontSizes: Array.from(sizes.keys()).sort((a,b)=>a-b),
    radii: Array.from(radii.keys()).slice(0,3),
    shadows: Array.from(shadows.keys()).slice(0,3),
  };
}
```

---

### 3) DOM Scenegraph Builder

* **Goal:** Convert DOM into a **clean tree of meaningful sections** with bounding boxes and reading order.
* **Tech:** linkedom/JSDOM + heuristics (visibility, size, role).
* **Outputs:** `scenegraph.json`.
* **Manual test:** In **Scenegraph** tab, toggle overlay to see section outlines (Header, Hero, CardList, Footer).
* **Automated test:** On fixtures, verify:

  * Wrapper reduction ≥ 40%,
  * Roles include expected sections,
  * Reading order is top-to-bottom, then left-to-right.
* **Acceptance:** Median IoU ≥ 0.8 versus reference boxes.

---

### 4) Intent Parser (LLM/mock)

* **Goal:** Map prompt to a **typed schema** (page_type ∈ `detail|list|profile` + required sections).
* **Tech:** GPT-4o-mini (function calling) or mock provider; schema validation.
* **Outputs:** `intent.json`.
* **Manual test:** Confirm `page_type` and `required_sections` match the prompt.
* **Automated test:** Golden prompts map to exact intents; fuzzy prompts (“detial”) still resolve to `detail`.
* **Acceptance:** ≥95% accuracy on a small prompt set.

**Example output**

```json
{
  "page_type":"detail",
  "primary_entity":"property",
  "required_sections":["gallery","summary","price_cta","amenities","reviews"],
  "priority_order":["hero","price_cta","gallery","trust_signals","details"]
}
```

---

### 5) Layout Synthesizer (Flexbox heuristics)

* **Goal:** Create a **wireframe** satisfying basic UX rules for desktop (12-col grid).
* **Tech:** TypeScript layout DSL → Flexbox props.
* **Outputs:** `layout.json` (stacks, gaps, areas with cols).
* **Manual test:** **Layout** tab should show sensible structure (gallery left, summary/CTA right).
* **Automated test:** All `required_sections` placed; gaps in token set; minimum sizes respected.
* **Acceptance:** 100% constraint satisfaction on fixtures; internal rater ≥ 4/5 layout quality.

**Example layout.json**

```json
{
  "frame": { "width": 1280 },
  "stacks": [
    { "id":"hero", "dir":"row", "gap":16, "areas":[
      { "node":"gallery", "cols":7 },
      { "node":"summary", "cols":5 }
    ]},
    { "id":"below", "dir":"col", "gap":24, "areas":["amenities","reviews"] }
  ]
}
```

---

### 6) Styling & Accessibility Applier

* **Goal:** Apply tokens to the wireframe (colors, fonts, spacing) and ensure **WCAG AA contrast**.
* **Tech:** Tailwind class generator; contrast checker.
* **Outputs:** `styled_layout.json`, `lint_report.json`.
* **Manual test:** **Styled** tab looks like the source brand; `lint_report.json` has 0 critical issues.
* **Automated test:** Token coverage ≥ 95%; AA contrast ≥ 99% of text nodes.
* **Acceptance:** 0 critical lints; only tokenized values used.

---

### 7) Component Code Generator (+ AST pass)

* **Goal:** Emit **React + Tailwind** code that compiles cleanly and matches the styled preview.
* **Tech:** EJS/Handlebars templates; ts-morph/Babel for AST cleanup; ESLint + TypeScript; Playwright visual diff.
* **Outputs:** `/components/*.tsx`, `/pages/GeneratedPage.tsx`.
* **Manual test:** **Code** tab shows generated files; `npm run dev` renders identical preview.
* **Automated test:** ESLint/TS errors = 0; visual diff ≤ 0.5%; no unused imports.
* **Acceptance:** Build is green; page renders as previewed.

**Component snippet (Button)**

```tsx
export function Button({ children, variant = "primary" }:{
  children: React.ReactNode; variant?: "primary"|"ghost"
}) {
  const base = "inline-flex items-center justify-center h-11 px-5 rounded-r0 font-medium";
  const cls = variant==="primary"
    ? `${base} bg-brand-500 text-white hover:bg-brand-600`
    : `${base} border border-gray-300 text-gray-800 bg-white`;
  return <button className={cls}>{children}</button>;
}
```

---

### 8) Vector Canvas & SVG Export

* **Goal:** Let users **select, move, resize** elements and **export SVG**.
* **Tech:** React + Konva; SVG serializer.
* **Outputs:** `canvas.json`, `canvas.svg`.
* **Manual test:** In **Canvas** tab, manipulate elements; export SVG; open it in a viewer.
* **Automated test:** Round-trip (json → canvas → json) ≥ 95% parity; SVG node counts match.
* **Acceptance:** 100% export success on fixtures.

---

### 9) Orchestration & Debug UI

* **Goal:** One endpoint to run the pipeline and a UI to inspect each stage.
* **Tech:** Next.js (API routes + pages), local filesystem storage.
* **Outputs:** `run_logs.json`, `timings.json`.
* **Manual test:** Enter URL + prompt → observe all tabs populated; metrics show stage times.
* **Automated test:** E2E test against `/fixtures/site` passes with all artifacts present; P95 total time < 3s on dev machine.

**API example**

```http
POST /api/generate
{
  "url": "https://example.com",
  "prompt": "create a property detail page"
}
```

**Response**

```json
{ "runId": "2025-09-25T12-00-00Z_abc123" }
```

---

## Offline demo fixture (no internet needed)

We include a small static site in `/fixtures/site`.

### Run it locally:

```bash
npm run fixtures:serve     # serves at http://localhost:5050
npm run generate -- --url http://localhost:5050 --prompt "create a property detail page"
```

The fixture has predictable colors, fonts, and sections, which our tests use to verify outputs.

---

## Configuration tips

* **LLM provider**: Set `INTENT_PROVIDER=mock` for deterministic demos. Switch to `openai` or `anthropic` for live parsing.
* **Tailwind safelist**: Put any dynamic classes in `TAILWIND_SAFELIST` env var to prevent JIT purging.
* **Timeouts**: Some sites are slow. You can adjust Playwright timeouts in `/pipeline/capture/config.ts`.

---

## Troubleshooting

* **Blank tokens or weird colors**: The site might be image-heavy. We only use computed CSS; try another URL or the fixture.
* **Tailwind classes missing**: Add classes to the safelist, or make class strings deterministic (no string concatenation of arbitrary values).
* **LLM errors**: Switch to `INTENT_PROVIDER=mock` to isolate the pipeline from network issues.
* **Layout looks odd**: For the demo, only `detail|list|profile` are supported. Try a different prompt or adjust the chosen template variant.

---

## Testing overview

```bash
npm test                 # unit + integration
npm run test:unit
npm run test:integration
npm run test:e2e         # end-to-end against fixtures/site
```

* **Coverage targets** (guidance):

  * Tokens: palette recall ≥ 75%, spacing steps ≤ 6, AA body text pass.
  * Scenegraph: wrapper reduction ≥ 40%, IoU ≥ 0.8 on fixtures.
  * Layout: 100% constraints satisfied on fixtures.
  * Styling: token coverage ≥ 95%, 0 critical contrast failures.
  * Codegen: ESLint/TS clean, visual diff ≤ 0.5%.
  * Canvas: round-trip ≥ 95% parity.

---

## Glossary (speed run)

* **Design tokens**: Named values for colors, fonts, spacing, etc., that define a brand’s style.
* **Scenegraph**: A tree describing UI sections and elements with positions and sizes.
* **WCAG AA**: Accessibility standard for readable color contrast.
* **Heuristic layout**: Rule-based (not ML) arrangement of sections using grids and flexbox.
* **AST post-pass**: Programmatic cleanup of generated code (imports, props, structure).

---

## Contributing

* Branch from `main`, open PRs with concise descriptions and screenshots (or artifact diffs).
* Add tests for new heuristics or token rules.
* Keep **determinism**: avoid non-deterministic randomness in the pipeline unless seeded.
* Be mindful of **performance**: pipeline P95 < 3s on fixtures is a core demo goal.

---

## Roadmap (post-demo, optional reading)

* **Screenshot-only** fallback (OCR + light detection).
* **Figma importer** plugin.
* **Mobile breakpoints** and sticky behaviors (fold-aware CTA).
* **Style retrieval** (ViT embeddings) to apply styles across sites.
* **Accessibility auto-fixer** (on by default).

---