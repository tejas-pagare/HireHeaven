import { Request, Response } from "express";
import cloudinary from "cloudinary";
// @ts-ignore
import pdfParse from "pdf-parse";
import Groq from "groq-sdk";
import dotenv from "dotenv";
import { AuthenticatedRequest } from "../../middleware/auth.js";
import { processResume, queryResume, queryResumeVsJob, getResumeStatus } from "./resume-rag.js";

dotenv.config();

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// ── Groq Helper ────────────────────────────────────────────────────────────────
async function askGroq(prompt: string): Promise<string> {
  const completion = await groq.chat.completions.create({
    model: "openai/gpt-oss-120b",
    messages: [{ role: "user", content: prompt }],
    temperature: 0.7,
  });
  return completion.choices[0]?.message?.content ?? "";
}

function parseGroqJson(raw: string): any {
  const cleaned = raw
    .replace(/<\|im_start\|>system\n.*?\n/gs, "")
    .replace(/```json/g, "")
    .replace(/```/g, "")
    .trim();

  try {
    return JSON.parse(cleaned);
  } catch {
    const ultraCleaned = cleaned.replace(/[\u0000-\u001F\u007F-\u009F]/g, "");
    return JSON.parse(ultraCleaned);
  }
}

// ── Upload to Cloudinary ───────────────────────────────────────────────────────
export const uploadFile = async (req: Request, res: Response): Promise<void> => {
  try {
    const { buffer, public_id } = req.body;
    if (public_id) await cloudinary.v2.uploader.destroy(public_id);
    const result = await cloudinary.v2.uploader.upload(buffer);
    res.json({ url: result.secure_url, public_id: result.public_id });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// ── Career Path Advisor ────────────────────────────────────────────────────────
export const careerAdvice = async (req: Request, res: Response): Promise<void> => {
  try {
    const { skills } = req.body;
    if (!skills) { res.status(400).json({ message: "Skills required" }); return; }

    const prompt = `
Based on the following skills: ${skills}.

Please act as a career advisor and generate a career path suggestion.
Your entire response must be in a valid JSON format. Do not include any text or markdown formatting outside of the JSON structure.

The JSON object should have the following structure:
{
 "summary": "A brief, encouraging summary of the user's skill set and their general job title.",
 "jobOptions": [
 {
   "title": "The name of the job role.",
   "responsibilities": "A description of what the user would do in this role.",
   "why": "An explanation of why this role is a good fit for their skills."
 }
 ],
 "skillsToLearn": [
 {
   "category": "A general category for skill improvement.",
   "skills": [
     {
       "title": "The name of the skill to learn.",
       "why": "Why learning this skill is important.",
       "how": "Specific examples of how to learn or apply this skill."
     }
   ]
 }
 ],
 "learningApproach": {
   "title": "How to Approach Learning",
   "points": ["A bullet point list of actionable advice for learning."]
 }
}
    `;

    const result = parseGroqJson(await askGroq(prompt));
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// ── Resume ATS Analyser ───────────────────────────────────────────────────────
export const resumeAnalyser = async (req: Request, res: Response): Promise<void> => {
  try {
    const { pdfBase64 } = req.body;
    if (!pdfBase64) { res.status(400).json({ message: "PDF data is required" }); return; }

    const base64Data = pdfBase64.replace(/^data:application\/pdf;base64,/, "");
    const pdfBuffer = Buffer.from(base64Data, "base64");
    const pdfData = await pdfParse(pdfBuffer);
    const extractedText = pdfData.text.substring(0, 6000);

    const prompt = `
You are an expert ATS (Applicant Tracking System) analyzer. Analyze the following resume text and provide:
1. An ATS compatibility score (0-100)
2. Detailed suggestions to improve the resume for better ATS performance

Resume text:
"""
${extractedText}
"""

Your entire response must be in valid JSON format. Do not include any text or markdown formatting outside of the JSON structure.

The JSON object should have the following structure:
{
  "atsScore": 85,
  "scoreBreakdown": {
    "formatting": { "score": 90, "feedback": "Brief feedback on formatting" },
    "keywords": { "score": 80, "feedback": "Brief feedback on keyword usage" },
    "structure": { "score": 85, "feedback": "Brief feedback on resume structure" },
    "readability": { "score": 88, "feedback": "Brief feedback on readability" }
  },
  "suggestions": [
    {
      "category": "Category name",
      "issue": "Description of the issue found",
      "recommendation": "Specific actionable recommendation",
      "priority": "high/medium/low"
    }
  ],
  "strengths": ["List of things the resume does well for ATS"],
  "summary": "A brief 2-3 sentence summary of the overall ATS performance"
}
    `;

    const result = parseGroqJson(await askGroq(prompt));
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// ── ATS Job Match ─────────────────────────────────────────────────────────────
export const atsJobMatch = async (req: Request, res: Response): Promise<void> => {
  try {
    const { pdfBase64, resumeUrl, jobDescription } = req.body;
    if (!jobDescription) { res.status(400).json({ message: "Job Description is required" }); return; }
    if (!pdfBase64 && !resumeUrl) { res.status(400).json({ message: "Either PDF data or resume URL is required" }); return; }

    let pdfBuffer: Buffer;
    if (pdfBase64) {
      pdfBuffer = Buffer.from(pdfBase64.replace(/^data:application\/pdf;base64,/, ""), "base64");
    } else {
      const response = await fetch(resumeUrl);
      if (!response.ok) throw new Error(`Failed to fetch resume: ${response.statusText}`);
      pdfBuffer = Buffer.from(await response.arrayBuffer());
    }

    const pdfData = await pdfParse(pdfBuffer);
    const extractedText = pdfData.text.substring(0, 6000);

    const prompt = `
You are an expert ATS analyzer and Recruiter. Analyze the following resume against the provided Job Description.
1. An ATS match score (0-100) indicating how well the resume matches the job description.
2. Detailed suggestions to improve the resume for this specific job.

Job Description:
"""
${jobDescription}
"""

Resume text:
"""
${extractedText}
"""

Your entire response must be in valid JSON format. Do not include any text or markdown formatting outside of the JSON structure.

The JSON object should have the following structure:
{
  "atsScore": 85,
  "scoreBreakdown": {
    "formatting": { "score": 90, "feedback": "Brief feedback on formatting" },
    "keywords": { "score": 80, "feedback": "Brief feedback on keyword usage compared to job description" },
    "structure": { "score": 85, "feedback": "Brief feedback on resume structure" },
    "readability": { "score": 88, "feedback": "Brief feedback on readability" }
  },
  "suggestions": [
    {
      "category": "Category name",
      "issue": "Description of the gap between resume and job description",
      "recommendation": "Specific actionable recommendation",
      "priority": "high/medium/low"
    }
  ],
  "strengths": ["List of strong matches between the resume and the job requirements"],
  "summary": "A brief 2-3 sentence summary of how well the candidate fits the role"
}
    `;

    const result = parseGroqJson(await askGroq(prompt));
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// ── Generate Quiz ─────────────────────────────────────────────────────────────
export const generateQuiz = async (req: Request, res: Response): Promise<void> => {
  try {
    const { jobDescription, questionCount = 5 } = req.body;
    if (!jobDescription) { res.status(400).json({ message: "Job Description is required" }); return; }

    const prompt = `
You are an expert technical recruiter and interviewer. Based on the following Job Description, generate a multiple-choice quiz with ${questionCount} questions.

Job Description:
"""
${jobDescription}
"""

Your entire response must be in valid JSON format ONLY. Do not include any markdown formatting, explanations, or text outside the JSON array.

The JSON should be an array of objects matching this exact structure:
[
  {
    "text": "Question text here",
    "options": ["Option A", "Option B", "Option C", "Option D"],
    "correct_answer_index": 0
  }
]

Ensure:
- Questions vary in difficulty but are relevant to the required skills.
- options array must have exactly 4 strings.
- correct_answer_index must refer to the 0-indexed correct option.
`;

    const result = parseGroqJson(await askGroq(prompt));
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// ── Resume RAG: Process/Upload ─────────────────────────────────────────────────
export const uploadResume = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { userId, pdfBase64, resumeUrl } = req.body;
    const targetUserId = userId || req.user?.user_id;

    if (!targetUserId) { res.status(400).json({ message: "userId is required" }); return; }
    if (!pdfBase64 && !resumeUrl) { res.status(400).json({ message: "Either pdfBase64 or resumeUrl is required" }); return; }

    let pdfBuffer: Buffer;
    if (pdfBase64) {
      pdfBuffer = Buffer.from(pdfBase64.replace(/^data:application\/pdf;base64,/, ""), "base64");
    } else {
      const response = await fetch(resumeUrl);
      if (!response.ok) throw new Error(`Failed to fetch resume: ${response.statusText}`);
      pdfBuffer = Buffer.from(await response.arrayBuffer());
    }

    const result = await processResume(targetUserId, pdfBuffer);
    res.json({ success: true, message: `Resume indexed — ${result.chunksCreated} chunks created`, ...result });
  } catch (error: any) {
    console.error("Resume upload/index error:", error);
    res.status(500).json({ message: error.message || "Failed to process resume" });
  }
};

// ── Resume RAG: Access Control ────────────────────────────────────────────────
import { sql } from "../../db.js";

/**
 * A candidate may only query their own resume. A recruiter may query a
 * candidate's resume only if that candidate has actually applied to one of
 * the recruiter's own jobs — being logged in as "any recruiter" used to be
 * enough to pull any candidate's resume summary or ask arbitrary questions
 * about it.
 */
async function assertResumeAccess(req: AuthenticatedRequest, targetUserId: number): Promise<boolean> {
  if (!req.user) return false;
  if (req.user.user_id === targetUserId) return true;
  if (req.user.role !== "recruiter") return false;

  const [relationship] = await sql`
    SELECT 1 FROM applications a
    JOIN jobs j ON a.job_id = j.job_id
    WHERE a.applicant_id = ${targetUserId} AND j.posted_by_recuriter_id = ${req.user.user_id}
    LIMIT 1
  `;
  return Boolean(relationship);
}

// ── Resume RAG: Query ─────────────────────────────────────────────────────────
export const queryResumeEndpoint = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { userId, question } = req.body;
    if (!userId) { res.status(400).json({ message: "userId is required" }); return; }
    if (!question || question.trim().length < 3) { res.status(400).json({ message: "A valid question is required" }); return; }
    if (!(await assertResumeAccess(req, Number(userId)))) {
      res.status(403).json({ message: "You do not have access to this candidate's resume" });
      return;
    }
    const result = await queryResume(userId, question);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ message: error.message || "Failed to query resume" });
  }
};

// ── Resume RAG: Query vs Job ──────────────────────────────────────────────────
export const queryResumeVsJobEndpoint = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { userId, question, jobDescription } = req.body;
    if (!userId) { res.status(400).json({ message: "userId is required" }); return; }
    if (!question || question.trim().length < 3) { res.status(400).json({ message: "A valid question is required" }); return; }
    if (!jobDescription || jobDescription.trim().length < 10) { res.status(400).json({ message: "A valid job description is required" }); return; }
    if (!(await assertResumeAccess(req, Number(userId)))) {
      res.status(403).json({ message: "You do not have access to this candidate's resume" });
      return;
    }
    const result = await queryResumeVsJob(userId, question, jobDescription);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ message: error.message || "Failed to query resume" });
  }
};

// ── Resume RAG: Status ────────────────────────────────────────────────────────
export const resumeStatusEndpoint = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = parseInt(req.params.userId as string, 10);
    if (isNaN(userId)) { res.status(400).json({ message: "Invalid userId" }); return; }
    if (!(await assertResumeAccess(req, userId))) {
      res.status(403).json({ message: "You do not have access to this candidate's resume" });
      return;
    }
    const status = await getResumeStatus(userId);
    res.json(status);
  } catch (error: any) {
    res.status(500).json({ message: error.message || "Failed to get resume status" });
  }
};

// ── AI Interview Result ───────────────────────────────────────────────────────
export const getAiInterviewResult = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const applicationId = parseInt(req.params.applicationId as string, 10);
    if (isNaN(applicationId)) { res.status(400).json({ message: "Invalid applicationId" }); return; }

    const [row] = await sql`
      SELECT ai.*, a.applicant_id, j.posted_by_recuriter_id
      FROM ai_interviews ai
      JOIN applications a ON a.application_id = ai.application_id
      JOIN jobs j ON j.job_id = a.job_id
      WHERE ai.application_id = ${applicationId}
    `;

    if (!row) {
      res.status(404).json({ message: "AI Interview result not found for this application." });
      return;
    }

    const isOwner = req.user?.user_id === row.applicant_id;
    const isHiringRecruiter = req.user?.role === "recruiter" && req.user?.user_id === row.posted_by_recuriter_id;
    if (!isOwner && !isHiringRecruiter) {
      res.status(403).json({ message: "You do not have access to this interview result" });
      return;
    }

    const { applicant_id, posted_by_recuriter_id, ...interview } = row;
    res.json(interview);
  } catch (error: any) {
    res.status(500).json({ message: error.message || "Failed to get AI interview result" });
  }
};
