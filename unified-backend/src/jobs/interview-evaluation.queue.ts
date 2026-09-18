import { Queue } from "bullmq";
import { queueConnection } from "../utils/queueConnection.js";
import type { InterviewEvaluationJob } from "../modules/ai/interview-evaluation.js";

export const INTERVIEW_EVALUATION_QUEUE = "interview-evaluation";

export const interviewEvaluationQueue = new Queue<InterviewEvaluationJob>(INTERVIEW_EVALUATION_QUEUE, {
  connection: queueConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 5000 },
    removeOnComplete: { age: 24 * 3600, count: 1000 },
    removeOnFail: { age: 7 * 24 * 3600 },
  },
});

/**
 * Enqueues an interview for background evaluation instead of running the
 * Groq call inline. jobId is keyed by applicationId so a duplicate enqueue
 * (e.g. a retried "end-interview" event) is a no-op rather than a second
 * concurrent evaluation of the same interview.
 */
export async function enqueueInterviewEvaluation(job: InterviewEvaluationJob): Promise<void> {
  await interviewEvaluationQueue.add("evaluate", job, {
    jobId: `interview-eval-${job.applicationId}`,
  });
}
