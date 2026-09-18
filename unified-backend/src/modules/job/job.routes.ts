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
  getJobRounds,
  addJobRound,
  deleteJobRound,
  getApplicationTimeline,
} from "./job.controller.js";
import { scheduleInterview, evaluateInterview, cancelInterview } from "./interview.controller.js";
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

// ── Job Rounds ────────────────────────────────────────────────────────────────
router.get("/:jobId/rounds", getJobRounds);
router.post("/:jobId/rounds", isAuth, addJobRound);
router.delete("/:jobId/rounds/:roundId", isAuth, deleteJobRound);

// ── Applications ──────────────────────────────────────────────────────────────
router.get("/:jobId/applications", isAuth, getAllApplicationsForJob);
router.put("/application/:id", isAuth, updateApplication);
router.get("/application/:applicationId/timeline", isAuth, getApplicationTimeline);

// ── Quiz ──────────────────────────────────────────────────────────────────────
router.post("/quiz", isAuth, createQuiz);
router.get("/quiz/:job_id", isAuth, getQuizByJob);
router.post("/quiz/submit", isAuth, submitQuizAttempt);

// ── Interview ─────────────────────────────────────────────────────────────────
router.post("/interview", isAuth, scheduleInterview);
router.post("/interview/evaluate", isAuth, evaluateInterview);
router.delete("/interview/:interviewId", isAuth, cancelInterview);

// ── Analytics ─────────────────────────────────────────────────────────────────
router.get("/analytics/jobseeker", isAuth, getJobSeekerAnalytics);

export default router;
