import { Server, Socket } from "socket.io";
import jwt, { JwtPayload } from "jsonwebtoken";
import { sql } from "../db.js";
import Groq from "groq-sdk";
import dotenv from "dotenv";
// @ts-ignore
import pdfParse from "pdf-parse";
import redisClient from "../redis.js";
import {
  sanitizeCandidateInput,
  buildInterviewSystemPrompt,
  buildEvaluationPrompt,
  parseAndValidateEvaluation,
  isRateLimited,
  clearRateLimitState,
} from "../modules/ai/interview-guardrails.js";
import type { InterviewEvaluation } from "../modules/ai/interview-guardrails.js";

dotenv.config();

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// ────────────────────────────────────────────────────────────────────────────────
// TYPES
// ────────────────────────────────────────────────────────────────────────────────

type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

interface AISocket extends Socket {
  data: {
    userId: number;
    userName: string;
    role: string;
    applicationId?: number;
    transcript?: Array<ChatMessage>;
    turnCount?: number;
    /** Flag to prevent concurrent LLM calls on the same socket */
    isProcessing?: boolean;
  };
}

// ────────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ────────────────────────────────────────────────────────────────────────────────

const MAX_TURNS = 6;

/** Redis key prefix for interview session backup */
const REDIS_SESSION_PREFIX = "interview:session:";

/** Session TTL in Redis — 30 minutes */
const SESSION_TTL_SECONDS = 1800;

// ────────────────────────────────────────────────────────────────────────────────
// HELPERS — PDF Extraction
// ────────────────────────────────────────────────────────────────────────────────

async function extractTextFromPdfUrl(url: string): Promise<string> {
  try {
    const response = await fetch(url);
    if (!response.ok) return "";
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const pdfData = await pdfParse(buffer);
    return pdfData.text.substring(0, 6000);
  } catch (error) {
    console.error("PDF parsing error:", error);
    return "";
  }
}

// ────────────────────────────────────────────────────────────────────────────────
// HELPERS — Redis Session Backup
// ────────────────────────────────────────────────────────────────────────────────

/**
 * Persists the interview transcript and turn count to Redis.
 * Prevents session loss on transient disconnects or server restarts.
 */
async function backupSessionToRedis(
  applicationId: number,
  transcript: Array<ChatMessage>,
  turnCount: number
): Promise<void> {
  try {
    const key = `${REDIS_SESSION_PREFIX}${applicationId}`;
    const payload = JSON.stringify({ transcript, turnCount });
    await redisClient.set(key, payload, { ex: SESSION_TTL_SECONDS });
  } catch (err) {
    // Non-critical — log but don't crash the interview
    console.warn("⚠️ Redis session backup failed:", err);
  }
}

/**
 * Attempts to restore a previously backed-up session from Redis.
 * Returns null if no session exists or the data is corrupt.
 */
async function restoreSessionFromRedis(
  applicationId: number
): Promise<{ transcript: Array<ChatMessage>; turnCount: number } | null> {
  try {
    const key = `${REDIS_SESSION_PREFIX}${applicationId}`;
    const raw = await redisClient.get(key);
    if (!raw) return null;

    const data = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (data?.transcript && typeof data?.turnCount === "number") {
      return data;
    }
    return null;
  } catch {
    return null;
  }
}

/** Clears the Redis session backup after successful evaluation */
async function clearRedisSession(applicationId: number): Promise<void> {
  try {
    const key = `${REDIS_SESSION_PREFIX}${applicationId}`;
    await redisClient.del(key);
  } catch {
    // Non-critical
  }
}

// ────────────────────────────────────────────────────────────────────────────────
// MAIN SOCKET SETUP
// ────────────────────────────────────────────────────────────────────────────────

export function setupAIInterviewSocket(io: Server): void {
  const aiNamespace = io.of("/ai-interview");

  // ── Authentication Middleware ────────────────────────────────────────────────
  aiNamespace.use(async (socket: AISocket, next) => {
    try {
      const token = socket.handshake.auth.token;
      if (!token) return next(new Error("Authentication required"));

      const decoded = jwt.verify(token, process.env.JWT_SEC as string) as JwtPayload;
      if (!decoded?.id) return next(new Error("Invalid token"));

      const users = await sql`SELECT user_id, name, role FROM users WHERE user_id = ${decoded.id}`;
      if (users.length === 0) return next(new Error("User not found"));

      socket.data.userId = users[0].user_id;
      socket.data.userName = users[0].name;
      socket.data.role = users[0].role;
      next();
    } catch {
      next(new Error("Authentication failed"));
    }
  });

  // ── Connection Handler ──────────────────────────────────────────────────────
  aiNamespace.on("connection", (socket: AISocket) => {
    console.log(`🤖 AI Interview: User ${socket.data.userName} connected`);

    // ── START INTERVIEW ───────────────────────────────────────────────────────
    socket.on("start-interview", async (data: { applicationId: number }) => {
      console.log(`🤖 AI Interview: Received start-interview for application ${data.applicationId} from user ${socket.data.userId}`);
      try {
        const { applicationId } = data;

        // Verify application exists and get job/resume context
        console.log(`🤖 AI Interview: Querying DB for application ${applicationId}`);
        const [application] = await sql`
          SELECT a.applicant_id, a.resume, j.title, j.description 
          FROM applications a
          JOIN jobs j ON a.job_id = j.job_id
          WHERE a.application_id = ${applicationId}
        `;

        if (!application) {
          socket.emit("error", { message: "Application not found" });
          return;
        }

        // Authorization: Only the applicant or a recruiter can start the interview
        if (application.applicant_id !== socket.data.userId && socket.data.role !== "recruiter") {
          socket.emit("error", { message: "Not authorized for this interview" });
          return;
        }

        // Check for an existing Redis session backup (reconnection scenario)
        const existingSession = await restoreSessionFromRedis(applicationId);
        if (existingSession && existingSession.turnCount < MAX_TURNS) {
          console.log(`♻️ Restoring session for application ${applicationId} (turn ${existingSession.turnCount})`);
          socket.data.applicationId = applicationId;
          socket.data.transcript = existingSession.transcript;
          socket.data.turnCount = existingSession.turnCount;

          // Send the last AI message so the candidate knows where they left off
          const lastAiMessage = [...existingSession.transcript]
            .reverse()
            .find((m) => m.role === "assistant");

          socket.emit("ai-message", {
            text: lastAiMessage?.content || "Welcome back! Let's continue where we left off.",
            isConcluding: false,
            isResumed: true,
          });
          return;
        }

        socket.emit("status", { message: "Analyzing resume and job description..." });

        const resumeText = await extractTextFromPdfUrl(application.resume);

        // Build hardened system prompt with guardrails
        const systemPrompt = buildInterviewSystemPrompt({
          candidateName: socket.data.userName,
          jobTitle: application.title,
          jobDescription: application.description,
          resumeText,
        });

        socket.data.applicationId = applicationId;
        socket.data.transcript = [
          { role: "system", content: systemPrompt },
          { role: "user", content: "Hi Alex, I'm ready to begin the interview." },
        ];
        socket.data.turnCount = 0;

        // Get initial question from LLM with streaming
        const stream = await groq.chat.completions.create({
          model: "openai/gpt-oss-120b",
          messages: socket.data.transcript,
          temperature: 0.7,
          stream: true,
        });

        let initialMessage = "";
        for await (const chunk of stream) {
          const content = chunk.choices[0]?.delta?.content || "";
          initialMessage += content;
          socket.emit("ai-message-chunk", { text: content });
        }

        if (!initialMessage.trim()) {
          initialMessage = "Hello, let's begin the interview. Could you tell me about yourself?";
        }

        socket.data.transcript.push({ role: "assistant", content: initialMessage });

        // Backup initial state to Redis
        await backupSessionToRedis(applicationId, socket.data.transcript, 0);

        socket.emit("ai-message-complete", { text: initialMessage, isConcluding: false });
      } catch (err) {
        console.error("AI Interview start error:", err);
        socket.emit("error", { message: "Failed to start interview" });
      }
    });

    // ── USER ANSWER (with guardrails) ─────────────────────────────────────────
    socket.on("user-answer", async (data: { text: string }) => {
      try {
        // Guard: Interview must be started
        if (!socket.data.transcript) {
          socket.emit("error", { message: "Interview not started" });
          return;
        }

        // Guard: Prevent concurrent LLM calls on the same socket
        if (socket.data.isProcessing) {
          socket.emit("error", { message: "Please wait for the current response" });
          return;
        }

        // Guard: Rate limiting — 3-second debounce per socket
        if (isRateLimited(socket.id)) {
          socket.emit("error", { message: "Please wait a moment before responding" });
          return;
        }

        // ── LAYER 1: Input Sanitization ─────────────────────────────────────
        const sanitization = sanitizeCandidateInput(data.text);

        if (!sanitization.safe) {
          switch (sanitization.reason) {
            case "INSUFFICIENT_INPUT":
            case "NOISE_FILLER":
              socket.emit("error", { message: "I didn't quite catch that. Could you please provide a more detailed answer?" });
              return;

            case "JAILBREAK_ATTEMPT":
              // Log the attempt, respond with a polite redirect, but do NOT
              // count this as a conversation turn (don't penalize the candidate)
              console.warn(
                `🚨 Jailbreak attempt detected from user ${socket.data.userId}: "${data.text.substring(0, 100)}"`
              );
              socket.emit("ai-message", {
                text: "I appreciate your creativity, but I'm here to learn about your professional background and experience. Let's stay focused on the interview. Could you tell me more about your recent work?",
                isConcluding: false,
              });
              return;

            default:
              return;
          }
        }

        const answer = sanitization.sanitized;

        socket.data.isProcessing = true;

        socket.data.transcript.push({ role: "user", content: answer });
        socket.data.turnCount = (socket.data.turnCount || 0) + 1;

        const isConcluding = socket.data.turnCount >= MAX_TURNS;

        if (isConcluding) {
          socket.data.transcript.push({
            role: "system",
            content:
              "The interview is now over. Thank the candidate warmly for their time and gracefully conclude the conversation. Do not ask any more questions.",
          });
        }

        const stream = await groq.chat.completions.create({
          model: "openai/gpt-oss-120b",
          messages: socket.data.transcript,
          temperature: 0.7,
          stream: true,
        });

        let aiResponse = "";
        for await (const chunk of stream) {
          const content = chunk.choices[0]?.delta?.content || "";
          aiResponse += content;
          socket.emit("ai-message-chunk", { text: content });
        }

        if (!aiResponse.trim()) {
          aiResponse = "Thank you for your response.";
        }
        
        socket.data.transcript.push({ role: "assistant", content: aiResponse });

        // Backup state after every turn
        await backupSessionToRedis(
          socket.data.applicationId!,
          socket.data.transcript,
          socket.data.turnCount
        );

        socket.emit("ai-message-complete", { text: aiResponse, isConcluding });

        if (isConcluding) {
          await evaluateAndSaveInterview(socket);
        }
      } catch (err) {
        console.error("AI Interview answer error:", err);
        socket.emit("error", { message: "Failed to process answer" });
      } finally {
        socket.data.isProcessing = false;
      }
    });

    // ── END INTERVIEW (manual) ────────────────────────────────────────────────
    socket.on("end-interview", async () => {
      if (socket.data.transcript && (socket.data.turnCount || 0) > 0) {
        await evaluateAndSaveInterview(socket);
      }
    });

    // ── DISCONNECT ────────────────────────────────────────────────────────────
    socket.on("disconnect", async () => {
      console.log(`🤖 AI Interview: User ${socket.data.userName} disconnected`);
      clearRateLimitState(socket.id);

      // Session is already backed up to Redis on every turn,
      // so it can be restored if the candidate reconnects.
    });
  });
}

// ────────────────────────────────────────────────────────────────────────────────
// EVALUATION — Rubric-anchored scoring with Zod validation & self-repair
// ────────────────────────────────────────────────────────────────────────────────

async function evaluateAndSaveInterview(socket: AISocket): Promise<void> {
  try {
    const transcript = socket.data.transcript || [];
    const applicationId = socket.data.applicationId;

    if (!applicationId || transcript.length < 3) return;

    // Filter out system prompts for DB storage and evaluation input
    const cleanTranscript = transcript.filter((m) => m.role !== "system");

    // Build rubric-anchored evaluation prompt
    const evalPrompt = buildEvaluationPrompt(cleanTranscript);

    const evalCompletion = await groq.chat.completions.create({
      model: "openai/gpt-oss-120b",
      messages: [{ role: "user", content: evalPrompt }],
      temperature: 0.2,
      response_format: { type: "json_object" },
    });

    const rawContent = evalCompletion.choices[0]?.message?.content || "{}";

    // ── LAYER 3: Zod validation with self-repair ──────────────────────────────
    const evaluationData: InterviewEvaluation | null =
      await parseAndValidateEvaluation(rawContent, groq);

    if (!evaluationData) {
      // All repair attempts failed — save transcript with a flagged evaluation
      console.error(`❌ Evaluation failed for application ${applicationId}. Saving transcript only.`);

      const fallbackEvaluation = {
        score: 0,
        technical_depth_score: 0,
        communication_score: 0,
        problem_solving_score: 0,
        job_relevance_score: 0,
        strengths: ["Evaluation could not be completed"],
        weaknesses: ["Evaluation could not be completed"],
        feedback: "The AI evaluation engine encountered an error processing this interview. A manual review is required.",
        _evaluationFailed: true,
      };

      await sql`
        INSERT INTO ai_interviews (application_id, transcript, evaluation, score)
        VALUES (
          ${applicationId},
          ${JSON.stringify(cleanTranscript)},
          ${JSON.stringify(fallbackEvaluation)},
          ${0}
        )
        ON CONFLICT (application_id) 
        DO UPDATE SET 
          transcript = EXCLUDED.transcript,
          evaluation = EXCLUDED.evaluation,
          score = EXCLUDED.score,
          created_at = NOW()
      `;

      socket.emit("interview-completed", {
        message: "Interview saved. Evaluation requires manual review.",
        evaluationFailed: true,
      });
      return;
    }

    // Save validated evaluation to DB
    await sql`
      INSERT INTO ai_interviews (application_id, transcript, evaluation, score)
      VALUES (
        ${applicationId},
        ${JSON.stringify(cleanTranscript)},
        ${JSON.stringify(evaluationData)},
        ${evaluationData.score}
      )
      ON CONFLICT (application_id) 
      DO UPDATE SET 
        transcript = EXCLUDED.transcript,
        evaluation = EXCLUDED.evaluation,
        score = EXCLUDED.score,
        created_at = NOW()
    `;

    // Update application-level interview score
    await sql`
      UPDATE applications
      SET interview_score = ${evaluationData.score}
      WHERE application_id = ${applicationId}
    `;

    // Clean up Redis session backup
    await clearRedisSession(applicationId);

    socket.emit("interview-completed", { message: "Interview evaluated and saved." });

    // Clear in-memory data to prevent double-save
    socket.data.transcript = undefined;
  } catch (error) {
    console.error("Evaluation error:", error);
    socket.emit("error", { message: "Failed to evaluate interview. Your transcript has been saved." });
  }
}
