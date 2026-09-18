/**
 * Benchmarks the post-interview evaluation step two ways:
 *
 *  1. "Synchronous" — the pre-BullMQ design: the evaluation (Groq multi-pass
 *     call + DB write) runs inline, so this measures exactly how long a
 *     candidate's "interview-completed" event used to wait.
 *  2. "Queued (BullMQ)" — the current design: evaluation is enqueued and a
 *     bounded-concurrency worker processes it in the background. Measures
 *     both the new (near-instant) candidate-facing latency, and the
 *     separate time until the analysis is actually persisted.
 *
 * Uses N disposable `applications` rows (cleaned up at the end) and a fixed
 * canned transcript so both modes do the same LLM work — this isolates the
 * comparison to "sync vs queued", not "different interview content".
 *
 * Usage: npx tsx scripts/benchmark-interview-evaluation.ts [concurrency]
 */
import dotenv from "dotenv";
dotenv.config();

import { Queue, Worker } from "bullmq";
import { sql } from "../src/db.js";
import { runInterviewEvaluation, type InterviewEvaluationJob } from "../src/modules/ai/interview-evaluation.js";
import { queueConnection } from "../src/utils/queueConnection.js";

// A dedicated queue name, NOT the production "interview-evaluation" queue.
// If a real backend is running alongside this benchmark, it already has its
// own worker consuming the production queue — sharing that queue here would
// let the live server's worker silently grab benchmark jobs, so this
// script's own "completed" listener would never fire for them and the
// measurement would be wrong (or hang). Full isolation avoids that.
const BENCHMARK_QUEUE_NAME = "interview-evaluation-benchmark";

const N = Number(process.argv[2]) || 5;
const BENCHMARK_EMAIL_DOMAIN = "benchmark.local";

const CANNED_TRANSCRIPT = [
  { role: "user", content: "Hi Alex, I'm ready to begin the interview." },
  { role: "assistant", content: "Great — tell me about a challenging backend feature you've built recently." },
  {
    role: "user",
    content:
      "I built an async job-processing pipeline using Node.js and BullMQ backed by Redis, handling retries and backoff for failed jobs, and used Postgres for persistence with idempotent upserts.",
  },
  { role: "assistant", content: "How did you handle failures and ensure jobs weren't lost or duplicated?" },
  {
    role: "user",
    content:
      "Each job had a deterministic jobId derived from the source entity, so re-enqueuing was a no-op if a job was already pending or completed. Failed jobs used exponential backoff with a max of 3 attempts before landing in a dead-letter state for manual review.",
  },
  { role: "assistant", content: "How would you monitor and scale that system in production?" },
  {
    role: "user",
    content:
      "I'd track queue depth, job duration percentiles, and failure rate as core metrics, and scale worker concurrency based on queue depth rather than a fixed number, with alerts on sustained backlog growth.",
  },
];

function buildJobPayload(applicationId: number): InterviewEvaluationJob {
  return {
    applicationId,
    jobTitle: "Backend Engineer",
    jobDescription:
      "We're hiring a backend engineer to build and scale our job-processing infrastructure using Node.js, Postgres, and Redis-backed queues.",
    cleanTranscript: CANNED_TRANSCRIPT,
    turnCount: 3,
    jailbreakAttempts: 0,
    turnMeta: [],
    interviewStartedAt: Date.now() - 90_000, // pretend it took 90s to conduct
  };
}

async function setupTempApplications(jobId: number, count: number, batchOffset: number): Promise<number[]> {
  const ids: number[] = [];
  for (let i = 0; i < count; i++) {
    const applicantId = 900_000 + batchOffset + i;
    const email = `benchmark-${batchOffset}-${i}-${Date.now()}@${BENCHMARK_EMAIL_DOMAIN}`;
    const [row] = await sql`
      INSERT INTO applications (job_id, applicant_id, applicant_email, resume)
      VALUES (${jobId}, ${applicantId}, ${email}, 'https://example.com/dummy.pdf')
      RETURNING application_id
    `;
    ids.push(row.application_id);
  }
  return ids;
}

async function cleanupTempApplications(): Promise<void> {
  await sql`DELETE FROM applications WHERE applicant_email LIKE ${"%@" + BENCHMARK_EMAIL_DOMAIN}`;
}

function stats(times: number[]) {
  const sorted = [...times].sort((a, b) => a - b);
  const sum = sorted.reduce((a, b) => a + b, 0);
  return {
    min: sorted[0] ?? 0,
    max: sorted[sorted.length - 1] ?? 0,
    avg: sorted.length ? sum / sorted.length : 0,
  };
}

function fmt(ms: number): string {
  return `${(ms / 1000).toFixed(2)}s`;
}

// ── Mode 1: Synchronous (pre-BullMQ) ──────────────────────────────────────────
async function benchmarkSynchronous(applicationIds: number[]) {
  console.log(`\n🐢 SYNCHRONOUS mode — evaluation runs inline (the old design)`);
  const batchStart = performance.now();

  const perCallLatencies = await Promise.all(
    applicationIds.map(async (id) => {
      const start = performance.now();
      await runInterviewEvaluation(buildJobPayload(id));
      return performance.now() - start;
    })
  );

  const batchElapsed = performance.now() - batchStart;
  const s = stats(perCallLatencies);

  console.log(`   Candidate-facing latency (time until "interview-completed"):`);
  console.log(`     min=${fmt(s.min)}  avg=${fmt(s.avg)}  max=${fmt(s.max)}`);
  console.log(`   Total time for all ${applicationIds.length} to be evaluated+saved: ${fmt(batchElapsed)}`);

  return { candidateLatency: s, batchElapsed };
}

// ── Mode 2: Queued via BullMQ (isolated benchmark queue) ──────────────────────
async function benchmarkQueued(applicationIds: number[]) {
  console.log(`\n🐇 QUEUED mode — evaluation enqueued to BullMQ (the current design)`);

  const queue = new Queue<InterviewEvaluationJob>(BENCHMARK_QUEUE_NAME, { connection: queueConnection });
  const worker = new Worker<InterviewEvaluationJob>(
    BENCHMARK_QUEUE_NAME,
    async (job) => runInterviewEvaluation(job.data),
    { connection: queueConnection, concurrency: Number(process.env.INTERVIEW_EVAL_CONCURRENCY) || 3 }
  );
  await worker.waitUntilReady();

  const completionResolvers = new Map<number, (elapsedMs: number) => void>();
  const batchStart = performance.now();

  const completionPromises = applicationIds.map(
    (id) =>
      new Promise<number>((resolve) => {
        completionResolvers.set(id, resolve);
      })
  );

  worker.on("completed", (job) => {
    const appId = job.data.applicationId;
    const resolve = completionResolvers.get(appId);
    if (resolve) resolve(performance.now() - batchStart);
  });

  const enqueueLatencies: number[] = [];
  for (const id of applicationIds) {
    const start = performance.now();
    await queue.add("evaluate", buildJobPayload(id), { jobId: `bench-${id}` });
    enqueueLatencies.push(performance.now() - start);
  }

  const enqueueStats = stats(enqueueLatencies);
  console.log(`   Candidate-facing latency (time until "interview submitted"):`);
  console.log(`     min=${fmt(enqueueStats.min)}  avg=${fmt(enqueueStats.avg)}  max=${fmt(enqueueStats.max)}`);

  const perJobBackgroundTimes = await Promise.all(completionPromises);
  const batchElapsed = performance.now() - batchStart;
  const bgStats = stats(perJobBackgroundTimes);

  console.log(`   Time from batch start until each job's analysis is actually saved:`);
  console.log(`     min=${fmt(bgStats.min)}  avg=${fmt(bgStats.avg)}  max=${fmt(bgStats.max)}`);
  console.log(`   Total time for all ${applicationIds.length} to be evaluated+saved: ${fmt(batchElapsed)}`);

  await worker.close();
  await queue.obliterate({ force: true });
  await queue.close();

  return { candidateLatency: enqueueStats, batchElapsed };
}

async function main() {
  console.log(`\n=== Interview Evaluation Benchmark (N=${N}) ===`);
  console.log(`Comparing synchronous (inline) evaluation vs BullMQ-queued evaluation.\n`);
  console.log(`⚠️  This makes ${N * 2} real Groq API calls and writes/deletes temporary DB rows.`);

  const [job] = await sql`SELECT job_id FROM jobs LIMIT 1`;
  if (!job) throw new Error("No jobs exist in the DB to attach benchmark applications to.");

  try {
    const syncAppIds = await setupTempApplications(job.job_id, N, 0);
    const syncResult = await benchmarkSynchronous(syncAppIds);

    // Groq's rate limit is a rolling per-minute window (TPM). Without a
    // cooldown, the queued phase would start against a budget already
    // partly consumed by the synchronous phase's concurrent calls — that
    // would make whichever phase runs second look artificially worse, not
    // because of sync-vs-queued behavior but because of leftover rate-limit
    // pressure. Waiting resets the comparison to a fair starting point.
    const cooldownSec = Number(process.env.BENCHMARK_COOLDOWN_SEC) || 65;
    console.log(`\n⏳ Cooling down ${cooldownSec}s to reset the rate-limit window before the next phase...`);
    await new Promise((r) => setTimeout(r, cooldownSec * 1000));

    const queuedAppIds = await setupTempApplications(job.job_id, N, N);
    const queuedResult = await benchmarkQueued(queuedAppIds);

    console.log(`\n=== SUMMARY ===`);
    console.log(`Candidate-facing latency (avg): ${fmt(syncResult.candidateLatency.avg)} → ${fmt(queuedResult.candidateLatency.avg)}`);
    const speedup = syncResult.candidateLatency.avg / Math.max(queuedResult.candidateLatency.avg, 0.001);
    console.log(`Candidate-facing latency improvement: ${speedup.toFixed(0)}x faster`);
    console.log(`Total batch completion time (background work is the same either way):`);
    console.log(`  synchronous=${fmt(syncResult.batchElapsed)}  queued=${fmt(queuedResult.batchElapsed)}`);
  } finally {
    await cleanupTempApplications();
    queueConnection.disconnect();
  }

  process.exit(0);
}

main().catch((err) => {
  console.error("Benchmark failed:", err);
  process.exit(1);
});
