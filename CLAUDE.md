# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is an AI Design Partner demo that generates React + Tailwind components by analyzing existing website styles. The system takes a URL and prompt (e.g., "create a property detail page") and produces working code plus an editable SVG canvas.

**Demo Scope**: URL-only, desktop-only, small component set, single-process app. No screenshots, no breakpoints, no microservices.

## Architecture

The project uses a 9-stage pipeline architecture:

1. **Capture & Normalize** - Playwright (Chromium) browser automation to extract HTML, computed CSS for visible elements, and full-page PNG
2. **Style Token Extractor** - Distills design tokens using culori/colorjs.io with k-means clustering, WCAG contrast checking
3. **DOM Scenegraph Builder** - JSDOM/linkedom parse with geometric heuristics to create clean section hierarchy
4. **Intent Parser** - GPT-4o-mini function calling with strict schema validation (page_type: detail|list|profile)
5. **Layout Synthesizer** - TypeScript layout DSL with Flexbox heuristics, 12-column desktop grid (1200-1280px)
6. **Styling & Accessibility Applier** - Tailwind class generator with WCAG AA contrast enforcement
7. **Component Code Generator** - EJS/Handlebars templates with ts-morph/Babel AST cleanup
8. **Vector Canvas & SVG Export** - React + Konva interactive canvas with custom SVG serializer
9. **Orchestration & Debug UI** - Next.js API routes with tab-based artifact inspection

All pipeline outputs are stored in `artifacts/<runId>/...` for debugging and inspection.

## Directory Structure (Planned)

```
/app                     # Next.js app (UI + API routes + debug UI)
/pipeline                # Pipeline modules (Node/TS)
  /capture, /tokens, /scenegraph, /intent, /layout, /styling, /codegen, /vector
/artifacts/{runId}/...   # All pipeline outputs per run
/tests                   # Unit & integration tests
/scripts                 # CLI wrappers to run steps individually
/fixtures                # Offline demo site for tests & no-internet demos
```

## Development Commands

### Setup
```bash
npm install
# Configure .env.local with required variables (see Environment Configuration below)
npm run dev  # Start at http://localhost:3000
```

### Pipeline Execution
```bash
# End-to-end generation
npm run generate -- --url https://airbnb.com --prompt "create a property detail page"

# Step-by-step debugging
npm run capture -- https://airbnb.com
npm run tokens -- artifacts/<runId>
npm run scenegraph -- artifacts/<runId>
npm run intent -- "create a property detail page" --scenegraph artifacts/<runId>/scenegraph.json
npm run layout -- artifacts/<runId>
npm run style -- artifacts/<runId>
npm run codegen -- artifacts/<runId>
```

### Testing
```bash
npm test                 # All unit & integration tests
npm run test:unit
npm run test:integration
npm run test:e2e         # End-to-end against fixtures
```

### Offline Demo (No Internet Required)
```bash
npm run fixtures:serve  # Serves fixture site at http://localhost:5050
npm run generate -- --url http://localhost:5050 --prompt "create a property detail page"
```

## Environment Configuration

Create `.env.local` in repository root:

```bash
# LLM Provider (required - choose one)
OPENAI_API_KEY=sk-...              # option 1
ANTHROPIC_API_KEY=sk-ant-...       # option 2
INTENT_PROVIDER=openai             # openai | anthropic

# Server
PORT=3000

# Tailwind safelist (prevent JIT purging of dynamic classes)
TAILWIND_SAFELIST=text-xl,text-2xl,text-3xl,bg-brand-500,bg-brand-600,rounded-r0,shadow-s0,shadow-s1,shadow-s2
```

## Key Technical Details

### Browser Automation
- Playwright with Chromium
- Disables animations/transitions for consistent capture
- Uses `waitUntil:'networkidle'` for deferred hydration
- Captures only visible nodes (bbox.w/h > 0)

## Specialized Subagents

When working on this codebase, invoke specialized subagents for complex tasks:

- **ui-layout-planner**: For UI layout planning, grid systems, and responsive design for component generation
- **react-tailwind-builder**: For building React components with Tailwind CSS for the AI Design Partner's generated component system
- **playwright-automation-expert**: For Playwright browser automation, web scraping, and DOM extraction for design capture
- **nextjs-developer**: For Next.js 14 app router architecture and React components for the AI Design Partner demo
- **testing-specialist**: For testing strategy focusing on unit tests, integration tests, and end-to-end validation
- **design-systems-expert**: For design token extraction, color science, and systematic design language creation
- **ai-llm-engineer**: For LLM integration, prompt engineering, and AI-powered intent parsing for design generation

Use these agents for non-trivial tasks in their respective domains to ensure expert-level implementation.

## Development Guidelines

### Code Quality & Style
- **No hardcoded data, mocks, or fallbacks** - use real pipeline outputs and dynamic data; fail fast with clear errors if data is missing
- **Keep code concise** - prefer minimal, readable implementations
- **Prefer removal over addition** when refactoring - simplify rather than extend
- **TypeScript must be lint-clean** - fix all ESLint errors, no workarounds or ignores
- **No linting suppressions** - address the root cause rather than suppressing warnings
- **Test changes as you go** - code should work when completed
- **Use the most simple implementation possible**
- **Follow DRY principles** - don't repeat yourself

### MVP Philosophy
This is an **MVP tech demo** with a core focus on **crafted design output quality**:

**Design Quality (Non-Negotiable)**:
- **Visual output must be aesthetically pleasing** - generated designs should look professional and polished
- **On-brand consistency** - captured style tokens must be faithfully applied to maintain brand coherence
- **Crafted appearance** - output should demonstrate sophisticated design understanding, not just functional layouts

**Technical Implementation**:
- **Functional over perfect** - basic functionality that works reliably
- **Simple over scalable** - direct implementations over complex architectures
- **Demo-ready over production-ready** - optimize for showcasing design generation capabilities
- **Deterministic behavior** - consistent results for reliable demos

**Success Criteria**: Code running is baseline; the true measure is whether generated designs look like they were created by a skilled designer who understood the source brand.