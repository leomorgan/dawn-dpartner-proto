import Replicate from 'replicate';

/**
 * Replicate CLIP Service
 *
 * Generates visual embeddings using Replicate's hosted CLIP model.
 * Model: andreasjansson/clip-features (512D embeddings)
 */

export interface ReplicateClipResult {
  embedding: number[];
  model: string;
  dimensions: number;
}

/**
 * Generate CLIP embedding using Replicate API
 *
 * @param imageBuffer - PNG image buffer
 * @returns 512D CLIP embedding vector
 */
export async function getClipEmbedding(
  imageBuffer: Buffer
): Promise<ReplicateClipResult> {
  const apiToken = process.env.REPLICATE_API_TOKEN;

  if (!apiToken) {
    throw new Error(
      'REPLICATE_API_TOKEN not found in environment. ' +
      'Get your token from https://replicate.com/account/api-tokens'
    );
  }

  const replicate = new Replicate({
    auth: apiToken,
  });

  // Convert buffer to base64 data URI
  const base64 = imageBuffer.toString('base64');
  const dataUri = `data:image/png;base64,${base64}`;

  try {
    // Call Replicate CLIP model
    // Model: openai/clip - official OpenAI CLIP model
    const output = await replicate.run("openai/clip", {
      input: {
        image: dataUri
      }
    }) as { embedding: number[] };

    // Validate output
    if (!output || typeof output !== 'object' || !('embedding' in output)) {
      throw new Error(`Unexpected output format from CLIP model`);
    }

    const embedding = output.embedding;

    if (!Array.isArray(embedding)) {
      throw new Error(`Expected embedding array, got ${typeof embedding}`);
    }

    // openai/clip returns 768D embeddings
    const expectedDim = 768;
    if (embedding.length !== expectedDim) {
      throw new Error(`Expected ${expectedDim}D embedding, got ${embedding.length}D`);
    }

    return {
      embedding,
      model: 'openai-clip',
      dimensions: embedding.length,
    };

  } catch (error) {
    if (error instanceof Error) {
      // Enhance error messages for common issues
      if (error.message.includes('401') || error.message.includes('authentication')) {
        throw new Error(
          'Replicate API authentication failed. Check your REPLICATE_API_TOKEN in .env.local'
        );
      }
      if (error.message.includes('rate limit')) {
        throw new Error(
          'Replicate rate limit exceeded. Upgrade at https://replicate.com/pricing'
        );
      }
      throw error;
    }
    throw new Error(`CLIP embedding failed: ${String(error)}`);
  }
}

/**
 * Batch generate CLIP embeddings (with rate limiting)
 *
 * @param imageBuffers - Array of PNG image buffers
 * @param delayMs - Delay between requests (default: 100ms)
 * @returns Array of CLIP embeddings
 */
export async function batchGetClipEmbeddings(
  imageBuffers: Buffer[],
  delayMs: number = 100
): Promise<ReplicateClipResult[]> {
  const results: ReplicateClipResult[] = [];

  for (let i = 0; i < imageBuffers.length; i++) {
    console.log(`Generating CLIP embedding ${i + 1}/${imageBuffers.length}...`);

    const result = await getClipEmbedding(imageBuffers[i]);
    results.push(result);

    // Rate limiting delay (except for last item)
    if (i < imageBuffers.length - 1) {
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }

  return results;
}
