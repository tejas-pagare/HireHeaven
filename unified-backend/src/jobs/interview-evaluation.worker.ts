import { Worker } from "bullmq";
import { queueConnection } from "../utils/queueConnection.js";
import { runInterviewEvaluation } from "../modules/ai/interview-evaluation.js";
import type { InterviewEvaluationJob } from "../modules/ai/interview-evaluation.js";
import { INTERVIEW_EVALUATION_QUEUE } from "./interview-evaluation.queue.js";

/**
 * Bounded concurrency — processes a handful of interviews' Groq calls at
 * once rather than however many finish in the same instant. Running this
 * in-process (not a separate deployment) is the right amount of complexity
 * for the current scale; split it into a standalone worker process later if
 * evaluation volume grows enough to need independent scaling.
 */
const CONCURRENCY = Number(process.env.INTERVIEW_EVAL_CONCURRENCY) || 3;

export function startInterviewEvaluationWorker(): Worker<InterviewEvaluationJob> {
  const worker = new Worker<InterviewEvaluationJob>(
    INTERVIEW_EVALUATION_QUEUE,
    async (job) => {
      await runInterviewEvaluation(job.data);
    },
    { connection: queueConnection, concurrency: CONCURRENCY }
  );

  worker.on("completed", (job) => {
    console.log(`✅ Interview evaluation completed for application ${job.data.applicationId}`);
  });

  worker.on("failed", (job, err) => {
    console.error(`❌ Interview evaluation failed for application ${job?.data.applicationId}:`, err.message);
  });

  console.log(`🧵 Interview evaluation worker started (concurrency=${CONCURRENCY})`);
  return worker;
}
