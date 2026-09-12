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

Phase 3 -- RAG, indexing lifecycle, and diagnostics remediation. Goal created
on 2026-09-12.

Completed phase:

- Phase 0 baseline freeze and requirement matrix: `8b28891 audit(ai): document v1 remediation gaps`
- Phase 1 shared status contract and AI experience: `37d6b87` and `c07bcb9`.
- Phase 2 live Provider/Function Calling implementation: `9014152
  fix(ai-provider): implement live providers and tool calling` (the local
  automated evidence remains Mock-only until a Qwen credential is configured).

## Starting repository state

- Branch: `codex/community-blog-v1`
- Starting implementation commit: `2ca95c4 test(ai): cover article selection and preserve visual baseline`
- External staged file: `.codex/HANDOFF.md` (preserve unchanged)
- Local `.env` exists and is ignored by Git. A presence-only inspection on
  2026-09-12 confirmed the required Qwen/Qdrant variables exist; their values
  were neither read into logs nor stored here.
- Docker CLI 29.7.2 and Docker Compose v5.5.1 are installed. Docker Desktop's
  Linux daemon is not currently running (`dockerDesktopLinuxEngine` pipe is
  unavailable), so Compose cannot start Qdrant yet.
- Real MySQL audit: 4 posts, 0 `ai_index_chunks`, 0 `ai_index_jobs`, index
  version 0. All currently observed posts are public/published.

## Confirmed gaps

- The global launcher hides when AI is disabled; `/ai` is a sparse disabled
  state rather than a complete product state.
- No safe `/api/ai/status` exists.
- The model registry claims Qwen tools while the provider sends/reads neither
  `tools` nor `tool_calls`; the workflow chooses Skills itself.
- Rerank uses the wrong `/rerank` endpoint. Qwen chat, embedding, and rerank
  need distinct endpoint handling.
- The live Qdrant, backfill, Qwen chat/embedding/rerank/tool-call, and true
  RAG/citation gates are unverified.
- RAG job deletion can leave Qdrant points after database cascade; scheduled
  publication and stale-job recovery need coverage.
- Existing evaluation fixtures are contract-only; they lack real-blog ground
  truth mappings.

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
| Evaluation command | Mock contract only | 20 rows; real metrics are null |
| Isolated Qdrant integration | BLOCKED_EXTERNAL | explicit Docker run fails: Docker CLI absent |
| Live provider tests | BLOCKED_EXTERNAL | no local Qwen/DeepSeek configuration |
| Existing full test history | Historical only | prior commit report; rerun after each remediation phase |

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
  ground truth remain pending the local Qdrant runtime.

## External blockers

1. **BLOCKED_EXTERNAL_QDRANT_ENGINE** until the already installed Docker
   Desktop is started with its WSL 2 Linux engine and `docker version` reports
   both Client and Server versions. Compose currently cannot connect to the
   `dockerDesktopLinuxEngine` pipe.
2. **QWEN_CONFIGURATION_PRESENT**: the required ignored local `.env`
   variables were found by presence-only inspection. Live calls remain pending
   Qdrant startup and the ensuing isolated provider checks; Codex must inspect
   only configuration booleans, never the secret value.

## Next exact action

Open Docker Desktop and wait until its tray/menu status says **Engine running**.
Then run `docker version` and `docker run --rm hello-world`. Once both succeed,
the next exact project command is `docker compose up -d qdrant` in
`E:\own_web`, followed by `docker compose ps`. The next code work is the
remaining Phase 3 indexing lifecycle, doctor, real-ground-truth, and
isolated-Qdrant integration work.
