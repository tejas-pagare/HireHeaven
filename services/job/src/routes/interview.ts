import express from "express";
import { isAuth } from "../middlewares/auth.js";
import { evaluateInterview, scheduleInterview } from "../controllers/interview.js";

const router = express.Router();

router.post("/schedule", isAuth, scheduleInterview);
router.post("/evaluate", isAuth, evaluateInterview);

export default router;
