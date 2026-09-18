# Résumé RAG retrieval eval

Offline benchmark for `retrieveTopChunks` (hybrid: pgvector cosine + Postgres
full-text + section intent, fused with RRF). Runs the production chunker,
MiniLM embeddings and SQL against PGlite (in-process Postgres + pgvector), so
no database server or API key is needed.

```bash
npm run eval:retrieval                          # dev split (tuning)
npm run eval:retrieval -- --split test          # held-out split — only for final numbers
npm run eval:retrieval -- --verbose             # print hybrid misses and noisy unanswerables
npm run eval:retrieval -- --threshold 0.3 --rrf-k 20 --candidates 10 --chunk-chars 400 --no-section
npm run eval:retrieval -- --split all --save my-run   # writes results/my-run-all.json
```

## Data

- `resumes/*.txt` — 12 synthetic résumés with varied formatting (all-caps
  headings, title-case with colons, bullets, one with no headings).
- `queries.json` — 96 labelled questions: exact-term, semantic, mixed,
  section-level and unanswerable. `gold` holds text spans that must appear in a
  retrieved chunk (an inner array = acceptable alternatives); `[]` means
  unanswerable. The harness fails fast if a gold span isn't in its résumé.
- Split by résumé: `dev` = r01–r06 (tune on this), `test` = r07–r12 (held out).

## Rules

1. Tune only on `dev`. Run `test` once per change set and record it.
2. Fix a label only when it is wrong, and add a `note` saying why.
3. Record every experiment — accepted or rejected — in the tuning log
   (see the "Retrieval eval run" section of the pipeline doc), with the command.

## Known limits

Synthetic, author-labelled, and short (~6 chunks per résumé), so RRF k and
candidates-per-leg can't be tuned here, and Recall@5 is near-trivial — use
Recall@3 / Hit@1 / MRR. Add longer, anonymised real résumés before trusting
small differences.
