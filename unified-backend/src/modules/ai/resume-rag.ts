/**
 * Resume RAG — Core Intelligence Module
 * Ported directly from utils service with no Kafka dependency.
 *
 * Pipeline:
 *  1. processResume()    — PDF → text → chunks → embeddings → pgvector
 *  2. queryResume()      — question → hybrid retrieval (pgvector cosine + Postgres
 *                          full-text, fused with RRF) → Groq LLM → answer
 *  3. queryResumeVsJob() — question + JD → context-aware analysis
 */

import { sql } from "../../db.js";
import { generateEmbedding } from "../../utils/embedding.js";
import { chunkResumeText, type ResumeChunk } from "./resume-chunking.js";
import {
  buildKeywordQuery,
  detectQuerySection,
  fuseAndFilter,
  HYBRID_CANDIDATES_PER_LEG,
  RELEVANCE_THRESHOLD,
  type CandidateRow,
  type MatchType,
  type RetrievedChunk,
} from "./resume-hybrid.js";
import {
  RAG_ANSWER_MODEL,
  RAG_ANSWER_TEMPERATURE,
  NO_RELEVANT_INFO_ANSWER,
  buildStructuredExtractionPrompt,
  buildResumeQAPrompt,
} from "./resume-prompts.js";
import {
  parseStructuredResume,
  type StructuredResume,
} from "./resume-structured-schema.js";
// @ts-ignore
import pdfParse from "pdf-parse";
import Groq from "groq-sdk";
import dotenv from "dotenv";

dotenv.config();

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

async function askGroq(prompt: string): Promise<string> {
  const completion = await groq.chat.completions.create({
    model: RAG_ANSWER_MODEL,
    messages: [{ role: "user", content: prompt }],
    temperature: RAG_ANSWER_TEMPERATURE,
  });
  return completion.choices[0]?.message?.content ?? "";
}

async function extractStructuredData(fullText: string): Promise<StructuredResume> {
  const prompt = buildStructuredExtractionPrompt(fullText);

  const { data, ok, reason } = parseStructuredResume(await askGroq(prompt));
  if (!ok) {
    // Never fatal: indexing proceeds with chunks only, and the sidebar just
    // renders without the structured summary.
    console.warn(`Structured extraction rejected (${reason}); continuing with chunks only.`);
  }
  return data;
}

// ─── Process Resume ───────────────────────────────────────────────────────────

export async function processResume(
  userId: number,
  pdfBuffer: Buffer
): Promise<{ chunksCreated: number; structured: StructuredResume }> {
  const pdfData = await pdfParse(pdfBuffer);
  const fullText = pdfData.text;

  if (!fullText || fullText.trim().length < 50) {
    throw new Error("Could not extract meaningful text from the PDF");
  }

  // ── Build phase ────────────────────────────────────────────────────────────
  // Everything fallible (chunking, the LLM call, N embedding round trips) runs
  // BEFORE anything is deleted. The previous version deleted first and then did
  // this work untransacted, so any failure left the candidate with a destroyed
  // or half-built index.
  const chunks = chunkResumeText(fullText);
  if (chunks.length === 0) {
    throw new Error("Could not derive any indexable content from the PDF");
  }

  const structured = await extractStructuredData(fullText);

  const embedded: { chunk: ResumeChunk; embeddingStr: string }[] = [];
  for (const chunk of chunks) {
    const embedding = await generateEmbedding(chunk.text);
    embedded.push({ chunk, embeddingStr: `[${embedding.join(",")}]` });
  }

  // ── Swap phase ─────────────────────────────────────────────────────────────
  // One non-interactive transaction: the old index is only dropped as part of
  // the same commit that writes the new one, so a re-index is never destructive.
  await sql.transaction([
    sql`DELETE FROM resume_chunks WHERE user_id = ${userId}`,
    sql`DELETE FROM resume_structured WHERE user_id = ${userId}`,
    ...embedded.map(
      ({ chunk, embeddingStr }) => sql`
        INSERT INTO resume_chunks (user_id, chunk_text, section_type, embedding)
        VALUES (${userId}, ${chunk.text}, ${chunk.sectionType}, ${embeddingStr}::vector)
      `
    ),
    sql`
      INSERT INTO resume_structured (user_id, skills, experience_summary, projects, education, full_text, processed_at)
      VALUES (${userId}, ${structured.skills}, ${structured.experience_summary}, ${structured.projects}, ${structured.education}, ${fullText.substring(0, 10000)}, NOW())
      ON CONFLICT (user_id) DO UPDATE SET
        skills = EXCLUDED.skills,
        experience_summary = EXCLUDED.experience_summary,
        projects = EXCLUDED.projects,
        education = EXCLUDED.education,
        full_text = EXCLUDED.full_text,
        processed_at = EXCLUDED.processed_at
    `,
  ]);

  console.log(`✅ Resume indexed for user ${userId}: ${chunks.length} chunks`);
  return { chunksCreated: chunks.length, structured };
}

// ─── Adaptive Retrieval (shared by recruiter Q&A + the live interview) ────────

export type { RetrievedChunk, MatchType };

/**
 * Hybrid retrieval: returns the top-k resume chunks for `userId`, fusing
 *   1. a semantic leg — cosine distance over the pgvector HNSW index,
 *   2. a keyword leg — Postgres full-text search (GIN over a generated tsvector), and
 *   3. a section leg — chunks of the section the question is about, when it
 *      names one ("which college…" → education),
 * with Reciprocal Rank Fusion. This is the one retrieval path used by both
 * the recruiter Q&A endpoints and the live interview's per-turn adaptive
 * context. scripts/eval-retrieval.ts runs these same three statements.
 *
 * The keyword leg is best-effort: if it errors (e.g. the tsv column hasn't
 * been created on this database yet) retrieval degrades to semantic-only
 * rather than failing the request.
 */
export async function retrieveTopChunks(
  userId: number,
  queryText: string,
  limit: number
): Promise<RetrievedChunk[]> {
  const queryEmbedding = await generateEmbedding(queryText);
  const embeddingStr = `[${queryEmbedding.join(",")}]`;
  const keywordQuery = buildKeywordQuery(queryText);

  const vectorLeg = Promise.resolve(sql`
    SELECT id, chunk_text, section_type, 1 - (embedding <=> ${embeddingStr}::vector) AS similarity
    FROM resume_chunks WHERE user_id = ${userId}
    ORDER BY embedding <=> ${embeddingStr}::vector
    LIMIT ${HYBRID_CANDIDATES_PER_LEG}
  `) as unknown as Promise<CandidateRow[]>;

  const keywordLeg: Promise<CandidateRow[]> = keywordQuery
    ? (Promise.resolve(sql`
        SELECT id, chunk_text, section_type, 1 - (embedding <=> ${embeddingStr}::vector) AS similarity
        FROM resume_chunks, websearch_to_tsquery('english', ${keywordQuery}) AS q
        WHERE user_id = ${userId} AND tsv @@ q
        ORDER BY ts_rank_cd(tsv, q) DESC, id
        LIMIT ${HYBRID_CANDIDATES_PER_LEG}
      `) as unknown as Promise<CandidateRow[]>).catch((err: unknown) => {
        console.warn("⚠️ Keyword retrieval failed, using semantic results only:", (err as Error).message);
        return [];
      })
    : Promise.resolve([]);

  const section = detectQuerySection(queryText);
  const sectionLeg: Promise<CandidateRow[]> = section
    ? (Promise.resolve(sql`
        SELECT id, chunk_text, section_type, 1 - (embedding <=> ${embeddingStr}::vector) AS similarity
        FROM resume_chunks WHERE user_id = ${userId} AND section_type = ${section}
        ORDER BY embedding <=> ${embeddingStr}::vector
        LIMIT ${HYBRID_CANDIDATES_PER_LEG}
      `) as unknown as Promise<CandidateRow[]>).catch((err: unknown) => {
        console.warn("⚠️ Section retrieval failed, continuing without it:", (err as Error).message);
        return [];
      })
    : Promise.resolve([]);

  const [vectorRows, keywordRows, sectionRows] = await Promise.all([vectorLeg, keywordLeg, sectionLeg]);
  return fuseAndFilter(vectorRows, keywordRows, { limit, relevanceThreshold: RELEVANCE_THRESHOLD }, sectionRows);
}

// ─── Query Resume ─────────────────────────────────────────────────────────────

interface QueryResult {
  answer: string;
  sources: { chunkText: string; sectionType: string; relevanceScore: number }[];
  confidence: number;
}

export async function queryResume(userId: number, question: string): Promise<QueryResult> {
  const chunkCount = await sql`SELECT COUNT(*) AS count FROM resume_chunks WHERE user_id = ${userId}`;
  if (!chunkCount[0] || Number(chunkCount[0].count) === 0) {
    return { answer: "This candidate's resume has not been indexed yet.", sources: [], confidence: 0 };
  }

  const relevantChunks = await retrieveTopChunks(userId, question, 5);
  if (relevantChunks.length === 0) {
    return { answer: NO_RELEVANT_INFO_ANSWER, sources: [], confidence: 0 };
  }

  const structuredRows = await sql`SELECT skills, experience_summary FROM resume_structured WHERE user_id = ${userId}`;
  const prompt = buildResumeQAPrompt(relevantChunks, structuredRows[0] || {}, question);

  const answer = await askGroq(prompt);
  const avgSimilarity = relevantChunks.reduce((sum, c) => sum + c.relevanceScore, 0) / relevantChunks.length;

  return {
    answer: answer.trim(),
    sources: relevantChunks,
    confidence: Math.round(avgSimilarity * 100) / 100,
  };
}

// ─── Query Resume vs Job Description ─────────────────────────────────────────

export async function queryResumeVsJob(userId: number, question: string, jobDescription: string): Promise<QueryResult> {
  const chunkCount = await sql`SELECT COUNT(*) AS count FROM resume_chunks WHERE user_id = ${userId}`;
  if (!chunkCount[0] || Number(chunkCount[0].count) === 0) {
    return { answer: "This candidate's resume has not been indexed yet.", sources: [], confidence: 0 };
  }

  const combinedQuery = `${question}\n\nJob Description Context: ${jobDescription.substring(0, 500)}`;
  const relevantChunks = await retrieveTopChunks(userId, combinedQuery, 6);
  if (relevantChunks.length === 0) {
    return { answer: "No relevant information found to compare with the job description.", sources: [], confidence: 0 };
  }

  const context = relevantChunks.map((c, i) => `[Source ${i + 1} — ${c.sectionType}]\n${c.chunkText}`).join("\n\n---\n\n");
  const structuredRows = await sql`SELECT skills, experience_summary FROM resume_structured WHERE user_id = ${userId}`;
  const structured = structuredRows[0] || {};

  const prompt = `
You are an AI hiring assistant. A recruiter is comparing a candidate's resume against a job description.
Answer the recruiter's question by analyzing BOTH the resume and job description.

--- RESUME CONTEXT ---
${context}
${structured.skills?.length > 0 ? `\nCandidate Skills: ${structured.skills.join(", ")}` : ""}
${structured.experience_summary ? `\nExperience: ${structured.experience_summary}` : ""}
--- END RESUME ---

--- JOB DESCRIPTION ---
${jobDescription.substring(0, 3000)}
--- END JOB DESCRIPTION ---

Recruiter's Question: ${question}
`;

  const answer = await askGroq(prompt);
  const avgSimilarity = relevantChunks.reduce((sum, c) => sum + c.relevanceScore, 0) / relevantChunks.length;

  return {
    answer: answer.trim(),
    sources: relevantChunks,
    confidence: Math.round(avgSimilarity * 100) / 100,
  };
}

// ─── Get Resume Status ────────────────────────────────────────────────────────

export async function getResumeStatus(userId: number) {
  const chunks = await sql`SELECT COUNT(*) AS count FROM resume_chunks WHERE user_id = ${userId}`;
  const structuredRows = await sql`SELECT * FROM resume_structured WHERE user_id = ${userId}`;
  const count = Number(chunks[0]?.count || 0);
  const structured = structuredRows[0] || null;

  return {
    indexed: count > 0,
    chunksCount: count,
    processedAt: structured?.processed_at || null,
    structured: structured
      ? { skills: structured.skills, experience_summary: structured.experience_summary, projects: structured.projects, education: structured.education }
      : null,
  };
}
