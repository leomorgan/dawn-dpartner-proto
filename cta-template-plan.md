# CTA Template Fix Plan

## Phase 1: Fix Button Detection & Token Extraction (Priority: Critical)

### Step 1.1: Improve Button Detection Accuracy
- **Goal**: Only detect actual interactive buttons, not layout containers
- **Changes**:
  - Add maximum area threshold (buttons typically < 10,000px area)
  - Add minimum area threshold (buttons typically > 100px area)
  - Filter by aspect ratio (buttons rarely have extreme ratios > 10:1)
  - Add text content validation (buttons should have text/icon content)
- **Success Metric**: No buttons with area > 5000px in extracted tokens

### Step 1.2: Fix Zero Padding Issue
- **Goal**: Ensure extracted buttons have usable padding values
- **Changes**:
  - Add fallback logic: if padding is "0px", use computed inner spacing
  - Calculate padding from text node position relative to button bounds
  - Minimum padding fallback: "12px 24px" for standard buttons
- **Success Metric**: All buttons have non-zero padding values

### Step 1.3: Implement Live Hover Simulation & Capture
- **Goal**: Capture actual hover behavior through browser simulation, not just CSS rules
- **Changes**:
  - **Playwright hover simulation**: Use `page.hover(selector)` on each detected button
  - **Before/after style capture**: Get computed styles before hover, trigger hover, capture again
  - **Animation completion**: Wait for CSS transitions to complete (`page.waitForTimeout()`)
  - **Multi-state capture**: Capture normal → hover → focus → active states
  - **Property diff analysis**: Compare computed styles to identify what actually changes
  - **JavaScript interaction detection**: Capture hover effects triggered by JS event handlers
- **Technical Implementation**:
  ```typescript
  // For each button element
  const normalStyles = await page.evaluate(selector => getComputedStyle(selector));
  await page.hover(selector);
  await page.waitForTimeout(300); // Allow transitions
  const hoverStyles = await page.evaluate(selector => getComputedStyle(selector));
  ```
- **Success Metric**: 80% of interactive buttons have captured hover state data

### Step 1.4: Handle Complex Hover Interactions
- **Goal**: Capture advanced hover effects (micro-animations, transforms, shadows)
- **Changes**:
  - **Multi-property tracking**: Monitor backgroundColor, transform, boxShadow, opacity, scale
  - **Nested element changes**: Hover on parent might change child elements (icons, text)
  - **Timing-based capture**: Multiple snapshots during transition (0ms, 150ms, 300ms)
  - **Cursor state validation**: Ensure cursor:pointer indicates interactive element
  - **Complex selector handling**: Capture effects from `.button:hover .icon` type selectors
- **Technical Implementation**:
  ```typescript
  // Capture transition timeline
  const snapshots = [];
  await page.hover(selector);
  for (const delay of [0, 100, 200, 300]) {
    await page.waitForTimeout(delay);
    snapshots.push(await captureAllStyles(selector));
  }
  ```
- **Success Metric**: Capture micro-animations and complex hover states from modern web apps

## Phase 2: Abandon Tailwind for Design Tokens (Priority: Critical)

### Step 2.1: Remove Tailwind Arbitrary Value Generation
- **Goal**: Stop generating broken Tailwind classes like `py-[0px]`
- **Changes**:
  - Remove `convertPaddingToTailwind()` function
  - Remove arbitrary value class generation for colors
  - Keep only structural Tailwind classes: `flex`, `inline-flex`, `items-center`
- **Success Metric**: No arbitrary value classes in generated components

### Step 2.2: Implement CSS Custom Properties System
- **Goal**: Use CSS variables for all design tokens
- **Changes**:
  - Generate comprehensive CSS variable set from tokens
  - Create variable naming convention: `--cta-{category}-{property}`
  - Include all extracted values: colors, spacing, typography, borders
- **Success Metric**: All style values reference CSS variables

### Step 2.3: Apply Inline Styles for Precision
- **Goal**: Direct application of design tokens via style prop
- **Changes**:
  - Generate style objects with CSS variable references
  - Apply computed styles directly to elements
  - Maintain React-compatible camelCase property names
- **Success Metric**: Components render with exact extracted styles

## Phase 3: Simplify Component Generation (Priority: High)

### Step 3.1: Create Clean Component Template
- **Goal**: Generate simple, maintainable React components
- **New structure**:
  ```jsx
  <button
    className="inline-flex items-center justify-center"
    style={{
      backgroundColor: 'var(--cta-primary-bg)',
      color: 'var(--cta-primary-text)',
      padding: 'var(--cta-button-padding)',
      borderRadius: 'var(--cta-button-radius)',
      fontSize: 'var(--cta-button-font-size)',
      fontWeight: 'var(--cta-button-font-weight)',
      transition: 'var(--cta-transition)'
    }}
  >
  ```
- **Success Metric**: Generated code is readable and maintainable

### Step 3.2: Fix Preview Rendering
- **Goal**: Reliable component preview without JSX-to-HTML conversion
- **Changes**:
  - Use React.createElement() for dynamic rendering
  - Inject CSS variables via styled component or CSS-in-JS
  - Remove dangerouslySetInnerHTML usage
- **Success Metric**: Preview renders without console errors

## Phase 4: Enhance Design Fidelity (Priority: High)

### Step 4.1: Improve Color Contrast Validation
- **Goal**: Ensure readable text on all buttons
- **Changes**:
  - Use proper WCAG contrast calculation
  - Find best text color from existing palette
  - Test against AA standard (4.5:1 ratio)
- **Success Metric**: All buttons meet WCAG AA contrast

### Step 4.2: Preserve Source Design Patterns
- **Goal**: Maintain brand-specific design details
- **Changes**:
  - Capture box-shadow values for depth
  - Preserve text-transform and letter-spacing
  - Maintain transition timing functions
- **Success Metric**: Side-by-side comparison shows high fidelity

## Phase 5: Quality Assurance & Testing (Priority: Medium)

### Step 5.1: Add Validation Pipeline
- **Goal**: Catch extraction errors before generation
- **Checks**:
  - Validate button has reasonable dimensions
  - Ensure colors have proper format
  - Verify padding/margin values are positive
  - Check font-size is within normal range (12-24px)
- **Success Metric**: Invalid tokens are filtered or corrected

### Step 5.2: Create Test Suite
- **Goal**: Ensure consistent quality across different sources
- **Tests**:
  - Extract from known good sources (Stripe, GitHub)
  - Verify button detection accuracy
  - Test contrast compliance
  - Validate CSS variable generation
- **Success Metric**: 90% test pass rate

## Phase 6: Documentation & Cleanup (Priority: Low)

### Step 6.1: Remove Unused Tailwind Utilities
- **Goal**: Clean up codebase
- **Actions**:
  - Remove tailwind-mapper utility functions
  - Update imports and dependencies
  - Clean up commented code
- **Success Metric**: No unused Tailwind mapping code

### Step 6.2: Document New Approach
- **Goal**: Clear documentation for maintenance
- **Content**:
  - CSS variable naming convention
  - Button extraction logic
  - Fallback strategies
- **Success Metric**: README updated with new approach

## Implementation Order

1. **Day 1**: Phase 1 (Button Detection) + Phase 2 (Remove Tailwind)
2. **Day 2**: Phase 3 (Component Generation) + Phase 4 (Design Fidelity)
3. **Day 3**: Phase 5 (Testing) + Phase 6 (Cleanup)

## Key Success Metrics

- ✅ Buttons have proper padding (not 0px)
- ✅ Text is readable (WCAG AA contrast)
- ✅ Components use CSS variables, not Tailwind arbitrary values
- ✅ Preview renders without errors
- ✅ Generated components match source design within 95% fidelity