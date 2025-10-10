import { OpenAI } from 'openai';
import type { DesignTokens } from '../tokens';

/**
 * Result of font embedding generation
 */
export interface FontEmbeddingResult {
  /** 256D text embedding vector from OpenAI text-embedding-3-small */
  embedding: Float32Array;
  /** Human-readable description of font characteristics that was embedded */
  description: string;
}

/**
 * Generate a semantic description of font characteristics from design tokens.
 *
 * The description includes:
 * - Primary typeface name
 * - Secondary typeface name (if different from primary)
 * - Weight analysis: "includes light weights" if min < 400
 * - Weight analysis: "includes bold weights" if max > 600
 * - Weight analysis: "high weight contrast" if range > 400
 * - Size range analysis: "large size range" if range > 60
 * - Size range analysis: "limited size range" if range < 20
 *
 * @param tokens - Design tokens extracted from the website
 * @returns Comma-separated description string
 */
function generateFontDescription(tokens: DesignTokens): string {
  const primary = tokens.typography.fontFamilies[0];
  const secondary = tokens.typography.fontFamilies[1];

  const parts: string[] = [];

  // Primary font
  parts.push(`Primary typeface: ${primary}`);

  // Secondary font (if different)
  if (secondary && secondary !== primary) {
    parts.push(`Secondary typeface: ${secondary}`);
  }

  // Font characteristics from weights
  const weights = tokens.typography.fontWeights;
  const minWeight = Math.min(...weights);
  const maxWeight = Math.max(...weights);

  if (minWeight < 400) parts.push("includes light weights");
  if (maxWeight > 600) parts.push("includes bold weights");
  if (maxWeight - minWeight > 400) parts.push("high weight contrast");

  // Font characteristics from sizes
  const sizes = tokens.typography.fontSizes;
  const sizeRange = Math.max(...sizes) - Math.min(...sizes);

  if (sizeRange > 60) parts.push("large size range");
  else if (sizeRange < 20) parts.push("limited size range");

  return parts.join(", ");
}

/**
 * Generate a 256D text embedding for font characteristics using OpenAI.
 *
 * This function:
 * 1. Generates a semantic description of the font using generateFontDescription()
 * 2. Sends the description to OpenAI's text-embedding-3-small model
 * 3. Returns a 256D embedding vector and the original description
 *
 * The embedding captures font family semantics (e.g., serif vs sans-serif,
 * geometric vs humanist) that numeric features cannot represent.
 *
 * @param tokens - Design tokens extracted from the website
 * @returns Font embedding result with 256D vector and description
 * @throws Error if OPENAI_API_KEY is not set
 * @throws Error if OpenAI API call fails
 *
 * @example
 * ```typescript
 * const tokens = await extractTokens(runId);
 * const { embedding, description } = await generateFontEmbedding(tokens);
 * console.log(description); // "Primary typeface: Inter, includes bold weights, large size range"
 * console.log(embedding.length); // 256
 * ```
 */
export async function generateFontEmbedding(
  tokens: DesignTokens
): Promise<FontEmbeddingResult> {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY environment variable is required for font embedding generation');
  }

  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  const description = generateFontDescription(tokens);

  console.log(`🔤 Font description: "${description}"`);

  try {
    const response = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: description,
      dimensions: 256,
    });

    if (!response.data || !response.data[0] || !response.data[0].embedding) {
      throw new Error('Invalid response from OpenAI embeddings API');
    }

    return {
      embedding: Float32Array.from(response.data[0].embedding),
      description,
    };
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to generate font embedding: ${error.message}`);
    }
    throw new Error('Failed to generate font embedding: Unknown error');
  }
}
