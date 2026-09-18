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
  formatRetrievedContextForPrompt,
  createResilientStream,
  isRateLimited,
  clearRateLimitState,
  INTERVIEW_SOFT_LIMIT_MS,
  INTERVIEW_HARD_LIMIT_MS,
  MAX_TURNS_SAFETY_CAP,
  ADAPTIVE_RETRIEVAL_TOP_K,
} from "../modules/ai/interview-guardrails.js";
import { processResume, retrieveTopChunks } from "../modules/ai/resume-rag.js";
import type { StructuredResume } from "../modules/ai/resume-structured-schema.js";
import { enqueueInterviewEvaluation } from "../jobs/interview-evaluation.queue.js";

dotenv.config();

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// ────────────────────────────────────────────────────────────────────────────────
// TYPES
// ────────────────────────────────────────────────────────────────────────────────

type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

interface TurnMetaEntry {
  turnIndex: number;
  latencyMs: number;
  sanitizationFlag: string | null;
  retrievedChunkIds: number[];
}

interface AISocket extends Socket {
  data: {
    userId: number;
    userName: string;
    role: string;
    applicationId?: number;
    applicantId?: number;
    jobTitle?: string;
    jobDescription?: string;
    transcript?: Array<ChatMessage>;
    turnCount?: number;
    interviewStartedAt?: number;
    turnMeta?: TurnMetaEntry[];
    jailbreakAttempts?: number;
    /** Flag to prevent concurrent LLM calls on the same socket */
    isProcessing?: boolean;
  };
}

interface SessionBackup {
  transcript: Array<ChatMessage>;
  turnCount: number;
  interviewStartedAt: number;
  turnMeta: TurnMetaEntry[];
  jailbreakAttempts: number;
}

// ────────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ────────────────────────────────────────────────────────────────────────────────

/** Redis key prefix for interview session backup */
const REDIS_SESSION_PREFIX = "interview:session:";

/** Session TTL in Redis — comfortably longer than the 10 minute interview
 *  so a brief disconnect/reconnect doesn't lose the transcript. */
const SESSION_TTL_SECONDS = 1800;

// ────────────────────────────────────────────────────────────────────────────────
// HELPERS — PDF Extraction (fallback only — the primary path is the RAG index)
// ────────────────────────────────────────────────────────────────────────────────

async function extractTextFromPdfUrl(url: string): Promise<string> {
  try {
    const response = await fetch(url);
    if (!response.ok) return "";
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const pdfData = await pdfParse(buffer);
    return pdfData.text.substring(0, 4000);
  } catch (error) {
    console.error("PDF parsing error:", error);
    return "";
  }
}

/** Compact resume summary for the base system prompt — deep detail is
 *  pulled in per-turn via adaptive retrieval instead of dumped up front. */
function summarizeStructuredResume(s: Partial<StructuredResume> | null | undefined): string {
  if (!s) return "";
  const parts: string[] = [];
  if (s.skills?.length) parts.push(`Skills: ${s.skills.join(", ")}`);
  if (s.experience_summary) parts.push(`Experience: ${s.experience_summary}`);
  if (s.projects?.length) parts.push(`Projects: ${s.projects.join("; ")}`);
  if (s.education) parts.push(`Education: ${s.education}`);
  return parts.join("\n");
}

// ────────────────────────────────────────────────────────────────────────────────
// HELPERS — Redis Session Backup
// ────────────────────────────────────────────────────────────────────────────────

/**
 * Persists the interview transcript, turn metadata, and start time to Redis.
 * Prevents session loss (and clock loss) on transient disconnects.
 */
async function backupSessionToRedis(applicationId: number, session: SessionBackup): Promise<void> {
  try {
    const key = `${REDIS_SESSION_PREFIX}${applicationId}`;
    await redisClient.set(key, JSON.stringify(session), { ex: SESSION_TTL_SECONDS });
  } catch (err) {
    // Non-critical — log but don't crash the interview
    console.warn("⚠️ Redis session backup failed:", err);
  }
}

async function restoreSessionFromRedis(applicationId: number): Promise<SessionBackup | null> {
  try {
    const key = `${REDIS_SESSION_PREFIX}${applicationId}`;
    const raw = await redisClient.get(key);
    if (!raw) return null;

    const data = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (data?.transcript && typeof data?.turnCount === "number" && typeof data?.interviewStartedAt === "number") {
      return {
        transcript: data.transcript,
        turnCount: data.turnCount,
        interviewStartedAt: data.interviewStartedAt,
        turnMeta: Array.isArray(data.turnMeta) ? data.turnMeta : [],
        jailbreakAttempts: typeof data.jailbreakAttempts === "number" ? data.jailbreakAttempts : 0,
      };
    }
    return null;
  } catch {
    return null;
  }
}

/** Clears the Redis session backup after successful evaluation */
async function clearRedisSession(applicationId: number): Promise<void> {
  try {
    await redisClient.del(`${REDIS_SESSION_PREFIX}${applicationId}`);
  } catch {
    // Non-critical
  }
}

// ────────────────────────────────────────────────────────────────────────────────
// HELPER — Hard timeboxing
// ────────────────────────────────────────────────────────────────────────────────

/**
 * Keyed by applicationId rather than stored on socket.data — a disconnect
 * hands the candidate a brand new Socket object on reconnect (fresh `.data`),
 * so a timer living on the old socket would either be lost (if cleared on
 * disconnect, meaning a candidate who just closes the tab never gets
 * finalized) or fire twice against two different `.data` objects (if not
 * cleared, once reconnect creates a second timer on the new socket). One
 * registry entry per application avoids both failure modes: disconnect
 * leaves the timer running against the last-known socket, and reconnect
 * re-points it at the new socket and reschedules from the true remaining
 * wall-clock budget.
 */
const hardStopRegistry = new Map<number, { timer: ReturnType<typeof setTimeout>; socket: AISocket }>();

/**
 * Schedules the hard 10-minute cutoff. Fires even if the candidate has
 * disconnected — the interview always ends and gets scored, it never hangs
 * open waiting for a reconnect that may not come.
 */
function scheduleHardStop(applicationId: number, socket: AISocket, remainingMs: number): void {
  const existing = hardStopRegistry.get(applicationId);
  if (existing) clearTimeout(existing.timer);

  const timer = setTimeout(async () => {
    const entry = hardStopRegistry.get(applicationId);
    if (!entry) return;
    const liveSocket = entry.socket;
    // Already concluded normally, or a turn is in flight and will itself
    // detect the elapsed soft limit and conclude — nothing to do here.
    if (!liveSocket.data.transcript || liveSocket.data.isProcessing) return;
    liveSocket.emit("time-up", { message: "Your interview time is up. Wrapping up now." });
    await queueInterviewEvaluation(liveSocket);
  }, Math.max(remainingMs, 0));

  hardStopRegistry.set(applicationId, { timer, socket });
}

function clearHardStop(applicationId: number | undefined): void {
  if (!applicationId) return;
  const existing = hardStopRegistry.get(applicationId);
  if (existing) {
    clearTimeout(existing.timer);
    hardStopRegistry.delete(applicationId);
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
      try {
        const { applicationId } = data;

        if (isRateLimited(`start:${socket.id}`)) {
          socket.emit("error", { message: "Please wait a moment before trying again." });
          return;
        }

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

        // ── Eligibility gate: one attempt only ─────────────────────────────────
        // The frontend already hides the "AI Screen" entry point once this
        // exists, but that's a UI convenience, not enforcement — hitting the
        // URL directly used to silently restart and overwrite the score.
        const [existingResult] = await sql`SELECT interview_id FROM ai_interviews WHERE application_id = ${applicationId}`;
        if (existingResult) {
          socket.emit("interview-blocked", {
            reason: "ALREADY_COMPLETED",
            message: "This interview has already been completed and cannot be retaken.",
          });
          return;
        }

        socket.data.applicationId = applicationId;
        socket.data.applicantId = application.applicant_id;
        socket.data.jobTitle = application.title;
        socket.data.jobDescription = application.description;

        // ── Reconnect: restore an in-progress session ──────────────────────────
        const existingSession = await restoreSessionFromRedis(applicationId);
        if (existingSession) {
          const elapsed = Date.now() - existingSession.interviewStartedAt;
          socket.data.transcript = existingSession.transcript;
          socket.data.turnCount = existingSession.turnCount;
          socket.data.interviewStartedAt = existingSession.interviewStartedAt;
          socket.data.turnMeta = existingSession.turnMeta;
          socket.data.jailbreakAttempts = existingSession.jailbreakAttempts;

          if (elapsed >= INTERVIEW_HARD_LIMIT_MS) {
            // Candidate was disconnected past the time budget — conclude now.
            socket.emit("time-up", { message: "Your interview time is up. Wrapping up now." });
            await queueInterviewEvaluation(socket);
            return;
          }

          console.log(`♻️ Restoring session for application ${applicationId} (turn ${existingSession.turnCount})`);
          scheduleHardStop(applicationId, socket, INTERVIEW_HARD_LIMIT_MS - elapsed);

          const lastAiMessage = [...existingSession.transcript].reverse().find((m) => m.role === "assistant");
          socket.emit("interview-resumed", {
            text: lastAiMessage?.content || "Welcome back! Let's continue where we left off.",
            startedAt: existingSession.interviewStartedAt,
            softLimitMs: INTERVIEW_SOFT_LIMIT_MS,
            hardLimitMs: INTERVIEW_HARD_LIMIT_MS,
          });
          return;
        }

        socket.emit("status", { message: "Preparing your interview..." });

        // ── Resume context: reuse the RAG index, indexing inline if missing ────
        // Previously this re-parsed the raw PDF on every single interview,
        // completely separate from the resume-intelligence index already
        // built for recruiter Q&A. Now both features share one index, and
        // the interview additionally pulls adaptive context per turn below.
        const applicantId = application.applicant_id;
        let resumeSummary = "";
        try {
          const [{ count }] = await sql`SELECT COUNT(*) AS count FROM resume_chunks WHERE user_id = ${applicantId}`;
          if (Number(count) === 0) {
            const res = await fetch(application.resume);
            if (!res.ok) throw new Error(`Failed to fetch resume: ${res.statusText}`);
            const buffer = Buffer.from(await res.arrayBuffer());
            const { structured } = await processResume(applicantId, buffer);
            resumeSummary = summarizeStructuredResume(structured);
          } else {
            const [structuredRow] = await sql`
              SELECT skills, experience_summary, projects, education FROM resume_structured WHERE user_id = ${applicantId}
            `;
            resumeSummary = summarizeStructuredResume(structuredRow);
          }
        } catch (indexErr) {
          console.warn("⚠️ Resume indexing/lookup failed, falling back to raw PDF text:", indexErr);
        }
        if (!resumeSummary.trim()) {
          resumeSummary = await extractTextFromPdfUrl(application.resume);
        }

        const systemPrompt = buildInterviewSystemPrompt({
          candidateName: socket.data.userName,
          jobTitle: application.title,
          jobDescription: application.description,
          resumeSummary,
        });

        socket.data.transcript = [
          { role: "system", content: systemPrompt },
          { role: "user", content: "Hi Alex, I'm ready to begin the interview." },
        ];
        socket.data.turnCount = 0;
        socket.data.interviewStartedAt = Date.now();
        socket.data.turnMeta = [];
        socket.data.jailbreakAttempts = 0;

        socket.emit("interview-started", {
          startedAt: socket.data.interviewStartedAt,
          softLimitMs: INTERVIEW_SOFT_LIMIT_MS,
          hardLimitMs: INTERVIEW_HARD_LIMIT_MS,
        });
        scheduleHardStop(applicationId, socket, INTERVIEW_HARD_LIMIT_MS);

        let initialMessage = "";
        try {
          initialMessage = await createResilientStream(
            groq,
            { messages: socket.data.transcript, temperature: 0.7 },
            (chunk) => socket.emit("ai-message-chunk", { text: chunk })
          );
        } catch (streamErr) {
          console.error("Opening question failed on all models:", streamErr);
        }
        if (!initialMessage.trim()) {
          initialMessage = "Hello, let's begin the interview. Could you tell me about yourself?";
        }

        socket.data.transcript.push({ role: "assistant", content: initialMessage });

        await backupSessionToRedis(applicationId, {
          transcript: socket.data.transcript,
          turnCount: socket.data.turnCount,
          interviewStartedAt: socket.data.interviewStartedAt,
          turnMeta: socket.data.turnMeta,
          jailbreakAttempts: socket.data.jailbreakAttempts,
        });

        socket.emit("ai-message-complete", { text: initialMessage, isConcluding: false });
      } catch (err) {
        console.error("AI Interview start error:", err);
        socket.emit("error", { message: "Failed to start interview" });
      }
    });

    // ── USER ANSWER (with guardrails) ─────────────────────────────────────────
    socket.on("user-answer", async (data: { text: string }) => {
      try {
        if (!socket.data.transcript || !socket.data.interviewStartedAt) {
          socket.emit("error", { message: "Interview not started" });
          return;
        }

        if (socket.data.isProcessing) {
          socket.emit("error", { message: "Please wait for the current response" });
          return;
        }

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
              socket.data.jailbreakAttempts = (socket.data.jailbreakAttempts || 0) + 1;
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
        const turnStartedAt = Date.now();
        socket.data.isProcessing = true;

        socket.data.transcript.push({ role: "user", content: answer });
        socket.data.turnCount = (socket.data.turnCount || 0) + 1;

        const elapsedMs = Date.now() - socket.data.interviewStartedAt;
        const isConcluding =
          elapsedMs >= INTERVIEW_SOFT_LIMIT_MS || socket.data.turnCount >= MAX_TURNS_SAFETY_CAP;

        let callMessages: ChatMessage[] = socket.data.transcript;
        let retrievedChunkIds: number[] = [];

        if (isConcluding) {
          socket.data.transcript.push({
            role: "system",
            content:
              "The interview time is up. Thank the candidate warmly for their time and gracefully conclude the conversation in one short message. Do not ask any more questions.",
          });
          callMessages = socket.data.transcript;
        } else if (socket.data.applicantId) {
          // ── Adaptive retrieval: ground the next question in the specific
          // resume detail most relevant to what the candidate just said,
          // instead of relying on the static summary alone.
          try {
            const chunks = await retrieveTopChunks(socket.data.applicantId, answer, ADAPTIVE_RETRIEVAL_TOP_K);
            retrievedChunkIds = chunks.map((c) => c.id);
            if (chunks.length > 0) {
              callMessages = [
                ...socket.data.transcript,
                { role: "system", content: formatRetrievedContextForPrompt(chunks.map((c) => c.chunkText)) },
              ];
            }
          } catch (retrievalErr) {
            console.warn("⚠️ Adaptive retrieval failed, continuing without extra context:", retrievalErr);
          }
        }

        let aiResponse = "";
        try {
          aiResponse = await createResilientStream(groq, { messages: callMessages, temperature: 0.7 }, (chunk) =>
            socket.emit("ai-message-chunk", { text: chunk })
          );
        } catch (streamErr) {
          console.error("Answer generation failed on all models:", streamErr);
          aiResponse = isConcluding
            ? "Thank you so much for your time today — that concludes our interview."
            : "Thank you for sharing that. Could you tell me a bit more?";
        }
        if (!aiResponse.trim()) aiResponse = "Thank you for your response.";

        socket.data.transcript.push({ role: "assistant", content: aiResponse });

        socket.data.turnMeta = socket.data.turnMeta || [];
        socket.data.turnMeta.push({
          turnIndex: socket.data.turnCount,
          latencyMs: Date.now() - turnStartedAt,
          sanitizationFlag: sanitization.truncated ? "INPUT_TOO_LONG" : null,
          retrievedChunkIds,
        });

        await backupSessionToRedis(socket.data.applicationId!, {
          transcript: socket.data.transcript,
          turnCount: socket.data.turnCount,
          interviewStartedAt: socket.data.interviewStartedAt,
          turnMeta: socket.data.turnMeta,
          jailbreakAttempts: socket.data.jailbreakAttempts || 0,
        });

        socket.emit("ai-message-complete", { text: aiResponse, isConcluding });

        if (isConcluding) {
          await queueInterviewEvaluation(socket);
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
        await queueInterviewEvaluation(socket);
      }
    });

    // ── DISCONNECT ────────────────────────────────────────────────────────────
    socket.on("disconnect", () => {
      console.log(`🤖 AI Interview: User ${socket.data.userName} disconnected`);
      clearRateLimitState(socket.id);
      // Deliberately NOT clearing the hard-stop timer here — it keeps
      // counting down against this socket so the interview still gets
      // finalized at 10:00 even if the candidate never reconnects. A
      // reconnect re-points the same registry entry at the new socket.
      // Session is already backed up to Redis on every turn either way.
    });
  });
}

// ────────────────────────────────────────────────────────────────────────────────
// EVALUATION — Enqueued to BullMQ instead of run inline
// ────────────────────────────────────────────────────────────────────────────────
//
// The Groq multi-pass call (and its retry/repair path) used to run directly
// inside this handler, so the candidate's "interview-completed" event waited
// on however long that call took (several seconds, per the benchmark below).
// It's now handed to a BullMQ queue and processed by a bounded-concurrency
// worker (src/jobs/interview-evaluation.worker.ts) — the candidate is told
// their interview was submitted the moment it's queued, and the actual
// scoring happens in the background via runInterviewEvaluation(), the same
// function the worker and the benchmark script both call.

async function queueInterviewEvaluation(socket: AISocket): Promise<void> {
  clearHardStop(socket.data.applicationId);

  try {
    const transcript = socket.data.transcript || [];
    const applicationId = socket.data.applicationId;

    if (!applicationId || transcript.length < 3) return;

    const cleanTranscript = transcript.filter((m) => m.role !== "system");

    await enqueueInterviewEvaluation({
      applicationId,
      jobTitle: socket.data.jobTitle || "",
      jobDescription: socket.data.jobDescription || "",
      cleanTranscript,
      turnCount: socket.data.turnCount || 0,
      jailbreakAttempts: socket.data.jailbreakAttempts || 0,
      turnMeta: socket.data.turnMeta || [],
      interviewStartedAt: socket.data.interviewStartedAt || Date.now(),
    });

    await clearRedisSession(applicationId);
    socket.data.transcript = undefined;

    socket.emit("interview-completed", {
      message: "Interview submitted successfully. Your responses are being analyzed.",
    });
  } catch (error) {
    console.error("Failed to queue interview evaluation:", error);
    socket.emit("error", { message: "Failed to submit interview. Your transcript has been saved." });
  }
}
