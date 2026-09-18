/**
 * Offline retrieval eval for the résumé RAG copilot.
 *
 * Indexes the synthetic résumés in eval/retrieval/resumes with the production
 * chunker + MiniLM embeddings into PGlite (in-process Postgres with pgvector
 * and full-text search — the same SQL as production, no server needed), then
 * scores each retriever on the labelled queries in eval/retrieval/queries.json.
 *
 *   npx tsx scripts/eval-retrieval.ts                      # dev split, all retrievers
 *   npx tsx scripts/eval-retrieval.ts --split test         # held-out split
 *   npx tsx scripts/eval-retrieval.ts --split all --save baseline
 *   npx tsx scripts/eval-retrieval.ts --rrf-k 20 --candidates 10 --threshold 0.3
 *   npx tsx scripts/eval-retrieval.ts --verbose            # print misses
 *
 * Retrievers:
 *   keyword-and  plainto_tsquery (every term must match) — "traditional" keyword search
 *   keyword-or   the production keyword leg alone (buildKeywordQuery + ts_rank_cd)
 *   vector       the vector leg alone with the old 0.2 floor — the pre-hybrid system
 *   hybrid       vector + keyword + section legs fused with fuseAndFilter() — the production path
 *
 * Metrics (answerable queries): Recall@k = share of gold spans found in the
 * top k; Hit@1 = first result contains a gold span; MRR = mean 1/rank of the
 * first chunk containing a gold span. Unanswerable queries report the share
 * that returned zero chunks (so the LLM is never called with noise).
 */
import fs from "node:fs";
import path from "node:path";
import {
  ROOT,
  loadQueries,
  openEvalDb,
  norm,
  keywordLeg,
  hybridRetrieve,
  vectorOnlyRetrieve,
  type Query,
} from "./eval-harness.js";
import { generateEmbedding } from "../src/utils/embedding.js";
import {
  buildKeywordQuery,
  HYBRID_CANDIDATES_PER_LEG,
  RELEVANCE_THRESHOLD,
  RRF_K,
} from "../src/modules/ai/resume-hybrid.js";
import type { PGlite } from "@electric-sql/pglite";

interface Config {
  split: "dev" | "test" | "all";
  k: number;
  candidates: number;
  rrfK: number;
  threshold: number;
  save?: string;
  verbose: boolean;
  chunkChars?: number;
  /** Ablation: disable the section-intent leg. */
  noSection: boolean;
}

function parseArgs(argv: string[]): Config {
  const get = (flag: string) => {
    const i = argv.indexOf(flag);
    return i !== -1 ? argv[i + 1] : undefined;
  };
  return {
    split: (get("--split") as Config["split"]) || "dev",
    k: Number(get("--k") ?? 3),
    candidates: Number(get("--candidates") ?? HYBRID_CANDIDATES_PER_LEG),
    rrfK: Number(get("--rrf-k") ?? RRF_K),
    threshold: Number(get("--threshold") ?? RELEVANCE_THRESHOLD),
    save: get("--save"),
    verbose: argv.includes("--verbose"),
    noSection: argv.includes("--no-section"),
    chunkChars: get("--chunk-chars") ? Number(get("--chunk-chars")) : undefined,
  };
}

type Retriever = "keyword-and" | "keyword-or" | "vector" | "hybrid";
const RETRIEVERS: Retriever[] = ["keyword-and", "keyword-or", "vector", "hybrid"];

async function retrieve(db: PGlite, which: Retriever, userId: number, q: string, cfg: Config): Promise<string[]> {
  switch (which) {
    case "keyword-and":
    case "keyword-or": {
      const emb = `[${(await generateEmbedding(q)).join(",")}]`;
      const rows =
        which === "keyword-and"
          ? await keywordLeg(db, userId, emb, q, "plainto_tsquery", cfg.k)
          : await keywordLeg(db, userId, emb, buildKeywordQuery(q), "websearch_to_tsquery", cfg.k);
      return rows.map((r) => r.chunk_text);
    }
    case "vector":
      return (await vectorOnlyRetrieve(db, userId, q, cfg.k)).map((c) => c.chunkText);
    case "hybrid":
      return (
        await hybridRetrieve(db, userId, q, {
          k: cfg.k,
          candidates: cfg.candidates,
          rrfK: cfg.rrfK,
          threshold: cfg.threshold,
          noSection: cfg.noSection,
        })
      ).map((c) => c.chunkText);
  }
}

// ── Scoring ────────────────────────────────────────────────────────────────────

interface QueryScore {
  id: string;
  type: string;
  recall: number;
  hit1: number;
  rr: number;
  empty: boolean;
  answerable: boolean;
}

function score(q: Query, chunks: string[]): QueryScore {
  const answerable = q.gold.length > 0;
  const nChunks = chunks.map(norm);
  const golds = q.gold.map((g) => (Array.isArray(g) ? g : [g]).map(norm));
  const matches = (c: string, alts: string[]) => alts.some((a) => c.includes(a));
  const found = golds.filter((alts) => nChunks.some((c) => matches(c, alts))).length;
  const firstRank = nChunks.findIndex((c) => golds.some((alts) => matches(c, alts)));
  return {
    id: q.id,
    type: q.type,
    answerable,
    recall: answerable ? found / golds.length : 0,
    hit1: answerable && firstRank === 0 ? 1 : 0,
    rr: answerable && firstRank >= 0 ? 1 / (firstRank + 1) : 0,
    empty: chunks.length === 0,
  };
}

function summarise(scores: QueryScore[]) {
  const ans = scores.filter((s) => s.answerable);
  const un = scores.filter((s) => !s.answerable);
  const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
  return {
    n: ans.length,
    recall: mean(ans.map((s) => s.recall)),
    hit1: mean(ans.map((s) => s.hit1)),
    mrr: mean(ans.map((s) => s.rr)),
    unanswerableEmpty: mean(un.map((s) => (s.empty ? 1 : 0))),
    nUnanswerable: un.length,
  };
}

// ── Main ───────────────────────────────────────────────────────────────────────

async function main() {
  const cfg = parseArgs(process.argv.slice(2));
  const queries = loadQueries();
  const selected = queries.filter((q) => cfg.split === "all" || q.split === cfg.split);

  const { db, userIds, texts, chunkTotal, resumeCount } = await openEvalDb(cfg.chunkChars);

  // Label sanity: every gold span must exist verbatim in its résumé.
  for (const q of queries) {
    for (const g of q.gold.flat()) {
      if (!norm(texts.get(q.resume) ?? "").includes(norm(g))) throw new Error(`${q.id}: gold span not in ${q.resume}: "${g}"`);
    }
  }

  console.log(`Indexed ${resumeCount} résumés → ${chunkTotal} chunks. Split=${cfg.split}, ${selected.length} queries.`);
  console.log(`Config: chunkChars=${cfg.chunkChars ?? "default"} k=${cfg.k} candidates/leg=${cfg.candidates} rrfK=${cfg.rrfK} threshold=${cfg.threshold}\n`);

  const results: Record<string, { overall: ReturnType<typeof summarise>; byType: Record<string, ReturnType<typeof summarise>>; perQuery: QueryScore[] }> = {};

  for (const which of RETRIEVERS) {
    const perQuery: QueryScore[] = [];
    for (const q of selected) {
      const chunks = await retrieve(db, which, userIds.get(q.resume)!, q.query, cfg);
      const s = score(q, chunks);
      perQuery.push(s);
      if (cfg.verbose && which === "hybrid" && ((s.answerable && s.hit1 < 1) || (!s.answerable && !s.empty))) {
        const label = s.answerable ? `MISS recall=${s.recall.toFixed(2)} mrr=${s.rr.toFixed(2)}` : `NOISE (unanswerable returned ${chunks.length})`;
        console.log(`  ${label} ${q.id} [${q.type}] "${q.query}" kw="${buildKeywordQuery(q.query)}"`);
        if (cfg.verbose) chunks.forEach((c, i) => console.log(`      ${i + 1}. ${c.replace(/\n/g, " | ").slice(0, 110)}`));
      }
    }
    const types = [...new Set(perQuery.map((s) => s.type))];
    results[which] = {
      overall: summarise(perQuery),
      byType: Object.fromEntries(types.map((t) => [t, summarise(perQuery.filter((s) => s.type === t))])),
      perQuery,
    };
  }

  const pct = (x: number) => (x * 100).toFixed(1).padStart(5);
  console.log(`retriever    | Recall@${cfg.k} | Hit@1 |  MRR  | unanswerable→empty`);
  console.log(`-------------|----------|-------|-------|-------------------`);
  for (const which of RETRIEVERS) {
    const o = results[which].overall;
    console.log(`${which.padEnd(12)} |   ${pct(o.recall)}  | ${pct(o.hit1)} | ${pct(o.mrr)} | ${pct(o.unanswerableEmpty)} (n=${o.nUnanswerable})`);
  }

  console.log(`\nRecall@${cfg.k} by query type:`);
  const types = Object.keys(results.hybrid.byType).filter((t) => t !== "unanswerable");
  console.log(`retriever    | ${types.map((t) => t.padStart(8)).join(" | ")}`);
  for (const which of RETRIEVERS) {
    console.log(`${which.padEnd(12)} | ${types.map((t) => `${pct(results[which].byType[t].recall)}   `).join(" | ")}`);
  }

  const lift = (a: number, b: number) => (b > 0 ? `${(((a - b) / b) * 100).toFixed(1)}%` : "n/a");
  const h = results.hybrid.overall;
  console.log(`\nHybrid vs keyword-and: Recall ${lift(h.recall, results["keyword-and"].overall.recall)}, MRR ${lift(h.mrr, results["keyword-and"].overall.mrr)}`);
  console.log(`Hybrid vs keyword-or:  Recall ${lift(h.recall, results["keyword-or"].overall.recall)}, MRR ${lift(h.mrr, results["keyword-or"].overall.mrr)}`);
  console.log(`Hybrid vs vector:      Recall ${lift(h.recall, results.vector.overall.recall)}, MRR ${lift(h.mrr, results.vector.overall.mrr)}`);

  if (cfg.save) {
    const dir = path.join(ROOT, "results");
    fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, `${cfg.save}-${cfg.split}.json`);
    fs.writeFileSync(file, JSON.stringify({ config: cfg, chunkTotal, results }, null, 2));
    console.log(`\nSaved ${path.relative(process.cwd(), file)}`);
  }

  await db.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
