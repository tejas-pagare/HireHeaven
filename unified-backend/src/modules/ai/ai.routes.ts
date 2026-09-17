import { Router } from "express";
import { isAuth } from "../../middleware/auth.js";
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

// ── File Upload (Cloudinary) ──────────────────────────────────────────────────
router.post("/upload", uploadFile);

// ── AI Features ───────────────────────────────────────────────────────────────
router.post("/career", careerAdvice);
router.post("/resume-analyser", resumeAnalyser);
router.post("/ats-job-match", atsJobMatch);
router.post("/generate-quiz", generateQuiz);

// ── Resume RAG (Intelligence) ─────────────────────────────────────────────────
router.post("/resume/upload", isAuth, uploadResume);
router.post("/resume/query", isAuth, queryResumeEndpoint);
router.post("/resume/query-job", isAuth, queryResumeVsJobEndpoint);
router.get("/resume/status/:userId", isAuth, resumeStatusEndpoint);
router.get("/interview/result/:applicationId", isAuth, getAiInterviewResult);

export default router;
