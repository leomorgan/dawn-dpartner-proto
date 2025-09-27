# Layout CTA Plan: Simplified Single-Card Approach

## Executive Summary

This document outlines a **simplified CTA-focused pipeline** that bypasses the complexity of the full 8-stage AI Design Partner pipeline. Instead of generating complete layouts with multiple components, this approach:

1. **Captures design tokens** from a source URL (using existing capture + tokens modules)
2. **Generates multiple template variants** with direct token application
3. **Applies source styling** with proper contrast validation and accessibility compliance
4. **Provides immediate preview** with performance optimization and caching

**Goal**: Demonstrate design token extraction and application in multiple template variants that showcase brand-accurate styling with clean, focused implementation.

**Key Improvements**:
- ✅ **Multiple Templates**: 3 template variants for different use cases
- ✅ **Performance**: Optimized execution and caching
- ✅ **Accessibility**: WCAG AA compliance with automated contrast checking
- ✅ **Clean Implementation**: Focused on core functionality without over-engineering

---

## Core Architecture

### Enhanced Pipeline Flow

```
URL Input → Capture → Tokens → Template Selection → Style Application → Output Generation → Preview
    ↓         ↓        ↓            ↓                  ↓                ↓               ↓
 user.com  HTML/CSS  Design   [Card|Banner|Modal]  Direct Token     React+CSS      Live Demo
           capture   tokens     + Variant          Application      + Variables    + Performance
                              Selection           + Validation     + Assets       + Caching
```

**Key Differences from Main Pipeline:**
- ✅ **Keep**: `capture` and `tokens` modules (proven, working)
- ❌ **Skip**: `scenegraph`, `intent`, `layout`, `canvas` modules
- ✅ **Enhanced**: Smart template selection with 3 variants
- ✅ **Simplified**: Direct token application without complexity
- ✅ **Optimized**: Fast execution with built-in performance

### API Route Structure

**Main Pipeline**: `/api/generate` (full 8-stage)
**CTA Pipeline**: `/api/generate-cta` (enhanced 4-stage)
**Template Selection**: `/api/cta-templates` (template metadata)

---

## Template Structure

### Multiple Template Variants

The approach provides **3 distinct template variants** to showcase different CTA patterns and design token applications:

#### **Template 1: Product Card**
```jsx
<div className="cta-template-card">
  <header className="template-header">
    <h1>Premium Solution</h1>
    <p>Transform your business with our industry-leading platform</p>
  </header>

  <section className="template-card">
    <div className="card-content">
      <h2>Professional Plan</h2>
      <p>Everything you need to scale your operations and drive growth.</p>
      <ul className="feature-list">
        <li>✓ Advanced Analytics</li>
        <li>✓ 24/7 Support</li>
        <li>✓ API Access</li>
      </ul>
      <div className="pricing">
        <span className="price">$99</span>
        <span className="period">/month</span>
      </div>
    </div>
  </section>

  <div className="template-actions">
    <button className="cta-primary">Start Free Trial</button>
    <button className="cta-secondary">View Features</button>
  </div>
</div>
```

#### **Template 2: Banner CTA**
```jsx
<div className="cta-template-banner">
  <div className="banner-content">
    <div className="banner-text">
      <h2>Ready to get started?</h2>
      <p>Join thousands of companies already using our platform</p>
    </div>
    <div className="banner-actions">
      <button className="cta-primary">Get Started</button>
      <button className="cta-secondary">Learn More</button>
    </div>
  </div>
</div>
```

#### **Template 3: Modal-Style CTA**
```jsx
<div className="cta-template-modal">
  <div className="modal-backdrop">
    <div className="modal-content">
      <header className="modal-header">
        <h2>Special Offer</h2>
        <p>Limited time opportunity</p>
      </header>

      <div className="modal-body">
        <p>Get exclusive access to premium features at a discounted rate.</p>
        <div className="offer-details">
          <span className="discount">30% OFF</span>
          <span className="original-price">$99</span>
          <span className="sale-price">$69</span>
        </div>
      </div>

      <div className="modal-actions">
        <button className="cta-primary">Claim Offer</button>
        <button className="cta-secondary">Maybe Later</button>
      </div>
    </div>
  </div>
</div>
```

### Template Selection Strategy

**Smart Template Selection:**
- **Card Template**: Default choice for most websites (versatile, professional)
- **Banner Template**: For sites with horizontal layouts or minimal designs
- **Modal Template**: For sites with bold, attention-grabbing elements

**Selection Criteria:**
- Dominant layout patterns from captured design tokens
- Color palette complexity (minimal → banner, rich → modal)
- Typography scale (conservative → card, dramatic → modal)

### Content Strategy

**Fixed, Professional Content:**
- **Header**: Business-appropriate headlines and taglines
- **Features**: Universal benefit statements (support, analytics, access)
- **CTAs**: Clear, action-oriented language ("Start Trial", "Get Started")
- **Pricing**: Simple, realistic pricing displays

---

## Design Token Application Strategy

### Token Extraction (Reuse Existing)

Leverage the existing `pipeline/tokens/index.ts` module which already extracts:

```typescript
interface DesignTokens {
  colors: {
    primary: string[];           // Brand colors
    neutral: string[];           // Supporting colors
    semantic: {
      text: string;              // Body text
      background: string;        // Page background
      cta: string;              // Call-to-action color
      accent: string;           // Highlight color
      muted: string;            // Secondary text
    };
    contextual: {
      buttons: string[];        // Button-specific colors
      links: string[];          // Link colors
      backgrounds: string[];    // Background variations
    };
  };
  typography: {
    fontFamilies: string[];
    fontSizes: number[];
    fontWeights: number[];
    lineHeights: number[];
  };
  spacing: number[];            // 8px grid spacing
  borderRadius: string[];       // Corner radii
  boxShadow: string[];         // Elevation shadows
}
```

### Template Styling Mapping

**Color Application:**
```typescript
const templateColorMapping = {
  // Header styling
  headerBackground: tokens.colors.semantic.background,
  headerText: tokens.colors.semantic.text,
  headerTagline: tokens.colors.semantic.muted,

  // Card styling
  cardBackground: tokens.colors.contextual.backgrounds[0] || '#ffffff',
  cardText: tokens.colors.semantic.text,
  cardBorder: tokens.colors.neutral[0],
  cardShadow: tokens.boxShadow[0],

  // CTA styling
  primaryCTA: tokens.colors.semantic.cta,
  primaryCTAText: findContrastingColor(tokens.colors.semantic.cta),
  secondaryCTA: tokens.colors.contextual.buttons[1] || tokens.colors.neutral[0],
  secondaryCTAText: tokens.colors.semantic.text,

  // Accent elements
  checkmarks: tokens.colors.semantic.accent,
  priceHighlight: tokens.colors.semantic.cta,
};
```

**Typography Application:**
```typescript
const templateTypographyMapping = {
  headerFont: tokens.typography.fontFamilies[0],
  headerSize: tokens.typography.fontSizes.find(s => s >= 24) || 24,
  headerWeight: tokens.typography.fontWeights.find(w => w >= 600) || 600,

  cardTitleSize: tokens.typography.fontSizes.find(s => s >= 18) || 20,
  cardTitleWeight: tokens.typography.fontWeights.find(w => w >= 500) || 500,

  bodySize: tokens.typography.fontSizes.find(s => s >= 14 && s <= 16) || 16,
  bodyWeight: tokens.typography.fontWeights[0] || 400,

  ctaSize: tokens.typography.fontSizes.find(s => s >= 16) || 16,
  ctaWeight: tokens.typography.fontWeights.find(w => w >= 500) || 500,
};
```

**Spacing Application:**
```typescript
const templateSpacingMapping = {
  headerPadding: tokens.spacing.find(s => s >= 24) || 32,
  cardPadding: tokens.spacing.find(s => s >= 16 && s <= 32) || 24,
  cardMargin: tokens.spacing.find(s => s >= 16) || 24,
  ctaGap: tokens.spacing.find(s => s >= 8 && s <= 16) || 12,
  elementGap: tokens.spacing.find(s => s >= 8) || 16,
};
```

### Contrast Validation

**Automated Contrast Checking:**
```typescript
function ensureContrastCompliance(foreground: string, background: string, tokens: DesignTokens): string {
  const contrast = calculateContrast(foreground, background);

  if (contrast >= 4.5) return foreground;

  // Try alternative colors from extracted palette
  const alternatives = [
    tokens.colors.semantic.text,
    tokens.colors.primary[0],
    tokens.colors.neutral[0],
    // Use extracted colors only - no hardcoded fallbacks
  ];

  for (const alt of alternatives) {
    if (calculateContrast(alt, background) >= 4.5) {
      return alt;
    }
  }

  return foreground; // Return best available from palette
}
```

---

## Implementation Plan

### Phase 1: API Route Creation

**New Route**: `/app/api/generate-cta/route.ts`

```typescript
export async function POST(request: NextRequest) {
  const { url, template = 'card' } = await request.json();
  const runId = generateRunId(url);

  try {
    // 1. Capture (reuse existing)
    const captureResult = await capture(url, undefined, runId);

    // 2. Extract tokens (reuse existing)
    const tokensResult = await extractTokens(runId);

    // 3. Select and apply template
    const selectedTemplate = selectTemplate(template, tokensResult.tokens);
    const styledTemplate = await applyTokensToTemplate(
      selectedTemplate,
      tokensResult.tokens,
      runId
    );

    return NextResponse.json({
      success: true,
      result: {
        runId,
        template: styledTemplate,
        tokens: tokensResult.tokens,
        selectedTemplate: selectedTemplate.type,
        preview: `/preview-cta/${runId}`
      }
    });

  } catch (error) {
    console.error('CTA generation failed:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Generation failed'
    }, { status: 500 });
  }
}
```

### Phase 2: Template Generator

**New Module**: `/pipeline/cta-template/index.ts`

```typescript
export interface TemplateVariant {
  type: 'card' | 'banner' | 'modal';
  structure: TemplateStructure;
  styleMapping: StyleMapping;
}

export async function applyTokensToTemplate(
  template: TemplateVariant,
  tokens: DesignTokens,
  runId: string
): Promise<TemplateResult> {

  // Select optimal colors with contrast validation
  const safeColors = validateAndSelectColors(tokens);

  // Generate template-specific styling
  const appliedStyles = applyTemplateStyles(template, safeColors, tokens);

  // Generate React component code
  const componentCode = generateTemplateComponent(template, appliedStyles);

  // Generate CSS variables from tokens
  const cssVariables = generateTemplateCSSVars(tokens, safeColors);

  // Save artifacts
  await saveTemplateArtifacts(runId, {
    component: componentCode,
    styles: appliedStyles,
    css: cssVariables,
    template: template.type
  });

  return {
    runId,
    componentCode,
    appliedStyles,
    cssVariables,
    templateType: template.type
  };
}

function selectTemplate(requested: string, tokens: DesignTokens): TemplateVariant {
  // Intelligent template selection based on tokens
  if (requested === 'auto') {
    if (tokens.colors.primary.length >= 4) return modalTemplate;
    if (tokens.spacing.every(s => s <= 16)) return bannerTemplate;
    return cardTemplate; // Default
  }

  const templates = { card: cardTemplate, banner: bannerTemplate, modal: modalTemplate };
  return templates[requested as keyof typeof templates] || cardTemplate;
}
```

### Phase 3: Template Component Generation

**Generated Component Structure:**

```typescript
// Generated: components/CTATemplate.tsx
export const CTATemplate: React.FC = () => {
  return (
    <div
      className="cta-template"
      style={{
        backgroundColor: 'var(--template-bg)',
        fontFamily: 'var(--template-font)',
        color: 'var(--template-text)'
      }}
    >
      <header
        className="template-header"
        style={{
          padding: 'var(--header-padding)',
          backgroundColor: 'var(--header-bg)',
          color: 'var(--header-text)'
        }}
      >
        <h1 style={{
          fontSize: 'var(--header-size)',
          fontWeight: 'var(--header-weight)',
          margin: '0 0 var(--element-gap) 0'
        }}>
          Acme Company
        </h1>
        <p style={{
          fontSize: 'var(--body-size)',
          color: 'var(--header-tagline)',
          margin: '0'
        }}>
          Your trusted partner for quality solutions
        </p>
      </header>

      <section
        className="template-card"
        style={{
          backgroundColor: 'var(--card-bg)',
          border: '1px solid var(--card-border)',
          borderRadius: 'var(--card-radius)',
          boxShadow: 'var(--card-shadow)',
          padding: 'var(--card-padding)',
          margin: 'var(--card-margin)'
        }}
      >
        {/* Card content with applied styling */}
      </section>

      <div
        className="template-actions"
        style={{
          gap: 'var(--cta-gap)',
          padding: 'var(--card-padding)'
        }}
      >
        <button
          className="cta-primary"
          style={{
            backgroundColor: 'var(--primary-cta)',
            color: 'var(--primary-cta-text)',
            padding: 'var(--cta-padding)',
            fontSize: 'var(--cta-size)',
            fontWeight: 'var(--cta-weight)',
            borderRadius: 'var(--cta-radius)',
            border: 'none'
          }}
        >
          Get Started
        </button>
        <button
          className="cta-secondary"
          style={{
            backgroundColor: 'var(--secondary-cta)',
            color: 'var(--secondary-cta-text)',
            padding: 'var(--cta-padding)',
            fontSize: 'var(--cta-size)',
            fontWeight: 'var(--cta-weight)',
            borderRadius: 'var(--cta-radius)',
            border: '1px solid var(--card-border)'
          }}
        >
          Learn More
        </button>
      </div>
    </div>
  );
};
```

### Phase 4: Preview Integration

**New Preview Route**: `/app/preview-cta/[runId]/page.tsx`

```typescript
export default function CTAPreview({ params }: { params: { runId: string } }) {
  const [templateData, setTemplateData] = useState(null);

  useEffect(() => {
    // Load template artifacts
    fetch(`/api/cta-artifacts/${params.runId}`)
      .then(res => res.json())
      .then(setTemplateData);
  }, [params.runId]);

  if (!templateData) return <div>Loading...</div>;

  return (
    <div className="preview-container">
      <style dangerouslySetInnerHTML={{ __html: templateData.css }} />
      <CTATemplate />
    </div>
  );
}
```

### Phase 5: UI Integration

**Enhanced Main Page**: Add template mode and selection

```typescript
// app/page.tsx additions
const [mode, setMode] = useState<'full' | 'cta'>('full');
const [selectedTemplate, setSelectedTemplate] = useState<'card' | 'banner' | 'modal' | 'auto'>('auto');

const handleGenerate = async (url: string, prompt: string) => {
  const endpoint = mode === 'cta' ? '/api/generate-cta' : '/api/generate';

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      url: url.trim(),
      prompt: mode === 'full' ? prompt.trim() : undefined,
      template: mode === 'cta' ? selectedTemplate : undefined
    }),
  });

  // Handle response...
};

// Enhanced UI:
<div className="generation-controls">
  <div className="mode-selector">
    <button
      onClick={() => setMode('full')}
      className={mode === 'full' ? 'active' : ''}
    >
      Full Pipeline
    </button>
    <button
      onClick={() => setMode('cta')}
      className={mode === 'cta' ? 'active' : ''}
    >
      CTA Templates
    </button>
  </div>

  {mode === 'cta' && (
    <div className="template-selector">
      <label>Template Style:</label>
      <select
        value={selectedTemplate}
        onChange={(e) => setSelectedTemplate(e.target.value as any)}
      >
        <option value="auto">Auto-Select</option>
        <option value="card">Product Card</option>
        <option value="banner">Banner CTA</option>
        <option value="modal">Modal Offer</option>
      </select>
    </div>
  )}
</div>
```

---

## Technical Benefits

### Performance Advantages
- **~85% faster execution**: Skip 5 of 8 pipeline stages
- **No LLM dependencies**: Fixed content eliminates API costs and variability
- **Predictable results**: Template-based approach ensures consistent output
- **Immediate preview**: Direct component rendering with optimized styling
- **Multiple variants**: 3 templates showcase different design token applications

### Development Benefits
- **Isolated testing**: Test design token extraction independently from layout complexity
- **Faster iteration**: Quick feedback loop for styling and token mapping improvements
- **Clear demonstration**: Focused showcase of brand style transfer capabilities
- **Simpler debugging**: Minimal surface area with clear separation of concerns
- **Template reusability**: Variant system allows easy expansion

### Business Benefits
- **Lower operational costs**: No ongoing API usage for content generation
- **Reliable demos**: Consistent results without LLM variability or failures
- **Focused value proposition**: Clear demonstration of design token extraction value
- **Professional output**: Business-ready templates suitable for client presentations
- **Versatile showcase**: Multiple templates demonstrate broad applicability

---

## Quality Assurance

### Design Token Coverage
- **Color harmony**: Verify extracted palette creates cohesive appearance
- **Typography hierarchy**: Ensure readable text scaling and weights
- **Spacing consistency**: Maintain visual rhythm with extracted spacing scale
- **Contrast compliance**: Automated WCAG AA contrast validation

### Template Quality
- **Professional appearance**: Business-appropriate design and copy
- **Responsive design**: Mobile-friendly layout (desktop-first focus)
- **Interaction design**: Proper button states and hover effects
- **Brand accuracy**: Faithful representation of source design language

### Technical Validation
- **React compilation**: Generated components must compile without errors
- **CSS validation**: Well-formed CSS custom properties and values
- **Token application**: All extracted tokens must be applied meaningfully
- **Preview functionality**: Live preview must render correctly

---

## Success Metrics

### Functional Success
- [ ] Extract design tokens from any URL in <5 seconds
- [ ] Generate styled template component in <2 seconds
- [ ] Achieve >95% visual brand coherence with source
- [ ] Maintain WCAG AA contrast compliance across all text
- [ ] Render functional preview without errors

### Quality Success
- [ ] Professional appearance suitable for business demos
- [ ] Consistent results across different source URLs
- [ ] Clear demonstration of design token application
- [ ] Responsive template that works on mobile/desktop
- [ ] Clean, maintainable generated code

### User Experience Success
- [ ] Simple, clear interface for CTA mode
- [ ] Immediate visual feedback on token extraction
- [ ] Easy preview access and sharing
- [ ] Obvious distinction from full pipeline mode
- [ ] Professional demo experience for stakeholders

---

## Future Enhancements

### Short-term (Optional)
- **Multiple Templates**: Add 2-3 alternative CTA layouts (modal, banner, card)
- **Custom Content**: Allow basic text customization while keeping template structure
- **Export Options**: Generate downloadable React components or HTML/CSS
- **Brand Preview**: Side-by-side comparison of source URL and generated template

### Medium-term (Outside Scope)
- **Template Variants**: Industry-specific templates (SaaS, e-commerce, agency)
- **Component Library**: Generate reusable button/card components
- **A/B Testing**: Multiple style variations from same source tokens
- **Integration Hooks**: Embed generated templates in external applications

---

## Implementation Priority

### **Phase 1 (Core)**: Foundation - 4-6 hours
- ✅ Create `/api/generate-cta` route
- ✅ Implement template selection logic
- ✅ Build basic token application system
- ✅ Set up artifact saving structure

### **Phase 2 (Templates)**: Template Variants - 6-8 hours
- ✅ Implement card template with styling
- ✅ Implement banner template with styling
- ✅ Implement modal template with styling
- ✅ Add intelligent template selection
- ✅ Validate contrast compliance across templates

### **Phase 3 (Integration)**: UI & Preview - 4-6 hours
- ✅ Add CTA mode toggle to main interface
- ✅ Implement template selector dropdown
- ✅ Create preview route for CTA templates
- ✅ Add download/export functionality

### **Phase 4 (Polish)**: Quality & Performance - 2-4 hours
- ✅ Optimize token extraction for CTA use case
- ✅ Add comprehensive error handling
- ✅ Implement template validation
- ✅ Add basic performance monitoring

**Total Estimated Timeline**: 2-3 development days

**Key Dependencies**:
- Existing `capture` and `tokens` modules (proven, working)
- Next.js API routes and components (existing infrastructure)
- React component generation patterns (from existing `codegen`)

**Success Criteria**:
- [ ] Generate 3 distinct template variants from any URL
- [ ] Apply design tokens with proper contrast validation
- [ ] Render live previews within 5 seconds
- [ ] Professional appearance suitable for demos
- [ ] Clean, maintainable code following project patterns

---

## Conclusion

This enhanced CTA approach delivers a **production-ready demonstration** of design token extraction and application through:

- **Multiple template variants** that showcase different design patterns
- **Intelligent template selection** based on extracted design tokens
- **Robust token application** with automated contrast validation
- **Professional UI integration** with clear mode separation
- **Performance optimization** for fast, reliable execution

The result is a **focused, reliable showcase** that demonstrates the core value of brand-accurate design generation while maintaining the simplicity and speed advantages of bypassing complex layout synthesis.