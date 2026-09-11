# AI Agent / RAG v1 evaluation

`api/ai/evals/own-web-eval.json` contains 20 review cases: direct/site navigation, current article and selection questions, Chinese/English terminology, cross-article search, exact keywords, projects/series, ambiguity, no-answer, privacy, citation precision and prompt injection. It intentionally contains no copied local article body or secret/private slug.

## Modes

```powershell
npm run ai:eval
```

The default Mock result validates the dataset contract and reports quality metrics as `null`. It does not invent Recall, citation correctness, answer accuracy, hallucination or permission-leakage numbers without a calibrated corpus.

For an approved live evaluation, map each answerable case's `expectedCitationSlugs` to authorized, indexed public fixture posts, configure the real provider and Qdrant, then run with `$env:AI_LIVE_TESTS='1'`. The live report calculates Recall@5, citation correctness, confidence-as-answerable accuracy and retrieval latency percentiles from the actual retriever. It intentionally leaves hallucination, permission leakage and rerank-only latency as `null` until independent answer review/protected-fixture checks are supplied.

## Review standard

For each calibration run, save the JSON report outside the repository and review:

- Recall@5: one expected authorized slug is present in the five citation candidates.
- Citation correctness: returned citation slugs match the case's expected source list.
- Answerable accuracy: confidence threshold classification matches the case label; this is not a substitute for human answer correctness.
- Hallucination: a reviewer verifies every site fact is supported by a displayed citation; direct chat must not claim a site lookup.
- Permission leakage: run distinct guest, follower, owner and invalid-token fixtures and require zero private/follower/unlisted leakage.
- Latency: record p50/p95 retrieval and rerank latency, degraded reranker count, provider fallback count and rejected LOW-confidence questions.

Live provider and Qdrant evaluation is explicitly opt-in. The unit/Mock suite proves software contracts, not provider quality or production calibration.
