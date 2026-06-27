/**
 * Neon PostgreSQL connection for the Utils service.
 * Shared across RAG module and auth middleware.
 */
import { neon } from "@neondatabase/serverless";
import dotenv from "dotenv";

dotenv.config();

export const sql = neon(process.env.DB_URL as string);

/**
 * Initialize pgvector extension and RAG tables.
 * Called once at startup.
 */
export async function initRAGTables(): Promise<void> {
  try {
    // Enable pgvector extension
    await sql`CREATE EXTENSION IF NOT EXISTS vector`;

    // Resume chunks with vector embeddings
    await sql`
      CREATE TABLE IF NOT EXISTS resume_chunks (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL,
        chunk_text TEXT NOT NULL,
        section_type VARCHAR(50) DEFAULT 'other',
        embedding vector(384),
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `;

    // Structured extracted data per user
    await sql`
      CREATE TABLE IF NOT EXISTS resume_structured (
        user_id INTEGER PRIMARY KEY,
        skills TEXT[] DEFAULT '{}',
        experience_summary TEXT DEFAULT '',
        projects TEXT[] DEFAULT '{}',
        education TEXT DEFAULT '',
        full_text TEXT DEFAULT '',
        processed_at TIMESTAMPTZ DEFAULT NOW()
      )
    `;

    // Create index for fast cosine similarity search
    // ivfflat requires existing data, so use hnsw which works with empty tables
    await sql`
      CREATE INDEX IF NOT EXISTS idx_resume_chunks_embedding
      ON resume_chunks
      USING hnsw (embedding vector_cosine_ops)
    `;

    // Index for fast user_id lookups
    await sql`
      CREATE INDEX IF NOT EXISTS idx_resume_chunks_user_id
      ON resume_chunks (user_id)
    `;

    console.log("✅ RAG tables initialized (pgvector ready)");
  } catch (error) {
    console.error("❌ Failed to initialize RAG tables:", error);
  }
}
