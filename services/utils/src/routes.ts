import express from "express";
import cloudinary from "cloudinary";
import { PDFParse } from "pdf-parse";

import Groq from "groq-sdk";
import dotenv from "dotenv";

import { isAuth, AuthenticatedRequest } from "./auth.js";
import {
  processResume,
  queryResume,
  queryResumeVsJob,
  getResumeStatus,
} from "./resume-rag.js";

dotenv.config();

const router = express.Router();

router.post("/upload", async (req, res) => {
  try {
    const { buffer, public_id } = req.body;

    if (public_id) {
      await cloudinary.v2.uploader.destroy(public_id);
    }

    const cloud = await cloudinary.v2.uploader.upload(buffer);

    res.json({
      url: cloud.secure_url,
      public_id: cloud.public_id,
    });
  } catch (error: any) {
    res.status(500).json({
      message: error.message,
    });
  }
});

// ── AI Provider ──────────────────────────────────────────────────────────────
// Gemini (commented out — replaced by Groq)
// import { GoogleGenAI } from "@google/genai";
// const ai = new GoogleGenAI({ apiKey: process.env.API_KEY_GEMINI });


const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// ── Helper: call Groq and parse JSON response ────────────────────────────────
async function askGroq(prompt: string): Promise<string> {
  const completion = await groq.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    messages: [
      {
        role: "user",
        content: prompt,
      },
    ],
    temperature: 0.7,
  });

  const text = completion.choices[0]?.message?.content ?? "";
  return text;
}

// ── /career ──────────────────────────────────────────────────────────────────
router.post("/career", async (req, res) => {
  try {
    const { skills } = req.body;

    if (!skills) {
      return res.status(400).json({
        message: "Skills Required",
      });
    }

    const prompt = `
Based on the following skills: ${skills}.
 
Please act as a career advisor and generate a career path suggestion.
Your entire response must be in a valid JSON format. Do not include any text or markdown
formatting outside of the JSON structure.
 
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
   "category": "A general category for skill improvement (e.g., 'Deepen Your Existing Stack Mastery', 'DevOps & Cloud').",
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

    // Gemini version (commented out):
    // const response = await ai.models.generateContent({
    //   model: "gemini-2.5-flash",
    //   contents: prompt,
    // });
    // const rawText = response.text?.replace(/```json/g, "").replace(/```/g, "").trim();

    const rawText = (await askGroq(prompt))
      .replace(/```json/g, "")
      .replace(/```/g, "")
      .trim();

    let jsonResponse;
    try {
      if (!rawText) throw new Error("AI did not return a valid text response.");
      jsonResponse = JSON.parse(rawText);
    } catch (error) {
      return res.status(500).json({
        message: "AI returned a response that was not valid JSON",
        rawResponse: rawText,
      });
    }

    res.json(jsonResponse);
  } catch (error: any) {
    res.status(500).json({
      message: error.message,
    });
  }
});

// ── /resume-analyser ─────────────────────────────────────────────────────────
// NOTE: Groq is a text-only API (no native PDF/binary input like Gemini's inlineData).
// The PDF base64 is decoded to raw text (best-effort extraction) before being passed
// to the model. For a production setup, use a proper PDF text extractor (e.g. pdf-parse).
router.post("/resume-analyser", async (req, res) => {
  try {
    const { pdfBase64 } = req.body;

    if (!pdfBase64) {
      return res.status(400).json({ message: "PDF data is required" });
    }

    // Decode base64 → raw bytes
    const base64Data = pdfBase64.replace(/^data:application\/pdf;base64,/, "");
    const pdfBuffer = Buffer.from(base64Data, "base64");

    // Extract text from the PDF using pdf-parse
    const parser = new PDFParse({ data: pdfBuffer });
    const pdfData = await parser.getText();
    await parser.destroy();
    const extractedText = pdfData.text.substring(0, 6000); // stay within token limits

    const prompt = `
You are an expert ATS (Applicant Tracking System) analyzer. Analyze the following resume text
and provide:
1. An ATS compatibility score (0-100)
2. Detailed suggestions to improve the resume for better ATS performance

Resume text:
"""
${extractedText}
"""

Your entire response must be in valid JSON format. Do not include any text or markdown
formatting outside of the JSON structure.

The JSON object should have the following structure:
{
  "atsScore": 85,
  "scoreBreakdown": {
    "formatting": {
      "score": 90,
      "feedback": "Brief feedback on formatting"
    },
    "keywords": {
      "score": 80,
      "feedback": "Brief feedback on keyword usage"
    },
    "structure": {
      "score": 85,
      "feedback": "Brief feedback on resume structure"
    },
    "readability": {
      "score": 88,
      "feedback": "Brief feedback on readability"
    }
  },
  "suggestions": [
    {
      "category": "Category name (e.g., 'Formatting', 'Content', 'Keywords', 'Structure')",
      "issue": "Description of the issue found",
      "recommendation": "Specific actionable recommendation to fix it",
      "priority": "high/medium/low"
    }
  ],
  "strengths": [
    "List of things the resume does well for ATS"
  ],
  "summary": "A brief 2-3 sentence summary of the overall ATS performance"
}

Focus on: File format and structure compatibility, proper use of standard section headings,
keyword optimization, formatting issues (tables, columns, graphics, special characters),
contact information placement, date formatting, use of action verbs and quantifiable
achievements, section organization and flow.
    `;

    // Gemini version (commented out — used native PDF inlineData which Groq doesn't support):
    // const response = await ai.models.generateContent({
    //   model: "gemini-2.5-flash",
    //   contents: [
    //     {
    //       role: "user",
    //       parts: [
    //         { text: prompt },
    //         {
    //           inlineData: {
    //             mimeType: "application/pdf",
    //             data: pdfBase64.replace(/^data:application\/pdf;base64,/, ""),
    //           },
    //         },
    //       ],
    //     },
    //   ],
    // });
    // const rawText = response.text?.replace(/```json/g, "").replace(/```/g, "").trim();

    const rawText = (await askGroq(prompt))
      .replace(/```json/g, "")
      .replace(/```/g, "")
      .trim();

    let jsonResponse;
    try {
      if (!rawText) throw new Error("AI did not return a valid text response.");
      jsonResponse = JSON.parse(rawText);
    } catch (error) {
      return res.status(500).json({
        message: "AI returned a response that was not valid JSON",
        rawResponse: rawText,
      });
    }

    res.json(jsonResponse);
  } catch (error: any) {
    res.status(500).json({
      message: error.message,
    });
  }
});

// ── /ats-job-match ─────────────────────────────────────────────────────────────
router.post("/ats-job-match", async (req, res) => {
  try {
    const { pdfBase64, resumeUrl, jobDescription } = req.body;

    if (!jobDescription) {
      return res.status(400).json({ message: "Job Description is required" });
    }

    if (!pdfBase64 && !resumeUrl) {
      return res.status(400).json({ message: "Either PDF data or resume URL is required" });
    }

    let pdfBuffer: Buffer;

    if (pdfBase64) {
      // Decode base64 → raw bytes
      const base64Data = pdfBase64.replace(/^data:application\/pdf;base64,/, "");
      pdfBuffer = Buffer.from(base64Data, "base64");
    } else {
      // Fetch from URL
      const response = await fetch(resumeUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch resume from URL: ${response.statusText}`);
      }
      const arrayBuffer = await response.arrayBuffer();
      pdfBuffer = Buffer.from(arrayBuffer);
    }

    // Extract text from the PDF using pdf-parse
    const parser = new PDFParse({ data: pdfBuffer });
    const pdfData = await parser.getText();
    await parser.destroy();
    const extractedText = pdfData.text.substring(0, 6000); // stay within token limits

    const prompt = `
You are an expert ATS (Applicant Tracking System) analyzer and Recruiter. Analyze the following resume text against the provided Job Description and provide:
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
    "formatting": {
      "score": 90,
      "feedback": "Brief feedback on formatting"
    },
    "keywords": {
      "score": 80,
      "feedback": "Brief feedback on keyword usage compared to job description"
    },
    "structure": {
      "score": 85,
      "feedback": "Brief feedback on resume structure"
    },
    "readability": {
      "score": 88,
      "feedback": "Brief feedback on readability"
    }
  },
  "suggestions": [
    {
      "category": "Category name (e.g., 'Keywords', 'Experience', 'Projects')",
      "issue": "Description of the gap between resume and job description",
      "recommendation": "Specific actionable recommendation to fix it",
      "priority": "high/medium/low"
    }
  ],
  "strengths": [
    "List of strong matches between the resume and the job requirements"
  ],
  "summary": "A brief 2-3 sentence summary of how well the candidate fits the role"
}

Focus on: Identifying missing keywords from the job description, highlighting matching skills, evaluating if the experience level aligns, and providing actionable ways to tailor the resume for this specific role.
    `;

    const rawText = (await askGroq(prompt))
      .replace(/<|im_start|>system\n.*?\n/gs, '')
      .replace(/```json/g, "")
      .replace(/```/g, "")
      .trim();

    let jsonResponse;
    try {
      if (!rawText) throw new Error("AI did not return a valid text response.");
      jsonResponse = JSON.parse(rawText);
    } catch (error) {
      // fallback cleanup of control characters if JSON parse fails initially
      try {
        const cleanedText = rawText.replace(/[\u0000-\u001F\u007F-\u009F]/g, "");
        jsonResponse = JSON.parse(cleanedText);
      } catch (innerError) {
        return res.status(500).json({
          message: "AI returned a response that was not valid JSON",
          rawResponse: rawText,
        });
      }
    }

    res.json(jsonResponse);
  } catch (error: any) {
    res.status(500).json({
      message: error.message,
    });
  }
});

// ── /generate-quiz ─────────────────────────────────────────────────────────────
router.post("/generate-quiz", async (req, res) => {
  try {
    const { jobDescription, questionCount = 5 } = req.body;

    if (!jobDescription) {
      return res.status(400).json({ message: "Job Description is required" });
    }

    const prompt = `
You are an expert technical recruiter and interviewer. Based on the following Job Description, generate a multiple-choice quiz with ${questionCount} questions to assess a candidate's suitability for this role.

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

    const rawText = (await askGroq(prompt))
      .replace(/<|im_start|>system\n.*?\n/gs, '')
      .replace(/```json/g, "")
      .replace(/```/g, "")
      .trim();

    let jsonResponse;
    try {
      if (!rawText) throw new Error("AI did not return a valid text response.");
      jsonResponse = JSON.parse(rawText);
    } catch (error) {
      try {
        const cleanedText = rawText.replace(/[\u0000-\u001F\u007F-\u009F]/g, "");
        jsonResponse = JSON.parse(cleanedText);
      } catch (innerError) {
        return res.status(500).json({
          message: "AI returned a response that was not valid JSON",
          rawResponse: rawText,
        });
      }
    }

    res.json(jsonResponse);
  } catch (error: any) {
    res.status(500).json({
      message: error.message,
    });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// ── RESUME INTELLIGENCE (RAG) ENDPOINTS ─────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

// ── POST /resume/upload — Process & index a resume ──────────────────────────
router.post("/resume/upload", isAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { userId, pdfBase64, resumeUrl } = req.body;

    const targetUserId = userId || req.user?.user_id;

    if (!targetUserId) {
      return res.status(400).json({ message: "userId is required" });
    }

    if (!pdfBase64 && !resumeUrl) {
      return res
        .status(400)
        .json({ message: "Either pdfBase64 or resumeUrl is required" });
    }

    let pdfBuffer: Buffer;

    if (pdfBase64) {
      const base64Data = pdfBase64.replace(/^data:application\/pdf;base64,/, "");
      pdfBuffer = Buffer.from(base64Data, "base64");
    } else {
      const response = await fetch(resumeUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch resume from URL: ${response.statusText}`);
      }
      const arrayBuffer = await response.arrayBuffer();
      pdfBuffer = Buffer.from(arrayBuffer);
    }

    const result = await processResume(targetUserId, pdfBuffer);

    res.json({
      success: true,
      message: `Resume indexed successfully — ${result.chunksCreated} chunks created`,
      chunksCreated: result.chunksCreated,
      structured: result.structured,
    });
  } catch (error: any) {
    console.error("Resume upload/index error:", error);
    res.status(500).json({ message: error.message || "Failed to process resume" });
  }
});

// ── POST /resume/query — Ask a question about a candidate's resume ──────────
router.post("/resume/query", isAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { userId, question } = req.body;

    if (!userId) {
      return res.status(400).json({ message: "userId is required" });
    }

    if (!question || question.trim().length < 3) {
      return res.status(400).json({ message: "A valid question is required" });
    }

    const result = await queryResume(userId, question);
    res.json(result);
  } catch (error: any) {
    console.error("Resume query error:", error);
    res.status(500).json({ message: error.message || "Failed to query resume" });
  }
});

// ── POST /resume/query-job — Ask about resume vs job description ────────────
router.post("/resume/query-job", isAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { userId, question, jobDescription } = req.body;

    if (!userId) {
      return res.status(400).json({ message: "userId is required" });
    }

    if (!question || question.trim().length < 3) {
      return res.status(400).json({ message: "A valid question is required" });
    }

    if (!jobDescription || jobDescription.trim().length < 10) {
      return res
        .status(400)
        .json({ message: "A valid job description is required" });
    }

    const result = await queryResumeVsJob(userId, question, jobDescription);
    res.json(result);
  } catch (error: any) {
    console.error("Resume query-job error:", error);
    res.status(500).json({ message: error.message || "Failed to query resume" });
  }
});

// ── GET /resume/status/:userId — Check if resume is indexed ─────────────────
router.get("/resume/status/:userId", isAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = parseInt(req.params.userId as string, 10);

    if (isNaN(userId)) {
      return res.status(400).json({ message: "Invalid userId" });
    }

    const status = await getResumeStatus(userId);
    res.json(status);
  } catch (error: any) {
    console.error("Resume status error:", error);
    res.status(500).json({ message: error.message || "Failed to get resume status" });
  }
});

export default router;
