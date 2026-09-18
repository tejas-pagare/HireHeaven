import { describe, it, expect } from "vitest";
import {
  chunkResumeText,
  detectSectionType,
  isSectionHeading,
  MAX_CHUNK_CHARS,
} from "../src/modules/ai/resume-chunking";

// ────────────────────────────────────────────────────────────────────────────────
// RÉSUMÉ CHUNKING
//
// Regression cover for the splitter bug: the original section regex carried an
// `i` flag on an `[A-Z]`-based all-caps test, so it matched ordinary prose. That
// split résumés at nearly every newline and dropped every section heading
// (headings became <20-char fragments and were filtered out), which in turn
// starved detectSectionType of its most reliable signal.
// ────────────────────────────────────────────────────────────────────────────────

const RESUME = `Raj Kumar
Bangalore, India | raj@example.com

SUMMARY
Full stack engineer with three years building scalable web services.
Comfortable across the stack and in production operations.

TECHNICAL SKILLS
Languages: Java, Python, TypeScript, JavaScript
Frameworks: Node.js, Express.js, React
Databases: PostgreSQL, MongoDB, Redis

EXPERIENCE
Full Stack Engineer Intern, Soundverse AI
Built the realtime ingestion path handling millions of events.
Owned the deployment pipeline and on call rotation.

PROJECTS
HireHeaven: microservices job portal with AI resume screening.
Realtime chat service using Socket.IO with Redis pub sub.`;

describe("isSectionHeading", () => {
  it("accepts all-caps headings", () => {
    expect(isSectionHeading("EXPERIENCE")).toBe(true);
    expect(isSectionHeading("TECHNICAL SKILLS")).toBe(true);
  });

  it("accepts title-case headings for known sections", () => {
    expect(isSectionHeading("Technical Skills")).toBe(true);
    expect(isSectionHeading("Work Experience")).toBe(true);
    expect(isSectionHeading("Projects")).toBe(true);
  });

  it("rejects ordinary prose — the original bug", () => {
    expect(isSectionHeading("Built the realtime ingestion path")).toBe(false);
    expect(isSectionHeading("Owned the deployment pipeline and on call rotation.")).toBe(false);
    expect(isSectionHeading("Comfortable across the stack and in production operations.")).toBe(false);
  });

  it("rejects contact lines and anything with a year", () => {
    expect(isSectionHeading("Bangalore, India | raj@example.com")).toBe(false);
    expect(isSectionHeading("Soundverse AI 2025")).toBe(false);
  });

  it("rejects over-long lines", () => {
    expect(isSectionHeading("A".repeat(61))).toBe(false);
  });
});

describe("chunkResumeText", () => {
  const chunks = chunkResumeText(RESUME);

  it("does not shred the résumé into one chunk per line", () => {
    // The buggy splitter produced 12 single-line fragments for this input.
    expect(chunks.length).toBeLessThan(8);
    expect(chunks.length).toBeGreaterThan(0);
  });

  it("keeps every section heading in the indexed text", () => {
    const all = chunks.map((c) => c.text).join("\n");
    for (const heading of ["SUMMARY", "TECHNICAL SKILLS", "EXPERIENCE", "PROJECTS"]) {
      expect(all).toContain(heading);
    }
  });

  it("keeps a section's lines together rather than separating them", () => {
    const skills = chunks.find((c) => c.text.includes("TECHNICAL SKILLS"));
    expect(skills).toBeDefined();
    expect(skills!.text).toContain("Languages:");
    expect(skills!.text).toContain("Frameworks:");
    expect(skills!.text).toContain("Databases:");
  });

  it("labels sections from their heading", () => {
    const types = chunks.map((c) => c.sectionType);
    // The name/contact block at the top has no heading and lands in "other";
    // every real section must be labelled from its heading.
    expect(types).toEqual(
      expect.arrayContaining(["summary", "skills", "experience", "projects"])
    );
  });

  it("labels plural headings — PROJECTS / ACHIEVEMENTS / CERTIFICATIONS", () => {
    for (const [heading, expected] of [
      ["PROJECTS", "projects"],
      ["ACHIEVEMENTS", "achievements"],
      ["CERTIFICATIONS", "achievements"],
      ["AWARDS", "achievements"],
    ] as const) {
      const [chunk] = chunkResumeText(`${heading}\nSomething substantial written here for the section body.`);
      expect(chunk.sectionType, heading).toBe(expected);
    }
  });

  it("never exceeds the embedding model's safe window", () => {
    for (const c of chunks) expect(c.text.length).toBeLessThanOrEqual(MAX_CHUNK_CHARS);
  });

  it("splits an oversized section but repeats the heading on each piece", () => {
    const long = `EXPERIENCE\n${"Delivered a large platform migration across many teams. ".repeat(30)}`;
    const out = chunkResumeText(long);
    expect(out.length).toBeGreaterThan(1);
    for (const c of out) {
      expect(c.text.startsWith("EXPERIENCE")).toBe(true);
      expect(c.text.length).toBeLessThanOrEqual(MAX_CHUNK_CHARS);
    }
  });

  it("windows headingless text instead of emitting one oversized chunk", () => {
    const flat = "Some continuous resume prose without any headings at all. ".repeat(40);
    const out = chunkResumeText(flat);
    expect(out.length).toBeGreaterThan(1);
    for (const c of out) expect(c.text.length).toBeLessThanOrEqual(MAX_CHUNK_CHARS);
  });

  it("returns no chunks for empty input rather than throwing", () => {
    expect(chunkResumeText("")).toEqual([]);
    expect(chunkResumeText("   \n  \n ")).toEqual([]);
  });
});

describe("detectSectionType", () => {
  it("uses the heading when one is present", () => {
    expect(detectSectionType("EXPERIENCE\nSoftware Engineer at Acme")).toBe("experience");
    expect(detectSectionType("EDUCATION\nB.Tech Computer Science")).toBe("education");
  });

  it("falls back to content heuristics without a heading", () => {
    expect(detectSectionType("LeetCode rating 1850, hackathon winner")).toBe("achievements");
    expect(detectSectionType("B.Tech in Computer Science, CGPA 8.7")).toBe("education");
  });
});
