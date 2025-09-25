import { readFile, writeFile } from 'fs/promises';
import { join } from 'path';
import type { Intent, SectionType } from '../intent';
import type { DesignTokens } from '../tokens';

export interface LayoutArea {
  section: SectionType;
  cols: number;
  minHeight?: number;
  content?: string;
}

export interface LayoutStack {
  id: string;
  direction: 'row' | 'column';
  gap: number;
  areas: (LayoutArea | LayoutStack)[];
  justify?: 'start' | 'center' | 'end' | 'between' | 'around';
  align?: 'start' | 'center' | 'end' | 'stretch';
}

export interface Layout {
  frame: {
    width: number;
    maxWidth: number;
    padding: number;
  };
  grid: {
    columns: number;
    gutter: number;
  };
  stacks: LayoutStack[];
  sections: Record<SectionType, {
    minWidth: number;
    minHeight: number;
    preferredCols: number;
  }>;
}

export interface LayoutResult {
  runId: string;
  layout: Layout;
  sections: SectionType[];
  constraints: {
    satisfied: number;
    total: number;
    violations: string[];
  };
}

const SECTION_SPECS = {
  // Detail page sections
  gallery: { minWidth: 400, minHeight: 300, preferredCols: 7 },
  summary: { minWidth: 300, minHeight: 200, preferredCols: 5 },
  price_cta: { minWidth: 280, minHeight: 120, preferredCols: 4 },
  amenities: { minWidth: 600, minHeight: 200, preferredCols: 12 },
  reviews: { minWidth: 600, minHeight: 300, preferredCols: 12 },
  trust_signals: { minWidth: 200, minHeight: 80, preferredCols: 3 },

  // Generic sections
  hero: { minWidth: 800, minHeight: 400, preferredCols: 12 },
  features: { minWidth: 900, minHeight: 400, preferredCols: 12 },
  testimonials: { minWidth: 800, minHeight: 300, preferredCols: 12 },
  faq: { minWidth: 600, minHeight: 400, preferredCols: 8 },
  contact: { minWidth: 400, minHeight: 300, preferredCols: 6 },

  // Profile sections
  avatar: { minWidth: 200, minHeight: 200, preferredCols: 3 },
  bio: { minWidth: 400, minHeight: 150, preferredCols: 6 },
  experience: { minWidth: 500, minHeight: 300, preferredCols: 8 },
  portfolio: { minWidth: 600, minHeight: 400, preferredCols: 9 },
  social_links: { minWidth: 300, minHeight: 60, preferredCols: 4 },
} as const;

const LAYOUT_TEMPLATES: Record<string, (sections: SectionType[]) => LayoutStack[]> = {
  detail: (sections: SectionType[]) => {
    const stacks: LayoutStack[] = [];

    // Hero section (if present)
    if (sections.includes('hero')) {
      stacks.push({
        id: 'hero_section',
        direction: 'column',
        gap: 24,
        areas: [{ section: 'hero', cols: 12 }],
        justify: 'center',
        align: 'center'
      });
    }

    // Main content: Gallery + Summary/Price
    const mainContentAreas: LayoutArea[] = [];
    if (sections.includes('gallery')) {
      mainContentAreas.push({ section: 'gallery', cols: 7 });
    }

    // Summary and price in sidebar
    const sidebarAreas: LayoutArea[] = [];
    if (sections.includes('summary')) {
      sidebarAreas.push({ section: 'summary', cols: 5 });
    }
    if (sections.includes('price_cta')) {
      sidebarAreas.push({ section: 'price_cta', cols: 5, minHeight: 120 });
    }
    if (sections.includes('trust_signals')) {
      sidebarAreas.push({ section: 'trust_signals', cols: 5 });
    }

    if (mainContentAreas.length > 0 || sidebarAreas.length > 0) {
      const mainAreas: (LayoutArea | LayoutStack)[] = [];

      if (mainContentAreas.length > 0) {
        mainAreas.push(...mainContentAreas);
      }

      if (sidebarAreas.length > 0) {
        mainAreas.push({
          id: 'sidebar',
          direction: 'column',
          gap: 16,
          areas: sidebarAreas,
          align: 'stretch'
        });
      }

      stacks.push({
        id: 'main_content',
        direction: 'row',
        gap: 32,
        areas: mainAreas,
        align: 'start'
      });
    }

    // Additional sections below
    const belowSections = sections.filter(s =>
      !['hero', 'gallery', 'summary', 'price_cta', 'trust_signals'].includes(s)
    );

    for (const section of belowSections) {
      stacks.push({
        id: `${section}_section`,
        direction: 'column',
        gap: 24,
        areas: [{ section, cols: SECTION_SPECS[section]?.preferredCols || 12 }],
      });
    }

    return stacks;
  },

  list: (sections: SectionType[]) => {
    const stacks: LayoutStack[] = [];

    // Hero section
    if (sections.includes('hero')) {
      stacks.push({
        id: 'hero_section',
        direction: 'column',
        gap: 24,
        areas: [{ section: 'hero', cols: 12 }],
        justify: 'center',
        align: 'center'
      });
    }

    // Features in grid
    if (sections.includes('features')) {
      stacks.push({
        id: 'features_section',
        direction: 'column',
        gap: 32,
        areas: [{ section: 'features', cols: 12 }],
      });
    }

    // Other sections
    const otherSections = sections.filter(s => !['hero', 'features'].includes(s));
    for (const section of otherSections) {
      stacks.push({
        id: `${section}_section`,
        direction: 'column',
        gap: 24,
        areas: [{ section, cols: SECTION_SPECS[section]?.preferredCols || 12 }],
      });
    }

    return stacks;
  },

  profile: (sections: SectionType[]) => {
    const stacks: LayoutStack[] = [];

    // Header with avatar and bio
    const headerAreas: LayoutArea[] = [];
    if (sections.includes('avatar')) {
      headerAreas.push({ section: 'avatar', cols: 3 });
    }
    if (sections.includes('bio')) {
      headerAreas.push({ section: 'bio', cols: 9 });
    }

    if (headerAreas.length > 0) {
      stacks.push({
        id: 'profile_header',
        direction: 'row',
        gap: 32,
        areas: headerAreas,
        align: 'center'
      });
    }

    // Portfolio and experience
    if (sections.includes('portfolio')) {
      stacks.push({
        id: 'portfolio_section',
        direction: 'column',
        gap: 24,
        areas: [{ section: 'portfolio', cols: 12 }],
      });
    }

    if (sections.includes('experience')) {
      stacks.push({
        id: 'experience_section',
        direction: 'column',
        gap: 24,
        areas: [{ section: 'experience', cols: 10 }],
        justify: 'center'
      });
    }

    // Social links
    if (sections.includes('social_links')) {
      stacks.push({
        id: 'social_section',
        direction: 'column',
        gap: 16,
        areas: [{ section: 'social_links', cols: 6 }],
        justify: 'center',
        align: 'center'
      });
    }

    return stacks;
  }
};

export async function synthesizeLayout(runId: string, artifactDir?: string): Promise<LayoutResult> {
  const baseDir = artifactDir || join(process.cwd(), 'artifacts');
  const runDir = join(baseDir, runId);

  // Read intent and design tokens
  const [intentContent, tokensContent] = await Promise.all([
    readFile(join(runDir, 'intent.json'), 'utf8'),
    readFile(join(runDir, 'design_tokens.json'), 'utf8'),
  ]);

  const intent: Intent = JSON.parse(intentContent);
  const tokens: DesignTokens = JSON.parse(tokensContent);

  // Select appropriate gap from design tokens
  const availableGaps = tokens.spacing.filter(s => s >= 8 && s <= 48);
  const defaultGap = availableGaps[Math.floor(availableGaps.length / 2)] || 24;

  // Generate layout using template
  const template = LAYOUT_TEMPLATES[intent.page_type] || LAYOUT_TEMPLATES.detail;
  const stacks = template(intent.required_sections);

  // Apply design token gaps to stacks
  const adjustedStacks = stacks.map(stack => ({
    ...stack,
    gap: findClosestGap(stack.gap, availableGaps) || defaultGap
  }));

  const layout: Layout = {
    frame: {
      width: 1280,
      maxWidth: 1280,
      padding: 24,
    },
    grid: {
      columns: 12,
      gutter: 24,
    },
    stacks: adjustedStacks,
    sections: { ...SECTION_SPECS }
  };

  // Validate constraints
  const constraints = validateConstraints(layout, intent.required_sections);

  // Save layout
  await writeFile(join(runDir, 'layout.json'), JSON.stringify(layout, null, 2));

  return {
    runId,
    layout,
    sections: intent.required_sections,
    constraints,
  };
}

function findClosestGap(targetGap: number, availableGaps: number[]): number | null {
  if (availableGaps.length === 0) return null;

  return availableGaps.reduce((closest, gap) => {
    return Math.abs(gap - targetGap) < Math.abs(closest - targetGap) ? gap : closest;
  });
}

function validateConstraints(layout: Layout, requiredSections: SectionType[]): LayoutResult['constraints'] {
  const violations: string[] = [];
  let satisfied = 0;
  let total = 0;

  // Check that all required sections are present
  const presentSections = extractSectionsFromStacks(layout.stacks);
  for (const section of requiredSections) {
    total++;
    if (presentSections.includes(section)) {
      satisfied++;
    } else {
      violations.push(`Missing required section: ${section}`);
    }
  }

  // Check minimum width constraints
  for (const stack of layout.stacks) {
    const stackViolations = validateStackConstraints(stack, layout);
    violations.push(...stackViolations);
    total += 1; // Each stack should satisfy constraints
    if (stackViolations.length === 0) satisfied++;
  }

  // Check that gaps are within design token set
  for (const stack of layout.stacks) {
    total++;
    // This is a simplified check - in practice we'd verify against actual tokens
    if (stack.gap >= 8 && stack.gap <= 48 && stack.gap % 8 === 0) {
      satisfied++;
    } else {
      violations.push(`Gap ${stack.gap} not in token set for stack ${stack.id}`);
    }
  }

  return {
    satisfied,
    total,
    violations,
  };
}

function extractSectionsFromStacks(stacks: LayoutStack[]): SectionType[] {
  const sections: SectionType[] = [];

  function traverse(areas: (LayoutArea | LayoutStack)[]) {
    for (const area of areas) {
      if ('section' in area) {
        sections.push(area.section);
      } else {
        traverse(area.areas);
      }
    }
  }

  for (const stack of stacks) {
    traverse(stack.areas);
  }

  return sections;
}

function validateStackConstraints(stack: LayoutStack, layout: Layout): string[] {
  const violations: string[] = [];
  const colWidth = (layout.frame.width - layout.frame.padding * 2) / layout.grid.columns;

  for (const area of stack.areas) {
    if ('section' in area) {
      const specs = SECTION_SPECS[area.section];
      if (specs) {
        const areaWidth = area.cols * colWidth;

        if (areaWidth < specs.minWidth) {
          violations.push(`${area.section} width ${areaWidth}px < minimum ${specs.minWidth}px`);
        }

        if (area.minHeight && area.minHeight < specs.minHeight) {
          violations.push(`${area.section} height ${area.minHeight}px < minimum ${specs.minHeight}px`);
        }
      }
    } else {
      // Recursive check for nested stacks
      const nestedViolations = validateStackConstraints(area, layout);
      violations.push(...nestedViolations);
    }
  }

  return violations;
}