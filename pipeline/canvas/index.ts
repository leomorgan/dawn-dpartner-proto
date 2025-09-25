import { readFile, writeFile } from 'fs/promises';
import { join } from 'path';
import type { StyledComponent, StyledSection } from '../styling';
import type { DesignTokens } from '../tokens';

export interface CanvasRect {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  cornerRadius?: number;
  opacity?: number;
}

export interface CanvasText {
  id: string;
  x: number;
  y: number;
  text: string;
  fontSize: number;
  fontFamily: string;
  fill: string;
  fontStyle?: 'normal' | 'italic' | 'bold';
  align?: 'left' | 'center' | 'right';
  verticalAlign?: 'top' | 'middle' | 'bottom';
  width?: number;
  height?: number;
}

export interface CanvasGroup {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  children: (CanvasRect | CanvasText | CanvasGroup)[];
  clipFunc?: boolean;
}

export interface CanvasLayout {
  width: number;
  height: number;
  background: string;
  elements: (CanvasRect | CanvasText | CanvasGroup)[];
}

export interface VectorResult {
  runId: string;
  canvas: CanvasLayout;
  svg: string;
  totalElements: number;
}

const CANVAS_CONFIG = {
  width: 1280,
  height: 1024,
  padding: 24,
  sectionSpacing: 32,
  defaultBackground: '#ffffff',
  defaultStroke: '#e5e7eb',
  defaultStrokeWidth: 1,
  defaultCornerRadius: 8,
  defaultFontFamily: 'Arial, sans-serif',
  defaultFontSize: 16,
  textColor: '#374151',
  headingColor: '#1f2937',
};

const SECTION_LAYOUTS: Record<string, { minHeight: number; contentPadding: number }> = {
  gallery: { minHeight: 300, contentPadding: 16 },
  summary: { minHeight: 200, contentPadding: 16 },
  price_cta: { minHeight: 120, contentPadding: 12 },
  amenities: { minHeight: 200, contentPadding: 16 },
  reviews: { minHeight: 300, contentPadding: 16 },
  trust_signals: { minHeight: 80, contentPadding: 8 },
  hero: { minHeight: 400, contentPadding: 32 },
  features: { minHeight: 400, contentPadding: 24 },
  testimonials: { minHeight: 300, contentPadding: 20 },
  faq: { minHeight: 400, contentPadding: 20 },
  contact: { minHeight: 300, contentPadding: 20 },
  avatar: { minHeight: 200, contentPadding: 16 },
  bio: { minHeight: 150, contentPadding: 16 },
  experience: { minHeight: 300, contentPadding: 16 },
  portfolio: { minHeight: 400, contentPadding: 20 },
  social_links: { minHeight: 60, contentPadding: 12 },
};

export async function generateCanvas(runId: string, artifactDir?: string): Promise<VectorResult> {
  const baseDir = artifactDir || join(process.cwd(), 'artifacts');
  const runDir = join(baseDir, runId);

  // Read styled components and design tokens
  const [styledComponentsContent, tokensContent] = await Promise.all([
    readFile(join(runDir, 'styled_components.json'), 'utf8'),
    readFile(join(runDir, 'design_tokens.json'), 'utf8'),
  ]);

  const styledComponents: StyledComponent[] = JSON.parse(styledComponentsContent);
  const tokens: DesignTokens = JSON.parse(tokensContent);

  // Convert components to canvas elements
  const canvas = convertComponentsToCanvas(styledComponents, tokens);

  // Generate SVG
  const svg = generateSVG(canvas);

  // Save canvas and SVG
  await Promise.all([
    writeFile(join(runDir, 'canvas.json'), JSON.stringify(canvas, null, 2)),
    writeFile(join(runDir, 'design.svg'), svg)
  ]);

  const totalElements = countElements(canvas.elements);

  return {
    runId,
    canvas,
    svg,
    totalElements,
  };
}

function convertComponentsToCanvas(components: StyledComponent[], tokens: DesignTokens): CanvasLayout {
  const canvas: CanvasLayout = {
    width: CANVAS_CONFIG.width,
    height: CANVAS_CONFIG.height,
    background: tokens.colors.semantic.background,
    elements: [],
  };

  let currentY = CANVAS_CONFIG.padding;

  components.forEach(component => {
    const group = convertComponentToGroup(component, 0, currentY, CANVAS_CONFIG.width, tokens);
    canvas.elements.push(group);
    currentY += group.height + CANVAS_CONFIG.sectionSpacing;
  });

  // Update canvas height based on content
  canvas.height = Math.max(currentY + CANVAS_CONFIG.padding, CANVAS_CONFIG.height);

  return canvas;
}

function convertComponentToGroup(
  component: StyledComponent,
  x: number,
  y: number,
  containerWidth: number,
  tokens: DesignTokens
): CanvasGroup {
  const backgroundColor = component.styles.backgroundColor || 'transparent';
  const cornerRadius = parseFloat(component.styles.borderRadius || '0');

  // Calculate component dimensions
  const padding = CANVAS_CONFIG.padding;
  const width = containerWidth - (x > 0 ? padding * 2 : 0);
  const height = calculateComponentHeight(component);

  const group: CanvasGroup = {
    id: component.id,
    x,
    y,
    width,
    height,
    children: [],
  };

  // Add background rectangle if needed
  if (backgroundColor !== 'transparent') {
    group.children.push({
      id: `${component.id}_bg`,
      x: 0,
      y: 0,
      width,
      height,
      fill: backgroundColor,
      cornerRadius: cornerRadius > 0 ? cornerRadius : CANVAS_CONFIG.defaultCornerRadius,
      stroke: CANVAS_CONFIG.defaultStroke,
      strokeWidth: 0.5,
    });
  }

  // Layout children
  if (component.children) {
    if (component.styles.flexDirection === 'row') {
      layoutChildrenHorizontally(group, component.children, tokens);
    } else {
      layoutChildrenVertically(group, component.children, tokens);
    }
  }

  return group;
}

function layoutChildrenHorizontally(
  group: CanvasGroup,
  children: (StyledComponent | StyledSection)[],
  tokens: DesignTokens
): void {
  const gap = CANVAS_CONFIG.sectionSpacing / 2;
  const availableWidth = group.width - (gap * (children.length - 1));
  const childWidth = availableWidth / children.length;

  let currentX = 0;

  children.forEach(child => {
    if ('section' in child) {
      const sectionGroup = convertSectionToGroup(child, currentX, 0, childWidth, tokens);
      group.children.push(sectionGroup);
    } else {
      const childGroup = convertComponentToGroup(child, currentX, 0, childWidth, tokens);
      group.children.push(childGroup);
    }

    currentX += childWidth + gap;
  });
}

function layoutChildrenVertically(
  group: CanvasGroup,
  children: (StyledComponent | StyledSection)[],
  tokens: DesignTokens
): void {
  const gap = CANVAS_CONFIG.sectionSpacing / 4;
  let currentY = gap;

  children.forEach(child => {
    if ('section' in child) {
      const sectionGroup = convertSectionToGroup(child, 0, currentY, group.width, tokens);
      group.children.push(sectionGroup);
      currentY += sectionGroup.height + gap;
    } else {
      const childGroup = convertComponentToGroup(child, 0, currentY, group.width, tokens);
      group.children.push(childGroup);
      currentY += childGroup.height + gap;
    }
  });
}

function convertSectionToGroup(
  section: StyledSection,
  x: number,
  y: number,
  width: number,
  tokens: DesignTokens
): CanvasGroup {
  const sectionLayout = SECTION_LAYOUTS[section.section] || { minHeight: 200, contentPadding: 16 };
  const backgroundColor = section.styles.backgroundColor || 'transparent';
  const cornerRadius = parseFloat(section.styles.borderRadius || '0');

  const group: CanvasGroup = {
    id: section.id,
    x,
    y,
    width,
    height: sectionLayout.minHeight,
    children: [],
  };

  // Add background
  if (backgroundColor !== 'transparent') {
    group.children.push({
      id: `${section.id}_bg`,
      x: 0,
      y: 0,
      width,
      height: group.height,
      fill: backgroundColor,
      cornerRadius: cornerRadius > 0 ? cornerRadius : CANVAS_CONFIG.defaultCornerRadius,
      stroke: section.styles.boxShadow !== 'none' ? CANVAS_CONFIG.defaultStroke : undefined,
      strokeWidth: section.styles.boxShadow !== 'none' ? 1 : 0,
    });
  }

  // Add section-specific visual content
  addSectionContent(group, section.section, sectionLayout.contentPadding, tokens);

  return group;
}

function addSectionContent(
  group: CanvasGroup,
  sectionType: string,
  padding: number,
  tokens: DesignTokens
): void {
  const contentWidth = group.width - padding * 2;
  const contentHeight = group.height - padding * 2;

  switch (sectionType) {
    case 'gallery':
      addGalleryContent(group, padding, contentWidth, contentHeight, tokens);
      break;
    case 'summary':
      addSummaryContent(group, padding, contentWidth, contentHeight, tokens);
      break;
    case 'price_cta':
      addPriceCTAContent(group, padding, contentWidth, contentHeight, tokens);
      break;
    case 'hero':
      addHeroContent(group, padding, contentWidth, contentHeight, tokens);
      break;
    case 'features':
      addFeaturesContent(group, padding, contentWidth, contentHeight, tokens);
      break;
    default:
      addGenericContent(group, sectionType, padding, contentWidth, contentHeight, tokens);
      break;
  }
}

function addGalleryContent(group: CanvasGroup, padding: number, width: number, height: number, tokens: DesignTokens): void {
  const imageSize = Math.min(width / 3 - 8, height - 16);
  const imageSpacing = 8;

  for (let i = 0; i < 3; i++) {
    group.children.push({
      id: `${group.id}_image_${i}`,
      x: padding + i * (imageSize + imageSpacing),
      y: padding + 8,
      width: imageSize,
      height: imageSize,
      fill: '#f3f4f6',
      stroke: '#d1d5db',
      strokeWidth: 1,
      cornerRadius: 4,
    });

    // Add image placeholder text
    group.children.push({
      id: `${group.id}_image_text_${i}`,
      x: padding + i * (imageSize + imageSpacing) + imageSize / 2,
      y: padding + 8 + imageSize / 2,
      text: `Image ${i + 1}`,
      fontSize: 12,
      fontFamily: CANVAS_CONFIG.defaultFontFamily,
      fill: '#9ca3af',
      align: 'center',
      verticalAlign: 'middle',
    });
  }
}

function addSummaryContent(group: CanvasGroup, padding: number, width: number, height: number, tokens: DesignTokens): void {
  // Title
  group.children.push({
    id: `${group.id}_title`,
    x: padding,
    y: padding + 8,
    text: 'Property Summary',
    fontSize: 20,
    fontFamily: CANVAS_CONFIG.defaultFontFamily,
    fill: CANVAS_CONFIG.headingColor,
    fontStyle: 'bold',
    width,
  });

  // Description
  group.children.push({
    id: `${group.id}_description`,
    x: padding,
    y: padding + 40,
    text: 'Beautiful modern property with stunning views and premium amenities.',
    fontSize: 14,
    fontFamily: CANVAS_CONFIG.defaultFontFamily,
    fill: CANVAS_CONFIG.textColor,
    width: width - 16,
    height: 40,
  });

  // Tags
  const tags = ['3 Bedrooms', '2 Bathrooms', 'Modern'];
  tags.forEach((tag, index) => {
    const tagWidth = tag.length * 8 + 16;
    group.children.push({
      id: `${group.id}_tag_bg_${index}`,
      x: padding + index * (tagWidth + 8),
      y: padding + 90,
      width: tagWidth,
      height: 24,
      fill: '#dbeafe',
      cornerRadius: 12,
    });

    group.children.push({
      id: `${group.id}_tag_text_${index}`,
      x: padding + index * (tagWidth + 8) + tagWidth / 2,
      y: padding + 90 + 12,
      text: tag,
      fontSize: 12,
      fontFamily: CANVAS_CONFIG.defaultFontFamily,
      fill: '#1e40af',
      align: 'center',
      verticalAlign: 'middle',
    });
  });
}

function addPriceCTAContent(group: CanvasGroup, padding: number, width: number, height: number, tokens: DesignTokens): void {
  // Price
  group.children.push({
    id: `${group.id}_price`,
    x: width / 2,
    y: padding + 20,
    text: '$299',
    fontSize: 24,
    fontFamily: CANVAS_CONFIG.defaultFontFamily,
    fill: CANVAS_CONFIG.headingColor,
    fontStyle: 'bold',
    align: 'center',
  });

  group.children.push({
    id: `${group.id}_period`,
    x: width / 2,
    y: padding + 45,
    text: '/night',
    fontSize: 14,
    fontFamily: CANVAS_CONFIG.defaultFontFamily,
    fill: '#6b7280',
    align: 'center',
  });

  // CTA Button
  const buttonWidth = width - 32;
  const buttonHeight = 36;
  group.children.push({
    id: `${group.id}_button`,
    x: padding + 16,
    y: height - buttonHeight - 16,
    width: buttonWidth,
    height: buttonHeight,
    fill: tokens.colors.primary[0] || '#2563eb',
    cornerRadius: 6,
  });

  group.children.push({
    id: `${group.id}_button_text`,
    x: width / 2,
    y: height - buttonHeight - 16 + buttonHeight / 2,
    text: 'Book Now',
    fontSize: 14,
    fontFamily: CANVAS_CONFIG.defaultFontFamily,
    fill: '#ffffff',
    fontStyle: 'bold',
    align: 'center',
    verticalAlign: 'middle',
  });
}

function addHeroContent(group: CanvasGroup, padding: number, width: number, height: number, tokens: DesignTokens): void {
  // Hero title
  group.children.push({
    id: `${group.id}_title`,
    x: width / 2,
    y: height / 2 - 40,
    text: 'Welcome',
    fontSize: 48,
    fontFamily: CANVAS_CONFIG.defaultFontFamily,
    fill: '#ffffff',
    fontStyle: 'bold',
    align: 'center',
    verticalAlign: 'middle',
  });

  // Hero subtitle
  group.children.push({
    id: `${group.id}_subtitle`,
    x: width / 2,
    y: height / 2,
    text: 'Discover amazing experiences',
    fontSize: 18,
    fontFamily: CANVAS_CONFIG.defaultFontFamily,
    fill: '#e5e7eb',
    align: 'center',
    verticalAlign: 'middle',
  });

  // CTA Button
  const buttonWidth = 140;
  const buttonHeight = 40;
  group.children.push({
    id: `${group.id}_cta`,
    x: width / 2 - buttonWidth / 2,
    y: height / 2 + 40,
    width: buttonWidth,
    height: buttonHeight,
    fill: '#ffffff',
    cornerRadius: 8,
  });

  group.children.push({
    id: `${group.id}_cta_text`,
    x: width / 2,
    y: height / 2 + 40 + buttonHeight / 2,
    text: 'Get Started',
    fontSize: 16,
    fontFamily: CANVAS_CONFIG.defaultFontFamily,
    fill: tokens.colors.primary[0] || '#2563eb',
    fontStyle: 'bold',
    align: 'center',
    verticalAlign: 'middle',
  });
}

function addFeaturesContent(group: CanvasGroup, padding: number, width: number, height: number, tokens: DesignTokens): void {
  // Title
  group.children.push({
    id: `${group.id}_title`,
    x: width / 2,
    y: padding + 20,
    text: 'Features',
    fontSize: 24,
    fontFamily: CANVAS_CONFIG.defaultFontFamily,
    fill: CANVAS_CONFIG.headingColor,
    fontStyle: 'bold',
    align: 'center',
  });

  // Feature boxes
  const featureWidth = (width - padding * 2 - 32) / 3;
  const features = ['Fast', 'Secure', 'Scalable'];

  features.forEach((feature, index) => {
    const x = padding + index * (featureWidth + 16);
    const y = padding + 60;

    // Feature box
    group.children.push({
      id: `${group.id}_feature_${index}`,
      x,
      y,
      width: featureWidth,
      height: height - 100,
      fill: '#f9fafb',
      stroke: '#e5e7eb',
      strokeWidth: 1,
      cornerRadius: 8,
    });

    // Feature icon
    group.children.push({
      id: `${group.id}_feature_icon_${index}`,
      x: x + featureWidth / 2,
      y: y + 40,
      text: ['⚡', '🛡️', '📈'][index],
      fontSize: 32,
      fontFamily: CANVAS_CONFIG.defaultFontFamily,
      fill: CANVAS_CONFIG.textColor,
      align: 'center',
    });

    // Feature title
    group.children.push({
      id: `${group.id}_feature_title_${index}`,
      x: x + featureWidth / 2,
      y: y + 90,
      text: feature,
      fontSize: 16,
      fontFamily: CANVAS_CONFIG.defaultFontFamily,
      fill: CANVAS_CONFIG.headingColor,
      fontStyle: 'bold',
      align: 'center',
    });
  });
}

function addGenericContent(group: CanvasGroup, sectionType: string, padding: number, width: number, height: number, tokens: DesignTokens): void {
  // Add generic title
  const title = sectionType.charAt(0).toUpperCase() + sectionType.slice(1).replace('_', ' ');
  group.children.push({
    id: `${group.id}_title`,
    x: padding,
    y: padding + 16,
    text: title,
    fontSize: 18,
    fontFamily: CANVAS_CONFIG.defaultFontFamily,
    fill: CANVAS_CONFIG.headingColor,
    fontStyle: 'bold',
  });

  // Add content placeholder
  group.children.push({
    id: `${group.id}_content`,
    x: padding,
    y: padding + 50,
    width: width - 32,
    height: height - 80,
    fill: '#f9fafb',
    stroke: '#e5e7eb',
    strokeWidth: 1,
    cornerRadius: 4,
  });
}

function calculateComponentHeight(component: StyledComponent): number {
  let height = CANVAS_CONFIG.padding * 2;

  if (component.children) {
    if (component.styles.flexDirection === 'row') {
      // For row layout, height is the maximum child height
      const maxChildHeight = Math.max(...component.children.map(child => {
        if ('section' in child) {
          return SECTION_LAYOUTS[child.section]?.minHeight || 200;
        } else {
          return calculateComponentHeight(child);
        }
      }));
      height = maxChildHeight;
    } else {
      // For column layout, height is sum of all children plus spacing
      component.children.forEach(child => {
        if ('section' in child) {
          height += SECTION_LAYOUTS[child.section]?.minHeight || 200;
        } else {
          height += calculateComponentHeight(child);
        }
        height += CANVAS_CONFIG.sectionSpacing / 4;
      });
    }
  }

  return Math.max(height, 100);
}

function generateSVG(canvas: CanvasLayout): string {
  let svg = `<svg width="${canvas.width}" height="${canvas.height}" xmlns="http://www.w3.org/2000/svg">`;
  svg += `<rect width="100%" height="100%" fill="${canvas.background}"/>`;

  canvas.elements.forEach(element => {
    svg += generateSVGElement(element);
  });

  svg += '</svg>';
  return svg;
}

function generateSVGElement(element: CanvasRect | CanvasText | CanvasGroup, offsetX = 0, offsetY = 0): string {
  const x = element.x + offsetX;
  const y = element.y + offsetY;

  if ('text' in element) {
    // Text element
    const textAlign = element.align === 'center' ? 'middle' : element.align || 'start';
    const verticalAlign = element.verticalAlign === 'middle' ? 'central' : 'baseline';

    return `<text x="${x}" y="${y}" font-size="${element.fontSize}" font-family="${element.fontFamily}" ` +
           `fill="${element.fill}" text-anchor="${textAlign}" dominant-baseline="${verticalAlign}" ` +
           `${element.fontStyle === 'bold' ? 'font-weight="bold"' : ''}>${element.text}</text>`;
  } else if ('children' in element) {
    // Group element
    let groupSVG = `<g transform="translate(${x}, ${y})">`;
    element.children.forEach(child => {
      groupSVG += generateSVGElement(child, 0, 0);
    });
    groupSVG += '</g>';
    return groupSVG;
  } else {
    // Rectangle element
    const strokeAttr = element.stroke ? `stroke="${element.stroke}"` : '';
    const strokeWidthAttr = element.strokeWidth ? `stroke-width="${element.strokeWidth}"` : '';
    const opacityAttr = element.opacity ? `opacity="${element.opacity}"` : '';
    const cornerRadius = element.cornerRadius ? `rx="${element.cornerRadius}" ry="${element.cornerRadius}"` : '';

    return `<rect x="${x}" y="${y}" width="${element.width}" height="${element.height}" ` +
           `fill="${element.fill || 'none'}" ${strokeAttr} ${strokeWidthAttr} ${opacityAttr} ${cornerRadius}/>`;
  }
}

function countElements(elements: (CanvasRect | CanvasText | CanvasGroup)[]): number {
  let count = 0;

  elements.forEach(element => {
    count++;
    if ('children' in element) {
      count += countElements(element.children);
    }
  });

  return count;
}