/**
 * Resume RAG — Core Intelligence Module
 *
 * Handles the full pipeline:
 *   1. processResume()  — PDF → text → chunks → embeddings → pgvector
 *   2. queryResume()    — question → embed → similarity search → Groq LLM → answer
 *   3. queryResumeVsJob() — question + job description → context-aware answer
 */

import { sql } from "./db.js";
import { generateEmbedding } from "./embedding.js";
import { PDFParse } from "pdf-parse";
import Groq from "groq-sdk";
import dotenv from "dotenv";

dotenv.config();

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// ─── LLM Helper ──────────────────────────────────────────────────────────────

async function askGroq(prompt: string): Promise<string> {
  const completion = await groq.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    messages: [{ role: "user", content: prompt }],
    temperature: 0.4, // lower for factual resume answers
  });
  return completion.choices[0]?.message?.content ?? "";
}

// ─── Section Detection ───────────────────────────────────────────────────────

interface ResumeChunk {
  text: string;
  sectionType: string;
}

const SECTION_PATTERNS: [RegExp, string][] = [
  [/\b(skills?|technical\s*skills?|core\s*competenc|technologies|tech\s*stack)\b/i, "skills"],
  [/\b(experience|work\s*experience|employment|professional\s*experience|work\s*history)\b/i, "experience"],
  [/\b(education|academic|qualification|degree|university|college)\b/i, "education"],
  [/\b(project|personal\s*project|academic\s*project|side\s*project)\b/i, "projects"],
  [/\b(summary|objective|profile|about\s*me|introduction)\b/i, "summary"],
  [/\b(certif|award|achievement|honor|accomplishment)\b/i, "achievements"],
  [/\b(volunteer|extra.?curricular|activities|interests|hobbies)\b/i, "other"],
];

function detectSectionType(text: string): string {
  const firstLine = text.split("\n")[0] || "";
  // 1. Check the first line (likely a section header)
  for (const [pattern, type] of SECTION_PATTERNS) {
    if (pattern.test(firstLine)) return type;
  }
  // 2. Check first 300 chars for header-like patterns
  for (const [pattern, type] of SECTION_PATTERNS) {
    if (pattern.test(text.substring(0, 300))) return type;
  }
  // 3. Content-based detection — scan the entire chunk for signals
  const lower = text.toLowerCase();
  if (/\b(java|python|react|node|typescript|javascript|sql|docker|aws|kubernetes|git|html|css|c\+\+)\b/i.test(text) &&
      (lower.includes("language") || lower.includes("framework") || lower.includes("tool") || 
       text.split(/[,|•·]/).length > 4)) {
    return "skills";
  }
  if (/\b(\d{4}\s*[-–]\s*(\d{4}|present|current))\b/i.test(text) ||
      /\b(intern|engineer|developer|manager|analyst|lead|senior|junior)\b/i.test(text)) {
    return "experience";
  }
  if (/\b(bachelor|master|b\.?tech|m\.?tech|b\.?sc|m\.?sc|degree|gpa|cgpa|semester)\b/i.test(text)) {
    return "education";
  }
  if (/\b(built|developed|created|implemented|designed|deployed|full.?stack|web\s*app|mobile\s*app)\b/i.test(text) &&
      lower.includes("project")) {
    return "projects";
  }
  if (/\b(leetcode|codeforces|hackathon|winner|award|certificate|certified|rank)\b/i.test(text)) {
    return "achievements";
  }
  return "other";
}

// ─── Text Chunking ───────────────────────────────────────────────────────────

function chunkResumeText(fullText: string): ResumeChunk[] {
  const chunks: ResumeChunk[] = [];

  // Split by common section headers (lines that are mostly uppercase or short titles)
  const sectionSplitRegex =
    /\n(?=[A-Z][A-Z\s&/,.:()-]{2,}\n)|(?=\n(?:SKILLS|EXPERIENCE|EDUCATION|PROJECTS|SUMMARY|OBJECTIVE|CERTIF|AWARDS|ACHIEVEMENTS|WORK|TECHNICAL|PROFESSIONAL|PERSONAL|ACADEMIC))/gi;

  const rawSections = fullText
    .split(sectionSplitRegex)
    .map((s) => s.trim())
    .filter((s) => s.length > 20); // skip tiny fragments

  if (rawSections.length <= 1) {
    // Fallback: split by double newlines
    const paragraphs = fullText
      .split(/\n\s*\n/)
      .map((p) => p.trim())
      .filter((p) => p.length > 20);

    // Group into chunks of ~500 characters
    let buffer = "";
    for (const para of paragraphs) {
      if (buffer.length + para.length > 600 && buffer.length > 0) {
        chunks.push({
          text: buffer.trim(),
          sectionType: detectSectionType(buffer),
        });
        buffer = para;
      } else {
        buffer += (buffer ? "\n\n" : "") + para;
      }
    }
    if (buffer.trim().length > 20) {
      chunks.push({
        text: buffer.trim(),
        sectionType: detectSectionType(buffer),
      });
    }
  } else {
    // Use detected sections
    for (const section of rawSections) {
      // If a section is very large, sub-chunk it
      if (section.length > 1000) {
        const subParagraphs = section
          .split(/\n\s*\n/)
          .map((p) => p.trim())
          .filter((p) => p.length > 20);

        let buffer = "";
        const sectionType = detectSectionType(section);

        for (const para of subParagraphs) {
          if (buffer.length + para.length > 600 && buffer.length > 0) {
            chunks.push({ text: buffer.trim(), sectionType });
            buffer = para;
          } else {
            buffer += (buffer ? "\n\n" : "") + para;
          }
        }
        if (buffer.trim().length > 20) {
          chunks.push({ text: buffer.trim(), sectionType });
        }
      } else {
        chunks.push({
          text: section,
          sectionType: detectSectionType(section),
        });
      }
    }
  }

  return chunks.length > 0
    ? chunks
    : [{ text: fullText.substring(0, 2000), sectionType: "other" }];
}

// ─── Structured Extraction via LLM ──────────────────────────────────────────

interface StructuredResume {
  skills: string[];
  experience_summary: string;
  projects: string[];
  education: string;
}

async function extractStructuredData(
  fullText: string
): Promise<StructuredResume> {
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
  "projects": ["Project 1: brief description", "Project 2: brief description", ...],
  "education": "Degree, University, Year"
}

Rules:
- skills: extract ALL technical and soft skills mentioned
- experience_summary: summarize roles, companies, and years of experience
- projects: list each project with a one-line description
- education: most recent degree with institution
- If a section is not found, use empty string or empty array
`;

  const rawText = (await askGroq(prompt))
    .replace(/```json/g, "")
    .replace(/```/g, "")
    .trim();

  try {
    return JSON.parse(rawText);
  } catch {
    return {
      skills: [],
      experience_summary: "",
      projects: [],
      education: "",
    };
  }
}

// ─── Process Resume (Full Pipeline) ─────────────────────────────────────────

export async function processResume(
  userId: number,
  pdfBuffer: Buffer
): Promise<{ chunksCreated: number; structured: StructuredResume }> {
  // 1. Extract text from PDF
  const parser = new PDFParse({ data: pdfBuffer });
  const pdfData = await parser.getText();
  await parser.destroy();
  const fullText = pdfData.text;

  if (!fullText || fullText.trim().length < 50) {
    throw new Error("Could not extract meaningful text from the PDF");
  }

  // 2. Delete old embeddings (re-index strategy)
  await sql`DELETE FROM resume_chunks WHERE user_id = ${userId}`;
  await sql`DELETE FROM resume_structured WHERE user_id = ${userId}`;

  // 3. Chunk the resume
  const chunks = chunkResumeText(fullText);

  // 4. Extract structured data
  const structured = await extractStructuredData(fullText);

  // 5. Generate embeddings and store each chunk
  for (const chunk of chunks) {
    const embedding = await generateEmbedding(chunk.text);
    const embeddingStr = `[${embedding.join(",")}]`;

    await sql`
      INSERT INTO resume_chunks (user_id, chunk_text, section_type, embedding)
      VALUES (${userId}, ${chunk.text}, ${chunk.sectionType}, ${embeddingStr}::vector)
    `;
  }

  // 6. Store structured data
  await sql`
    INSERT INTO resume_structured (user_id, skills, experience_summary, projects, education, full_text, processed_at)
    VALUES (
      ${userId},
      ${structured.skills},
      ${structured.experience_summary},
      ${structured.projects},
      ${structured.education},
      ${fullText.substring(0, 10000)},
      NOW()
    )
  `;

  console.log(
    `✅ Resume indexed for user ${userId}: ${chunks.length} chunks, ${structured.skills.length} skills extracted`
  );

  return { chunksCreated: chunks.length, structured };
}

// ─── Query Resume (RAG Flow) ────────────────────────────────────────────────

const RELEVANCE_THRESHOLD = 0.2; // MiniLM on short resume text produces lower raw similarity

interface QueryResult {
  answer: string;
  sources: {
    chunkText: string;
    sectionType: string;
    relevanceScore: number;
  }[];
  confidence: number;
}

export async function queryResume(
  userId: number,
  question: string
): Promise<QueryResult> {
  // 1. Check if resume is indexed
  const chunks = await sql`
    SELECT COUNT(*) as count FROM resume_chunks WHERE user_id = ${userId}
  `;

  if (!chunks[0] || Number(chunks[0].count) === 0) {
    return {
      answer:
        "This candidate's resume has not been indexed yet. Please wait for the resume to be processed.",
      sources: [],
      confidence: 0,
    };
  }

  // 2. Generate query embedding
  const queryEmbedding = await generateEmbedding(question);
  const embeddingStr = `[${queryEmbedding.join(",")}]`;

  // 3. Retrieve top-k chunks by cosine similarity
  const topChunks = await sql`
    SELECT
      chunk_text,
      section_type,
      1 - (embedding <=> ${embeddingStr}::vector) AS similarity
    FROM resume_chunks
    WHERE user_id = ${userId}
    ORDER BY embedding <=> ${embeddingStr}::vector
    LIMIT 5
  `;

  // 4. Query guardrail — check if any chunks are relevant enough
  const relevantChunks = topChunks.filter(
    (c: any) => Number(c.similarity) >= RELEVANCE_THRESHOLD
  );

  if (relevantChunks.length === 0) {
    return {
      answer:
        "No relevant information was found in this candidate's resume for your question. The resume may not contain details on this topic.",
      sources: [],
      confidence: 0,
    };
  }

  // 5. Build context from retrieved chunks
  const context = relevantChunks
    .map(
      (c: any, i: number) =>
        `[Source ${i + 1} — ${c.section_type}]\n${c.chunk_text}`
    )
    .join("\n\n---\n\n");

  // 6. Also fetch structured data for extra context
  const structuredRows = await sql`
    SELECT skills, experience_summary, projects, education
    FROM resume_structured
    WHERE user_id = ${userId}
  `;
  const structured = structuredRows[0] || {};

  let structuredContext = "";
  if (structured.skills?.length > 0) {
    structuredContext += `\nCandidate Skills: ${structured.skills.join(", ")}`;
  }
  if (structured.experience_summary) {
    structuredContext += `\nExperience Summary: ${structured.experience_summary}`;
  }

  // 7. Generate answer via LLM
  const prompt = `
You are an AI hiring assistant analyzing a candidate's resume for a recruiter.
Answer the recruiter's question accurately based ONLY on the resume information provided.

CRITICAL RULES:
- ONLY use information from the provided resume context
- If the resume doesn't contain enough info to answer, say "The resume does not contain specific information about this."
- Be concise and professional
- Reference specific details from the resume (years, technologies, companies, etc.)
- Do NOT make assumptions or add information not present in the resume

--- RESUME CONTEXT ---
${context}
${structuredContext}
--- END CONTEXT ---

Recruiter's Question: ${question}

Provide a clear, professional answer:
`;

  const answer = await askGroq(prompt);

  // 8. Calculate confidence as average similarity of used chunks
  const avgSimilarity =
    relevantChunks.reduce((sum: number, c: any) => sum + Number(c.similarity), 0) /
    relevantChunks.length;

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

// ─── Query Resume vs Job Description ────────────────────────────────────────

export async function queryResumeVsJob(
  userId: number,
  question: string,
  jobDescription: string
): Promise<QueryResult> {
  // 1. Check if resume is indexed
  const chunks = await sql`
    SELECT COUNT(*) as count FROM resume_chunks WHERE user_id = ${userId}
  `;

  if (!chunks[0] || Number(chunks[0].count) === 0) {
    return {
      answer:
        "This candidate's resume has not been indexed yet. Please wait for the resume to be processed.",
      sources: [],
      confidence: 0,
    };
  }

  // 2. Generate combined query embedding (question + job context)
  const combinedQuery = `${question}\n\nJob Description Context: ${jobDescription.substring(0, 500)}`;
  const queryEmbedding = await generateEmbedding(combinedQuery);
  const embeddingStr = `[${queryEmbedding.join(",")}]`;

  // 3. Retrieve top-k chunks by cosine similarity
  const topChunks = await sql`
    SELECT
      chunk_text,
      section_type,
      1 - (embedding <=> ${embeddingStr}::vector) AS similarity
    FROM resume_chunks
    WHERE user_id = ${userId}
    ORDER BY embedding <=> ${embeddingStr}::vector
    LIMIT 6
  `;

  const relevantChunks = topChunks.filter(
    (c: any) => Number(c.similarity) >= RELEVANCE_THRESHOLD
  );

  if (relevantChunks.length === 0) {
    return {
      answer:
        "No relevant information was found in this candidate's resume to compare with the job description.",
      sources: [],
      confidence: 0,
    };
  }

  // 4. Build context
  const context = relevantChunks
    .map(
      (c: any, i: number) =>
        `[Source ${i + 1} — ${c.section_type}]\n${c.chunk_text}`
    )
    .join("\n\n---\n\n");

  // 5. Fetch structured data
  const structuredRows = await sql`
    SELECT skills, experience_summary, projects, education
    FROM resume_structured
    WHERE user_id = ${userId}
  `;
  const structured = structuredRows[0] || {};

  // 6. Generate answer
  const prompt = `
You are an AI hiring assistant. A recruiter is comparing a candidate's resume against a job description.
Answer the recruiter's question by analyzing BOTH the resume and job description.

CRITICAL RULES:
- Use information from the provided resume context
- Compare it against the job description requirements
- Highlight matches and gaps
- Be specific about what the candidate has vs what the job requires
- Do NOT fabricate information

--- RESUME CONTEXT ---
${context}
${structured.skills?.length > 0 ? `\nCandidate Skills: ${structured.skills.join(", ")}` : ""}
${structured.experience_summary ? `\nExperience: ${structured.experience_summary}` : ""}
--- END RESUME ---

--- JOB DESCRIPTION ---
${jobDescription.substring(0, 3000)}
--- END JOB DESCRIPTION ---

Recruiter's Question: ${question}

Provide a clear, comparative analysis:
`;

  const answer = await askGroq(prompt);

  const avgSimilarity =
    relevantChunks.reduce((sum: number, c: any) => sum + Number(c.similarity), 0) /
    relevantChunks.length;

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

// ─── Get Resume Index Status ────────────────────────────────────────────────

export async function getResumeStatus(
  userId: number
): Promise<{ indexed: boolean; chunksCount: number; processedAt: string | null; structured: any | null }> {
  const chunks = await sql`
    SELECT COUNT(*) as count FROM resume_chunks WHERE user_id = ${userId}
  `;

  const structuredRows = await sql`
    SELECT * FROM resume_structured WHERE user_id = ${userId}
  `;

  const count = Number(chunks[0]?.count || 0);
  const structured = structuredRows[0] || null;

  return {
    indexed: count > 0,
    chunksCount: count,
    processedAt: structured?.processed_at || null,
    structured: structured
      ? {
          skills: structured.skills,
          experience_summary: structured.experience_summary,
          projects: structured.projects,
          education: structured.education,
        }
      : null,
  };
}
