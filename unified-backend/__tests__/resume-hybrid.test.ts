import { describe, it, expect } from "vitest";
import {
  buildKeywordQuery,
  detectQuerySection,
  fuseAndFilter,
  reciprocalRankFusion,
  RRF_K,
  type CandidateRow,
} from "../src/modules/ai/resume-hybrid";

// ────────────────────────────────────────────────────────────────────────────────
// HYBRID RETRIEVAL — keyword query building + Reciprocal Rank Fusion
// ────────────────────────────────────────────────────────────────────────────────

describe("buildKeywordQuery", () => {
  it("drops recruiting-domain filler and ORs the distinctive terms", () => {
    expect(buildKeywordQuery("Does the candidate know Snowflake?")).toBe("snowflake");
    expect(buildKeywordQuery("Has she worked with PySpark and Airflow")).toBe("pyspark or airflow");
  });

  it("keeps tech tokens with symbols intact", () => {
    const q = buildKeywordQuery("Any C++ or C# experience?");
    expect(q.split(" or ")).toEqual(["c++", "c#"]);
  });

  it("strips trailing punctuation but not internal dots", () => {
    expect(buildKeywordQuery("Did he use Vue.js.")).toBe("vue.js");
  });

  it("drops generic question verbs that matched unrelated chunks in the eval", () => {
    expect(buildKeywordQuery("Has he built anything in Rust?")).toBe("rust");
    expect(buildKeywordQuery("How has he improved reliability or reduced alerts?")).toBe("reliability or alerts");
  });

  it("expands abbreviations in both directions", () => {
    expect(buildKeywordQuery("Does he know Kubernetes?").split(" or ")).toContain("k8s");
    expect(buildKeywordQuery("Any K8s?").split(" or ")).toContain("kubernetes");
  });

  it("expands multi-word synonyms as quoted phrases", () => {
    const terms = buildKeywordQuery("Has he written infrastructure as code?").split(" or ");
    expect(terms).toContain("iac");
    expect(terms).toContain('"infrastructure as code"');
  });

  it("deduplicates terms case-insensitively", () => {
    expect(buildKeywordQuery("Docker docker DOCKER")).toBe("docker");
  });

  it("never emits websearch operators from user text", () => {
    const q = buildKeywordQuery('Python or -java "quoted"');
    expect(q.split(" or ")).toEqual(["python", "java", "quoted"]);
  });

  it("caps the number of terms for long JD-augmented queries", () => {
    // (Synonyms count toward the cap too.)
    const long = Array.from({ length: 100 }, (_, i) => `term${i}`).join(" ");
    expect(buildKeywordQuery(long).split(" or ")).toHaveLength(32);
  });

  it("returns an empty string when nothing distinctive remains", () => {
    expect(buildKeywordQuery("What does the candidate have?")).toBe("");
    expect(buildKeywordQuery("")).toBe("");
  });
});

describe("reciprocalRankFusion", () => {
  const ids = (xs: number[]) => xs.map((id) => ({ id }));

  it("ranks a chunk found by both legs above chunks found by one", () => {
    const fused = reciprocalRankFusion(ids([1, 2, 3]), ids([3, 4]));
    expect(fused[0].id).toBe(3);
    expect(fused[0].vectorRank).toBe(3);
    expect(fused[0].keywordRank).toBe(1);
  });

  it("computes score as the sum of 1/(k + rank)", () => {
    const fused = reciprocalRankFusion(ids([7]), ids([7]));
    expect(fused[0].rrfScore).toBeCloseTo(2 / (RRF_K + 1));
  });

  it("surfaces keyword-only hits the vector leg missed", () => {
    const fused = reciprocalRankFusion(ids([1, 2]), ids([9]));
    const nine = fused.find((h) => h.id === 9)!;
    expect(nine.vectorRank).toBeNull();
    expect(nine.keywordRank).toBe(1);
  });

  it("breaks score ties toward the vector leg's order", () => {
    // 1 is vector #1, 5 is keyword #1 — identical RRF scores.
    const fused = reciprocalRankFusion(ids([1]), ids([5]));
    expect(fused.map((h) => h.id)).toEqual([1, 5]);
  });

  it("degrades to the vector order when the keyword leg is empty", () => {
    const fused = reciprocalRankFusion(ids([4, 2, 8]), []);
    expect(fused.map((h) => h.id)).toEqual([4, 2, 8]);
  });

  it("returns nothing for two empty legs", () => {
    expect(reciprocalRankFusion([], [])).toEqual([]);
  });

  it("adds the optional section leg as a third ranked list", () => {
    const fused = reciprocalRankFusion(ids([1, 2]), ids([]), RRF_K, ids([2]));
    expect(fused[0].id).toBe(2);
    expect(fused[0].sectionRank).toBe(1);
  });
});

describe("detectQuerySection", () => {
  it("routes study questions to education", () => {
    expect(detectQuerySection("Which college did he graduate from?")).toBe("education");
    expect(detectQuerySection("What courses has she taken?")).toBe("education");
  });

  it("routes certifications and competitive programming to achievements", () => {
    expect(detectQuerySection("Is he OSCP certified?")).toBe("achievements");
    expect(detectQuerySection("How good is she at competitive programming?")).toBe("achievements");
  });

  it("returns null for questions not about one section", () => {
    expect(detectQuerySection("Has he handled production outages?")).toBeNull();
  });
});

describe("fuseAndFilter", () => {
  const row = (id: number, similarity: number): CandidateRow => ({
    id, chunk_text: `chunk ${id}`, section_type: "other", similarity,
  });
  const opts = { limit: 3, relevanceThreshold: 0.25 };

  it("drops semantic-only hits under the cosine floor", () => {
    expect(fuseAndFilter([row(1, 0.24)], [], opts)).toEqual([]);
  });

  it("keeps keyword and section hits regardless of cosine", () => {
    const kept = fuseAndFilter([], [row(1, 0.05)], opts, [row(2, 0.1)]);
    expect(kept.map((c) => [c.id, c.matchType])).toEqual([[1, "keyword"], [2, "section"]]);
  });

  it("labels chunks found by more than one leg as hybrid and cuts to limit", () => {
    const out = fuseAndFilter([row(1, 0.5), row(2, 0.4), row(3, 0.3), row(4, 0.3)], [row(3, 0.3)], opts);
    expect(out).toHaveLength(3);
    expect(out[0]).toMatchObject({ id: 3, matchType: "hybrid" });
  });
});
