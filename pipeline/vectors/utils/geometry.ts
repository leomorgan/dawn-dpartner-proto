/**
 * Geometric utilities for layout analysis and visual grouping
 */

import type { ComputedStyleNode } from '../../capture';

export interface BBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Calculate the area of a bounding box
 */
export function calculateBBoxArea(bbox: BBox): number {
  return bbox.w * bbox.h;
}

/**
 * Calculate the intersection area between two bounding boxes
 * Returns 0 if boxes don't overlap
 *
 * @example
 * const box1 = { x: 0, y: 0, w: 100, h: 100 };
 * const box2 = { x: 50, y: 50, w: 100, h: 100 };
 * calculateBBoxOverlap(box1, box2); // 2500 (50x50 overlap)
 */
export function calculateBBoxOverlap(bbox1: BBox, bbox2: BBox): number {
  const x1 = Math.max(bbox1.x, bbox2.x);
  const y1 = Math.max(bbox1.y, bbox2.y);
  const x2 = Math.min(bbox1.x + bbox1.w, bbox2.x + bbox2.w);
  const y2 = Math.min(bbox1.y + bbox1.h, bbox2.y + bbox2.h);

  const width = Math.max(0, x2 - x1);
  const height = Math.max(0, y2 - y1);

  return width * height;
}

/**
 * Calculate the center point of a bounding box
 */
function calculateCenter(bbox: BBox): { x: number; y: number } {
  return {
    x: bbox.x + bbox.w / 2,
    y: bbox.y + bbox.h / 2,
  };
}

/**
 * Calculate Euclidean distance between two points
 */
function calculateDistance(p1: { x: number; y: number }, p2: { x: number; y: number }): number {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Detect visual groups using proximity-based clustering
 * Elements within `proximityThreshold` pixels are considered part of the same group
 *
 * @param nodes Array of DOM nodes with bounding boxes
 * @param proximityThreshold Distance threshold in pixels (default: 32px)
 * @returns Array of groups, where each group is an array of nodes
 *
 * @example
 * const groups = detectVisualGroups(nodes, 32);
 * // Returns: [[node1, node2], [node3, node4, node5], ...]
 */
export function detectVisualGroups(
  nodes: ComputedStyleNode[],
  proximityThreshold: number = 32
): ComputedStyleNode[][] {
  if (nodes.length === 0) return [];

  // Simple clustering: assign each node to a group based on proximity
  const groups: ComputedStyleNode[][] = [];
  const assigned = new Set<string>();

  for (const node of nodes) {
    if (assigned.has(node.id)) continue;

    // Start a new group
    const group: ComputedStyleNode[] = [node];
    assigned.add(node.id);

    const nodeCenter = calculateCenter(node.bbox);

    // Find nearby nodes
    for (const other of nodes) {
      if (assigned.has(other.id)) continue;

      const otherCenter = calculateCenter(other.bbox);
      const distance = calculateDistance(nodeCenter, otherCenter);

      if (distance <= proximityThreshold) {
        group.push(other);
        assigned.add(other.id);
      }
    }

    groups.push(group);
  }

  return groups;
}

/**
 * Check if a node represents an image element
 * Detects: img, picture, video, or elements with background-image
 *
 * @param node ComputedStyleNode to check
 * @returns true if node is an image element
 */
export function isImageElement(node: ComputedStyleNode): boolean {
  // Check tag name
  if (['img', 'picture', 'video', 'svg', 'canvas'].includes(node.tag)) {
    return true;
  }

  // Check for background-image
  // Note: ComputedStyleNode doesn't have backgroundImage in styles interface
  // We'll check if it has a className that suggests image (fallback heuristic)
  if (node.className) {
    const lowerClass = node.className.toLowerCase();
    if (
      lowerClass.includes('image') ||
      lowerClass.includes('img') ||
      lowerClass.includes('photo') ||
      lowerClass.includes('thumbnail') ||
      lowerClass.includes('avatar')
    ) {
      return true;
    }
  }

  return false;
}

/**
 * Check if a node contains text content
 * Excludes empty strings and whitespace-only content
 *
 * @param node ComputedStyleNode to check
 * @returns true if node has meaningful text content
 */
export function hasTextContent(node: ComputedStyleNode): boolean {
  if (!node.textContent) return false;

  // Check if text is not just whitespace
  const trimmed = node.textContent.trim();
  return trimmed.length > 0;
}

/**
 * Calculate average spacing within a group (intra-group spacing)
 * Measures average distance between centers of elements in the group
 *
 * @param group Array of nodes in the group
 * @returns Average spacing in pixels
 */
export function calculateIntraGroupSpacing(group: ComputedStyleNode[]): number {
  if (group.length < 2) return 0;

  let totalDistance = 0;
  let pairCount = 0;

  for (let i = 0; i < group.length; i++) {
    for (let j = i + 1; j < group.length; j++) {
      const center1 = calculateCenter(group[i].bbox);
      const center2 = calculateCenter(group[j].bbox);
      totalDistance += calculateDistance(center1, center2);
      pairCount++;
    }
  }

  return pairCount > 0 ? totalDistance / pairCount : 0;
}

/**
 * Calculate average spacing between a group and all other nodes (inter-group spacing)
 * Measures average distance from group center to other element centers
 *
 * @param group Array of nodes in the group
 * @param allNodes All nodes in the layout
 * @returns Average spacing in pixels
 */
export function calculateInterGroupSpacing(
  group: ComputedStyleNode[],
  allNodes: ComputedStyleNode[]
): number {
  if (group.length === 0 || allNodes.length === 0) return 0;

  // Calculate group center (centroid)
  const groupIds = new Set(group.map(n => n.id));
  const groupCenters = group.map(n => calculateCenter(n.bbox));
  const groupCentroid = {
    x: groupCenters.reduce((sum, c) => sum + c.x, 0) / groupCenters.length,
    y: groupCenters.reduce((sum, c) => sum + c.y, 0) / groupCenters.length,
  };

  // Measure distance to other nodes
  const otherNodes = allNodes.filter(n => !groupIds.has(n.id));
  if (otherNodes.length === 0) return 0;

  let totalDistance = 0;
  for (const node of otherNodes) {
    const nodeCenter = calculateCenter(node.bbox);
    totalDistance += calculateDistance(groupCentroid, nodeCenter);
  }

  return totalDistance / otherNodes.length;
}

/**
 * Detect horizontal bands of elements (elements at similar Y positions)
 * Used for measuring vertical rhythm and whitespace gaps
 *
 * @param nodes Array of nodes to analyze
 * @param yThreshold Maximum Y difference to consider elements in same band (default: 20px)
 * @returns Array of bands, where each band is an array of nodes
 *
 * @example
 * const bands = detectHorizontalBands(nodes, 20);
 * // Returns: [[headerNodes...], [heroNodes...], [contentNodes...], ...]
 */
export function detectHorizontalBands(
  nodes: ComputedStyleNode[],
  yThreshold: number = 20
): ComputedStyleNode[][] {
  if (nodes.length === 0) return [];

  // Sort by Y position (top to bottom)
  const sorted = [...nodes].sort((a, b) => a.bbox.y - b.bbox.y);

  const bands: ComputedStyleNode[][] = [];
  let currentBand: ComputedStyleNode[] = [sorted[0]];
  let lastY = sorted[0].bbox.y;

  for (let i = 1; i < sorted.length; i++) {
    const node = sorted[i];

    if (node.bbox.y - lastY > yThreshold) {
      // Start new band
      bands.push(currentBand);
      currentBand = [node];
      lastY = node.bbox.y;
    } else {
      // Add to current band
      currentBand.push(node);
    }
  }

  // Push final band
  if (currentBand.length > 0) {
    bands.push(currentBand);
  }

  return bands;
}

/**
 * Measure vertical gaps between consecutive horizontal bands
 * Gap = distance from bottom of band N to top of band N+1
 *
 * @param bands Array of horizontal bands from detectHorizontalBands
 * @returns Array of gap sizes in pixels
 */
export function measureVerticalGaps(bands: ComputedStyleNode[][]): number[] {
  if (bands.length < 2) return [];

  const gaps: number[] = [];

  for (let i = 0; i < bands.length - 1; i++) {
    const currentBand = bands[i];
    const nextBand = bands[i + 1];

    // Find bottom of current band (max Y + height)
    const bandBottom = Math.max(...currentBand.map(n => n.bbox.y + n.bbox.h));

    // Find top of next band (min Y)
    const nextBandTop = Math.min(...nextBand.map(n => n.bbox.y));

    const gap = nextBandTop - bandBottom;
    if (gap > 0) {
      gaps.push(gap);
    }
  }

  return gaps;
}

/**
 * Measure horizontal gaps between elements within bands
 * Gap = distance from right edge of element N to left edge of element N+1
 *
 * @param bands Array of horizontal bands from detectHorizontalBands
 * @returns Array of gap sizes in pixels
 */
export function measureHorizontalGaps(bands: ComputedStyleNode[][]): number[] {
  const gaps: number[] = [];

  for (const band of bands) {
    if (band.length < 2) continue;

    // Sort by X position (left to right)
    const sortedByX = [...band].sort((a, b) => a.bbox.x - b.bbox.x);

    for (let i = 0; i < sortedByX.length - 1; i++) {
      const current = sortedByX[i];
      const next = sortedByX[i + 1];

      const gap = next.bbox.x - (current.bbox.x + current.bbox.w);
      if (gap > 0) {
        gaps.push(gap);
      }
    }
  }

  return gaps;
}
