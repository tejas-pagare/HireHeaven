/**
 * Re-index résumés against the current chunking pipeline.
 *
 * Needed because chunk boundaries changed: the previous splitter shredded
 * résumés into single lines and discarded section headings, so everything
 * indexed before that fix has poor-quality chunks and unreliable section_type
 * labels. Embeddings are only comparable within one chunking scheme, so stored
 * indexes must be rebuilt rather than migrated.
 *
 *   npx tsx scripts/reindex-resumes.ts                # all indexed users, dry run off
 *   npx tsx scripts/reindex-resumes.ts --dry-run      # report only, no writes
 *   npx tsx scripts/reindex-resumes.ts --user 3       # single user
 *   npx tsx scripts/reindex-resumes.ts --stale-only   # skip users already re-indexed
 *   npx tsx scripts/reindex-resumes.ts --concurrency 2
 *
 * processResume() is build-then-swap, so a failure on one user leaves that
 * user's existing index untouched and the run continues.
 */
import { sql } from "../src/db.js";
import { processResume } from "../src/modules/ai/resume-rag.js";

interface Args {
  dryRun: boolean;
  userId?: number;
  staleOnly: boolean;
  concurrency: number;
  since?: string;
}

function parseArgs(argv: string[]): Args {
  const get = (flag: string) => {
    const i = argv.indexOf(flag);
    return i !== -1 ? argv[i + 1] : undefined;
  };
  const userRaw = get("--user");
  const concRaw = get("--concurrency");
  return {
    dryRun: argv.includes("--dry-run"),
    userId: userRaw ? Number(userRaw) : undefined,
    staleOnly: argv.includes("--stale-only"),
    concurrency: concRaw ? Math.max(1, Number(concRaw)) : 1,
    since: get("--since"),
  };
}

interface Target {
  user_id: number;
  name: string;
  resume: string | null;
  chunk_count: number;
  processed_at: string | null;
}

async function loadTargets(args: Args): Promise<Target[]> {
  if (args.userId) {
    return (await sql`
      SELECT u.user_id, u.name, u.resume,
             COALESCE(c.n, 0)::int AS chunk_count,
             s.processed_at
      FROM users u
      LEFT JOIN (SELECT user_id, COUNT(*) AS n FROM resume_chunks GROUP BY user_id) c
             ON c.user_id = u.user_id
      LEFT JOIN resume_structured s ON s.user_id = u.user_id
      WHERE u.user_id = ${args.userId}
    `) as unknown as Target[];
  }

  // Everyone who has a résumé on file — including users whose index was lost to
  // a failed run, so the backfill repairs as well as upgrades.
  const rows = (await sql`
    SELECT u.user_id, u.name, u.resume,
           COALESCE(c.n, 0)::int AS chunk_count,
           s.processed_at
    FROM users u
    LEFT JOIN (SELECT user_id, COUNT(*) AS n FROM resume_chunks GROUP BY user_id) c
           ON c.user_id = u.user_id
    LEFT JOIN resume_structured s ON s.user_id = u.user_id
    WHERE u.resume IS NOT NULL AND u.resume <> ''
    ORDER BY u.user_id
  `) as unknown as Target[];

  if (args.staleOnly && args.since) {
    const cutoff = new Date(args.since).getTime();
    return rows.filter((r) => !r.processed_at || new Date(r.processed_at).getTime() < cutoff);
  }
  return rows;
}

async function reindexOne(t: Target): Promise<{ ok: boolean; detail: string }> {
  if (!t.resume) return { ok: false, detail: "no résumé on file" };
  try {
    const res = await fetch(t.resume);
    if (!res.ok) return { ok: false, detail: `fetch ${res.status}` };
    const buf = Buffer.from(await res.arrayBuffer());
    const { chunksCreated } = await processResume(t.user_id, buf);
    return { ok: true, detail: `${t.chunk_count} → ${chunksCreated} chunks` };
  } catch (err) {
    return { ok: false, detail: (err as Error).message };
  }
}

/** Run tasks with a small worker pool — embeddings are CPU-bound locally. */
async function pool<T>(items: T[], n: number, fn: (item: T) => Promise<void>) {
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(n, items.length) }, async () => {
      while (i < items.length) await fn(items[i++]);
    })
  );
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const targets = await loadTargets(args);

  console.log(`\nRésumé re-index — ${targets.length} candidate(s)${args.dryRun ? "  [DRY RUN]" : ""}\n`);
  if (targets.length === 0) {
    console.log("Nothing to do.\n");
    return;
  }

  if (args.dryRun) {
    for (const t of targets) {
      console.log(
        `  user ${String(t.user_id).padStart(4)}  ${String(t.chunk_count).padStart(3)} chunks  ` +
        `${t.processed_at ? new Date(t.processed_at).toISOString().slice(0, 10) : "never"}  ${t.name}`
      );
    }
    console.log(`\n${targets.length} user(s) would be re-indexed. No writes made.\n`);
    return;
  }

  let done = 0, failed = 0;
  await pool(targets, args.concurrency, async (t) => {
    const { ok, detail } = await reindexOne(t);
    if (ok) { done++; console.log(`  ✅ user ${t.user_id}  ${detail}`); }
    else    { failed++; console.warn(`  ⚠️  user ${t.user_id}  skipped — ${detail} (existing index left intact)`); }
  });

  console.log(`\nDone. ${done} re-indexed, ${failed} skipped.\n`);
  if (failed > 0) process.exitCode = 1;
}

main().catch((err) => {
  console.error("Backfill failed:", err);
  process.exit(1);
});
