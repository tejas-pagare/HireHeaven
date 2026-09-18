/**
 * Resume RAG — Core Intelligence Module
 * Ported directly from utils service with no Kafka dependency.
 *
 * Pipeline:
 *  1. processResume()    — PDF → text → chunks → embeddings → pgvector
 *  2. queryResume()      — question → embed → similarity search → Groq LLM → answer
 *  3. queryResumeVsJob() — question + JD → context-aware analysis
 */

import { sql } from "../../db.js";
import { generateEmbedding } from "../../utils/embedding.js";
import { chunkResumeText, type ResumeChunk } from "./resume-chunking.js";
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
    model: "openai/gpt-oss-120b",
    messages: [{ role: "user", content: prompt }],
    temperature: 0.4,
  });
  return completion.choices[0]?.message?.content ?? "";
}

async function extractStructuredData(fullText: string): Promise<StructuredResume> {
  const prompt = `
Analyze the following resume text and extract structured information.
Return ONLY valid JSON with no markdown formatting.

Resume:
"""
${fullText.substring(0, 5000)}
"""

Return this exact JSON structure:
{
  "skills": ["skill1", "skill2", ...],
  "experience_summary": "A 2-3 sentence summary of their work experience",
  "projects": ["Project 1: brief description", ...],
  "education": "Degree, University, Year"
}

Rules:
- skills: extract ALL technical and soft skills mentioned
- experience_summary: summarize roles, companies, and years of experience
- projects: list each project with a one-line description
- education: most recent degree with institution
- If a section is not found, use empty string or empty array
`;

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

// ─── Query Resume ─────────────────────────────────────────────────────────────

const RELEVANCE_THRESHOLD = 0.2;

interface QueryResult {
  answer: string;
  sources: { chunkText: string; sectionType: string; relevanceScore: number }[];
  confidence: number;
}

export async function queryResume(userId: number, question: string): Promise<QueryResult> {
  const chunks = await sql`SELECT COUNT(*) AS count FROM resume_chunks WHERE user_id = ${userId}`;
  if (!chunks[0] || Number(chunks[0].count) === 0) {
    return { answer: "This candidate's resume has not been indexed yet.", sources: [], confidence: 0 };
  }

  const queryEmbedding = await generateEmbedding(question);
  const embeddingStr = `[${queryEmbedding.join(",")}]`;

  const topChunks = await sql`
    SELECT chunk_text, section_type, 1 - (embedding <=> ${embeddingStr}::vector) AS similarity
    FROM resume_chunks WHERE user_id = ${userId}
    ORDER BY embedding <=> ${embeddingStr}::vector LIMIT 5
  `;

  const relevantChunks = topChunks.filter((c: any) => Number(c.similarity) >= RELEVANCE_THRESHOLD);
  if (relevantChunks.length === 0) {
    return { answer: "No relevant information found in this candidate's resume.", sources: [], confidence: 0 };
  }

  const context = relevantChunks.map((c: any, i: number) => `[Source ${i + 1} — ${c.section_type}]\n${c.chunk_text}`).join("\n\n---\n\n");

  const structuredRows = await sql`SELECT skills, experience_summary FROM resume_structured WHERE user_id = ${userId}`;
  const structured = structuredRows[0] || {};
  let structuredContext = "";
  if (structured.skills?.length > 0) structuredContext += `\nCandidate Skills: ${structured.skills.join(", ")}`;
  if (structured.experience_summary) structuredContext += `\nExperience Summary: ${structured.experience_summary}`;

  const prompt = `
You are an AI hiring assistant analyzing a candidate's resume for a recruiter.
Answer the recruiter's question accurately based ONLY on the resume information provided.

CRITICAL RULES:
- ONLY use information from the provided resume context
- If the resume doesn't contain enough info, say "The resume does not contain specific information about this."
- Be concise and professional
- Do NOT make assumptions

--- RESUME CONTEXT ---
${context}
${structuredContext}
--- END CONTEXT ---

Recruiter's Question: ${question}
`;

  const answer = await askGroq(prompt);
  const avgSimilarity = relevantChunks.reduce((sum: number, c: any) => sum + Number(c.similarity), 0) / relevantChunks.length;

  return {
    answer: answer.trim(),
    sources: relevantChunks.map((c: any) => ({
      chunkText: c.chunk_text,
      sectionType: c.section_type,
      relevanceScore: Math.round(Number(c.similarity) * 100) / 100,
    })),
    confidence: Math.round(avgSimilarity * 100) / 100,
  };
}

// ─── Query Resume vs Job Description ─────────────────────────────────────────

export async function queryResumeVsJob(userId: number, question: string, jobDescription: string): Promise<QueryResult> {
  const chunks = await sql`SELECT COUNT(*) AS count FROM resume_chunks WHERE user_id = ${userId}`;
  if (!chunks[0] || Number(chunks[0].count) === 0) {
    return { answer: "This candidate's resume has not been indexed yet.", sources: [], confidence: 0 };
  }

  const combinedQuery = `${question}\n\nJob Description Context: ${jobDescription.substring(0, 500)}`;
  const queryEmbedding = await generateEmbedding(combinedQuery);
  const embeddingStr = `[${queryEmbedding.join(",")}]`;

  const topChunks = await sql`
    SELECT chunk_text, section_type, 1 - (embedding <=> ${embeddingStr}::vector) AS similarity
    FROM resume_chunks WHERE user_id = ${userId}
    ORDER BY embedding <=> ${embeddingStr}::vector LIMIT 6
  `;

  const relevantChunks = topChunks.filter((c: any) => Number(c.similarity) >= RELEVANCE_THRESHOLD);
  if (relevantChunks.length === 0) {
    return { answer: "No relevant information found to compare with the job description.", sources: [], confidence: 0 };
  }

  const context = relevantChunks.map((c: any, i: number) => `[Source ${i + 1} — ${c.section_type}]\n${c.chunk_text}`).join("\n\n---\n\n");
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
  const avgSimilarity = relevantChunks.reduce((sum: number, c: any) => sum + Number(c.similarity), 0) / relevantChunks.length;

  return {
    answer: answer.trim(),
    sources: relevantChunks.map((c: any) => ({
      chunkText: c.chunk_text,
      sectionType: c.section_type,
      relevanceScore: Math.round(Number(c.similarity) * 100) / 100,
    })),
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
