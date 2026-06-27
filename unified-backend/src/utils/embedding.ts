/**
 * Sentence-Transformers embedding via @xenova/transformers
 * Produces a 384-dimensional vector from text (MiniLM-L6-v2)
 * Used by the Resume RAG pipeline.
 */

// @ts-ignore — no types for @xenova/transformers
import { pipeline } from "@xenova/transformers";

let extractor: any = null;

/**
 * Lazy-initialize the embedding pipeline.
 * First call downloads the model (~23 MB), subsequent calls reuse it.
 */
async function getExtractor() {
  if (!extractor) {
    extractor = await pipeline(
      "feature-extraction",
      "Xenova/all-MiniLM-L6-v2"
    );
  }
  return extractor;
}

export async function generateEmbedding(text: string): Promise<number[]> {
  const ext = await getExtractor();
  const output = await ext(text, { pooling: "mean", normalize: true });
  return Array.from(output.data as Float32Array);
}

/**
 * Called at startup to warm up the embedding model in the background.
 */
export async function warmUpEmbeddings(): Promise<void> {
  try {
    console.log("⏳ Warming up embedding model...");
    await generateEmbedding("warm up");
    console.log("✅ Embedding model ready");
  } catch (err) {
    console.warn("⚠️  Embedding warm-up failed:", (err as Error).message);
  }
}
