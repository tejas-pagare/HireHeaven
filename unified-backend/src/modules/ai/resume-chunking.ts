/**
 * Résumé chunking + section detection.
 *
 * Kept free of DB/LLM imports so it can be unit-tested without a database
 * connection or a Groq API key (both of those clients construct at module load).
 */

export interface ResumeChunk {
  text: string;
  sectionType: string;
}

/** Target chunk size in characters.
 *
 *  all-MiniLM-L6-v2 truncates at 256 word-piece tokens. Measured against the
 *  tokenizer: ~600 chars ≈ 194 tokens, ~1000 chars ≈ 322 tokens. 600 keeps a
 *  safe margin so no chunk is silently cut off mid-content.
 */
export const MAX_CHUNK_CHARS = 600;

/** Minimum length for a fragment to be worth indexing on its own. */
const MIN_CHUNK_CHARS = 20;

/**
 * Heading -> section type. Stems are suffixed with `\w*` because the originals
 * were exact words inside `\b…\b`: `\bproject\b` never matched "PROJECTS",
 * `\bcertif\b` never matched "CERTIFICATIONS", and `\bachievement\b` never
 * matched "ACHIEVEMENTS" — four of seven types could not match their own
 * heading. That went unnoticed while the chunker was discarding headings.
 */
const SECTION_PATTERNS: [RegExp, string][] = [
  [/\b(skills?|technical\s*skills?|core\s*competenc\w*|technologies|tech\s*stack)\b/i, "skills"],
  [/\b(experiences?|work\s*experience|employment|professional\s*experience|work\s*histor\w*)\b/i, "experience"],
  [/\b(education|academics?|qualifications?|degrees?|university|college)\b/i, "education"],
  [/\b(projects?|personal\s*projects?|academic\s*projects?|side\s*projects?)\b/i, "projects"],
  [/\b(summary|objectives?|profile|about\s*me|introduction)\b/i, "summary"],
  [/\b(certif\w*|awards?|achievements?|honou?rs?|accomplishments?)\b/i, "achievements"],
  [/\b(volunteer\w*|extra.?curricular|activities|interests|hobbies)\b/i, "other"],
];

/** Headings we recognise even when they aren't in all caps ("Technical Skills"). */
const KNOWN_HEADING =
  /^(technical\s+)?(skills?|core\s+competenc\w*|technologies|tech\s+stack|work\s+experience|professional\s+experience|employment(\s+history)?|experience|education|academics?|projects?|summary|objective|profile|about\s+me|certifications?|awards?|achievements?|publications?|volunteering|interests|hobbies|languages|contact)\s*:?$/i;

/**
 * Is this line a section heading rather than prose?
 *
 * The previous implementation used a regex with the `i` flag on an
 * `[A-Z]`-based "all caps" test, which made it match ordinary sentences — so
 * résumés were split at almost every line and headings were dropped entirely.
 * Heading-ness is decided explicitly here instead.
 */
export function isSectionHeading(line: string): boolean {
  const t = line.trim();
  if (!t || t.length > 60) return false;
  // Prose ends in punctuation; headings don't.
  if (/[.!?,;]$/.test(t)) return false;
  // Contact lines ("a@b.com | +91 …") are not headings.
  if (/[@|]/.test(t) || /\d{4}/.test(t)) return false;

  const letters = t.replace(/[^A-Za-z]/g, "");
  if (!letters) return false;

  const isAllCaps = letters === letters.toUpperCase() && letters.length >= 3;
  return isAllCaps || KNOWN_HEADING.test(t);
}

export function detectSectionType(text: string): string {
  const firstLine = text.split("\n")[0] || "";
  for (const [pattern, type] of SECTION_PATTERNS) {
    if (pattern.test(firstLine)) return type;
  }
  for (const [pattern, type] of SECTION_PATTERNS) {
    if (pattern.test(text.substring(0, 300))) return type;
  }
  const lower = text.toLowerCase();
  if (
    /\b(java|python|react|node|typescript|javascript|sql|docker|aws|kubernetes|git|html|css|c\+\+)\b/i.test(text) &&
    (lower.includes("language") || lower.includes("framework") || lower.includes("tool") || text.split(/[,|•·]/).length > 4)
  ) return "skills";
  if (/\b(\d{4}\s*[-–]\s*(\d{4}|present|current))\b/i.test(text) ||
    /\b(intern|engineer|developer|manager|analyst|lead|senior|junior)\b/i.test(text)) return "experience";
  if (/\b(bachelor|master|b\.?tech|m\.?tech|b\.?sc|m\.?sc|degree|gpa|cgpa|semester)\b/i.test(text)) return "education";
  if (/\b(built|developed|created|implemented|designed|deployed|full.?stack|web\s*app|mobile\s*app)\b/i.test(text) && lower.includes("project")) return "projects";
  if (/\b(leetcode|codeforces|hackathon|winner|award|certificate|certified|rank)\b/i.test(text)) return "achievements";
  return "other";
}

/** Split one section's body into <=MAX_CHUNK_CHARS pieces, keeping the heading
 *  on every piece so retrieved fragments stay self-describing. */
function packSection(heading: string, body: string, sectionType: string, maxChars: number): ResumeChunk[] {
  const out: ResumeChunk[] = [];
  const prefix = heading ? `${heading}\n` : "";
  const budget = Math.max(maxChars - prefix.length, 120);

  // Prefer paragraph boundaries, then lines, then a hard cut.
  const units = body
    .split(/\n\s*\n/)
    .flatMap((p) => (p.length <= budget ? [p] : p.split("\n")))
    .flatMap((p) => {
      if (p.length <= budget) return [p];
      const pieces: string[] = [];
      for (let i = 0; i < p.length; i += budget) pieces.push(p.slice(i, i + budget));
      return pieces;
    })
    .map((p) => p.trim())
    .filter(Boolean);

  let buffer = "";
  for (const unit of units) {
    if (buffer && buffer.length + unit.length + 1 > budget) {
      out.push({ text: (prefix + buffer).trim(), sectionType });
      buffer = unit;
    } else {
      buffer += (buffer ? "\n" : "") + unit;
    }
  }
  if (buffer.trim()) out.push({ text: (prefix + buffer).trim(), sectionType });

  return out;
}

export function chunkResumeText(fullText: string, maxChars: number = MAX_CHUNK_CHARS): ResumeChunk[] {
  const lines = fullText.split("\n");

  // Group lines into sections, each keyed by the heading that opened it.
  const sections: { heading: string; body: string[] }[] = [];
  let current: { heading: string; body: string[] } = { heading: "", body: [] };

  for (const line of lines) {
    if (isSectionHeading(line)) {
      if (current.heading || current.body.join("").trim()) sections.push(current);
      current = { heading: line.trim(), body: [] };
    } else {
      current.body.push(line);
    }
  }
  if (current.heading || current.body.join("").trim()) sections.push(current);

  const chunks: ResumeChunk[] = [];
  for (const section of sections) {
    const body = section.body.join("\n").trim();
    if (!body && !section.heading) continue;

    // A heading with no body is not worth indexing alone.
    if (!body) continue;

    const sectionType = detectSectionType(`${section.heading}\n${body}`);
    chunks.push(...packSection(section.heading, body, sectionType, maxChars));
  }

  const usable = chunks.filter((c) => c.text.trim().length >= MIN_CHUNK_CHARS);
  if (usable.length > 0) return usable;

  // Fallback: window the whole document rather than storing one oversized
  // chunk, which the embedding model would silently truncate.
  const flat = fullText.trim();
  const windows: ResumeChunk[] = [];
  for (let i = 0; i < flat.length; i += maxChars) {
    const text = flat.slice(i, i + maxChars).trim();
    if (text.length >= MIN_CHUNK_CHARS) {
      windows.push({ text, sectionType: detectSectionType(text) });
    }
  }
  return windows;
}
