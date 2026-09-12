# Own-Web AI/RAG v1 Remediation State

## Goal

Turn the existing AI v1 Mock framework into a real, safely deployed Own-Web AI
Demo with Qwen, Qdrant, hybrid RAG, genuine LLM tool calling, citations, and
full security/browser acceptance. The Goal can be completed only after every
mandatory live gate passes. A missing Qwen credential or local Qdrant runtime
is an external blocker, not completion.

## Invariants

- The product runtime remains a single deterministic Agent workflow; Codex
  development uses the A--F multi-agent roles.
- Preserve all existing blog, workspace, visibility, ownership, session, and
  route behaviour. The server is the authority for article access.
- Never commit or print secrets. `.env` is ignored. `.codex/HANDOFF.md` is
  user-owned and currently staged; do not modify, unstage, or include it.
- Keep the existing Mock provider for deterministic CI only. Do not call Mock
  validation a live-provider or live-RAG pass.

## Current phase

Phase 7 -- final acceptance complete; clean, scoped commit pending.
The previously blocked Goal resumed on 2026-09-12 after the operator restored
the Qwen account. The Goal service retains its historical `blocked` value until
the final acceptance decision; this document is the current recovery record.

Completed phase:

- Phase 0 baseline freeze and requirement matrix: `8b28891 audit(ai): document v1 remediation gaps`
- Phase 1 shared status contract and AI experience: `37d6b87` and `c07bcb9`.
- Phase 2 live Provider/Function Calling implementation: `9014152
  fix(ai-provider): implement live providers and tool calling` (the local
  automated evidence remains Mock-only until a Qwen credential is configured).
- Phase 3 live diagnostics and lifecycle safety: `0c15892 fix(ai-rag): harden
  lifecycle and live diagnostics`.

## Starting repository state

- Branch: `codex/community-blog-v1`
- Starting implementation commit: `2ca95c4 test(ai): cover article selection and preserve visual baseline`
- External staged file: `.codex/HANDOFF.md` (preserve unchanged)
- Local `.env` exists and is ignored by Git. Presence-only inspection confirms
  the required Qwen/Qdrant variables exist; values were never read into logs
  or stored here.
- Docker CLI 29.7.2 and Docker Compose v5.5.1 are installed. The pinned
  `qdrant/qdrant:v1.19.0` container is healthy and bound only to
  `127.0.0.1:6333`; its Compose healthcheck now uses Bash TCP probing because
  this image does not include `curl` or `wget`.
- Real MySQL audit: 4 existing public/published posts are indexed into 32
  chunks. The Qdrant collection also has 32 points after orphan cleanup.

## Confirmed gaps at freeze time

- The global launcher hides when AI is disabled; `/ai` is a sparse disabled
  state rather than a complete product state.
- No safe `/api/ai/status` exists.
- The model registry claims Qwen tools while the provider sends/reads neither
  `tools` nor `tool_calls`; the workflow chooses Skills itself.
- Rerank uses the wrong `/rerank` endpoint. Qwen chat, embedding, and rerank
  need distinct endpoint handling.
- Qdrant schema and hybrid-query integration were verified, but the first
  live backfill and Qwen calls were blocked by Provider HTTP 403.
- RAG job deletion can leave Qdrant points after database cascade; scheduled
  publication and stale-job recovery need coverage.
- Real answers, citations, browser flows and protected-content fixtures were
  awaiting live Provider authorization.

## Decisions locked

- Qdrant: local Docker Desktop plus WSL 2, then the existing localhost-bound
  Compose service.
- Required primary provider: Qwen `qwen3.8-flash` with 1M capability metadata.
- Optional provider: DeepSeek `deepseek-v4-flash`, shown as DeepSeek Flash and
  marked optional-blocked if no local key is configured.
- Qdrant sparse inference: multilingual tokenizer, disabled stemmer, empty
  stopwords, identically applied on ingest and query.
- Status states: `disabled`, `unconfigured`, `degraded`, `ready`; no status
  response contains a secret, endpoint, or raw infrastructure exception.

## Phase log and test evidence

| Item | Result | Evidence |
| --- | --- | --- |
| `npm run typecheck` | PASS | Phase 0 baseline, 2026-09-12 |
| `npm run api:check` | PASS | Phase 0 baseline, 2026-09-12 |
| `npm run build` | PASS | Phase 0 baseline; existing bundle-size advisory only |
| `npm run test:ai` | PASS | 30 unit/API/security checks plus 12 desktop/dark/mobile UI checks |
| Phase 1 `npm run test:ai` | PASS | 7 RAG + 7 Agent + 6 API + 19 security assertions; 12 Mock browser flows passed and 4 deliberately skipped under Mock configuration |
| Phase 1 disabled browser flow | PASS | Desktop unavailable launcher/shell run separately with AI Mock runner disabled |
| Phase 1 typecheck/API/build | PASS | `typecheck`, `api:check`, and production build; existing bundle-size advisory only |
| Phase 1 visual review | PASS | Actual local 1440px desktop and 390px narrow layouts, light/dark, floating panel/bottom sheet, unavailable states and focus behavior checked |
| Phase 2 AI suite | PASS | 7 RAG + 12 Agent + 7 API + 25 security assertions; 12 Mock browser flows passed and 4 intentionally skipped under Mock configuration |
| Phase 2 typecheck/API/build | PASS | `typecheck`, `api:check`, and production build; existing bundle-size advisory only |
| Phase 3 deterministic RAG guards | PASS | `test:ai-rag` (7 tests) and `api:check`; live Qdrant schema and integration are deliberately not represented as passes |
| Phase 3 queue/retrieval suite | PASS | 10 RAG unit checks: tombstone cleanup, action coalescing/lease, selection neighbors, hash rehydration and LOW confidence |
| Phase 3 isolated Qdrant integration | PASS | Real Qdrant 1.19 dense 1024/Cosine, BM25-IDF multilingual terms and RRF in an ephemeral collection |
| Migration regression | PASS | `sixth-pass-migration.ts` validates action/lease/tombstone schema on a fresh temporary database |
| Phase 3 AI suite | PASS | 10 RAG checks plus isolated Qdrant, 12 Agent, 7 API, 25 security, and 12 UI checks; 4 disabled-branch UI cases intentionally skipped by the Mock runner |
| Evaluation command | Mock contract only | 22 ground-truth cases; real metrics remain null until a nonzero live index exists |
| `ai:doctor` infrastructure | PARTIAL | configuration/migration/Qdrant PASS; embedding/rerank/chat FAIL with safe HTTP 403 evidence |
| Live provider tests | BLOCKED_EXTERNAL | all three Qwen interfaces returned 403; no response body, URL or secret was recorded |
| Existing full test history | Historical only | prior commit report; rerun after each remediation phase |
| Qwen/Qdrant readiness after recovery | PASS | `ai:doctor`: configuration, two AI migrations, Qdrant count 32, embedding, rerank and chat all PASS; output contained only a request ID and counts |
| Real index rebuild | PASS | Final `ai:index:backfill`: 4 scanned/indexed posts, 32 chunks/points, 8 test-origin orphan points pruned; no failures |
| Real hybrid evaluation | PASS with calibration follow-up | Final 20-case public-retrieval run: Recall@5 1.0000, citation correctness 0.9792, answerable accuracy 1.0000, p50 698ms, p95 744ms; two security/no-answer cases are intentionally outside retrieval recall |
| Real Qwen tool trace | PASS | `ai:live:acceptance` recorded model-selected `search_articles` -> server validation/Skill -> tool result -> second model call, plus a real citation and LOW-confidence refusal |
| Real logged-in persistence | PASS | `ai:live:account` used a temporary account to verify real-Qwen conversation response, two persisted messages, selected model, explicit Memory and cross-user conversation/Memory isolation; the account was deleted in `finally` |
| Real protected-content validation | PASS | `ai:live:security` indexed three synthetic private/followers/unlisted fixtures; guest citations 0, authorized follower/share-token reads passed, tool/context authorization passed, then fixture rows and vector points were removed |
| Browser live flows | PASS | Actual localhost UI: public RAG answer with source-anchor jump, keyboard Escape/focus recovery in selection Ask AI, selection context response, and visible LOW-confidence refusal without sources |
| Current real-index cleanup | PASS | Final backfill: 4 scanned/indexed posts, 32 chunks/points, 8 test-origin orphan points pruned; final `ai:doctor` reports Qdrant count 32 and all six checks PASS |
| Full legacy regression | PASS | Final serialized `test:all`: typecheck, production build, API syntax, 90 unit, AI, API, 133 E2E (19 explicit environment/config skips), security, 20 visual, Lighthouse and all four account/study/media/blog smoke gates passed. The production build retains its existing >500 kB advisory; Lighthouse correctly marks editor performance `Needs Runtime Verification` without an authenticated test cookie. |

## Phase 1 implementation and verification

- Added `GET /api/ai/status` with an exact, cache-bypassed safe readiness
  contract. It exposes only `state`, readiness booleans, and a product message.
- Added server-owned quick-action enum, exact request validation, selected model
  persistence scoped to the requesting user/session, and product-only SSE
  status events.
- Removed browser-provided article titles from the AI request contract and
  centralized client context allowlisting.
- Rebuilt persistent AI entry points, unavailable state, responsive panel,
  chat-first `/ai`, contextual quick actions, article selection popover,
  source cards, dialog focus management, and AI personalization state.
- Visual verification used temporary local preview only; the preview process was
  stopped afterward. No user data or secret was sent.

## Phase 2 implementation and verification

- Qwen now derives compatible-mode Chat/Embedding and compatible-api Rerank
  endpoints separately, retaining `QWEN_BASE_URL` as a backwards-compatible
  base. Rerank now calls `/reranks`.
- The registry now identifies Qwen 3.8 Flash and optional DeepSeek Flash as
  1M-context capable. DeepSeek stays unavailable without its local key/base
  configuration and can fall back to Qwen exactly once.
- OpenAI-compatible Providers preserve both non-streaming and indexed-stream
  `tool_calls`, `tools`, `tool_choice`, and `role: tool` message reinjection.
- The Agent now leaves macro routing to the Router but lets the selected model
  choose from only the registered, strictly validated, read-only Skills. The
  tool loop has a hard three-round limit and returns only product statuses.
- Usage requests reserve quota by the request UUID inside a serialized database
  transaction before generation; final usage settles that reservation. Logs
  include a safe fallback marker but no prompt, endpoint, or secret.
- Mock contract tests prove the sequence `model tool call -> Zod/Skill -> tool
  result -> second model call`; no real provider request was made.

## Phase 3 partial checkpoint

- Qdrant collection creation now distinguishes an actual missing collection
  from connection or authentication failure, so a failed Qdrant connection can
  never be silently converted into a new-collection attempt.
- BM25 ingest and query now share the fixed Qdrant 1.19 language-neutral
  configuration: `multilingual` tokenizer, no stemmer, and empty stopwords.
- Before a retrieved Qdrant candidate can reach reranking or a model, the
  server reconstructs the current Markdown chunks from MySQL and requires the
  stable chunk ID and content hash to match. This prevents an asynchronously
  stale vector point from becoming external context.
- The above behavior has deterministic unit coverage. Index lifecycle actions,
  live collection/schema checks, backfill diagnostics, and real evaluation
  ground truth are now implemented and covered locally.
- `ai_index_jobs` now records `upsert`/`delete` actions, leases, attempts and
  availability. Delete requests snapshot point IDs in `ai_index_tombstones`
  before the post cascade; expired leases recover, actions coalesce by article,
  and scheduled publication queues an upsert without changing the post route's
  success behavior.
- The backfill CLI now reports scanned/indexed posts and chunks, failures and
  Qdrant point count. `ai:doctor` emits only PASS/FAIL, numeric counts and a
  request ID while checking migration, collection/schema/count, embedding,
  rerank and chat.
- The 22-case evaluation set now maps each answerable public retrieval case to
  one of the actual four public article slugs. This is genuine ground truth,
  but its live metrics remain absent until embedding succeeds.
- The earlier HTTP 403 was resolved externally by the operator. It is retained
  only as historical diagnostic evidence; current live diagnostics are PASS.

## Phase 4--5 live acceptance checkpoint

- Qwen chat, streaming, embeddings, reranking, hybrid retrieval, citations and
  actual LLM-selected Function Calling now run against the configured local
  service. The acceptance script prints only a generated request ID, check
  names and counts; it does not store prompts, tool results, URLs or secrets.
- A live backfill initially revealed 16 legacy Qdrant points that had no
  corresponding MySQL chunk. Backfill now removes only orphaned `post` points,
  preserving other source types. The collection is now 32 live points for 32
  MySQL chunks.
- Qdrant 1.19 rejected the former nested `should.filter` shape. Retrieval now
  sends one valid top-level exact access filter per permission branch and merges
  their bounded hybrid result IDs before MySQL authorization/re-hydration.
- Weak cross-article candidates are suppressed with a configurable evidence
  floor and meaningful multilingual lexical-support check. A no-answer browser
  query now returns the safe refusal through SSE `delta`, instead of an empty
  assistant bubble.
- The protected-content live fixture creates a private author, a follower and
  an outsider plus three synthetic articles. It removes all fixture database
  rows and filtered Qdrant points in `finally`; post-run verification found
  zero temporary rows and `ai:doctor` still reported 32 points.
- The final live evaluation recorded Recall@5 1.0000, citation correctness
  0.9792 and confidence-as-answerable accuracy 1.0000 on 20 retrieval cases.
  Retrieval latency was p50 698ms and p95 744ms in the final run. It does not
  manufacture hallucination or permission-leakage rates; those retain their
  separate review/fixture evidence.
- `ai:live:account` adds a real logged-in Qwen round trip over a temporary
  user. It verifies selected-model and explicit-Memory persistence plus
  cross-user conversation/Memory isolation, then deletes that user and all
  cascade-owned AI rows in `finally`.
- The global launcher is intentional on every route, so all 60 visual
  baselines across desktop/tablet/mobile and light/dark were refreshed after
  manual inspection. Serial visual verification passes. Do not run visual and
  performance suites concurrently: both use the isolated fixture database.

## External blockers

1. **BLOCKED_OPTIONAL_DEEPSEEK**: DeepSeek is deliberately optional and has no
   configured local credential, so its real model-switch/fallback leg remains
   `BLOCKED_OPTIONAL_PROVIDER`. This does not block the mandatory Qwen v1 path.
2. **Operational note**: Qwen quotas may change after acceptance. A future
   quota response is an external pause, not a successful or failed historical
   check; rerun only the explicitly opt-in live commands after service recovery.

## Next exact action

Review the final scoped diff, run `git diff --check`, and commit only the
listed AI remediation files. Keep the user-staged `.codex/HANDOFF.md` outside
that commit. If a future provider quota error occurs, preserve this file and
resume with `$env:AI_LIVE_TESTS='1'; npm run ai:doctor` after service recovery.
Never add a secret to a command, log or tracked file.
