/**
 * Validation for the LLM's structured-résumé extraction.
 *
 * The previous code did `JSON.parse(raw)` inside a try/catch and returned the
 * result directly. The catch only covered *parse* failure, not *shape*: a model
 * returning `"skills": "Java, Python"` parsed fine, then hit a `TEXT[]` column
 * and threw — after the old code had already deleted the user's index.
 *
 * Everything here is pure so it can be unit-tested without a DB or an API key.
 */
import { z } from "zod";

/** Coerce a scalar or comma/newline-delimited string into a clean string[]. */
const StringArray = z
  .union([z.array(z.unknown()), z.string(), z.null(), z.undefined()])
  .transform((v) => {
    if (v == null) return [];
    const parts = Array.isArray(v) ? v : String(v).split(/[,\n;]+/);
    return parts
      .map((p) => String(p).trim())
      .filter((p) => p.length > 0 && p.length <= 200)
      .slice(0, 100);
  });

const StringField = z
  .union([z.string(), z.number(), z.null(), z.undefined()])
  .transform((v) => (v == null ? "" : String(v).trim().slice(0, 4000)));

export const StructuredResumeSchema = z.object({
  skills: StringArray,
  experience_summary: StringField,
  projects: StringArray,
  education: StringField,
});

export type StructuredResume = z.infer<typeof StructuredResumeSchema>;

export const EMPTY_STRUCTURED: StructuredResume = {
  skills: [],
  experience_summary: "",
  projects: [],
  education: "",
};

/** Strip code fences the model may wrap JSON in, in any case. */
export function stripCodeFences(raw: string): string {
  return raw
    .replace(/^\s*```[a-z]*\s*/i, "")
    .replace(/```\s*$/i, "")
    .replace(/```/g, "")
    .trim();
}

/**
 * Parse + validate an LLM response into a StructuredResume.
 * Never throws — falls back to empty so a bad extraction can't abort indexing.
 */
export function parseStructuredResume(raw: string): {
  data: StructuredResume;
  ok: boolean;
  reason?: string;
} {
  const cleaned = stripCodeFences(raw ?? "");
  if (!cleaned) return { data: EMPTY_STRUCTURED, ok: false, reason: "EMPTY_RESPONSE" };

  // Models sometimes prepend prose before the JSON object.
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  const candidate = start !== -1 && end > start ? cleaned.slice(start, end + 1) : cleaned;

  let parsed: unknown;
  try {
    parsed = JSON.parse(candidate);
  } catch {
    return { data: EMPTY_STRUCTURED, ok: false, reason: "INVALID_JSON" };
  }

  const result = StructuredResumeSchema.safeParse(parsed);
  if (!result.success) {
    return { data: EMPTY_STRUCTURED, ok: false, reason: "SCHEMA_MISMATCH" };
  }
  return { data: result.data, ok: true };
}
