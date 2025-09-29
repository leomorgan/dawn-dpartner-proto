"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.capture = capture;
const playwright_1 = require("playwright");
const promises_1 = require("fs/promises");
const path_1 = require("path");
const uuid_1 = require("uuid");
async function handleCookieBanners(page) {
    console.log('🍪 Detecting and handling cookie banners...');
    try {
        // Wait a moment for any dynamic banners to appear
        await page.waitForTimeout(2000);
        // Comprehensive selectors for cookie banners and consent modals
        const cookieBannerSelectors = [
            // Common cookie banner button text patterns (case-insensitive)
            'button:has-text("Accept")',
            'button:has-text("Accept All")',
            'button:has-text("Accept all")',
            'button:has-text("ACCEPT")',
            'button:has-text("I Accept")',
            'button:has-text("Agree")',
            'button:has-text("I Agree")',
            'button:has-text("OK")',
            'button:has-text("Got it")',
            'button:has-text("Continue")',
            'button:has-text("Allow")',
            'button:has-text("Allow All")',
            'button:has-text("Accept Cookies")',
            'button:has-text("Accept & Close")',
            'button:has-text("Understood")',
            // Common ID and class patterns
            '#accept-cookies',
            '#cookie-accept',
            '#cookieAccept',
            '#accept-all',
            '#acceptAll',
            '.accept-cookies',
            '.cookie-accept',
            '.accept-all',
            '.accept-btn',
            '.cookie-consent-accept',
            '.gdpr-accept',
            '[data-testid="accept"]',
            '[data-testid="accept-all"]',
            '[data-testid="cookie-accept"]',
            '[data-cy="accept"]',
            '[data-cy="accept-cookies"]',
            // OneTrust (very common)
            '#onetrust-accept-btn-handler',
            '.ot-sdk-row .ot-sdk-column button',
            '.onetrust-accept-btn-handler',
            // Cookiebot
            '#CybotCookiebotDialogBodyLevelButtonLevelOptinAllowAll',
            '.CybotCookiebotDialogBodyButton',
            // TrustArc
            '#truste-consent-button',
            '.truste-button1',
            // Osano
            '.osano-cm-accept-all',
            '.osano-cm-accept',
            // Quantcast Choice
            '.qc-cmp-button',
            '.qc-cmp-accept-all',
            // Didomi
            '.didomi-continue-without-agreeing',
            '.didomi-button-standard',
            // ConsentManager
            '.consent-manager-accept',
            '.consent-accept-all',
            // Common generic patterns
            '[aria-label*="accept" i]',
            '[aria-label*="cookies" i]',
            '[title*="accept" i]',
            '[alt*="accept" i]',
            // Close/dismiss buttons for modals
            'button:has-text("×")',
            'button:has-text("Close")',
            '[aria-label="Close"]',
            '.close-modal',
            '.modal-close',
            '.popup-close'
        ];
        // Try each selector and click the first one found
        let bannerDismissed = false;
        for (const selector of cookieBannerSelectors) {
            try {
                const element = await page.locator(selector).first();
                if (await element.isVisible({ timeout: 1000 })) {
                    console.log(`✅ Found cookie banner with selector: ${selector}`);
                    await element.click({ timeout: 2000 });
                    console.log('✅ Clicked cookie banner button');
                    bannerDismissed = true;
                    // Wait for banner to disappear
                    await page.waitForTimeout(1000);
                    break;
                }
            }
            catch (error) {
                // Continue to next selector if this one fails
                continue;
            }
        }
        // Additional strategy: Look for common overlay/modal patterns and try to dismiss
        if (!bannerDismissed) {
            const overlaySelectors = [
                '.overlay:visible',
                '.modal:visible',
                '.popup:visible',
                '[role="dialog"]:visible',
                '[role="alertdialog"]:visible',
                '.cookie-banner:visible',
                '.consent-banner:visible'
            ];
            for (const overlaySelector of overlaySelectors) {
                try {
                    const overlay = await page.locator(overlaySelector).first();
                    if (await overlay.isVisible({ timeout: 500 })) {
                        // Try to find accept/ok button within overlay
                        const acceptInOverlay = overlay.locator('button:has-text("Accept"), button:has-text("OK"), button:has-text("Continue")').first();
                        if (await acceptInOverlay.isVisible({ timeout: 500 })) {
                            await acceptInOverlay.click();
                            console.log(`✅ Dismissed overlay with ${overlaySelector}`);
                            bannerDismissed = true;
                            break;
                        }
                    }
                }
                catch (error) {
                    continue;
                }
            }
        }
        // Last resort: Press Escape key to close modals
        if (!bannerDismissed) {
            try {
                await page.keyboard.press('Escape');
                await page.waitForTimeout(500);
                console.log('📱 Attempted to dismiss banners with Escape key');
            }
            catch (error) {
                // Ignore escape key errors
            }
        }
        if (bannerDismissed) {
            console.log('✅ Cookie banner handled successfully');
            // Extra wait for any animations/transitions to complete
            await page.waitForTimeout(1500);
        }
        else {
            console.log('⚠️  No cookie banner detected or unable to dismiss');
        }
    }
    catch (error) {
        console.log('⚠️  Error handling cookie banners:', error);
        // Don't throw - continue with capture even if banner handling fails
    }
}
async function capture(url, outputDir, runId) {
    const actualRunId = runId || generateRunId(url);
    const baseDir = outputDir || (0, path_1.join)(process.cwd(), 'artifacts');
    const artifactDir = (0, path_1.join)(baseDir, actualRunId);
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
        // Handle cookie banners and consent modals
        await handleCookieBanners(page);
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
        // Wait a bit for layout to stabilize after banner dismissal
        await page.waitForTimeout(1000);
        // Extract HTML
        const html = await page.content();
        // Extract all CSS rules for hover detection
        const cssRules = await page.evaluate(() => {
            const rules = [];
            // Extract rules from all stylesheets
            for (const stylesheet of Array.from(document.styleSheets)) {
                try {
                    if (stylesheet.cssRules) {
                        for (const rule of Array.from(stylesheet.cssRules)) {
                            if (rule instanceof CSSStyleRule && rule.selectorText?.includes(':hover')) {
                                rules.push({
                                    selector: rule.selectorText,
                                    styles: Array.from(rule.style).reduce((acc, prop) => {
                                        acc[prop] = rule.style.getPropertyValue(prop);
                                        return acc;
                                    }, {})
                                });
                            }
                        }
                    }
                }
                catch (e) {
                    // Skip cross-origin stylesheets
                    console.warn('Could not access stylesheet:', e);
                }
            }
            return rules;
        });
        // Extract button hover states by using Playwright's hover functionality
        console.log('🎯 Capturing button hover states...');
        const buttonHoverStates = [];
        // Get button elements for hover testing (including CTA-style anchor tags)
        const buttonLocators = await page.locator('button, a[role="button"], input[type="button"], input[type="submit"], a[class*="button" i], a[class*="btn" i], a[class*="cta" i]').all();
        // Time limit for hover capture (30 seconds max)
        const hoverStartTime = Date.now();
        const maxHoverTime = 30000; // 30 seconds
        for (let i = 0; i < Math.min(buttonLocators.length, 25); i++) { // Limit to first 25 buttons
            // Check time limit
            if (Date.now() - hoverStartTime > maxHoverTime) {
                console.log(`⏰ Hover capture time limit reached, stopping at button ${i + 1}`);
                break;
            }
            const button = buttonLocators[i];
            try {
                // Check if button is visible
                if (!(await button.isVisible()))
                    continue;
                // Phase 1.3: Enhanced hover state capture with more properties
                const getAdvancedStyles = (el) => {
                    const styles = getComputedStyle(el);
                    return {
                        backgroundColor: styles.backgroundColor,
                        color: styles.color,
                        opacity: styles.opacity,
                        transform: styles.transform,
                        borderColor: styles.borderColor,
                        boxShadow: styles.boxShadow,
                        // Phase 1.3: Add more properties for comprehensive capture
                        scale: styles.scale || 'none',
                        filter: styles.filter,
                        transition: styles.transition,
                        cursor: styles.cursor
                    };
                };
                // Get normal state
                const normalStyles = await button.evaluate(getAdvancedStyles);
                const className = await button.getAttribute('class') || '';
                // Phase 1.3: Multi-state capture with proper timing
                await button.hover({ timeout: 2000 });
                // Phase 1.3: Multiple snapshots during transition for comprehensive capture
                const snapshots = [];
                for (const delay of [0, 150, 300]) {
                    await page.waitForTimeout(delay);
                    const snapshot = await button.evaluate(getAdvancedStyles);
                    snapshots.push(snapshot);
                }
                // Use the final snapshot as the hover state (most complete transition)
                const hoverStyles = snapshots[snapshots.length - 1];
                // Check if hover state is different
                let hasChanges = false;
                for (const prop in hoverStyles) {
                    if (hoverStyles[prop] !== normalStyles[prop]) {
                        hasChanges = true;
                        break;
                    }
                }
                if (hasChanges) {
                    buttonHoverStates.push({
                        selector: 'button' + (className ? '.' + className.trim().split(/\s+/).join('.') : ''),
                        className,
                        normalStyles,
                        hoverStyles
                    });
                    console.log(`✅ Found hover effect for button ${i + 1}`);
                }
                // Move mouse away to reset hover state
                await page.mouse.move(0, 0);
            }
            catch (e) {
                console.warn(`⚠️  Error capturing hover for button ${i + 1}:`, e);
            }
        }
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
                                fontWeight: computed.fontWeight,
                                lineHeight: computed.lineHeight,
                                borderRadius: computed.borderRadius,
                                border: `${computed.borderWidth} ${computed.borderStyle} ${computed.borderColor}`,
                                boxShadow: computed.boxShadow,
                                margin: `${computed.marginTop} ${computed.marginRight} ${computed.marginBottom} ${computed.marginLeft}`,
                                padding: `${computed.paddingTop} ${computed.paddingRight} ${computed.paddingBottom} ${computed.paddingLeft}`,
                                display: computed.display,
                                alignItems: computed.alignItems,
                                justifyContent: computed.justifyContent,
                                textAlign: computed.textAlign,
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
            (0, promises_1.writeFile)((0, path_1.join)(rawDir, 'css_rules.json'), JSON.stringify(cssRules, null, 2), 'utf8'),
            (0, promises_1.writeFile)((0, path_1.join)(rawDir, 'button_hover_states.json'), JSON.stringify(buttonHoverStates, null, 2), 'utf8'),
            (0, promises_1.writeFile)((0, path_1.join)(rawDir, 'meta.json'), JSON.stringify(meta, null, 2), 'utf8'),
        ]);
        const result = {
            runId: actualRunId,
            artifacts: {
                html,
                styles,
                cssRules,
                buttonHoverStates,
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
function generateRunId(url) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const uuid = (0, uuid_1.v4)().slice(0, 8);
    if (url) {
        const urlSuffix = createUrlSuffix(url);
        return `${timestamp}_${uuid}_${urlSuffix}`;
    }
    return `${timestamp}_${uuid}`;
}
function createUrlSuffix(url) {
    try {
        const urlObj = new URL(url);
        // Extract hostname and remove 'www.' if present
        const hostname = urlObj.hostname.replace(/^www\./, '');
        // Convert to safe directory name: replace dots and special chars with dashes
        return hostname.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
    }
    catch {
        // Fallback for invalid URLs
        return url.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase().substring(0, 20);
    }
}
//# sourceMappingURL=index.js.map