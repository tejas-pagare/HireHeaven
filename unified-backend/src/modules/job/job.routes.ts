import { Router } from "express";
import { isAuth } from "../../middleware/auth.js";
import { upload } from "../../middleware/multer.js";
import {
  createCompany,
  deleteCompany,
  getAllCompany,
  getCompanyDetails,
  createJob,
  updateJob,
  getAllActiveJobs,
  getSingleJob,
  getAllApplicationsForJob,
  updateApplication,
} from "./job.controller.js";
import { scheduleInterview, evaluateInterview } from "./interview.controller.js";
import { createQuiz, getQuizByJob, submitQuizAttempt } from "./quiz.controller.js";
import { getJobSeekerAnalytics } from "./analytics.controller.js";

const router = Router();

// ── Company ───────────────────────────────────────────────────────────────────
router.post("/company", isAuth, upload.single("logo"), createCompany);
router.delete("/company/:companyId", isAuth, deleteCompany);
router.get("/company", isAuth, getAllCompany);
router.get("/company/:id", getCompanyDetails);

// ── Jobs ──────────────────────────────────────────────────────────────────────
router.post("/", isAuth, createJob);
router.put("/:jobId", isAuth, updateJob);
router.get("/", getAllActiveJobs);
router.get("/:jobId", getSingleJob);

// ── Applications ──────────────────────────────────────────────────────────────
router.get("/:jobId/applications", isAuth, getAllApplicationsForJob);
router.put("/application/:id", isAuth, updateApplication);

// ── Quiz ──────────────────────────────────────────────────────────────────────
router.post("/quiz", isAuth, createQuiz);
router.get("/quiz/:job_id", isAuth, getQuizByJob);
router.post("/quiz/submit", isAuth, submitQuizAttempt);

// ── Interview ─────────────────────────────────────────────────────────────────
router.post("/interview", isAuth, scheduleInterview);
router.post("/interview/evaluate", isAuth, evaluateInterview);

// ── Analytics ─────────────────────────────────────────────────────────────────
router.get("/analytics/jobseeker", isAuth, getJobSeekerAnalytics);

export default router;
