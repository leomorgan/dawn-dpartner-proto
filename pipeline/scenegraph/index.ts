import { readFile, writeFile } from 'fs/promises';
import { join } from 'path';
import { parseHTML } from 'linkedom';
import type { ComputedStyleNode } from '../capture';

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

  // Read DOM and computed styles
  const [htmlContent, stylesContent] = await Promise.all([
    readFile(join(rawDir, 'dom.html'), 'utf8'),
    readFile(join(rawDir, 'computed_styles.json'), 'utf8'),
  ]);

  const computedNodes: ComputedStyleNode[] = JSON.parse(stylesContent);
  const { document } = parseHTML(htmlContent);

  // Build style lookup map
  const styleMap = new Map<string, ComputedStyleNode>();
  computedNodes.forEach(node => {
    styleMap.set(node.id, node);
  });

  // Process DOM tree and build scene graph
  const originalNodeCount = computedNodes.length;
  const root = processElement(document.body, styleMap, 0);

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

function processElement(element: Element, styleMap: Map<string, ComputedStyleNode>, depth: number): SceneNode {
  const elementRect = getBoundingRect(element, styleMap);

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
    const childNode = processElement(child, styleMap, depth + 1);
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
      className: element.className || undefined,
      originalId: element.id || undefined,
    },
  };
}

function getBoundingRect(element: Element, styleMap: Map<string, ComputedStyleNode>): { x: number; y: number; w: number; h: number } | null {
  // Find corresponding computed style node
  const nodeId = findNodeId(element, styleMap);
  if (nodeId) {
    const computed = styleMap.get(nodeId);
    if (computed) {
      return computed.bbox;
    }
  }

  // Fallback: create reasonable default bounds for semantic elements
  const tag = element.tagName.toLowerCase();
  if (['body', 'html', 'main'].includes(tag)) {
    return { x: 0, y: 0, w: 1280, h: 800 };
  }

  if (['header', 'nav'].includes(tag)) {
    return { x: 0, y: 0, w: 1280, h: 100 };
  }

  if (['footer'].includes(tag)) {
    return { x: 0, y: 700, w: 1280, h: 100 };
  }

  if (['section'].includes(tag)) {
    return { x: 0, y: 100, w: 1280, h: 400 };
  }

  // Default fallback for any element
  return { x: 0, y: 0, w: 200, h: 50 };
}

function findNodeId(element: Element, styleMap: Map<string, ComputedStyleNode>): string | null {
  // Try to match by tag, className, and text content
  const tag = element.tagName.toLowerCase();
  const className = element.className;
  const textContent = element.textContent?.trim().slice(0, 50);

  for (const [nodeId, node] of styleMap.entries()) {
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
  for (const [nodeId, node] of styleMap.entries()) {
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

function determineRole(element: Element, rect: { x: number; y: number; w: number; h: number }, depth: number): string {
  const tag = element.tagName.toLowerCase();
  const className = element.className?.toLowerCase() || '';

  // Explicit role attribute
  if (element.hasAttribute('role')) {
    return element.getAttribute('role')!;
  }

  // Semantic elements
  if (tag === 'header') return 'Header';
  if (tag === 'nav') return 'Navigation';
  if (tag === 'main') return 'Main';
  if (tag === 'section') return 'Section';
  if (tag === 'article') return 'Article';
  if (tag === 'aside') return 'Sidebar';
  if (tag === 'footer') return 'Footer';

  // Heuristic-based role detection
  if (depth <= 1 && rect.y < 100) {
    return 'Header';
  }

  if (depth <= 2 && rect.w > 800 && rect.h > 300) {
    return 'Hero';
  }

  if (className.includes('card') || (rect.w < 400 && rect.h > 200)) {
    return 'Card';
  }

  if (className.includes('nav') || className.includes('menu')) {
    return 'Navigation';
  }

  if (depth <= 1 && rect.y > window.innerHeight - 200) {
    return 'Footer';
  }

  // Default roles
  if (tag === 'h1' || tag === 'h2' || tag === 'h3') return 'Heading';
  if (tag === 'p') return 'Text';
  if (tag === 'button') return 'Button';
  if (tag === 'a') return 'Link';

  return 'Container';
}

function shouldCollapseWrapper(element: Element, children: SceneNode[], rect: { x: number; y: number; w: number; h: number }): boolean {
  // Don't collapse semantic elements
  const tag = element.tagName.toLowerCase();
  if (['header', 'nav', 'main', 'section', 'article', 'aside', 'footer'].includes(tag)) {
    return false;
  }

  // Don't collapse elements with meaningful styling
  if (element.className && (
    element.className.includes('bg-') ||
    element.className.includes('border') ||
    element.className.includes('shadow')
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
      className: element.className || undefined,
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
  return `scene_${Math.random().toString(36).substr(2, 8)}`;
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