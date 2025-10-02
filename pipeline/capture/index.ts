import { chromium, Browser, Page } from 'playwright';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { v4 as uuidv4 } from 'uuid';

export interface CaptureResult {
  runId: string;
  artifacts: {
    html: string;
    styles: ComputedStyleNode[];
    cssRules: CSSRuleData[];
    buttonHoverStates: ButtonHoverState[];
    screenshot: string;
    meta: CaptureMetadata;
  };
}

export interface CSSRuleData {
  selector: string;
  styles: Record<string, string>;
}

export interface ButtonHoverState {
  selector: string;
  className: string;
  normalStyles: {
    backgroundColor: string;
    color: string;
    opacity: string;
    transform: string;
    borderColor: string;
    boxShadow: string;
    // Phase 1.3: Enhanced properties for comprehensive hover capture
    scale: string;
    filter: string;
    transition: string;
    cursor: string;
  };
  hoverStyles: {
    backgroundColor: string;
    color: string;
    opacity: string;
    transform: string;
    borderColor: string;
    boxShadow: string;
    // Phase 1.3: Enhanced properties for comprehensive hover capture
    scale: string;
    filter: string;
    transition: string;
    cursor: string;
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
    fontWeight: string;
    lineHeight: string;
    borderRadius: string;
    border: string;
    boxShadow: string;
    margin: string;
    padding: string;
    display: string;
    alignItems: string;
    justifyContent: string;
    textAlign: string;
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

async function handleCookieBanners(page: Page): Promise<void> {
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
      } catch (error) {
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
        } catch (error) {
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
      } catch (error) {
        // Ignore escape key errors
      }
    }

    if (bannerDismissed) {
      console.log('✅ Cookie banner handled successfully');
      // Extra wait for any animations/transitions to complete
      await page.waitForTimeout(1500);
    } else {
      console.log('⚠️  No cookie banner detected or unable to dismiss');
    }

  } catch (error) {
    console.log('⚠️  Error handling cookie banners:', error);
    // Don't throw - continue with capture even if banner handling fails
  }
}

export async function capture(url: string, outputDir?: string, runId?: string): Promise<CaptureResult> {
  const actualRunId = runId || generateRunId(url);
  const baseDir = outputDir || join(process.cwd(), 'artifacts');
  const artifactDir = join(baseDir, actualRunId);
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
      const rules: any[] = [];

      // Extract rules from all stylesheets
      for (const stylesheet of Array.from(document.styleSheets)) {
        try {
          if (stylesheet.cssRules) {
            for (const rule of Array.from(stylesheet.cssRules)) {
              if (rule instanceof CSSStyleRule && rule.selectorText?.includes(':hover')) {
                rules.push({
                  selector: rule.selectorText,
                  styles: Array.from(rule.style).reduce((acc: any, prop) => {
                    acc[prop] = rule.style.getPropertyValue(prop);
                    return acc;
                  }, {})
                });
              }
            }
          }
        } catch (e) {
          // Skip cross-origin stylesheets
          console.warn('Could not access stylesheet:', e);
        }
      }

      return rules;
    });

    // Extract button hover states using physical mouse hover
    console.log('🎯 Capturing button hover states using physical hover...');
    const buttonHoverStates: Array<{
      selector: string;
      className: string;
      normalStyles: any;
      hoverStyles: any;
    }> = [];

    // No CDP session needed for physical hover

    // Get button elements for hover testing (including CTA-style anchor tags)
    const buttonLocators = await page.locator('button, a[role="button"], input[type="button"], input[type="submit"], a[class*="button" i], a[class*="btn" i], a[class*="cta" i]').all();

    console.log(`📊 Found ${buttonLocators.length} potential buttons to analyze`);

    // Time limit for hover capture (45 seconds max)
    const hoverStartTime = Date.now();
    const maxHoverTime = 45000; // 45 seconds

    for (let i = 0; i < Math.min(buttonLocators.length, 30); i++) { // Increased to 30 buttons
      // Check time limit
      if (Date.now() - hoverStartTime > maxHoverTime) {
        console.log(`⏰ Hover capture time limit reached, stopping at button ${i + 1}`);
        break;
      }
      const button = buttonLocators[i];

      try {
        // Log first 10 buttons to see what we're testing (before visibility check)
        if (i < 10) {
          const tagName = await button.evaluate(el => el.tagName);
          const classList = await button.getAttribute('class');
          const text = await button.evaluate(el => el.textContent?.trim().substring(0, 30));
          const visible = await button.isVisible();
          console.log(`🔍 Button ${i + 1}: <${tagName}> "${text}" visible=${visible}`);
        }

        // Check if button is visible
        if (!(await button.isVisible())) continue;

        // Helper to get computed styles
        const getAdvancedStyles = (el: Element) => {
          const styles = getComputedStyle(el);
          const beforeStyles = getComputedStyle(el, '::before');
          const afterStyles = getComputedStyle(el, '::after');

          return {
            backgroundColor: styles.backgroundColor,
            color: styles.color,
            opacity: styles.opacity,
            transform: styles.transform,
            borderColor: styles.borderColor,
            boxShadow: styles.boxShadow,
            scale: styles.scale || 'none',
            filter: styles.filter,
            transition: styles.transition,
            cursor: styles.cursor,
            // Check pseudo-elements for hover effects
            beforeBg: beforeStyles.backgroundColor,
            beforeOpacity: beforeStyles.opacity,
            afterBg: afterStyles.backgroundColor,
            afterOpacity: afterStyles.opacity
          };
        };

        // Get normal state
        const normalStyles = await button.evaluate(getAdvancedStyles);
        const className = await button.getAttribute('class') || '';

        // PHYSICAL HOVER: Simulate actual mouse hover
        try {
          let hoverStyles = normalStyles;

          // Hover over the button
          await button.hover({ timeout: 3000 });

          // Wait for hover animations/transitions (extra time for CSS-in-JS sites)
          await page.waitForTimeout(500);

          // Read hover state
          hoverStyles = await button.evaluate(getAdvancedStyles);

          // Move mouse away
          await page.mouse.move(0, 0);
          await page.waitForTimeout(100);

          // Check if hover state is different
          let hasChanges = false;
          for (const prop in hoverStyles) {
            if (hoverStyles[prop as keyof typeof hoverStyles] !== normalStyles[prop as keyof typeof normalStyles]) {
              hasChanges = true;
              break;
            }
          }

          if (hasChanges) {
            // Log changes for debugging
            const changes = [];
            if (normalStyles.backgroundColor !== hoverStyles.backgroundColor) {
              changes.push(`bg: ${normalStyles.backgroundColor} → ${hoverStyles.backgroundColor}`);
            }
            if (normalStyles.color !== hoverStyles.color) {
              changes.push(`color: ${normalStyles.color} → ${hoverStyles.color}`);
            }
            if (normalStyles.borderColor !== hoverStyles.borderColor) {
              changes.push(`border: ${normalStyles.borderColor} → ${hoverStyles.borderColor}`);
            }
            if (normalStyles.beforeBg !== hoverStyles.beforeBg) {
              changes.push(`::before bg: ${normalStyles.beforeBg} → ${hoverStyles.beforeBg}`);
            }
            if (normalStyles.beforeOpacity !== hoverStyles.beforeOpacity) {
              changes.push(`::before opacity: ${normalStyles.beforeOpacity} → ${hoverStyles.beforeOpacity}`);
            }

            buttonHoverStates.push({
              selector: 'button' + (className ? '.' + className.trim().split(/\s+/).join('.') : ''),
              className,
              normalStyles,
              hoverStyles
            });

            console.log(`✅ Found hover for button ${i + 1}: ${changes.join(', ')}`);
          }

        } catch (hoverError) {
          // Hover might fail for covered/moving elements - just skip
        }

      } catch (e) {
        console.warn(`⚠️  Error capturing hover for button ${i + 1}:`, e);
      }
    }

    console.log(`✨ Captured ${buttonHoverStates.length} button hover states`);

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
      writeFile(join(rawDir, 'css_rules.json'), JSON.stringify(cssRules, null, 2), 'utf8'),
      writeFile(join(rawDir, 'button_hover_states.json'), JSON.stringify(buttonHoverStates, null, 2), 'utf8'),
      writeFile(join(rawDir, 'meta.json'), JSON.stringify(meta, null, 2), 'utf8'),
    ]);

    const result: CaptureResult = {
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

  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

function generateRunId(url?: string): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const uuid = uuidv4().slice(0, 8);

  if (url) {
    const urlSuffix = createUrlSuffix(url);
    return `${timestamp}_${uuid}_${urlSuffix}`;
  }

  return `${timestamp}_${uuid}`;
}

function createUrlSuffix(url: string): string {
  try {
    const urlObj = new URL(url);
    // Extract hostname and remove 'www.' if present
    const hostname = urlObj.hostname.replace(/^www\./, '');
    // Convert to safe directory name: replace dots and special chars with dashes
    return hostname.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
  } catch {
    // Fallback for invalid URLs
    return url.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase().substring(0, 20);
  }
}