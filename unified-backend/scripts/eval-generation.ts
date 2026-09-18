/**
 * Offline generation (end-to-end answer) eval for the résumé RAG copilot.
 *
 * For each labelled question in eval/retrieval/queries.json this runs the
 * production path — retrieval (k = 5, as queryResume uses), the production
 * Q&A prompt, the production model/temperature — then asks a judge model from
 * a different family to grade the answer against the gold facts and the
 * retrieved context.
 *
 *   npx tsx scripts/eval-generation.ts                        # all queries, hybrid
 *   npx tsx scripts/eval-generation.ts --retrievers hybrid,vector
 *   npx tsx scripts/eval-generation.ts --split dev --limit 10
 *   npx tsx scripts/eval-generation.ts --spot-check 20        # print verdicts to audit the judge
 *
 * Needs GROQ_API_KEY. Answers and verdicts are cached in eval/generation/cache
 * keyed by a hash of the exact prompt, so re-runs only pay for what changed.
 *
 * Metrics
 *   answerable:   correct (states every gold fact), faithful (no claim the
 *                 context doesn't support), false refusal (said "not in the
 *                 résumé" although it is)
 *   unanswerable: correct refusal, hallucination (asserted a fact that isn't there)
 *   split by whether retrieval surfaced a gold span, to separate retrieval
 *   errors from generation errors.
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import dotenv from "dotenv";
import Groq from "groq-sdk";
import {
  ROOT as RETRIEVAL_ROOT,
  loadQueries,
  openEvalDb,
  norm,
  hybridRetrieve,
  vectorOnlyRetrieve,
  type Query,
} from "./eval-harness.js";
import {
  RAG_ANSWER_MODEL,
  RAG_ANSWER_TEMPERATURE,
  NO_RELEVANT_INFO_ANSWER,
  buildResumeQAPrompt,
  buildStructuredExtractionPrompt,
} from "../src/modules/ai/resume-prompts.js";
import { parseStructuredResume, type StructuredResume } from "../src/modules/ai/resume-structured-schema.js";
import type { RetrievedChunk } from "../src/modules/ai/resume-hybrid.js";

dotenv.config();

const OUT = path.resolve(RETRIEVAL_ROOT, "../generation");
const CACHE = path.join(OUT, "cache");
const JUDGE_MODEL = process.env.EVAL_JUDGE_MODEL || "qwen/qwen3.8-27b";
const QA_K = 5; // queryResume's k

type RetrieverName = "hybrid" | "vector";

interface Config {
  split: "dev" | "test" | "all";
  retrievers: RetrieverName[];
  limit?: number;
  spotCheck: number;
  save?: string;
}

function parseArgs(argv: string[]): Config {
  const get = (flag: string) => {
    const i = argv.indexOf(flag);
    return i !== -1 ? argv[i + 1] : undefined;
  };
  return {
    split: (get("--split") as Config["split"]) || "all",
    retrievers: ((get("--retrievers") || "hybrid").split(",") as RetrieverName[]),
    limit: get("--limit") ? Number(get("--limit")) : undefined,
    spotCheck: Number(get("--spot-check") ?? 0),
    save: get("--save"),
  };
}

// ── Groq with cache + 429 backoff ────────────────────────────────────────────────

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY, maxRetries: 0 });
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
let callsMade = 0;

async function cachedCompletion(
  kind: string,
  params: { model: string; temperature: number; messages: { role: "system" | "user"; content: string }[]; json?: boolean }
): Promise<string> {
  const key = crypto.createHash("sha256").update(JSON.stringify(params)).digest("hex").slice(0, 24);
  const file = path.join(CACHE, `${kind}-${key}.json`);
  if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, "utf8")).content;

  for (let attempt = 0; ; attempt++) {
    try {
      const res = await groq.chat.completions.create({
        model: params.model,
        temperature: params.temperature,
        messages: params.messages,
        ...(params.json ? { response_format: { type: "json_object" as const } } : {}),
      });
      callsMade++;
      const content = res.choices[0]?.message?.content ?? "";
      fs.mkdirSync(CACHE, { recursive: true });
      fs.writeFileSync(file, JSON.stringify({ params, content }, null, 2));
      return content;
    } catch (err: any) {
      const status = err?.status;
      if ((status === 429 || status >= 500) && attempt < 6) {
        const retryAfter = Number(err?.headers?.["retry-after"]) || 0;
        const wait = Math.max(retryAfter * 1000, 2000 * 2 ** attempt);
        console.warn(`   ${status} from Groq (${params.model}); retrying in ${Math.round(wait / 1000)}s`);
        await sleep(wait);
        continue;
      }
      throw err;
    }
  }
}

// ── Production path: structured extraction + answer ─────────────────────────────

async function structuredFor(resumeText: string): Promise<StructuredResume> {
  const raw = await cachedCompletion("structured", {
    model: RAG_ANSWER_MODEL,
    temperature: RAG_ANSWER_TEMPERATURE,
    messages: [{ role: "user", content: buildStructuredExtractionPrompt(resumeText) }],
  });
  return parseStructuredResume(raw).data;
}

async function answer(chunks: RetrievedChunk[], structured: StructuredResume, question: string): Promise<string> {
  // queryResume returns this fixed string without calling the LLM.
  if (chunks.length === 0) return NO_RELEVANT_INFO_ANSWER;
  const raw = await cachedCompletion("answer", {
    model: RAG_ANSWER_MODEL,
    temperature: RAG_ANSWER_TEMPERATURE,
    messages: [{ role: "user", content: buildResumeQAPrompt(chunks, structured, question) }],
  });
  return raw.trim();
}

// ── Judge ─────────────────────────────────────────────────────────────────────

interface Verdict {
  refused: boolean;
  correct: boolean | null;
  faithful: boolean;
  unsupported_claims: string[];
  reason: string;
}

function judgePrompt(q: Query, context: string, ans: string): string {
  const goldText =
    q.gold.length === 0
      ? "NONE — the résumé does not contain this information. The ideal answer says so."
      : q.gold.map((g, i) => `${i + 1}. ${Array.isArray(g) ? g.join("  OR  ") : g}`).join("\n");

  return `You are grading an AI assistant that answers a recruiter's question about a candidate's résumé.

QUESTION:
${q.query}

GOLD EVIDENCE (the résumé text that answers the question; the answer does not need to repeat every detail of it):
${goldText}

CONTEXT THE ASSISTANT WAS GIVEN:
"""
${context || "(no context — the system returned a fixed 'no relevant information' reply without calling the model)"}
"""

ASSISTANT'S ANSWER:
"""
${ans}
"""

Grade strictly and return ONLY a JSON object:
{
  "refused": <true if the answer's main message is that the résumé/context does not contain the information>,
  "correct": <if there is gold evidence: true if the answer gives the answer that evidence supports (for several numbered items, it must reflect each one); false if it refuses, contradicts it, or misses the point. If gold evidence is NONE: true if the answer says the information is not present, false if it claims the candidate has it>,
  "faithful": <true if every factual claim about the candidate in the answer is supported by the CONTEXT above; a refusal is faithful>,
  "unsupported_claims": [<each claim not supported by the context, verbatim or near-verbatim; empty if none>],
  "reason": "<one sentence>"
}`;
}

function contextOf(prompt: string): string {
  const start = prompt.indexOf("--- RESUME CONTEXT ---");
  const end = prompt.indexOf("--- END CONTEXT ---");
  return prompt.slice(start + "--- RESUME CONTEXT ---".length, end).trim();
}

function parseVerdict(raw: string): Verdict {
  const cleaned = raw.replace(/<think>[\s\S]*?<\/think>/g, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  const obj = JSON.parse(cleaned.slice(start, end + 1));
  return {
    refused: Boolean(obj.refused),
    correct: obj.correct === null || obj.correct === undefined ? null : Boolean(obj.correct),
    faithful: Boolean(obj.faithful),
    unsupported_claims: Array.isArray(obj.unsupported_claims) ? obj.unsupported_claims.map(String) : [],
    reason: String(obj.reason ?? ""),
  };
}

async function judge(q: Query, context: string, ans: string): Promise<Verdict> {
  const prompt = judgePrompt(q, context, ans);
  for (let attempt = 0; attempt < 2; attempt++) {
    const raw = await cachedCompletion(`judge${attempt ? "-retry" : ""}`, {
      model: JUDGE_MODEL,
      temperature: 0,
      json: true,
      messages: [{ role: "user", content: prompt }],
    });
    try {
      return parseVerdict(raw);
    } catch {
      console.warn(`   judge returned unparseable JSON for ${q.id}; retrying once`);
    }
  }
  throw new Error(`Judge failed twice on ${q.id}`);
}

// ── Main ──────────────────────────────────────────────────────────────────────

interface Row {
  id: string;
  split: string;
  type: string;
  retriever: RetrieverName;
  question: string;
  answerable: boolean;
  retrievalHit: boolean;
  chunks: number;
  answer: string;
  verdict: Verdict;
}

function pct(n: number, d: number) {
  return d ? `${((n / d) * 100).toFixed(1)}%` : "n/a";
}

function report(rows: Row[], label: string) {
  const ans = rows.filter((r) => r.answerable);
  const un = rows.filter((r) => !r.answerable);
  const hit = ans.filter((r) => r.retrievalHit);
  const miss = ans.filter((r) => !r.retrievalHit);
  const c = (xs: Row[], f: (r: Row) => boolean) => xs.filter(f).length;
  console.log(`\n${label}`);
  console.log(`  answerable (n=${ans.length})`);
  console.log(`    correct            ${pct(c(ans, (r) => r.verdict.correct === true), ans.length)}`);
  console.log(`    faithful           ${pct(c(ans, (r) => r.verdict.faithful), ans.length)}`);
  console.log(`    false refusal      ${pct(c(ans, (r) => r.verdict.refused), ans.length)}`);
  console.log(`    correct | retrieval hit  (n=${hit.length})  ${pct(c(hit, (r) => r.verdict.correct === true), hit.length)}`);
  console.log(`    correct | retrieval miss (n=${miss.length})  ${pct(c(miss, (r) => r.verdict.correct === true), miss.length)}`);
  console.log(`  unanswerable (n=${un.length})`);
  console.log(`    correct refusal    ${pct(c(un, (r) => r.verdict.correct === true), un.length)}`);
  console.log(`    hallucination      ${pct(c(un, (r) => r.verdict.correct === false), un.length)}`);
  console.log(`    faithful           ${pct(c(un, (r) => r.verdict.faithful), un.length)}`);
  const types = [...new Set(ans.map((r) => r.type))];
  console.log(`  correct by type: ${types.map((t) => `${t} ${pct(c(ans, (r) => r.type === t && r.verdict.correct === true), c(ans, (r) => r.type === t))}`).join(" · ")}`);
}

async function main() {
  const cfg = parseArgs(process.argv.slice(2));
  if (!process.env.GROQ_API_KEY) throw new Error("GROQ_API_KEY is not set");

  let queries = loadQueries().filter((q) => cfg.split === "all" || q.split === cfg.split);
  if (cfg.limit) queries = queries.slice(0, cfg.limit);

  const { db, userIds, texts, chunkTotal } = await openEvalDb();
  console.log(`Indexed ${userIds.size} résumés → ${chunkTotal} chunks. ${queries.length} queries × ${cfg.retrievers.join(", ")}.`);
  console.log(`Answer model: ${RAG_ANSWER_MODEL} @ ${RAG_ANSWER_TEMPERATURE}. Judge: ${JUDGE_MODEL} @ 0.`);

  const structured = new Map<string, StructuredResume>();
  for (const [name, text] of texts) structured.set(name, await structuredFor(text));

  const rows: Row[] = [];
  for (const retriever of cfg.retrievers) {
    for (const [i, q] of queries.entries()) {
      const userId = userIds.get(q.resume)!;
      const chunks =
        retriever === "hybrid"
          ? await hybridRetrieve(db, userId, q.query, { k: QA_K })
          : await vectorOnlyRetrieve(db, userId, q.query, QA_K);
      const ans = await answer(chunks, structured.get(q.resume)!, q.query);
      // Exactly what the answer model saw between the context markers,
      // including the structured skills / experience summary lines.
      const context = chunks.length ? contextOf(buildResumeQAPrompt(chunks, structured.get(q.resume)!, q.query)) : "";
      const verdict = await judge(q, context, ans);
      const goldAlts = q.gold.map((g) => (Array.isArray(g) ? g : [g]).map(norm));
      const retrievalHit =
        q.gold.length > 0 && goldAlts.every((alts) => chunks.some((c) => alts.some((a) => norm(c.chunkText).includes(a))));
      rows.push({
        id: q.id,
        split: q.split,
        type: q.type,
        retriever,
        question: q.query,
        answerable: q.gold.length > 0,
        retrievalHit,
        chunks: chunks.length,
        answer: ans,
        verdict,
      });
      process.stdout.write(`\r  ${retriever}: ${i + 1}/${queries.length} (Groq calls so far: ${callsMade})   `);
    }
    process.stdout.write("\n");
  }

  for (const retriever of cfg.retrievers) {
    for (const split of cfg.split === "all" ? ["dev", "test", "all"] : [cfg.split]) {
      const subset = rows.filter((r) => r.retriever === retriever && (split === "all" || r.split === split));
      report(subset, `== ${retriever} · ${split}`);
    }
  }

  if (cfg.spotCheck > 0) {
    console.log(`\n== Spot-check sample (${cfg.spotCheck}) — audit these verdicts by hand`);
    const sample = rows.filter((r) => r.retriever === cfg.retrievers[0]);
    const step = Math.max(1, Math.floor(sample.length / cfg.spotCheck));
    for (let i = 0; i < sample.length && i / step < cfg.spotCheck; i += step) {
      const r = sample[i];
      console.log(`\n[${r.id}] (${r.type}) ${r.question}`);
      console.log(`  ANSWER: ${r.answer.replace(/\s+/g, " ").slice(0, 400)}`);
      console.log(`  VERDICT: refused=${r.verdict.refused} correct=${r.verdict.correct} faithful=${r.verdict.faithful} — ${r.verdict.reason}`);
      if (r.verdict.unsupported_claims.length) console.log(`  UNSUPPORTED: ${r.verdict.unsupported_claims.join(" | ")}`);
    }
  }

  const file = path.join(OUT, "results", `${cfg.save || "latest"}.json`);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify({ config: cfg, answerModel: RAG_ANSWER_MODEL, judgeModel: JUDGE_MODEL, rows }, null, 2));
  console.log(`\nSaved ${path.relative(process.cwd(), file)} · Groq calls this run: ${callsMade}`);
  await db.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
