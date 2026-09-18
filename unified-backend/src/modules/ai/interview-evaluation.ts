/**
 * The single place interview evaluation actually happens. Extracted out of
 * the socket handler so it has no dependency on a live Socket.IO connection
 * — it's called identically whether triggered synchronously (the old path)
 * or from a BullMQ worker (the new default), and by the benchmark script
 * comparing the two.
 */
import Groq from "groq-sdk";
import dotenv from "dotenv";
import { sql } from "../../db.js";
import {
  buildEvaluationPrompt,
  createResilientCompletion,
  parseAndValidateEvaluation,
  computeFinalScore,
  deriveRecommendation,
  shouldFlagManualReview,
} from "./interview-guardrails.js";
import type { InterviewEvaluation } from "./interview-guardrails.js";

dotenv.config();

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

export interface TurnMetaEntry {
  turnIndex: number;
  latencyMs: number;
  sanitizationFlag: string | null;
  retrievedChunkIds: number[];
}

export interface InterviewEvaluationJob {
  applicationId: number;
  jobTitle: string;
  jobDescription: string;
  cleanTranscript: Array<{ role: string; content: string }>;
  turnCount: number;
  jailbreakAttempts: number;
  turnMeta: TurnMetaEntry[];
  interviewStartedAt: number;
}

export async function runInterviewEvaluation(job: InterviewEvaluationJob): Promise<void> {
  const {
    applicationId,
    jobTitle,
    jobDescription,
    cleanTranscript,
    turnCount,
    jailbreakAttempts,
    turnMeta,
    interviewStartedAt,
  } = job;

  const durationMs = Date.now() - interviewStartedAt;
  const startedAtIso = new Date(interviewStartedAt).toISOString();
  const durationSeconds = Math.round(durationMs / 1000);

  let evaluationData: InterviewEvaluation | null = null;
  try {
    const evalPrompt = buildEvaluationPrompt({ jobTitle, jobDescription, cleanTranscript });

    const rawContent = await createResilientCompletion(groq, {
      messages: [{ role: "user", content: evalPrompt }],
      temperature: 0.2,
      response_format: { type: "json_object" },
    });

    evaluationData = await parseAndValidateEvaluation(rawContent, groq);
  } catch (evalCallErr) {
    console.error(`❌ Evaluation call failed for application ${applicationId}:`, evalCallErr);
  }

  const evaluationFailed = !evaluationData;
  const manualReviewRequired = shouldFlagManualReview({
    evaluationFailed,
    turnCount,
    durationMs,
    jailbreakAttempts,
  });

  if (evaluationFailed) {
    // Score is left NULL — "pending manual review" — rather than a
    // fabricated 0, which used to be indistinguishable from a real
    // failing interview in the recruiter's view.
    const fallbackEvaluation = {
      feedback:
        "The AI evaluation engine encountered an error processing this interview. A manual review is required.",
      _evaluationFailed: true,
    };

    await sql`
      INSERT INTO ai_interviews (
        application_id, transcript, evaluation, score, recommendation,
        manual_review_required, turn_meta, started_at, duration_seconds
      )
      VALUES (
        ${applicationId}, ${JSON.stringify(cleanTranscript)}, ${JSON.stringify(fallbackEvaluation)},
        NULL, NULL, true, ${JSON.stringify(turnMeta)}, ${startedAtIso}, ${durationSeconds}
      )
      ON CONFLICT (application_id)
      DO UPDATE SET
        transcript = EXCLUDED.transcript,
        evaluation = EXCLUDED.evaluation,
        score = EXCLUDED.score,
        recommendation = EXCLUDED.recommendation,
        manual_review_required = EXCLUDED.manual_review_required,
        turn_meta = EXCLUDED.turn_meta,
        started_at = EXCLUDED.started_at,
        duration_seconds = EXCLUDED.duration_seconds,
        created_at = NOW()
    `;
    return;
  }

  const finalScore = computeFinalScore(evaluationData!);
  const recommendation = deriveRecommendation(finalScore);

  await sql`
    INSERT INTO ai_interviews (
      application_id, transcript, evaluation, score, recommendation,
      manual_review_required, turn_meta, started_at, duration_seconds
    )
    VALUES (
      ${applicationId}, ${JSON.stringify(cleanTranscript)}, ${JSON.stringify(evaluationData)},
      ${finalScore}, ${recommendation}, ${manualReviewRequired}, ${JSON.stringify(turnMeta)},
      ${startedAtIso}, ${durationSeconds}
    )
    ON CONFLICT (application_id)
    DO UPDATE SET
      transcript = EXCLUDED.transcript,
      evaluation = EXCLUDED.evaluation,
      score = EXCLUDED.score,
      recommendation = EXCLUDED.recommendation,
      manual_review_required = EXCLUDED.manual_review_required,
      turn_meta = EXCLUDED.turn_meta,
      started_at = EXCLUDED.started_at,
      duration_seconds = EXCLUDED.duration_seconds,
      created_at = NOW()
  `;

  await sql`UPDATE applications SET interview_score = ${finalScore} WHERE application_id = ${applicationId}`;
}
