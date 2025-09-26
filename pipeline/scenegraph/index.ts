import { readFile, writeFile } from 'fs/promises';
import { join } from 'path';
import { parseHTML } from 'linkedom';
import type { ComputedStyleNode, CaptureMetadata } from '../capture';

export interface SceneNode {
  id: string;
  type: 'container' | 'text' | 'image' | 'button' | 'input';
  role: string;
  bbox: {
    x: number;
    y: number;
    w: number;
    h: number;
  };
  children: SceneNode[];
  textContent?: string;
  styles: {
    backgroundColor?: string;
    borderRadius?: string;
    boxShadow?: string;
  };
  metadata: {
    tag: string;
    className?: string;
    originalId?: string;
  };
}

export interface SceneGraph {
  root: SceneNode;
  totalNodes: number;
  wrapperReduction: number;
  readingOrder: string[];
}

export interface SceneGraphResult {
  runId: string;
  scenegraph: SceneGraph;
}

export async function buildSceneGraph(runId: string, artifactDir?: string): Promise<SceneGraphResult> {
  const baseDir = artifactDir || join(process.cwd(), 'artifacts');
  const runDir = join(baseDir, runId);
  const rawDir = join(runDir, 'raw');

  // Read DOM, computed styles, and metadata
  const [htmlContent, stylesContent, metaContent] = await Promise.all([
    readFile(join(rawDir, 'dom.html'), 'utf8'),
    readFile(join(rawDir, 'computed_styles.json'), 'utf8'),
    readFile(join(rawDir, 'meta.json'), 'utf8'),
  ]);

  const computedNodes: ComputedStyleNode[] = JSON.parse(stylesContent);
  const metadata: CaptureMetadata = JSON.parse(metaContent);
  const { document } = parseHTML(htmlContent);

  // Build style lookup map
  const styleMap = new Map<string, ComputedStyleNode>();
  computedNodes.forEach(node => {
    styleMap.set(node.id, node);
  });

  // Process DOM tree and build scene graph
  const originalNodeCount = computedNodes.length;
  const root = processElement(document.body, styleMap, metadata, 0);

  // Calculate metrics
  const totalNodes = countNodes(root);
  const wrapperReduction = ((originalNodeCount - totalNodes) / originalNodeCount) * 100;
  const readingOrder = generateReadingOrder(root);

  const scenegraph: SceneGraph = {
    root,
    totalNodes,
    wrapperReduction,
    readingOrder,
  };

  // Save scenegraph
  await writeFile(join(runDir, 'scenegraph.json'), JSON.stringify(scenegraph, null, 2));

  return {
    runId,
    scenegraph,
  };
}

function processElement(element: Element, styleMap: Map<string, ComputedStyleNode>, metadata: CaptureMetadata, depth: number): SceneNode {
  const elementRect = getBoundingRect(element, styleMap, metadata);

  // If element has no meaningful size, skip it
  if (!elementRect || elementRect.w <= 0 || elementRect.h <= 0) {
    // Return a placeholder that will be filtered out
    return createPlaceholderNode();
  }

  // Determine node type and role
  const nodeType = determineNodeType(element);
  const role = determineRole(element, elementRect, depth);

  // Process children
  const children: SceneNode[] = [];
  for (const child of Array.from(element.children)) {
    const childNode = processElement(child, styleMap, metadata, depth + 1);
    if (!isPlaceholder(childNode)) {
      children.push(childNode);
    }
  }

  // Collapse wrapper elements
  if (shouldCollapseWrapper(element, children, elementRect)) {
    // Return the most significant child or merge children
    return children.length === 1 ? children[0] : mergeChildren(children, elementRect, element);
  }

  // Get text content (for text nodes)
  const textContent = getTextContent(element);

  // Get styles
  const styles = extractNodeStyles(element, styleMap);

  return {
    id: generateNodeId(),
    type: nodeType,
    role,
    bbox: snapToGrid(elementRect),
    children,
    textContent,
    styles,
    metadata: {
      tag: element.tagName.toLowerCase(),
      className: (element.className && typeof element.className === 'string' ? element.className : '') || undefined,
      originalId: element.id || undefined,
    },
  };
}

function getBoundingRect(element: Element, styleMap: Map<string, ComputedStyleNode>, metadata: CaptureMetadata): { x: number; y: number; w: number; h: number } | null {
  // Find corresponding computed style node
  const nodeId = findNodeId(element, styleMap);
  if (nodeId) {
    const computed = styleMap.get(nodeId);
    if (computed) {
      return computed.bbox;
    }
  }

  // Fallback: create adaptive default bounds based on viewport and semantic role
  const { viewport } = metadata;
  const viewportWidth = viewport.width;
  const viewportHeight = viewport.height;
  const tag = element.tagName.toLowerCase();

  if (['body', 'html', 'main'].includes(tag)) {
    return { x: 0, y: 0, w: viewportWidth, h: viewportHeight };
  }

  if (['header', 'nav'].includes(tag)) {
    // Header/nav typically spans full width, height is ~8-12% of viewport
    return { x: 0, y: 0, w: viewportWidth, h: Math.round(viewportHeight * 0.1) };
  }

  if (['footer'].includes(tag)) {
    // Footer spans full width, positioned at bottom, height is ~8-10% of viewport
    const footerHeight = Math.round(viewportHeight * 0.08);
    return { x: 0, y: viewportHeight - footerHeight, w: viewportWidth, h: footerHeight };
  }

  if (['section'].includes(tag)) {
    // Section spans full width, height is ~30-50% of viewport depending on content
    return { x: 0, y: Math.round(viewportHeight * 0.1), w: viewportWidth, h: Math.round(viewportHeight * 0.4) };
  }

  // Default fallback for any element - small but proportional to viewport
  const defaultWidth = Math.min(200, Math.round(viewportWidth * 0.15));
  const defaultHeight = Math.min(50, Math.round(viewportHeight * 0.06));
  return { x: 0, y: 0, w: defaultWidth, h: defaultHeight };
}

function findNodeId(element: Element, styleMap: Map<string, ComputedStyleNode>): string | null {
  // Try to match by tag, className, and text content
  const tag = element.tagName.toLowerCase();
  const className = element.className && typeof element.className === 'string' ? element.className : '';
  const textContent = element.textContent?.trim().slice(0, 50);

  for (const nodeId of Array.from(styleMap.keys())) {
    const node = styleMap.get(nodeId)!;
    // Match by tag first
    if (node.tag !== tag) continue;

    // If both have className, they should match
    if (className && node.className && node.className === className) {
      return nodeId;
    }

    // If no className but text content matches
    if (!className && !node.className && textContent && node.textContent) {
      if (node.textContent.includes(textContent) || textContent.includes(node.textContent.slice(0, 50))) {
        return nodeId;
      }
    }

    // If same tag and similar content length, assume match
    if (!className && !node.className && Math.abs((element.textContent?.length || 0) - (node.textContent?.length || 0)) < 10) {
      return nodeId;
    }
  }

  // Fallback: find by tag only if nothing else matches
  for (const nodeId of Array.from(styleMap.keys())) {
    const node = styleMap.get(nodeId)!;
    if (node.tag === tag) {
      return nodeId;
    }
  }

  return null;
}

function determineNodeType(element: Element): SceneNode['type'] {
  const tag = element.tagName.toLowerCase();

  if (tag === 'button' || (tag === 'a' && element.textContent?.trim())) {
    return 'button';
  }

  if (tag === 'input' || tag === 'textarea' || tag === 'select') {
    return 'input';
  }

  if (tag === 'img' || tag === 'svg' || tag === 'picture') {
    return 'image';
  }

  if (element.textContent && element.textContent.trim() && element.children.length === 0) {
    return 'text';
  }

  return 'container';
}

function determineRole(element: Element, rect: { x: number; y: number; w: number; h: number }, depth: number, allElements?: Element[]): string {
  const tag = element.tagName.toLowerCase();
  const className = (element.className && typeof element.className === 'string' ? element.className.toLowerCase() : '') || '';

  // Explicit role attribute (highest priority)
  if (element.hasAttribute('role')) {
    return element.getAttribute('role')!;
  }

  // Semantic HTML elements (second priority)
  if (tag === 'header') return 'Header';
  if (tag === 'nav') return 'Navigation';
  if (tag === 'main') return 'Main';
  if (tag === 'section') return 'Section';
  if (tag === 'article') return 'Article';
  if (tag === 'aside') return 'Sidebar';
  if (tag === 'footer') return 'Footer';

  // Content-based intelligent role detection (replaces hardcoded position assumptions)
  const role = analyzeSemanticRole(element, rect, depth, className, allElements);
  if (role !== 'Unknown') return role;

  // Element type-based roles (fallback)
  if (tag === 'h1' || tag === 'h2' || tag === 'h3') return 'Heading';
  if (tag === 'p') return 'Text';
  if (tag === 'button') return 'Button';
  if (tag === 'a') return 'Link';

  return 'Container';
}

// Intelligent semantic role analysis - replaces hardcoded position assumptions
function analyzeSemanticRole(element: Element, rect: { x: number; y: number; w: number; h: number }, depth: number, className: string, allElements?: Element[]): string {

  // Analyze content and context instead of fixed positions
  const contentAnalysis = analyzeElementContent(element);
  const layoutContext = analyzeLayoutContext(rect, allElements || []);
  const classNameAnalysis = analyzeClassNameSemantics(className);

  // Navigation detection - look for nav patterns, not position
  if (classNameAnalysis.isNavigation || contentAnalysis.hasNavigationPatterns) {
    return 'Navigation';
  }

  // Header detection - look for header content patterns, not y < 100
  if (contentAnalysis.hasHeaderPatterns && layoutContext.isInTopRegion && depth <= 2) {
    return 'Header';
  }

  // Footer detection - look for footer content patterns, not y > 520
  if (contentAnalysis.hasFooterPatterns && layoutContext.isInBottomRegion && depth <= 2) {
    return 'Footer';
  }

  // Hero detection - look for prominent content area with hero characteristics
  if (contentAnalysis.hasHeroPatterns && rect.w > 600 && rect.h > 200 && depth <= 3) {
    return 'Hero';
  }

  // Card detection - look for card patterns in content and styling
  if (contentAnalysis.hasCardPatterns || classNameAnalysis.isCard) {
    return 'Card';
  }

  // Sidebar detection - narrow tall content with supplementary info
  if (layoutContext.hasLayoutCharacteristics.sidebar && contentAnalysis.hasSecondaryContent) {
    return 'Sidebar';
  }

  return 'Unknown';
}

function analyzeElementContent(element: Element) {
  const textContent = element.textContent?.toLowerCase() || '';
  const childElements = Array.from(element.children);

  // Navigation patterns
  const hasNavigationPatterns =
    textContent.includes('menu') ||
    textContent.includes('home') ||
    (childElements.some(child => child.tagName.toLowerCase() === 'a') && childElements.length >= 2);

  // Header patterns - look for site titles, logos, primary navigation
  const hasHeaderPatterns =
    element.querySelector('h1') ||
    element.querySelector('[class*="logo"]') ||
    element.querySelector('img[alt*="logo" i]') ||
    (hasNavigationPatterns && element.querySelector('h1, h2, [class*="title"], [class*="brand"]'));

  // Footer patterns - look for footer-specific content
  const hasFooterPatterns =
    textContent.includes('copyright') ||
    textContent.includes('©') ||
    textContent.includes('privacy') ||
    textContent.includes('terms') ||
    textContent.includes('contact us') ||
    element.querySelectorAll('a').length >= 5; // Many links typical in footers

  // Hero patterns - large text, call-to-action, prominent messaging
  const hasHeroPatterns =
    element.querySelector('h1') ||
    element.querySelector('[class*="hero"]') ||
    element.querySelector('[class*="banner"]') ||
    element.querySelector('button, [class*="cta"], [class*="call-to-action"]');

  // Card patterns - structured content in contained unit
  const hasCardPatterns =
    (element.querySelector('h2, h3') && element.querySelector('p')) ||
    (element.querySelector('img') && element.querySelector('h2, h3')) ||
    element.querySelector('[class*="price"]');

  // Secondary content patterns
  const hasSecondaryContent =
    element.querySelector('[class*="widget"]') ||
    element.querySelector('[class*="sidebar"]') ||
    textContent.includes('related') ||
    textContent.includes('recent');

  return {
    hasNavigationPatterns,
    hasHeaderPatterns,
    hasFooterPatterns,
    hasHeroPatterns,
    hasCardPatterns,
    hasSecondaryContent
  };
}

function analyzeLayoutContext(rect: { x: number; y: number; w: number; h: number }, allElements: Element[]) {
  // Determine layout position relative to page structure, not hardcoded pixels
  const pageHeight = allElements.length > 0 ? Math.max(...allElements.map(el => {
    try {
      const elRect = el.getBoundingClientRect?.();
      return elRect ? elRect.bottom : 0;
    } catch {
      return 0;
    }
  })) : 800; // fallback

  const relativePosition = rect.y / Math.max(pageHeight, 1);

  const isInTopRegion = relativePosition < 0.2; // Top 20% of page
  const isInBottomRegion = relativePosition > 0.8; // Bottom 20% of page

  const hasLayoutCharacteristics = {
    sidebar: rect.w < 300 && rect.h > 400, // Narrow and tall
    fullWidth: rect.w > (pageHeight * 0.8), // Spans most of page width
    prominent: rect.w > 600 && rect.h > 300, // Large area
  };

  return {
    isInTopRegion,
    isInBottomRegion,
    hasLayoutCharacteristics
  };
}

function analyzeClassNameSemantics(className: string) {
  const isNavigation =
    className.includes('nav') ||
    className.includes('menu') ||
    className.includes('navigation');

  const isCard =
    className.includes('card') ||
    className.includes('item') ||
    className.includes('product') ||
    className.includes('post');

  return { isNavigation, isCard };
}

function shouldCollapseWrapper(element: Element, children: SceneNode[], rect: { x: number; y: number; w: number; h: number }): boolean {
  // Don't collapse semantic elements
  const tag = element.tagName.toLowerCase();
  if (['header', 'nav', 'main', 'section', 'article', 'aside', 'footer'].includes(tag)) {
    return false;
  }

  // Don't collapse elements with meaningful styling
  const elementClassName = element.className && typeof element.className === 'string' ? element.className : '';
  if (elementClassName && (
    elementClassName.includes('bg-') ||
    elementClassName.includes('border') ||
    elementClassName.includes('shadow')
  )) {
    return false;
  }

  // Collapse single-child containers
  if (children.length === 1) {
    const child = children[0];
    // Don't collapse if the wrapper adds significant space
    if (Math.abs(rect.w - child.bbox.w) > 20 || Math.abs(rect.h - child.bbox.h) > 20) {
      return false;
    }
    return true;
  }

  // Don't collapse containers with multiple children
  return false;
}

function mergeChildren(children: SceneNode[], rect: { x: number; y: number; w: number; h: number }, element: Element): SceneNode {
  return {
    id: generateNodeId(),
    type: 'container',
    role: 'Container',
    bbox: snapToGrid(rect),
    children,
    styles: extractNodeStyles(element, new Map()),
    metadata: {
      tag: element.tagName.toLowerCase(),
      className: (element.className && typeof element.className === 'string' ? element.className : '') || undefined,
    },
  };
}

function getTextContent(element: Element): string | undefined {
  // Get direct text content, not including children
  const textContent = Array.from(element.childNodes)
    .filter(node => node.nodeType === 3) // Text nodes only
    .map(node => node.textContent)
    .join('')
    .trim();

  return textContent.length > 0 ? textContent.slice(0, 100) : undefined;
}

function extractNodeStyles(element: Element, styleMap: Map<string, ComputedStyleNode>): SceneNode['styles'] {
  const nodeId = findNodeId(element, styleMap);
  if (nodeId) {
    const computed = styleMap.get(nodeId);
    if (computed) {
      return {
        backgroundColor: computed.styles.backgroundColor !== 'rgba(0, 0, 0, 0)' ? computed.styles.backgroundColor : undefined,
        borderRadius: computed.styles.borderRadius !== '0px' ? computed.styles.borderRadius : undefined,
        boxShadow: computed.styles.boxShadow !== 'none' ? computed.styles.boxShadow : undefined,
      };
    }
  }

  return {};
}

function snapToGrid(rect: { x: number; y: number; w: number; h: number }): { x: number; y: number; w: number; h: number } {
  return {
    x: Math.round(rect.x / 8) * 8,
    y: Math.round(rect.y / 8) * 8,
    w: Math.round(rect.w / 8) * 8,
    h: Math.round(rect.h / 8) * 8,
  };
}

function generateNodeId(): string {
  return `scene_${Math.random().toString(36).substring(2, 10)}`;
}

function createPlaceholderNode(): SceneNode {
  return {
    id: '__placeholder__',
    type: 'container',
    role: '__placeholder__',
    bbox: { x: 0, y: 0, w: 0, h: 0 },
    children: [],
    styles: {},
    metadata: { tag: 'placeholder' },
  };
}

function isPlaceholder(node: SceneNode): boolean {
  return node.id === '__placeholder__';
}

function countNodes(node: SceneNode): number {
  return 1 + node.children.reduce((total, child) => total + countNodes(child), 0);
}

function generateReadingOrder(node: SceneNode): string[] {
  const order: string[] = [];

  function traverse(n: SceneNode) {
    if (n.type === 'text' || n.textContent) {
      order.push(n.id);
    }

    // Sort children by Y position, then X position for reading order
    const sortedChildren = [...n.children].sort((a, b) => {
      const yDiff = a.bbox.y - b.bbox.y;
      if (Math.abs(yDiff) > 20) return yDiff; // Different rows
      return a.bbox.x - b.bbox.x; // Same row, left to right
    });

    sortedChildren.forEach(traverse);
  }

  traverse(node);
  return order;
}