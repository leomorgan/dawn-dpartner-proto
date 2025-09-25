Awesome — here’s the same plan, now extended with **developer stories**, **how to run**, and **how to test correctness** for each module. I’ve aimed this at someone onboarding cold who needs to clone, run, verify, and debug quickly.

---

# AI Design Partner — First Demo Technical Project Plan (with Dev Stories & Tests)

## Introduction

This tool takes a **URL** (e.g., Airbnb homepage) and a **user goal** (“create a property detail page”), then:

1. captures and understands the site’s **style**,
2. interprets the **goal** as a page pattern,
3. creates a **layout** that follows basic UX rules,
4. applies the captured **style tokens**,
5. emits **React + Tailwind code**, and
6. renders an **editable vector canvas (SVG)**.

First demo scope: **URL-only**, **desktop-only**, **small component set**, **single-process** app. No screenshots, no breakpoints, no microservices.

---

## Architecture (flow + artifacts)

```
URL
  └── [1] Capture & Normalize
        └── raw/dom.html, raw/computed_styles.json, raw/page.png
  └── [2] Style Token Extractor
        └── design_tokens.json, tailwind.config.js, css_vars.css
  └── [3] DOM Scenegraph Builder
        └── scenegraph.json
  └── [4] Intent Parser (LLM)
        └── intent.json
  └── [5] Layout Synthesizer
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

**Repo suggestion**

```
/app                     # Next.js app (UI + API routes)
/pipeline                # Node/TS pipeline modules
  /capture
  /tokens
  /scenegraph
  /intent
  /layout
  /styling
  /codegen
  /vector
/artifacts/{runId}/...   # saved outputs per run
/scripts                 # CLI helpers
/tests                   # unit + integration tests
```

---

## 1) Web Capture & Normalize

**Goal (plain language):** Load a URL in a headless browser, save the **HTML**, the **computed CSS** for visible nodes, and a **screenshot**. These are the “raw ingredients” for everything else.

### Requirements

* Navigate → wait for network idle → disable animations → snapshot HTML, computed styles (for visible elements), full-page PNG.
* Ignore zero-size or offscreen nodes.

### Outputs

* `raw/dom.html`
* `raw/computed_styles.json`
* `raw/page.png`
* `raw/meta.json` (url, viewport, timestamp, user agent)

### Tech

* Playwright (Chromium), TypeScript.

### Expected Behaviour

* Re-running the same URL yields consistent outputs, aside from dynamic content.

### Developer Story

* **As a developer**, I can run `npm run capture -- https://example.com` and get `artifacts/<runId>/raw/...` files to inspect.

### How to run

```bash
# one-off
npm run capture -- https://airbnb.com

# programmatically
node scripts/capture.js https://airbnb.com --out artifacts/2025-09-25T12-00Z
```

`scripts/capture.js` returns JSON with the `runId` and file paths.

### Quick manual test

* Open `artifacts/<runId>/raw/page.png` — you should see the page.
* Open `.../raw/computed_styles.json` — check there are hundreds/thousands of entries with `bbox` and `styles`.

### Automated tests

`/tests/capture.spec.ts`:

* Mocks a small local HTML page with known CSS.
* Asserts:

  * at least N visible nodes,
  * each node has finite `bbox.w/h > 0`,
  * key CSS props exist (`fontFamily`, `fontSize`, `color`).

### Acceptance criteria

* ≥ 95% of visible DOM nodes have computed styles recorded.
* Capture time P95 < 1.2s for known simple pages.

### Risks

* **Anti-bot / deferred hydration** → add `waitUntil:'networkidle'`, optional `await page.waitForTimeout(300)`.
* **Canvas-heavy sites** → will still have PNG but sparse CSS; acceptable for demo.

---

## 2) Style Token Extractor

**Goal:** Boil the site’s look-and-feel into **design tokens**: palette, fonts, font sizes, spacing, radii, shadows. These tokens will drive Tailwind config and ensure consistent styling.

### Requirements

* Aggregate most frequent text/background colors from `computed_styles.json` (weight by element area).
* Dominant `fontFamily`, discrete buckets of `fontSize`/`lineHeight`.
* Cluster spacing values to ≤ 6 steps, snapped to **8px grid**.
* Cluster radii/shadows to ≤ 3 levels.
* Check WCAG contrast for body text; report failures.

### Outputs

* `design_tokens.json`
* `tailwind.config.js`
* `css_vars.css`
* `style_report.json` (palettes, histograms, contrast pass rate)

### Tech

* TypeScript utilities (`culori` or `colorjs.io`), simple k-means or quantile binning, custom WCAG checker.

### Expected Behaviour

* Simple, compact token set representing the dominant style, not noise.

### Developer Story

* **As a developer**, I can run `npm run tokens -- <runId>` and get the token files generated from prior capture.

### How to run

```bash
npm run tokens -- artifacts/2025-09-25T12-00Z
```

### Quick manual test

* Inspect `tailwind.config.js` → see brand colors + spacing keys aligned with observed values.
* Check `style_report.json` → `contrast.body_text.aa_pass = true`.

### Automated tests

* Feed a canned `computed_styles.json` (fixtures) with known colors/spacings.
* Assert:

  * tokens contain those values (within tolerance),
  * spacing steps ≤ 6,
  * AA body text contrast ≥ 4.5:1.

### Acceptance criteria

* Palette recall: ≥ 3 of top 4 unique CSS colors present in tokens.
* Spacing steps: ≤ 6 after snapping.
* Body text AA pass ≥ 95% of evaluated pairs.

### Risks

* **Image-dominant colors contaminating palette** → we use **computed CSS** only (not screenshots).

---

## 3) DOM Scenegraph Builder

**Goal:** Turn messy DOM into a **clean hierarchy** of meaningful sections (Header, Hero, CardList, Footer), with bounding boxes and reading order.

### Requirements

* Keep visible nodes, drop purely decorative tiny wrappers.
* Collapse wrappers without visual contribution.
* Assign coarse roles by size/position/semantics (e.g., large top section → `Hero`).
* Snap bboxes to 8px grid.

### Outputs

* `scenegraph.json` (tree of `{id,type,role,bbox,children,text?}`)

### Tech

* JSDOM/linkedom parse; geometric heuristics.

### Expected Behaviour

* Tree size ≤ 200 nodes for typical pages; obvious sections are present with reasonable bboxes.

### Developer Story

* **As a developer**, I run `npm run scenegraph -- <runId>` and review a rendered overlay in the debug UI.

### How to run

```bash
npm run scenegraph -- artifacts/2025-09-25T12-00Z
```

### Quick manual test

* Debug UI overlay: see section frames aligned with visible parts of the page.

### Automated tests

* Fixture DOM with known structure; assert:

  * wrappers reduced (≥ 40% reduction),
  * roles include expected (e.g. `Header`,`Footer`),
  * reading order monotonic in Y, then X.

### Acceptance criteria

* Median IoU with bounding rects vs. reference ≥ 0.8 (on fixtures).
* Wrapper reduction ratio ≥ 40%.

### Risks

* **Over-collapse** deletes meaningful containers → include safe-guards (preserve nodes with borders/backgrounds/text).

---

## 4) Intent Parser (LLM)

**Goal:** Convert a natural prompt (e.g., “create a property detail page”) into a **typed intent** from a small ontology.

### Requirements

* Support `page_type ∈ {detail, list, profile}`.
* For each type, propose required sections (for `detail`: gallery, title, price_cta, amenities, reviews).
* Validate result; if invalid, apply sane default.

### Outputs

* `intent.json`

### Tech

* GPT-4o-mini (function calling) with strict schema + server-side validation.

### Expected Behaviour

* Deterministic intent; **no** ad-hoc section names leaking through.

### Developer Story

* **As a developer**, I call `npm run intent -- "<prompt>" --scenegraph artifacts/.../scenegraph.json` and get `intent.json`.

### How to run

```bash
npm run intent -- "create a property detail page" --scenegraph artifacts/2025-09-25T12-00Z/scenegraph.json
```

### Quick manual test

* Inspect `intent.json` → `page_type: "detail"`, expected `required_sections`.

### Automated tests

* Map canonical prompts to golden intents; assert exact match.
* Fuzz: prompts with typos (“detial”) still map to `detail`.

### Acceptance criteria

* ≥ 95% accuracy on small prompt set.
* Latency < 300ms (mocked/local test; live < 1s acceptable).

### Risks

* Ambiguity → fallback defaults; log to `lint_report.json` as “intent_confidence: low”.

---

## 5) Layout Synthesizer (Heuristic Flexbox)

**Goal:** Produce a **wireframe** honoring UX rules and intent: e.g., PDP → gallery left, price/CTA right, trust signals near CTA, details below.

### Requirements

* 12-column desktop grid (container 1200–1280px).
* Pre-baked patterns per page type with parameterized areas (cols).
* Use token gap values (snap to nearest).
* No overlaps; deterministic ordering.

### Outputs

* `layout.json` (stacks, areas, dir=row/col, cols, gaps)

### Tech

* TypeScript layout DSL → Flexbox props; simple placement algorithms.

### Expected Behaviour

* Consistent, legible layout for each page type.

### Developer Story

* **As a developer**, I can run `npm run layout -- <runId>` and see a wireframe in the debug UI.

### How to run

```bash
npm run layout -- artifacts/2025-09-25T12-00Z
```

### Quick manual test

* Visual preview shows gallery + summary side-by-side, CTAs visible above fold.

### Automated tests

* For sample intents, assert:

  * all `required_sections` are present in `layout.json`,
  * constraints satisfied: no area width < 200px, tap targets ≥ 40px height,
  * gaps ∈ token set.

### Acceptance criteria

* Constraint satisfaction rate 100% on fixtures.
* Human rater (internal) score ≥ 4/5 on “sensible layout” rubric.

### Risks

* Content densities vary; include 2 variants per page type, choose by available sections.

---

## 6) Styling & Accessibility Applier

**Goal:** Translate layout → **styled layout** using tokens; enforce accessibility (contrast) and consistency (spacing, radii).

### Requirements

* Assign Tailwind classes for color/typography/spacing.
* Validate contrast for text vs. background; if failing, pick nearest darker/lighter token variant and **record the adjustment**.
* Limit spacing/radii/shadows to token set.

### Outputs

* `styled_layout.json` (node→class list)
* `lint_report.json` (violations, auto-fixes logged)

### Tech

* Class serializers tied to tokens; WCAG checker.

### Expected Behaviour

* All text readable; classes use tokenized values.

### Developer Story

* **As a developer**, I run `npm run style -- <runId>` and the preview updates with the site’s look.

### How to run

```bash
npm run style -- artifacts/2025-09-25T12-00Z
```

### Quick manual test

* Inspect body text against backgrounds; `lint_report.json` shows 0 critical issues.

### Automated tests

* Fixture tokens + layout: assert all emitted classes come from safelisted set; contrast AA for 99% of text nodes.

### Acceptance criteria

* WCAG AA failures = 0 critical; ≤ 1% minor (tiny labels).
* Token coverage ≥ 95% (no ad-hoc pixel values).

### Risks

* Tailwind JIT purging dynamic classes → restrict to deterministic class names, safelist in config.

---

## 7) Component Code Generator (+ AST Post-Pass)

**Goal:** Emit **production-ready React + Tailwind** for the page using a tiny, opinionated component set.

### Requirements

* Template-first components: `Button`, `Text`, `Image`, `Input`, `Navbar`, `Hero`, `Card`, `CardList`, `CTABox`, `KeyValueList`, `Footer`, `Gallery`, `ReviewList`.
* Generate `/pages/GeneratedPage.tsx` that composes them per `styled_layout.json`.
* AST pass to remove unused imports, normalize order, enforce prop types.

### Outputs

* `/components/*.tsx`
* `/pages/GeneratedPage.tsx`

### Tech

* EJS/Handlebars templates; ts-morph or Babel for AST cleanup; ESLint + TypeScript.

### Expected Behaviour

* `npm run build` → lint/ts clean; preview matches styled layout.

### Developer Story

* **As a developer**, I can run `npm run codegen -- <runId>` and then `npm run dev` to view the generated page.

### How to run

```bash
npm run codegen -- artifacts/2025-09-25T12-00Z
npm run dev
```

### Quick manual test

* Open `http://localhost:3000/preview/<runId>`; compare against the pipeline preview.

### Automated tests

* ESLint/TS checks = 0 errors.
* Playwright visual test: render `/preview/<runId>` and diff against reference image (≤ 0.5% pixel delta).
* Ensure no unused imports (AST assertion).

### Acceptance criteria

* Lint clean, build passes, visual diff threshold ≤ 0.5%.
* Bundle contains a single Tailwind file and no duplicate component imports.

### Risks

* Tailwind class safelist again; keep templates deterministic.

---

## 8) Vector Canvas & SVG Export

**Goal:** Provide an **editable design surface** equivalent to the generated page, allowing basic selection/move/resize and export to SVG.

### Requirements

* Render `styled_layout.json` into a Konva stage; enable select/drag/resize; snap-to-8px.
* Export `canvas.svg` and `canvas.json`.

### Outputs

* `canvas.json`, `canvas.svg`

### Tech

* React + Konva; custom serializer to SVG.

### Expected Behaviour

* Interactive, responsive editor with token-aware properties (color, font size, radius).

### Developer Story

* **As a developer**, I open `/canvas/<runId>` and manipulate elements, then click **Export SVG**.

### How to run

* After codegen, navigate to the **Canvas** tab in the debug UI or open the route directly.

### Quick manual test

* Select an element, move it, resize it; export SVG; open SVG in a viewer to confirm fidelity.

### Automated tests

* Serialize → deserialize round-trip equals original within tolerance (positions/radii/shadow).
* SVG contains expected node count and attributes.

### Acceptance criteria

* Round-trip structural parity ≥ 95%.
* Export success rate 100% on fixtures.

### Risks

* Divergence between canvas and React render; for demo, edits are **canvas-only** and don’t regenerate code.

---

## 9) Orchestration & Debug UI

**Goal:** Provide a **single button/endpoint** to run the whole pipeline and a **debug UI** to inspect each step.

### Requirements

* `/api/generate` accepts `{ url, prompt }` and returns a `runId`.
* Saves artifacts to `artifacts/<runId>/...`.
* Debug UI with tabs: **Capture → Tokens → Scenegraph → Intent → Layout → Styled → Code → Canvas → Metrics**.
* Timings per stage, error panel, artifact download.

### Outputs

* `run_logs.json`, `timings.json`

### Tech

* Next.js API routes + pages; local filesystem; simple context store.

### Expected Behaviour

* End-to-end generation in < 3s on known sites; each tab loads corresponding artifacts.

### Developer Story

* **As a developer**, I can enter a URL + prompt in the UI, click **Generate**, and step through each artifact visually.

### How to run

```bash
npm run dev
# UI at http://localhost:3000
```

### Quick manual test

* Use a known URL (static test page) + “create a property detail page”; validate each tab has content; preview and canvas look coherent.

### Automated tests

* End-to-end integration test with a local fixture site (`/tests/fixtures/site` served on a port):

  * Call `/api/generate`.
  * Assert all expected artifact files exist and are non-empty.
  * Assert timings P95 targets (capture < 1.2s, total < 3s).

### Acceptance criteria

* End-to-end success rate ≥ 95% on fixtures.
* All artifacts present; no stage crashes; debug UI loads.

### Risks

* Long-tail website quirks; for demo use whitelisted URLs.

---

## Example CLI (developer ergonomics)

```bash
# 1) End-to-end in one go
npm run generate -- --url https://airbnb.com --prompt "create a property detail page"

# 2) Step-by-step (for debugging)
npm run capture -- https://airbnb.com
npm run tokens -- artifacts/<runId>
npm run scenegraph -- artifacts/<runId>
npm run intent -- "create a property detail page" --scenegraph artifacts/<runId>/scenegraph.json
npm run layout -- artifacts/<runId>
npm run style -- artifacts/<runId>
npm run codegen -- artifacts/<runId>
# launch UI to view canvas + preview
npm run dev
```

---

## Sample “golden” tests (summarized)

* **Capture**: visible node count ≥ X; computed styles coverage ≥ 95%.
* **Tokens**: palette recall (≥ 3/4), spacing steps ≤ 6, body text AA pass.
* **Scenegraph**: wrapper reduction ≥ 40%; IoU ≥ 0.8 (fixtures).
* **Intent**: ontology accuracy ≥ 95% on canonical prompts.
* **Layout**: all required sections placed; min sizes respected; gaps ∈ tokens.
* **Styling**: token coverage ≥ 95%; zero critical AA failures.
* **Codegen**: ESLint/TS = 0; Playwright visual diff ≤ 0.5%.
* **Vector**: round-trip ≥ 95% structural parity; SVG export valid.
* **E2E**: artifacts exist; timings within targets; UI navigable.

---

## Risks & Mitigations (global)

* **Tailwind JIT purging dynamic classes** → restrict to deterministic classes; safelist in config.
* **Ambiguous prompts** → tiny ontology + sensible defaults; log low-confidence.
* **Perf spikes** (heavy sites) → cap node processing; sample large DOMs.
* **Design drift** post-edit in canvas → edits are canvas-only for demo; clearly labeled.

---

## Done Criteria (for the demo)

* A user can paste a URL and a goal, click **Generate**, and within ~3 seconds see:

  * Tokens (colors/fonts/spacing),
  * Scenegraph visualization,
  * Wireframe → styled layout preview,
  * Generated React + Tailwind code (compiles & runs),
  * Editable vector canvas with working **Export SVG**.
* All relevant tests pass locally (`npm test`), and the debug UI explains each stage.
