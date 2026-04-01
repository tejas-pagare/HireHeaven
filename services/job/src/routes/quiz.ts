import express from "express";
import { isAuth } from "../middlewares/auth.js";
import { createQuiz, getQuizByJob, submitQuizAttempt } from "../controllers/quiz.js";

const router = express.Router();

router.post("/new", isAuth, createQuiz);
router.get("/job/:job_id", isAuth, getQuizByJob);
router.post("/attempt", isAuth, submitQuizAttempt);

export default router;
