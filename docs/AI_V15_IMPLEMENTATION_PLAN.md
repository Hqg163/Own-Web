# Own-Web AI v1.5 implementation plan

## Objective and architecture

Upgrade v1 from `regex router -> chunk RAG -> early LOW/refusal` to one
adaptive **Single Runtime Agent**:

```text
User -> Context Builder -> Query Understanding -> Retrieval Planner
     -> Catalog | Article Discovery | Chunk RAG | Current Article | Skills
     -> Evidence Set -> Evidence Evaluation -> Model Gateway -> Composer
```

Catalog data is authoritative metadata, article discovery finds candidate
articles, chunk RAG supports specific facts with citations, and an authorized
current article/selection has priority. LOW is allowed only after every
relevant planned source has finished or failed safely.

The chosen index shape is one existing Qdrant collection with explicit
`source_type` values: `chunk` and `article`. This is the least invasive option:
it retains existing dense/BM25 schema, localhost network controls, scope
filters and MySQL authorization, while keeping article and chunk retrieval
independent. A new MySQL article-index state table records stable article point
IDs/content hashes; post updates and deletion queue both document types.

## Phase 0 — source integrity and contracts

- Record the actual local/remote HEAD, staged user file, live doctor result,
  provider tools, rerank URL, scope and status wiring in
  `AI_V15_BASELINE_AUDIT.md`.
- Record this plan and `AI_V15_REMEDIATION_STATE.md`; do not edit or stage
  `.codex/HANDOFF.md`.
- Freeze v1 access/session/rate-limit and old route behavior with existing
  checks before adding functionality.

Exit gate: source reconciliation complete, `git diff --check`, `typecheck`,
`api:check`, `build`, targeted current AI tests, and a scoped audit commit.

## Phase 1 — query understanding, catalog and evidence contracts

- Add `ARTICLE_CATALOG`, `ARTICLE_DISCOVERY` and `ARTICLE_RECOMMENDATION` to
  the fixed intent enum.
- Create a strict Zod `RouterDecision` and `RetrievalPlan` with fixed intent,
  source flags, requested count, sort and topic values. Strong deterministic
  cases win: selected text, current-article summary, catalog/list/count/recent
  requests and explicit recommendation requests. Ambiguous requests may use
  one Qwen structured-decision call; invalid/unavailable output falls back to
  a deterministic rule. The model cannot name arbitrary tools or SQL.
- Add a server-owned catalog service which obtains article metadata through
  normal `canAccessPost` authorization, never browser ownership fields.
- Add `list_articles` with strict input `{limit<=50, offset, sort, category,
  tag, seriesId}` and normalized result `{id,title,slug,excerpt,publishedAt,
  updatedAt,categories,tags,series}`. Add count and bounded pagination
  metadata. Guests only see published public posts; owners/followers/unlisted
  retain exactly existing access rules.
- Improve `search_articles`: normalize task words, derive bounded terms, use
  prepared SQL and weighted title/excerpt/tags/category/series/content matches.
- Define an `EvidenceSet` that distinguishes authoritative catalog/current
  article results from semantic chunks, discovery candidates and tool results.

Exit gate: Router/plan/schema/catalog access tests; catalog completeness,
requested-count and unauthorized visibility regressions; `typecheck`,
`api:check`, `build` and scoped commit.

## Phase 2 — article discovery index and adaptive retrieval

- Add migration/state for article discovery documents. Each stable article
  document contains title, excerpt, categories, tags, series, headings and a
  bounded introduction (plus an existing summary if one exists). Do not create
  expensive summaries merely to index.
- Extend indexer, deletion tombstones, queue, backfill/retry and orphan pruning
  to upsert/remove both `source_type=article` and `source_type=chunk` points
  idempotently. Preserve the current chunk IDs and article business
  transactions; indexing remains asynchronous.
- Implement discovery retrieval filtered by the same permission scope, then
  MySQL-rehydrate and reauthorize every candidate before it reaches reranking
  or the model. Blend article semantic similarity with small category/tag/series
  bonuses for related/recommendation candidates; never infer relation from a
  full-title string match.
- Keep chunk hybrid retrieval unchanged for factual QA. Add a bounded rewrite
  stage for semantic questions (original plus at most two validated rewrites),
  contextualized by current authorized article/selection when available.
- Split confidence evaluators: catalog/current article are authoritative;
  reranked semantic results use rerank confidence; RRF degraded fallback uses
  rank/coverage confidence and exposes `degraded=true` rather than comparing
  raw RRF scores to rerank thresholds.

Exit gate: stable article IDs, index lifecycle/deletion/backfill, article
discovery, related candidates, multilingual/technical rewrite, MySQL
rehydration, rerank-fallback and privacy tests; isolated Qdrant integration;
scoped commit.

## Phase 3 — evidence planner, Agent runtime and safe synthesis

- Insert `RetrievalPlanner` after Context Builder/Router. It selects only the
  necessary sources: catalog for complete listings/counts/recent data; article
  discovery for topics/recommendations; chunk RAG for detailed facts; complete
  current article/selection for active reading; Skills for model-selected
  project/series/article lookup. It avoids sending every question to every
  source.
- Implement deterministic catalog execution for unambiguous “有哪些/列出/全部/
  几篇/最近” requests. For ambiguous multi-article requests, permit real Qwen
  Function Calling only through the fixed Skill schemas and the existing
  maximum three-round loop.
- Rework workflow so an individual semantic miss cannot terminate a catalog,
  article-context or authorized tool path. Make LOW the final evidence
  evaluation after all plan branches, with an explicit valid-refusal path.
- Update the system prompt: catalog questions must not infer completeness from
  Top-K; recommendations must cite real candidates and reasons; facts require
  current evidence; summaries are not fact authority; retain prompt-injection,
  secret, access and hidden-reasoning protections.
- Replace raw conversation compaction with bounded structured fields: current
  topic, user goal, confirmed site facts, explicit preferences, important
  references and open questions. Optional Qwen summarization is strictly
  structured and never replaces fresh authorization/retrieval.
- Add an opt-in, redacted developer trace (intent, plan, safe tool names/counts,
  source counts, confidence kind, model and timing). Never include secret,
  cookie, raw private content or chain-of-thought.

Exit gate: planner matrix, tool-loop, function-call, early-LOW prevention,
summary isolation, trace redaction and XSS/IDOR/security tests; real tool
trace proof; scoped commit.

## Phase 4 — quality evaluation and real acceptance

- Expand the evaluation fixture with catalog, count, recent, discovery,
  recommendation, cross-article synthesis, current article/selection, factual
  DeepSORT-style QA and no-answer cases grounded in real local blog metadata.
- Add measurements: catalog completeness, requested-count accuracy, article
  selection precision, intent-routing accuracy, tool success rate, unnecessary
  refusal rate and valid-refusal rate alongside Recall@K/citation correctness.
- Add deterministic and opt-in live scripts for: complete catalog list,
  three exact recommendations with existing links, AI/object-detection
  discovery, chunk-cited factual QA, selection QA and no-answer refusal.
- Verify current provider source and live trace prove actual `tools`,
  `tool_choice`, model `tool_calls`, server validation, tool result and second
  model call where tool calling is selected. Catalog may intentionally use a
  deterministic plan with a recorded trace to avoid a needless model round.

Exit gate: nonzero article/chunk counts; Qwen/Qdrant live acceptance; quality
metrics with no skipped-as-pass results; security suite; scoped commit.

## Phase 5 — Chat-first workspace UI

- Rebuild `/ai` as a full-height, viewport-aware workspace: 240px collapsible
  desktop history sidebar, mobile drawer, flexible main region and a centered
  860–920px reading column. Remove the shared outer 1180px workspace cap
  without changing normal site containers.
- Make `AiChatSurface` variant-based (`panel` / `workspace`) so the floating
  panel stays compact and behavior is not duplicated. Use clean assistant
  typography instead of nested cards; retain a bounded user bubble, compact
  sources, copy/regenerate/feedback, error/loading/status and safe Markdown.
- Make the message region `flex:1; min-height:0; overflow-y:auto`, with real
  viewport height. Add an auto-growing 48–52px composer capped at 180–220px,
  compact context/model/send controls, low-priority character hint near limit,
  stop control and safe-area keyboard handling.
- Retain/remodel Context Chip view/remove behavior without altering articles;
  add context-aware empty actions, compact source expansion/navigation,
  collapsible product-only tool statuses, dark/reduced-motion/keyboard/focus
  behavior and all existing dialogs/conversation controls.

Exit gate: component/UI unit tests, Playwright/axe keyboard and Escape/focus
coverage, real manual browser review at 1440×900, 1920×1080 and 390×844 in
light/dark, reviewed visual snapshots and scoped commit.

## Phase 6 — final integration, security and delivery

- Run all mandatory quality flows against actual accessible data: complete
  catalog, catalog synthesis, exact three recommendations, discovery,
  chunk-cited technical QA, current selection QA and valid no-answer.
- Re-run private/followers/unlisted, prompt/tool injection, XSS, conversation
  and Memory IDOR, quota/concurrency, abort, fallback and status non-disclosure
  checks.
- Update architecture/setup/security/evaluation/state documentation with index
  layout, planner, trace, operational commands, metrics and any optional
  provider limitation. Commit only explicit v1.5 files.
- Run and honestly report `typecheck`, `build`, `api:check`, AI/RAG/security,
  API/E2E/visual/performance and `test:all`; final Qwen/Qdrant doctor and live
  quality suite happen after the final backfill. No conditionally skipped check
  is reported as passed.

## Recovery discipline

Update `AI_V15_REMEDIATION_STATE.md` after Phase 1, 3 and 5, or after any
quota interruption. Record exact commit, changed surface, test result,
external blocker and next command. Each phase ends with its focused tests,
`typecheck`, `api:check`, `build`, `git diff --check` and a scoped commit.
Never stage `.env` or `.codex/HANDOFF.md`.
