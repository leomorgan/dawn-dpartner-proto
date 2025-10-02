import fs from 'fs';
import path from 'path';
import sizeOf from 'image-size';
import { getClipEmbedding } from './replicate-clip';

export interface VisualEmbeddingResult {
  embedding: number[];          // 512D CLIP vector
  model: string;                // "clip-vit-base-patch32"
  dimensions: number;           // 512
  imageSize: { width: number; height: number };
}

/**
 * Build visual embedding using Replicate CLIP API
 *
 * Takes a screenshot and generates a 512D CLIP embedding that captures
 * visual/perceptual similarity (layout, composition, aesthetic feel).
 *
 * @param runId - Artifact run ID containing page.png
 * @returns Visual embedding result with 512D vector
 */
export async function buildVisualEmbedding(
  runId: string
): Promise<VisualEmbeddingResult> {
  // Read screenshot (page.png from raw directory)
  const imagePath = path.join(process.cwd(), 'artifacts', runId, 'raw', 'page.png');

  if (!fs.existsSync(imagePath)) {
    throw new Error(`Screenshot not found: ${imagePath}`);
  }

  // Read image
  const imageBuffer = fs.readFileSync(imagePath);

  // Get image dimensions
  const dimensions = sizeOf(imageBuffer);

  // Use Replicate CLIP - no fallback
  const result = await getClipEmbedding(imageBuffer);

  return {
    embedding: result.embedding,
    model: result.model,
    dimensions: result.dimensions,
    imageSize: {
      width: dimensions.width || 0,
      height: dimensions.height || 0
    }
  };
}

// Visual embeddings now exclusively use Replicate CLIP API
// No mock fallback - will error if API token not configured or API fails
// See replicate-clip.ts for implementation details
