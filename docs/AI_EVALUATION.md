# AI Agent / RAG v1 evaluation

`api/ai/evals/own-web-eval.json` contains 25 review cases grounded in the four
currently indexed public Own-Web articles: Vue scheduling, Adam/RMSProp,
Kyoto observation, and the personal knowledge website. It separately covers
chunk factual retrieval, complete catalog results, article discovery/
recommendation, no-answer and security cases. Every answerable case has at
least one expected public slug.

## Modes

```powershell
npm run ai:eval
```

The default Mock result validates the dataset contract and reports quality metrics as `null`. It does not invent Recall, citation correctness, answer accuracy, hallucination or permission-leakage numbers without a calibrated corpus.

For an approved live evaluation, index the public fixtures, configure the real
provider and Qdrant, then run with `$env:AI_LIVE_TESTS='1'`. The live report
calculates Recall@5, citation correctness, confidence-as-answerable accuracy,
catalog completeness, discovery selection precision, deterministic intent
routing accuracy and retrieval latency percentiles from the actual services.
It intentionally leaves model-answer hallucination, protected-fixture
permission leakage, tool success and rerank-only latency as `null` until their
independent acceptance suites supply those observations.

## Review standard

For each calibration run, save the JSON report outside the repository and review:

- Recall@5: one expected authorized slug is present in the five factual chunk candidates.
- Catalog completeness: every authorized catalog slug is emitted from the full
  metadata catalog, never inferred from vector Top-K.
- Article selection precision: expected discovery candidates divided by all
  discovered candidates; this is deliberately stricter than “correct top hit”.
- Citation correctness: returned citation slugs match the case's expected source list.
- Answerable accuracy: confidence threshold classification matches the case label; this is not a substitute for human answer correctness.
- Hallucination: a reviewer verifies every site fact is supported by a displayed citation; direct chat must not claim a site lookup.
- Permission leakage: run distinct guest, follower, owner and invalid-token fixtures and require zero private/follower/unlisted leakage.
- Latency: record p50/p95 retrieval and rerank latency, degraded reranker count, provider fallback count and rejected LOW-confidence questions.

Live provider and Qdrant evaluation is explicitly opt-in. The unit/Mock suite proves software contracts, not provider quality or production calibration.

## Recorded local live calibration

After v1.5 backfill produced 32 chunks plus 4 article discovery points for the
four existing public posts, the opt-in 2026-09-12 run evaluated 23 executable
cases (two security cases are intentionally excluded):

- Recall@5: `1.0000`
- Citation correctness: `0.8814` (duplicate chunk citations and broad
  discovery candidates are intentionally counted rather than hidden)
- Confidence-as-answerable accuracy: `1.0000`
- Catalog completeness: `1.0000`; deterministic intent routing: `1.0000`
- Discovery selection precision: `0.5000`; correct expected targets ranked
  first, but broader Top-5 candidates need product-side compact presentation.
- Retrieval latency: p50 `743ms`, p95 `875ms`
- The no-answer quantum-price case had zero citations and `LOW` confidence.

This is a local calibration sample, not a production quality claim.
Hallucination remains a human answer-review metric. Permission leakage is not
derived from this public corpus; it is separately verified by the opt-in
synthetic protected-fixture security check. The independent live acceptance
script records a real Qwen Function Calling trace (model call → Zod/skill →
tool result → second model call) and must pass before release.
