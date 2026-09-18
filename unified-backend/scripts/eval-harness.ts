/**
 * Shared harness for the offline RAG evals (eval-retrieval.ts, eval-generation.ts).
 *
 * Builds the résumé index with the production chunker + MiniLM embeddings in
 * PGlite (in-process Postgres with pgvector + full-text search) and exposes
 * the same three retrieval statements retrieveTopChunks runs in production.
 */
import fs from "node:fs";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { vector } from "@electric-sql/pglite-pgvector";
import { chunkResumeText } from "../src/modules/ai/resume-chunking.js";
import { generateEmbedding } from "../src/utils/embedding.js";
import {
  buildKeywordQuery,
  detectQuerySection,
  fuseAndFilter,
  HYBRID_CANDIDATES_PER_LEG,
  RELEVANCE_THRESHOLD,
  RRF_K,
  type CandidateRow,
  type RetrievedChunk,
} from "../src/modules/ai/resume-hybrid.js";

export const ROOT = path.resolve(import.meta.dirname, "../eval/retrieval");

export interface Query {
  id: string;
  split: "dev" | "test";
  resume: string;
  type: string;
  query: string;
  /** Each entry is one fact to find; an array entry lists acceptable alternative spans. */
  gold: (string | string[])[];
}

export function loadQueries(): Query[] {
  return (JSON.parse(fs.readFileSync(path.join(ROOT, "queries.json"), "utf8")) as { queries: Query[] }).queries;
}

export async function openEvalDb(chunkChars?: number) {
  const db = new PGlite({ extensions: { vector } });
  const index = await buildIndex(db, chunkChars);
  return { db, ...index };
}

/** The pre-hybrid production system's floor — the vector baseline stays fixed
 *  at this so the comparison is against what actually shipped before. */
export const BASELINE_VECTOR_THRESHOLD = 0.2;

export const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();

// ── Index ──────────────────────────────────────────────────────────────────────

export async function buildIndex(db: PGlite, chunkChars?: number) {
  await db.exec(`
    CREATE EXTENSION IF NOT EXISTS vector;
    CREATE TABLE resume_chunks (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL,
      chunk_text TEXT NOT NULL,
      section_type VARCHAR(50) DEFAULT 'other',
      embedding vector(384),
      tsv tsvector GENERATED ALWAYS AS (to_tsvector('english', chunk_text)) STORED
    );
    CREATE INDEX ON resume_chunks USING hnsw (embedding vector_cosine_ops);
    CREATE INDEX ON resume_chunks USING gin (tsv);
    CREATE INDEX ON resume_chunks (user_id);
  `);

  const files = fs.readdirSync(path.join(ROOT, "resumes")).filter((f) => f.endsWith(".txt")).sort();
  const userIds = new Map<string, number>();
  const texts = new Map<string, string>();
  let chunkTotal = 0;

  for (const [i, file] of files.entries()) {
    const name = file.replace(/\.txt$/, "");
    const text = fs.readFileSync(path.join(ROOT, "resumes", file), "utf8");
    userIds.set(name, i + 1);
    texts.set(name, text);
    for (const chunk of chunkResumeText(text, chunkChars)) {
      const emb = await generateEmbedding(chunk.text);
      await db.query(
        `INSERT INTO resume_chunks (user_id, chunk_text, section_type, embedding) VALUES ($1, $2, $3, $4::vector)`,
        [i + 1, chunk.text, chunk.sectionType, `[${emb.join(",")}]`]
      );
      chunkTotal++;
    }
  }
  return { userIds, texts, chunkTotal, resumeCount: files.length };
}

// ── Retrievers (same SQL as retrieveTopChunks in resume-rag.ts) ────────────────

export async function vectorLeg(db: PGlite, userId: number, emb: string, n: number) {
  const r = await db.query<CandidateRow>(
    `SELECT id, chunk_text, section_type, 1 - (embedding <=> $1::vector) AS similarity
     FROM resume_chunks WHERE user_id = $2
     ORDER BY embedding <=> $1::vector LIMIT $3`,
    [emb, userId, n]
  );
  return r.rows;
}

export async function keywordLeg(db: PGlite, userId: number, emb: string, tsQuery: string, fn: string, n: number) {
  if (!tsQuery) return [];
  const r = await db.query<CandidateRow>(
    `SELECT id, chunk_text, section_type, 1 - (embedding <=> $1::vector) AS similarity
     FROM resume_chunks, ${fn}('english', $2) AS q
     WHERE user_id = $3 AND tsv @@ q
     ORDER BY ts_rank_cd(tsv, q) DESC, id LIMIT $4`,
    [emb, tsQuery, userId, n]
  );
  return r.rows;
}

export async function sectionLeg(db: PGlite, userId: number, emb: string, section: string | null, n: number) {
  if (!section) return [];
  const r = await db.query<CandidateRow>(
    `SELECT id, chunk_text, section_type, 1 - (embedding <=> $1::vector) AS similarity
     FROM resume_chunks WHERE user_id = $2 AND section_type = $3
     ORDER BY embedding <=> $1::vector LIMIT $4`,
    [emb, userId, section, n]
  );
  return r.rows;
}

export interface HybridOptions {
  k: number;
  candidates?: number;
  rrfK?: number;
  threshold?: number;
  noSection?: boolean;
}

/** The production hybrid path (retrieveTopChunks) against the eval DB. */
export async function hybridRetrieve(db: PGlite, userId: number, q: string, opts: HybridOptions): Promise<RetrievedChunk[]> {
  const n = opts.candidates ?? HYBRID_CANDIDATES_PER_LEG;
  const emb = `[${(await generateEmbedding(q)).join(",")}]`;
  const [v, kw, sec] = await Promise.all([
    vectorLeg(db, userId, emb, n),
    keywordLeg(db, userId, emb, buildKeywordQuery(q), "websearch_to_tsquery", n),
    opts.noSection ? Promise.resolve([]) : sectionLeg(db, userId, emb, detectQuerySection(q), n),
  ]);
  return fuseAndFilter(
    v,
    kw,
    { limit: opts.k, relevanceThreshold: opts.threshold ?? RELEVANCE_THRESHOLD, rrfK: opts.rrfK ?? RRF_K },
    sec
  );
}

/** The pre-hybrid system: vector leg alone with the old 0.2 floor. */
export async function vectorOnlyRetrieve(db: PGlite, userId: number, q: string, k: number): Promise<RetrievedChunk[]> {
  const emb = `[${(await generateEmbedding(q)).join(",")}]`;
  return (await vectorLeg(db, userId, emb, k))
    .filter((r) => Number(r.similarity) >= BASELINE_VECTOR_THRESHOLD)
    .map((r) => ({
      id: r.id,
      chunkText: r.chunk_text,
      sectionType: r.section_type,
      relevanceScore: Math.round(Number(r.similarity) * 100) / 100,
      matchType: "semantic" as const,
    }));
}
