import { OpenAI } from 'openai';
import type { DesignTokens } from './index';

interface ButtonForAnalysis {
  text: string;
  backgroundColor: string;
  borderColor: string | null;
  color: string;
  fontSize: number;
  fontWeight: number;
  prominence: number;
  hasHover: boolean;
  count: number;
}

interface ClassificationResult {
  primary: string[];  // Background colors classified as primary
  secondary: string[]; // Background colors classified as secondary
  primaryIndex?: number; // Button index (1-based) for primary
  secondaryIndex?: number; // Button index (1-based) for secondary
  reasoning: string;
}

/**
 * Use LLM to semantically classify buttons based on their copy and visual properties
 */
export async function classifyButtonsWithLLM(
  buttons: DesignTokens['buttons']['variants']
): Promise<ClassificationResult> {
  // Filter to actionable buttons (exclude pure black which is often fallback/decorative)
  // Include both solid AND ghost buttons (ghost buttons with borders are important for some sites like Dojo)
  const actionableButtons = buttons.filter(b =>
    b.backgroundColor !== '#000000' // Exclude pure black (often fallback/invisible/decorative)
  );

  // If we have 2 or fewer buttons, use simple heuristics
  if (actionableButtons.length <= 2) {
    const primaryColors = actionableButtons.slice(0, 1).map(b => b.backgroundColor);
    const secondaryColors = actionableButtons.slice(1, 2).map(b => b.backgroundColor);
    return {
      primary: primaryColors,
      secondary: secondaryColors,
      reasoning: 'Simple heuristic: fewer than 3 buttons, no LLM needed'
    };
  }

  // Prepare button data for LLM analysis
  const buttonData: ButtonForAnalysis[] = actionableButtons.map(b => ({
    text: b.textContent || '[no text]',
    backgroundColor: b.backgroundColor,
    borderColor: b.borderColor || null,
    color: b.color,
    fontSize: b.fontSize,
    fontWeight: b.fontWeight,
    prominence: b.prominence?.score || 0,
    hasHover: !!(b.hover?.backgroundColor || b.hover?.opacity),
    count: b.count || 0
  }));

  try {
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const prompt = `You are selecting button colors for a design system from a captured website.

**Your task:** Pick EXACTLY ONE primary button color and EXACTLY ONE secondary button color.

**Selection criteria:**
PRIMARY: The MOST PROMINENT call-to-action button (highest visual hierarchy)
- Look for text like: "Sign Up", "Get Started", "Buy Now", "Start Free Trial", "Subscribe"
- Should have the strongest visual weight
- Prefer solid colors over transparent
- Usually appears multiple times on the site

SECONDARY: The SECOND MOST PROMINENT action (supporting CTA)
- Look for text like: "Learn More", "Contact Us", "View Demo", "View products", "Start now", "Documentation", "Pay"
- Should have DIFFERENT background color from primary (strong visual contrast)
- **PREFER solid background colors over transparent** (transparent only if no good solid option exists)
- **For transparent buttons: prioritize highest PROMINENCE SCORE over count**
- Should NOT be a utility button like dropdown selectors ("Enterprise", "United Kingdom"), cookie banners, or navigation
- Avoid utility/navigation buttons - focus on action-oriented text

**Buttons available:**
${buttonData.map((b, i) => {
  const parts = [`${i + 1}. "${b.text}"`];
  if (b.backgroundColor === '#transparent' && b.borderColor) {
    parts.push(`transparent bg with ${b.borderColor} border and ${b.color} text`);
  } else {
    parts.push(`${b.backgroundColor} bg, ${b.color} text`);
  }
  parts.push(`${b.fontSize}px`);
  parts.push(`weight ${b.fontWeight}`);
  parts.push(`prominence ${b.prominence.toFixed(1)}`);
  parts.push(`hover: ${b.hasHover ? 'yes' : 'no'}`);
  parts.push(`appears ${b.count}x`);
  return parts.join(', ');
}).join('\n')}

Return JSON with EXACTLY this structure (pick ONE color for primary, ONE for secondary):
{
  "primary": ["#color"],
  "secondary": ["#color_or_transparent"],
  "primaryIndex": number (the button number from the list above, e.g., 1, 2, 3...),
  "secondaryIndex": number (the button number from the list above),
  "reasoning": "Brief explanation focusing on button text content and visual hierarchy"
}

IMPORTANT:
- Include both the color AND the index number for each selection
- For ghost buttons, the index helps identify which specific transparent button you chose
- Include borderColor context in your reasoning`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are a design system expert specializing in button hierarchy and UI semantics. Return only valid JSON.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.2,
      response_format: { type: 'json_object' }
    });

    const result = JSON.parse(response.choices[0].message.content || '{}');
    console.log('🤖 LLM Button Classification:', result.reasoning);

    return {
      primary: result.primary || [],
      secondary: result.secondary || [],
      primaryIndex: result.primaryIndex,
      secondaryIndex: result.secondaryIndex,
      reasoning: result.reasoning || 'LLM classification completed'
    };

  } catch (error: any) {
    console.error('❌ LLM button classification failed:', error);

    // Fallback to heuristics
    const primaryColors = actionableButtons
      .filter(b => b.hover?.backgroundColor || b.hover?.opacity)
      .sort((a, b) => (b.count || 0) - (a.count || 0))
      .slice(0, 2)
      .map(b => b.backgroundColor);

    const secondaryColors = actionableButtons
      .filter(b => !primaryColors.includes(b.backgroundColor))
      .slice(0, 2)
      .map(b => b.backgroundColor);

    return {
      primary: primaryColors,
      secondary: secondaryColors,
      reasoning: `Fallback heuristic classification (LLM failed: ${error?.message || 'unknown error'})`
    };
  }
}
