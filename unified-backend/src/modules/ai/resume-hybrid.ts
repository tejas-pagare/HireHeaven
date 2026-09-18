/**
 * Hybrid retrieval helpers — keyword-query building + Reciprocal Rank Fusion.
 *
 * Vector search captures meaning ("led a team" ≈ "managed 5 engineers") but
 * misses exact tokens a recruiter asks about by name: "K8s", "PySpark", a
 * company, a version. Postgres full-text search catches those. The two legs
 * produce scores on unrelated scales (cosine vs ts_rank_cd), so they are
 * fused on rank alone via RRF instead of trying to normalise the scores.
 *
 * Kept free of DB/LLM imports so it can be unit-tested without a database
 * connection or a Groq API key.
 */

/** RRF damping constant — 60 is the value from the original RRF paper and
 *  the common default; it keeps a single #1 rank from dominating the sum. */
export const RRF_K = 60;

/**
 * Cosine floor for chunks found ONLY by the vector leg. Tuned with
 * scripts/eval-retrieval.ts: 0.2 let 50% of unanswerable dev questions return
 * noise; 0.25 returns nothing for all of them with no loss on answerable
 * ones. It is a sharp edge (0.26 starts dropping real answers), so re-run the
 * eval before moving it.
 */
export const RELEVANCE_THRESHOLD = 0.25;

/** How many candidates each leg contributes before fusion. */
export const HYBRID_CANDIDATES_PER_LEG = 20;

/** Upper bound on OR-ed terms, so a long JD-augmented query stays cheap. */
const MAX_KEYWORD_TERMS = 32;

/**
 * Words that appear in almost every recruiter question and would otherwise
 * match every chunk. Postgres' english config already drops true stop words
 * ("the", "does"); this list covers the recruiting-domain ones it keeps.
 */
const DOMAIN_STOPWORDS = new Set([
  "candidate", "candidates", "applicant", "resume", "cv", "profile",
  "does", "did", "do", "have", "has", "had", "any", "know", "knows",
  "tell", "about", "what", "which", "who", "how", "much", "many",
  "he", "she", "they", "his", "her", "their", "them", "him",
  "is", "are", "was", "were", "with", "and", "or", "the", "a", "an",
  "in", "on", "of", "for", "to", "at", "by", "from", "this", "that",
  "worked", "work", "working", "used", "using", "use", "experience",
  "job", "description", "context", "role",
  // Generic verbs / vague nouns that carry the question's shape, not its
  // subject. Found via the retrieval eval: they matched unrelated chunks and,
  // because keyword hits bypass the cosine floor, leaked noise into answers
  // for questions the résumé can't answer.
  "built", "build", "building", "done", "made", "make", "handled", "handle",
  "improved", "improve", "reduced", "reduce", "written", "write", "wrote",
  "ensure", "understand", "anything", "something", "other", "others",
  "good", "well", "ever", "also", "kind", "type", "types", "tool", "tools",
  "system", "systems", "development", "years", "year", "can", "could",
  "would", "should", "been", "being", "be", "where", "when", "why",
]);

/**
 * Equivalent spellings of common tech terms. Full-text search only matches
 * lexemes, so "Kubernetes" never meets "K8s" and "infrastructure as code"
 * never meets "IaC" (both surfaced as misses in the retrieval eval). Each
 * group is symmetric: any member in the query adds the others. Multi-word
 * members are matched against the raw query text.
 */
const SYNONYM_GROUPS: string[][] = [
  ["kubernetes", "k8s", "gke", "eks", "aks"],
  ["javascript", "js"],
  ["typescript"],
  ["postgres", "postgresql"],
  ["golang", "go"],
  ["node", "node.js", "nodejs"],
  ["react", "reactjs", "react.js"],
  ["infrastructure as code", "iac", "terraform"],
  ["ci/cd", "ci", "cd", "continuous integration", "jenkins", "github actions"],
  ["machine learning", "ml"],
  ["large language model", "large language models", "llm", "llms"],
  ["natural language processing", "nlp"],
  ["end-to-end", "e2e"],
  ["aws", "amazon web services"],
  ["gcp", "google cloud"],
  ["a/b testing", "a/b", "experimentation", "experiments"],
];

function synonymsFor(lowerText: string, tokens: Set<string>): string[] {
  const out: string[] = [];
  for (const group of SYNONYM_GROUPS) {
    const hit = group.some((m) => (m.includes(" ") ? lowerText.includes(m) : tokens.has(m)));
    if (hit) out.push(...group);
  }
  return out;
}

/**
 * Turns free text into an OR query for `websearch_to_tsquery`.
 *
 * `plainto_tsquery` / `websearch_to_tsquery` AND every word together, so
 * "does the candidate know Kubernetes" would only match a chunk containing
 * "candidate", "know" AND "kubernetes" — i.e. nothing. OR-ing the
 * distinctive terms and letting ts_rank_cd reward chunks that match more of
 * them is what a keyword leg should do. Returns "" when nothing distinctive
 * is left, in which case the keyword leg is skipped.
 */
export function buildKeywordQuery(text: string): string {
  const seen = new Set<string>();
  const terms: string[] = [];
  const lower = text.toLowerCase();

  // Keep tech-ish tokens intact: c++, c#, node.js, .net, ci/cd.
  const rawTokens = (lower.match(/[a-z0-9][a-z0-9+#./-]*[a-z0-9+#]/g) || []).map((t) =>
    t.replace(/^[./-]+|[./-]+$/g, "")
  );

  const add = (term: string) => {
    if (term.length < 2 || seen.has(term) || terms.length >= MAX_KEYWORD_TERMS) return;
    seen.add(term);
    // A multi-word synonym is quoted so websearch_to_tsquery matches it as a phrase.
    terms.push(term.includes(" ") ? `"${term}"` : term);
  };

  for (const token of rawTokens) {
    if (DOMAIN_STOPWORDS.has(token)) continue;
    // websearch_to_tsquery treats a bare "or" as an operator and "-" as NOT.
    if (token === "or" || token.startsWith("-")) continue;
    add(token);
  }
  for (const synonym of synonymsFor(lower, new Set(rawTokens))) add(synonym);

  return terms.join(" or ");
}

/**
 * Maps a question to the résumé section it is about, using the same labels
 * the chunker stores in `section_type`. "Which college did he graduate
 * from?" shares no words with "EDUCATION / B.Tech …, NIT Kurukshetra" and
 * MiniLM scores them low, so without this the retriever returned nothing
 * for section-level questions in the eval. Returns null when the question
 * isn't about one section.
 */
const SECTION_INTENTS: [RegExp, string][] = [
  [/\b(college|university|degree|graduat\w*|stud(y|ied|ies)|educat\w*|qualifications?|cgpa|gpa|coursework|courses?|school|alma mater)\b/i, "education"],
  [/\b(certif\w*|awards?|achievements?|hackathons?|honou?rs?|competitive programming|leetcode|codeforces)\b/i, "achievements"],
  [/\b(skills?|tech(nology|nologies)? stack|technologies|programming languages)\b/i, "skills"],
  [/\b(projects?|side projects?|portfolio)\b/i, "projects"],
  [/\b(summary|objective|about (him|her|them)|career goals?)\b/i, "summary"],
];

export function detectQuerySection(text: string): string | null {
  for (const [pattern, section] of SECTION_INTENTS) {
    if (pattern.test(text)) return section;
  }
  return null;
}

export interface RankedHit {
  id: number;
}

export interface FusedHit {
  id: number;
  rrfScore: number;
  vectorRank: number | null;
  keywordRank: number | null;
  sectionRank: number | null;
}

/**
 * Reciprocal Rank Fusion: score(d) = Σ 1 / (k + rank_i(d)), ranks 1-based.
 * A chunk found by several legs outranks one found by a single leg; ties
 * break toward the vector leg's order so pure-semantic behaviour is the
 * baseline. The section leg is optional (only when the question names one).
 */
export function reciprocalRankFusion(
  vectorHits: RankedHit[],
  keywordHits: RankedHit[],
  k: number = RRF_K,
  sectionHits: RankedHit[] = []
): FusedHit[] {
  const fused = new Map<number, FusedHit>();
  const legs: [RankedHit[], "vectorRank" | "keywordRank" | "sectionRank"][] = [
    [vectorHits, "vectorRank"],
    [keywordHits, "keywordRank"],
    [sectionHits, "sectionRank"],
  ];

  for (const [hits, rankKey] of legs) {
    hits.forEach((hit, i) => {
      const entry =
        fused.get(hit.id) ?? { id: hit.id, rrfScore: 0, vectorRank: null, keywordRank: null, sectionRank: null };
      entry.rrfScore += 1 / (k + i + 1);
      entry[rankKey] = i + 1;
      fused.set(hit.id, entry);
    });
  }

  return [...fused.values()].sort(
    (a, b) =>
      b.rrfScore - a.rrfScore ||
      (a.vectorRank ?? Infinity) - (b.vectorRank ?? Infinity) ||
      (a.keywordRank ?? Infinity) - (b.keywordRank ?? Infinity)
  );
}

/** hybrid = found by 2+ legs; otherwise the single leg that found it. */
export type MatchType = "hybrid" | "semantic" | "keyword" | "section";

/** One candidate row as both retrieval legs' SQL returns it. */
export interface CandidateRow {
  id: number;
  chunk_text: string;
  section_type: string;
  similarity: number | string;
}

export interface RetrievedChunk {
  id: number;
  chunkText: string;
  sectionType: string;
  /** Cosine similarity to the query, 0–1 (shown to recruiters, averaged into confidence). */
  relevanceScore: number;
  /** Which retrieval leg(s) surfaced this chunk. */
  matchType: MatchType;
}

export interface FuseOptions {
  limit: number;
  /** Cosine floor for chunks found ONLY by the vector leg. */
  relevanceThreshold: number;
  rrfK?: number;
}

/**
 * Fuses the two legs' rows, applies the relevance floor and cuts to `limit`.
 * Shared by production retrieval and the offline eval harness
 * (scripts/eval-retrieval.ts) so tuning measures the real code path.
 *
 * Only semantic-only hits face the cosine floor: an exact term hit
 * ("Kubernetes") or a chunk from the section the question asked about is
 * evidence of relevance even when the embedding similarity is modest.
 */
export function fuseAndFilter(
  vectorRows: CandidateRow[],
  keywordRows: CandidateRow[],
  { limit, relevanceThreshold, rrfK = RRF_K }: FuseOptions,
  sectionRows: CandidateRow[] = []
): RetrievedChunk[] {
  const rowsById = new Map<number, CandidateRow>();
  for (const row of [...vectorRows, ...keywordRows, ...sectionRows]) rowsById.set(row.id, row);

  const results: RetrievedChunk[] = [];
  for (const hit of reciprocalRankFusion(vectorRows, keywordRows, rrfK, sectionRows)) {
    const row = rowsById.get(hit.id)!;
    const similarity = Number(row.similarity);
    const legCount = [hit.vectorRank, hit.keywordRank, hit.sectionRank].filter((r) => r !== null).length;
    const matchType: MatchType =
      legCount > 1
        ? "hybrid"
        : hit.keywordRank !== null
          ? "keyword"
          : hit.sectionRank !== null
            ? "section"
            : "semantic";

    if (matchType === "semantic" && similarity < relevanceThreshold) continue;

    results.push({
      id: row.id,
      chunkText: row.chunk_text,
      sectionType: row.section_type,
      relevanceScore: Math.round(Math.max(similarity, 0) * 100) / 100,
      matchType,
    });
    if (results.length >= limit) break;
  }
  return results;
}
