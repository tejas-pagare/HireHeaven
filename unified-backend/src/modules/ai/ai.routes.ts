import { Router } from "express";
import { isAuth } from "../../middleware/auth.js";
import { createRateLimiter } from "../../middleware/rateLimiter.js";
import {
  uploadFile,
  careerAdvice,
  resumeAnalyser,
  atsJobMatch,
  generateQuiz,
  uploadResume,
  queryResumeEndpoint,
  queryResumeVsJobEndpoint,
  resumeStatusEndpoint,
  getAiInterviewResult,
} from "./ai.controller.js";

const router = Router();

// Every route here calls a metered LLM (Groq) or upload (Cloudinary) API —
// unauthenticated + unlimited access was an open cost/DoS surface. Rate
// limiting (IP-keyed when there's no logged-in user) closes that without
// requiring login — /career, /resume-analyser, /ats-job-match, and /upload
// are deliberately public, unauthenticated lead-gen tools (the landing page
// and job-details page call them with no Authorization header at all), so
// gating them behind isAuth would break a real product feature rather than
// close a hole. /generate-quiz is different: its only caller (the recruiter
// quiz builder) already authenticates, so isAuth is safe to require there.
const aiLimiter = createRateLimiter({ windowSeconds: 600, max: 20, prefix: "ai" });
const uploadLimiter = createRateLimiter({ windowSeconds: 600, max: 10, prefix: "upload" });

// ── File Upload (Cloudinary) ──────────────────────────────────────────────────
router.post("/upload", uploadLimiter, uploadFile);

// ── AI Features ───────────────────────────────────────────────────────────────
router.post("/career", aiLimiter, careerAdvice);
router.post("/resume-analyser", aiLimiter, resumeAnalyser);
router.post("/ats-job-match", aiLimiter, atsJobMatch);
router.post("/generate-quiz", isAuth, aiLimiter, generateQuiz);

// ── Resume RAG (Intelligence) ─────────────────────────────────────────────────
router.post("/resume/upload", isAuth, uploadLimiter, uploadResume);
router.post("/resume/query", isAuth, aiLimiter, queryResumeEndpoint);
router.post("/resume/query-job", isAuth, aiLimiter, queryResumeVsJobEndpoint);
router.get("/resume/status/:userId", isAuth, resumeStatusEndpoint);
router.get("/interview/result/:applicationId", isAuth, getAiInterviewResult);

export default router;
