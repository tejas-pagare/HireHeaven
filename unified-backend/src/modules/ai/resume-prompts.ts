/**
 * Prompts + model settings for the résumé RAG copilot.
 *
 * Kept free of DB/LLM/pdf-parse imports so the offline generation eval
 * (scripts/eval-generation.ts) sends byte-for-byte the prompt production
 * sends, without constructing a DB client at import time.
 */

export const RAG_ANSWER_MODEL = "openai/gpt-oss-120b";
export const RAG_ANSWER_TEMPERATURE = 0.4;

/** Returned without an LLM call when retrieval finds nothing above the floor. */
export const NO_RELEVANT_INFO_ANSWER = "No relevant information found in this candidate's resume.";

/** The phrase the Q&A prompt tells the model to use when the context lacks the answer. */
export const MISSING_INFO_PHRASE = "The resume does not contain specific information about this.";

export function buildStructuredExtractionPrompt(fullText: string): string {
  return `
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
}

export function buildResumeQAPrompt(
  chunks: { chunkText: string; sectionType: string }[],
  structured: { skills?: string[] | null; experience_summary?: string | null },
  question: string
): string {
  const context = chunks.map((c, i) => `[Source ${i + 1} — ${c.sectionType}]\n${c.chunkText}`).join("\n\n---\n\n");

  let structuredContext = "";
  if (structured.skills && structured.skills.length > 0) structuredContext += `\nCandidate Skills: ${structured.skills.join(", ")}`;
  if (structured.experience_summary) structuredContext += `\nExperience Summary: ${structured.experience_summary}`;

  return `
You are an AI hiring assistant analyzing a candidate's resume for a recruiter.
Answer the recruiter's question accurately based ONLY on the resume information provided.

CRITICAL RULES:
- ONLY use information from the provided resume context
- If the resume doesn't contain enough info, say "${MISSING_INFO_PHRASE}"
- Be concise and professional
- Do NOT make assumptions

--- RESUME CONTEXT ---
${context}
${structuredContext}
--- END CONTEXT ---

Recruiter's Question: ${question}
`;
}
