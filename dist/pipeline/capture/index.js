"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.capture = capture;
const playwright_1 = require("playwright");
const promises_1 = require("fs/promises");
const path_1 = require("path");
const uuid_1 = require("uuid");
async function capture(url, outputDir) {
    const runId = generateRunId();
    const baseDir = outputDir || (0, path_1.join)(process.cwd(), 'artifacts');
    const artifactDir = (0, path_1.join)(baseDir, runId);
    const rawDir = (0, path_1.join)(artifactDir, 'raw');
    await (0, promises_1.mkdir)(rawDir, { recursive: true });
    let browser = null;
    try {
        browser = await playwright_1.chromium.launch({
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
            const nodes = [];
            const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT, null);
            let element = walker.currentNode;
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
                element = walker.nextNode();
            }
            return nodes;
        });
        // Take screenshot
        const screenshotPath = (0, path_1.join)(rawDir, 'page.png');
        await page.screenshot({
            path: screenshotPath,
            fullPage: true,
            type: 'png',
        });
        // Get metadata
        const title = await page.title();
        const userAgent = await page.evaluate(() => navigator.userAgent);
        const meta = {
            url,
            viewport: { width: 1280, height: 720 },
            timestamp: new Date().toISOString(),
            userAgent,
            title,
        };
        // Save artifacts
        await Promise.all([
            (0, promises_1.writeFile)((0, path_1.join)(rawDir, 'dom.html'), html, 'utf8'),
            (0, promises_1.writeFile)((0, path_1.join)(rawDir, 'computed_styles.json'), JSON.stringify(styles, null, 2), 'utf8'),
            (0, promises_1.writeFile)((0, path_1.join)(rawDir, 'meta.json'), JSON.stringify(meta, null, 2), 'utf8'),
        ]);
        const result = {
            runId,
            artifacts: {
                html,
                styles,
                screenshot: screenshotPath,
                meta,
            },
        };
        return result;
    }
    finally {
        if (browser) {
            await browser.close();
        }
    }
}
function generateRunId() {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const uuid = (0, uuid_1.v4)().slice(0, 8);
    return `${timestamp}_${uuid}`;
}
//# sourceMappingURL=index.js.map