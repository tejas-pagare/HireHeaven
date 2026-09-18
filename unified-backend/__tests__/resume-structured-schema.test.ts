import { describe, it, expect } from "vitest";
import {
  parseStructuredResume,
  stripCodeFences,
  EMPTY_STRUCTURED,
} from "../src/modules/ai/resume-structured-schema";

describe("stripCodeFences", () => {
  it("strips lowercase and uppercase fences", () => {
    expect(stripCodeFences('```json\n{"a":1}\n```')).toBe('{"a":1}');
    expect(stripCodeFences('```JSON\n{"a":1}\n```')).toBe('{"a":1}');
    expect(stripCodeFences('{"a":1}')).toBe('{"a":1}');
  });
});

describe("parseStructuredResume", () => {
  it("accepts a well-formed response", () => {
    const { data, ok } = parseStructuredResume(
      JSON.stringify({
        skills: ["Java", "Python"],
        experience_summary: "Three years backend.",
        projects: ["HireHeaven: job portal"],
        education: "B.Tech CS",
      })
    );
    expect(ok).toBe(true);
    expect(data.skills).toEqual(["Java", "Python"]);
    expect(data.education).toBe("B.Tech CS");
  });

  it("coerces a comma-delimited string into an array — the shape bug", () => {
    const { data, ok } = parseStructuredResume(
      '{"skills":"Java, Python, Redis","experience_summary":"x","projects":[],"education":""}'
    );
    expect(ok).toBe(true);
    expect(data.skills).toEqual(["Java", "Python", "Redis"]);
  });

  it("tolerates nulls and missing fields", () => {
    const { data, ok } = parseStructuredResume('{"skills":null}');
    expect(ok).toBe(true);
    expect(data).toEqual(EMPTY_STRUCTURED);
  });

  it("extracts JSON when the model prepends prose", () => {
    const { data, ok } = parseStructuredResume(
      'Here is the JSON:\n{"skills":["Go"],"experience_summary":"","projects":[],"education":""}'
    );
    expect(ok).toBe(true);
    expect(data.skills).toEqual(["Go"]);
  });

  it("falls back to empty on unparseable output instead of throwing", () => {
    for (const bad of ["", "not json at all", "{broken", "null"]) {
      const { data, ok } = parseStructuredResume(bad);
      expect(ok).toBe(false);
      expect(data).toEqual(EMPTY_STRUCTURED);
    }
  });

  it("bounds runaway output", () => {
    const { data } = parseStructuredResume(
      JSON.stringify({ skills: Array(500).fill("x"), experience_summary: "y".repeat(99999), projects: [], education: "" })
    );
    expect(data.skills.length).toBeLessThanOrEqual(100);
    expect(data.experience_summary.length).toBeLessThanOrEqual(4000);
  });
});
