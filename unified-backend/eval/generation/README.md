# Résumé RAG generation eval

End-to-end answer quality for the recruiter copilot, on the same 96 labelled
questions as `../retrieval`. Runs retrieval (k = 5, as `queryResume` does), the
production prompt/model from `src/modules/ai/resume-prompts.ts`, then grades each
answer with a judge from a different model family (default `qwen/qwen3.8-27b`,
override with `EVAL_JUDGE_MODEL`).

```bash
npm run eval:generation                                          # hybrid, all splits
npm run eval:generation -- --retrievers hybrid,vector --spot-check 20 --save v2
npm run eval:generation -- --split dev --limit 10                # quick check
```

Needs `GROQ_API_KEY`. `cache/` holds every answer and verdict keyed by a hash of
the exact prompt, so re-runs only pay for what changed; delete it to resample.
`results/<name>.json` has per-question answers and verdicts for auditing.

Metrics: answerable → correct, faithful, false refusal, and correct split by
whether retrieval surfaced the gold span; unanswerable → correct refusal,
hallucination. Always hand-audit a sample of verdicts (`--spot-check`) and all
failures before quoting numbers.
