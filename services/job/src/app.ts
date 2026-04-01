import express from "express";
import jobRoutes from "./routes/job.js";
import quizRoutes from "./routes/quiz.js";
import interviewRoutes from "./routes/interview.js";
import cors from "cors";

const app = express();

app.use(cors({
  origin: "*",
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));

app.use(express.json());

app.use("/api/job", jobRoutes);
app.use("/api/quiz", quizRoutes);
app.use("/api/interview", interviewRoutes);

export default app;
