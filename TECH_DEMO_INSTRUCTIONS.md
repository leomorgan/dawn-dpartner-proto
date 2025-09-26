# AI Design Partner - Tech Demo Instructions

## Overview
This demo transforms any website into crafted React + Tailwind components through an 8-stage AI pipeline. The system captures web content, extracts design tokens, builds semantic structure, and generates production-ready code with visual fidelity.

## Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Environment Setup
Create `.env.local` in the project root:
```bash
# LLM Provider (required for intelligent content generation)
OPENAI_API_KEY=sk-...              # Get from OpenAI dashboard
ANTHROPIC_API_KEY=sk-ant-...       # Optional alternative
INTENT_PROVIDER=openai             # mock | openai | anthropic

# Server configuration (auto-detects available port)
PORT=3000

# Tailwind safelist (prevents purging of dynamic classes)
TAILWIND_SAFELIST=text-xl,text-2xl,text-3xl,bg-brand-500,bg-brand-600
```

**Note**: For testing without API costs, use `INTENT_PROVIDER=mock`

### 3. Start the Development Server
```bash
npm run dev
```
The demo will be available at: **http://localhost:3001**

### 4. Start the Fixture Site (Optional)
For testing with a known target:
```bash
npm run fixtures:serve
```
Fixture site available at: **http://localhost:5050**

## Using the Demo

### Web Interface
1. Open http://localhost:3001
2. Enter a target URL (try: http://localhost:5050 for the fixture site)
3. Enter a design prompt (e.g., "property detail page", "product showcase")
4. Click "Generate Design"
5. Watch real-time pipeline execution with 8 stages:
   - **Web Capture**: Playwright extracts HTML, styles, screenshots
   - **Design Tokens**: Color analysis, typography, spacing extraction
   - **DOM Scenegraph**: Semantic structure with role detection
   - **Intent Parsing**: LLM interprets your prompt into section requirements
   - **Layout Synthesis**: Flexbox heuristics with 24-column grid
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
curl -X POST http://localhost:3001/api/generate \
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

### Full Pipeline Execution
```bash
npm run generate -- --url https://example.com --prompt "create a property detail page"
```

Each pipeline module can also be run independently:

### 1. Web Capture
```bash
npm run capture -- https://example.com
```
Outputs: HTML, computed styles, full-page screenshot

### 2. Design Token Extraction
```bash
npm run tokens -- <runId>
```
Outputs: Color palettes, typography scales, Tailwind config

### 3. DOM Scenegraph
```bash
npm run scenegraph -- <runId>
```
Outputs: Semantic node hierarchy with roles and styling

### 4. Intent Parsing
```bash
npm run intent -- "product detail page" <runId>
```
Outputs: Interpreted sections and page type with confidence

### 5. Layout Synthesis
```bash
npm run layout -- <runId>
```
Outputs: Flexbox layout with 24-column grid constraints

### 6. Styling Engine
```bash
npm run style -- <runId>
```
Outputs: CSS with design tokens and Tailwind classes

### 7. Code Generation
```bash
npm run codegen -- <runId>
```
Outputs: React/TypeScript components with proper typing

### 8. Vector Canvas
```bash
npm run canvas -- <runId>
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
- `design_tokens.json` - Extracted color palettes, typography, spacing
- `tailwind.config.js` - Generated Tailwind CSS configuration
- `scenegraph.json` - Semantic node hierarchy with roles
- `adaptive_intent.json` - Parsed sections and page type
- `adaptive_layout.json` - Grid configuration with 24-column constraints
- `styled_components.json` - CSS styling specifications
- `styles.css` - Generated CSS with design tokens
- `css_vars.css` - CSS custom properties
- `components/` - React/TypeScript component files
- `style_report.json` - Styling analysis and metrics

## Example Workflows

### 1. Analyze a Landing Page
```bash
# Capture the site
npm run capture -- https://company.com

# Extract design tokens
npm run tokens -- <runId-from-capture>

# Build semantic structure
npm run scenegraph -- <runId>

# Interpret as landing page
npm run intent -- "landing page with hero and features" <runId>
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
curl -X POST http://localhost:3001/api/generate \
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

**Port 3000 in use**: The dev server will automatically use port 3001 if 3000 is busy. Use http://localhost:3001 instead.

**Pipeline fails on capture**: Ensure target URL is accessible and responds with valid HTML

**Design tokens extraction empty**: Site may use minimal styling or external stylesheets

**Intent parsing low confidence**: Try more specific prompts like "e-commerce product page" vs "make a website"

**Layout constraints violated**: Complex layouts may need manual section arrangement

**Generated code has TypeScript errors**: Check design token application and component structure

**Missing OpenAI API key**: Set `OPENAI_API_KEY` in `.env.local` or use `INTENT_PROVIDER=mock` for testing

**Canvas module not found errors**: These are warnings and don't affect pipeline functionality

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