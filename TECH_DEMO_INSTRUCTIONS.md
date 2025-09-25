# AI Design Partner - Tech Demo Instructions

## Overview
This demo transforms any website into crafted React + Tailwind components through an 8-stage AI pipeline. The system captures web content, extracts design tokens, builds semantic structure, and generates production-ready code with visual fidelity.

## Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Start the Development Server
```bash
npm run dev
```
The demo will be available at: **http://localhost:3000**

### 3. Start the Fixture Site (Optional)
For testing with a known target:
```bash
npm run fixture
```
Fixture site available at: **http://localhost:5050**

## Using the Demo

### Web Interface
1. Open http://localhost:3000
2. Enter a target URL (try: http://localhost:5050 for the fixture site)
3. Enter a design prompt (e.g., "property detail page", "product showcase")
4. Click "Generate Design"
5. Watch real-time pipeline execution with 8 stages:
   - **Web Capture**: Playwright extracts HTML, styles, screenshots
   - **Design Tokens**: Color analysis, typography, spacing extraction
   - **DOM Scenegraph**: Semantic structure with role detection
   - **Intent Parsing**: LLM interprets your prompt into section requirements
   - **Layout Synthesis**: Flexbox heuristics with 12-column grid
   - **Styling Engine**: Design token application with Tailwind classes
   - **Code Generation**: React/TypeScript component creation
   - **Vector Canvas**: SVG mockup generation

### Debug UI Tabs
- **Overview**: Pipeline status, timing, step progress
- **Tokens**: Color palettes, typography scales, spacing systems
- **Layout**: Grid configuration, section arrangement
- **Components**: Generated React code with TypeScript
- **Canvas**: Visual SVG mockup of the generated design

## API Usage

### Generate Design via API
```bash
curl -X POST http://localhost:3000/api/generate \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://example.com",
    "prompt": "create a product detail page",
    "enableDebug": true
  }'
```

### API Endpoints
- `GET /api/generate` - API documentation and pipeline info
- `POST /api/generate` - Execute full design generation pipeline

## CLI Usage

Each pipeline module can be run independently:

### 1. Web Capture
```bash
npx tsx pipeline/capture/cli.ts https://example.com
```
Outputs: HTML, computed styles, full-page screenshot

### 2. Design Token Extraction
```bash
npx tsx pipeline/tokens/cli.ts <runId>
```
Outputs: Color palettes, typography scales, Tailwind config

### 3. DOM Scenegraph
```bash
npx tsx pipeline/scenegraph/cli.ts <runId>
```
Outputs: Semantic node hierarchy with roles and styling

### 4. Intent Parsing
```bash
npx tsx pipeline/intent/cli.ts "product detail page" <runId>
```
Outputs: Interpreted sections and page type with confidence

### 5. Layout Synthesis
```bash
npx tsx pipeline/layout/cli.ts <runId>
```
Outputs: Flexbox layout with 12-column grid constraints

### 6. Styling Engine
```bash
npx tsx pipeline/styling/cli.ts <runId>
```
Outputs: CSS with design tokens and Tailwind classes

### 7. Code Generation
```bash
npx tsx pipeline/codegen/cli.ts <runId>
```
Outputs: React/TypeScript components with proper typing

### 8. Vector Canvas
```bash
npx tsx pipeline/canvas/cli.ts <runId>
```
Outputs: Interactive SVG mockup with visual elements

## Testing

### Run All Tests
```bash
npm run test:unit
```

### Test Individual Modules
```bash
npm test -- --testPathPattern=capture
npm test -- --testPathPattern=tokens
npm test -- --testPathPattern=scenegraph
npm test -- --testPathPattern=intent
npm test -- --testPathPattern=layout
npm test -- --testPathPattern=styling
npm test -- --testPathPattern=codegen
npm test -- --testPathPattern=canvas
npm test -- --testPathPattern=orchestration
```

## Development

### Linting and Type Checking
```bash
npm run lint
npm run type-check
```

### Build for Production
```bash
npm run build
```

## Pipeline Artifacts

All generated artifacts are stored in `/artifacts/<runId>/`:
- `raw/` - HTML, styles, screenshots from capture
- `tokens/` - Design token JSON and Tailwind config
- `scenegraph/` - Semantic node structure
- `intent/` - Parsed sections and requirements
- `layout/` - Grid configuration and constraints
- `styling/` - CSS and component styling
- `codegen/` - React/TypeScript component files
- `canvas/` - SVG mockup and visual elements

## Example Workflows

### 1. Analyze a Landing Page
```bash
# Capture the site
npx tsx pipeline/capture/cli.ts https://company.com

# Extract design tokens
npx tsx pipeline/tokens/cli.ts <runId-from-capture>

# Build semantic structure
npx tsx pipeline/scenegraph/cli.ts <runId>

# Interpret as landing page
npx tsx pipeline/intent/cli.ts "landing page with hero and features" <runId>
```

### 2. Generate E-commerce Product Page
```bash
# Use the web interface
# URL: https://shopify-store.com/product/example
# Prompt: "product detail page with gallery and purchase options"
```

### 3. Recreate a Portfolio Site
```bash
# Full pipeline via API
curl -X POST http://localhost:3000/api/generate \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://designer-portfolio.com",
    "prompt": "portfolio homepage with project showcase"
  }'
```

## Key Technologies

- **Next.js 14**: App Router with TypeScript
- **Playwright**: Headless browser automation
- **Culori**: Advanced color analysis and WCAG compliance
- **linkedom**: Server-side DOM parsing
- **OpenAI/Anthropic**: LLM integration for intent parsing
- **Tailwind CSS**: Utility-first styling framework
- **Konva**: 2D canvas library for SVG generation
- **Jest**: Comprehensive test suite

## Troubleshooting

### Common Issues

**Pipeline fails on capture**: Ensure target URL is accessible and responds with valid HTML

**Design tokens extraction empty**: Site may use minimal styling or external stylesheets

**Intent parsing low confidence**: Try more specific prompts like "e-commerce product page" vs "make a website"

**Layout constraints violated**: Complex layouts may need manual section arrangement

**Generated code has TypeScript errors**: Check design token application and component structure

### Debug Mode
Enable detailed logging by setting `enableDebug: true` in API calls or using the web interface debug toggle.

## Architecture

The system follows a modular pipeline architecture where each stage:
1. Receives a `runId` to locate previous artifacts
2. Processes data from the previous stage
3. Outputs structured results to the artifacts directory
4. Provides CLI access for individual testing
5. Integrates seamlessly with the orchestration layer

This enables both full pipeline execution and granular debugging of individual components.