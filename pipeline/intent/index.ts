import { readFile, writeFile } from 'fs/promises';
import { join } from 'path';
import { OpenAI } from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import type { SceneGraph } from '../scenegraph';

export type PageType = 'detail' | 'list' | 'profile';

export type SectionType =
  | 'gallery' | 'summary' | 'price_cta' | 'amenities' | 'reviews' | 'trust_signals'
  | 'hero' | 'features' | 'testimonials' | 'faq' | 'contact'
  | 'avatar' | 'bio' | 'experience' | 'portfolio' | 'social_links';

export interface Intent {
  page_type: PageType;
  primary_entity: string;
  required_sections: SectionType[];
  priority_order: SectionType[];
  confidence: number;
  reasoning: string;
}

export interface IntentParseResult {
  runId: string;
  intent: Intent;
  provider: 'openai' | 'anthropic';
}

const INTENT_SCHEMA = {
  type: 'object',
  properties: {
    page_type: {
      type: 'string',
      enum: ['detail', 'list', 'profile'],
      description: 'The type of page to create'
    },
    primary_entity: {
      type: 'string',
      description: 'The main entity/subject of the page (e.g. property, product, person)'
    },
    required_sections: {
      type: 'array',
      items: {
        type: 'string',
        enum: ['gallery', 'summary', 'price_cta', 'amenities', 'reviews', 'trust_signals', 'hero', 'features', 'testimonials', 'faq', 'contact', 'avatar', 'bio', 'experience', 'portfolio', 'social_links']
      },
      description: 'Essential sections this page type needs'
    },
    priority_order: {
      type: 'array',
      items: {
        type: 'string',
        enum: ['gallery', 'summary', 'price_cta', 'amenities', 'reviews', 'trust_signals', 'hero', 'features', 'testimonials', 'faq', 'contact', 'avatar', 'bio', 'experience', 'portfolio', 'social_links']
      },
      description: 'Recommended order of sections by importance'
    },
    confidence: {
      type: 'number',
      minimum: 0,
      maximum: 1,
      description: 'Confidence in the interpretation (0-1)'
    },
    reasoning: {
      type: 'string',
      description: 'Brief explanation of why this interpretation was chosen'
    }
  },
  required: ['page_type', 'primary_entity', 'required_sections', 'priority_order', 'confidence', 'reasoning']
};


export async function parseIntent(
  prompt: string,
  runId: string,
  artifactDir?: string,
  provider?: 'openai' | 'anthropic'
): Promise<IntentParseResult> {
  const baseDir = artifactDir || join(process.cwd(), 'artifacts');
  const runDir = join(baseDir, runId);

  // Read scenegraph for context
  let scenegraph: SceneGraph | null = null;
  try {
    const scenegraphContent = await readFile(join(runDir, 'scenegraph.json'), 'utf8');
    scenegraph = JSON.parse(scenegraphContent);
  } catch (error) {
    // Scenegraph is optional for intent parsing
  }

  const intentProvider = provider || process.env.INTENT_PROVIDER || 'openai';
  let intent: Intent;

  switch (intentProvider) {
    case 'openai':
      intent = await parseWithOpenAI(prompt, scenegraph);
      break;
    case 'anthropic':
      intent = await parseWithAnthropic(prompt, scenegraph);
      break;
    default:
      throw new Error(`Unsupported intent provider: ${intentProvider}. Must be 'openai' or 'anthropic'.`);
  }

  // Save intent
  await writeFile(join(runDir, 'intent.json'), JSON.stringify(intent, null, 2));

  return {
    runId,
    intent,
    provider: intentProvider as any,
  };
}

async function parseWithOpenAI(prompt: string, scenegraph?: SceneGraph | null): Promise<Intent> {
  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  const systemPrompt = `You are an expert UX designer that interprets user requests for web page creation.

Given a user prompt, determine:
1. What type of page they want (detail, list, or profile)
2. What the main entity/subject is
3. What sections the page needs
4. The priority order of those sections

Available page types:
- detail: focused on a single item (product, property, article)
- list: collection of items with filtering/overview
- profile: showcases a person or entity

Available sections:
- gallery: image gallery or carousel
- summary: main description/overview
- price_cta: pricing and call-to-action
- amenities: features/amenities list
- reviews: user reviews and ratings
- trust_signals: badges, certifications, guarantees
- hero: main banner/intro section
- features: key features grid
- testimonials: customer testimonials
- faq: frequently asked questions
- contact: contact information
- avatar: profile picture
- bio: biographical information
- experience: work history
- portfolio: work samples
- social_links: social media links

${scenegraph ? `Context: The source page has ${scenegraph.totalNodes} elements with sections like ${scenegraph.root.children?.map(c => c.role).join(', ')}.` : ''}

Respond with valid JSON only.`;

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: prompt }
    ],
    functions: [{
      name: 'parse_intent',
      description: 'Parse user intent for page creation',
      parameters: INTENT_SCHEMA
    }],
    function_call: { name: 'parse_intent' },
    temperature: 0.1,
  });

  const functionCall = response.choices[0].message.function_call;
  if (!functionCall?.arguments) {
    throw new Error('Failed to get structured response from OpenAI');
  }

  const intent = JSON.parse(functionCall.arguments) as Intent;
  return validateIntent(intent);
}

async function parseWithAnthropic(prompt: string, scenegraph?: SceneGraph | null): Promise<Intent> {
  const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
  });

  const systemPrompt = `You are an expert UX designer that interprets user requests for web page creation.

Return a JSON object with these fields:
- page_type: "detail", "list", or "profile"
- primary_entity: the main subject (e.g. "property", "product", "person")
- required_sections: array of essential sections from the allowed list
- priority_order: array of sections in order of importance
- confidence: number 0-1 for confidence in interpretation
- reasoning: brief explanation

Available sections: gallery, summary, price_cta, amenities, reviews, trust_signals, hero, features, testimonials, faq, contact, avatar, bio, experience, portfolio, social_links

${scenegraph ? `Context: Source page has ${scenegraph.totalNodes} elements.` : ''}

Return only valid JSON.`;

  const response = await anthropic.messages.create({
    model: 'claude-3-haiku-20240307',
    max_tokens: 500,
    system: systemPrompt,
    messages: [
      { role: 'user', content: prompt }
    ],
    temperature: 0.1,
  });

  const content = response.content[0];
  if (content.type !== 'text') {
    throw new Error('Unexpected response type from Anthropic');
  }

  const intent = JSON.parse(content.text) as Intent;
  return validateIntent(intent);
}


function validateIntent(intent: Intent): Intent {
  // Ensure page_type is valid
  if (!['detail', 'list', 'profile'].includes(intent.page_type)) {
    intent.page_type = 'detail';
  }

  // Ensure required_sections contains valid sections
  const validSections: SectionType[] = ['gallery', 'summary', 'price_cta', 'amenities', 'reviews', 'trust_signals', 'hero', 'features', 'testimonials', 'faq', 'contact', 'avatar', 'bio', 'experience', 'portfolio', 'social_links'];

  intent.required_sections = intent.required_sections.filter(s => validSections.includes(s));
  intent.priority_order = intent.priority_order.filter(s => validSections.includes(s));

  // Ensure confidence is between 0 and 1
  intent.confidence = Math.max(0, Math.min(1, intent.confidence || 0.5));

  // Provide defaults if empty
  if (intent.required_sections.length === 0) {
    intent.required_sections = ['hero', 'summary'];
  }

  if (intent.priority_order.length === 0) {
    intent.priority_order = intent.required_sections;
  }

  return intent;
}