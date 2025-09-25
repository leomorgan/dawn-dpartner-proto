import { chromium, Browser, Page } from 'playwright';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { v4 as uuidv4 } from 'uuid';

export interface CaptureResult {
  runId: string;
  artifacts: {
    html: string;
    styles: ComputedStyleNode[];
    screenshot: string;
    meta: CaptureMetadata;
  };
}

export interface ComputedStyleNode {
  id: string;
  tag: string;
  bbox: {
    x: number;
    y: number;
    w: number;
    h: number;
  };
  styles: {
    color: string;
    backgroundColor: string;
    fontFamily: string;
    fontSize: string;
    lineHeight: string;
    borderRadius: string;
    boxShadow: string;
    margin: string;
    padding: string;
  };
  role?: string;
  className?: string;
  textContent?: string;
}

export interface CaptureMetadata {
  url: string;
  viewport: {
    width: number;
    height: number;
  };
  timestamp: string;
  userAgent: string;
  title: string;
}

export async function capture(url: string, outputDir?: string): Promise<CaptureResult> {
  const runId = generateRunId();
  const baseDir = outputDir || join(process.cwd(), 'artifacts');
  const artifactDir = join(baseDir, runId);
  const rawDir = join(artifactDir, 'raw');

  await mkdir(rawDir, { recursive: true });

  let browser: Browser | null = null;

  try {
    browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage({
      viewport: { width: 1280, height: 720 },
      deviceScaleFactor: 1,
    });

    // Navigate and wait for content
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });

    // Disable animations and transitions for consistent capture
    await page.addStyleTag({
      content: `
        *, *::before, *::after {
          animation-duration: 0s !important;
          animation-delay: 0s !important;
          transition-duration: 0s !important;
          transition-delay: 0s !important;
        }
      `
    });

    // Wait a bit for layout to stabilize
    await page.waitForTimeout(300);

    // Extract HTML
    const html = await page.content();

    // Extract computed styles for visible elements
    const styles = await page.evaluate(() => {
      const nodes: ComputedStyleNode[] = [];
      const walker = document.createTreeWalker(
        document.body,
        NodeFilter.SHOW_ELEMENT,
        null
      );

      let element = walker.currentNode as Element;
      let nodeIndex = 0;

      while (element) {
        if (element instanceof HTMLElement) {
          const rect = element.getBoundingClientRect();

          // Only capture visible elements
          if (rect.width > 0 && rect.height > 0) {
            const computed = getComputedStyle(element);

            nodes.push({
              id: `node_${nodeIndex}`,
              tag: element.tagName.toLowerCase(),
              bbox: {
                x: Math.round(rect.x),
                y: Math.round(rect.y),
                w: Math.round(rect.width),
                h: Math.round(rect.height),
              },
              styles: {
                color: computed.color,
                backgroundColor: computed.backgroundColor,
                fontFamily: computed.fontFamily,
                fontSize: computed.fontSize,
                lineHeight: computed.lineHeight,
                borderRadius: computed.borderRadius,
                boxShadow: computed.boxShadow,
                margin: `${computed.marginTop} ${computed.marginRight} ${computed.marginBottom} ${computed.marginLeft}`,
                padding: `${computed.paddingTop} ${computed.paddingRight} ${computed.paddingBottom} ${computed.paddingLeft}`,
              },
              role: element.getAttribute('role') || undefined,
              className: element.className || undefined,
              textContent: element.textContent?.slice(0, 100) || undefined,
            });

            nodeIndex++;
          }
        }

        element = walker.nextNode() as Element;
      }

      return nodes;
    });

    // Take screenshot
    const screenshotPath = join(rawDir, 'page.png');
    await page.screenshot({
      path: screenshotPath,
      fullPage: true,
      type: 'png',
    });

    // Get metadata
    const title = await page.title();
    const userAgent = await page.evaluate(() => navigator.userAgent);

    const meta: CaptureMetadata = {
      url,
      viewport: { width: 1280, height: 720 },
      timestamp: new Date().toISOString(),
      userAgent,
      title,
    };

    // Save artifacts
    await Promise.all([
      writeFile(join(rawDir, 'dom.html'), html, 'utf8'),
      writeFile(join(rawDir, 'computed_styles.json'), JSON.stringify(styles, null, 2), 'utf8'),
      writeFile(join(rawDir, 'meta.json'), JSON.stringify(meta, null, 2), 'utf8'),
    ]);

    const result: CaptureResult = {
      runId,
      artifacts: {
        html,
        styles,
        screenshot: screenshotPath,
        meta,
      },
    };

    return result;

  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

function generateRunId(): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const uuid = uuidv4().slice(0, 8);
  return `${timestamp}_${uuid}`;
}