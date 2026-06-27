/**
 * Local Embedding Module
 * Uses @xenova/transformers with all-MiniLM-L6-v2 (384 dimensions)
 * Runs entirely in Node.js — zero API cost, zero latency dependency.
 */

let pipeline: any = null;

async function getEmbeddingPipeline() {
  if (!pipeline) {
    const { pipeline: transformersPipeline } = await import(
      "@xenova/transformers"
    );
    pipeline = await transformersPipeline(
      "feature-extraction",
      "Xenova/all-MiniLM-L6-v2"
    );
    console.log("✅ Embedding model loaded (all-MiniLM-L6-v2, 384-dim)");
  }
  return pipeline;
}

/**
 * Generate a 384-dimensional embedding vector for the given text.
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  const pipe = await getEmbeddingPipeline();
  const output = await pipe(text, { pooling: "mean", normalize: true });
  return Array.from(output.data as Float32Array);
}

/**
 * Pre-load the embedding model at startup so first query isn't slow.
 */
export async function warmUpEmbeddings(): Promise<void> {
  try {
    await getEmbeddingPipeline();
  } catch (error) {
    console.error("⚠️ Failed to pre-load embedding model:", error);
  }
}

export const EMBEDDING_DIMENSIONS = 384;
