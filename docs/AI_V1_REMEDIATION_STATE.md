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

Phase 2 -- live Provider and genuine Function Calling remediation. Goal created
on 2026-09-12.

Completed phase:

- Phase 0 baseline freeze and requirement matrix: `8b28891 audit(ai): document v1 remediation gaps`
- Phase 1 shared status contract and AI experience: pending this checkpoint's
  selective commit (all local checks below passed).

## Starting repository state

- Branch: `codex/community-blog-v1`
- Starting implementation commit: `2ca95c4 test(ai): cover article selection and preserve visual baseline`
- External staged file: `.codex/HANDOFF.md` (preserve unchanged)
- Local `.env` exists and is ignored by Git. Presence-only inspection found no
  AI/Qwen/DeepSeek/Qdrant configuration.
- Docker CLI is unavailable; `wsl.exe` exists but reports that WSL needs
  installation. `winget` is available.
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

## External blockers

1. **BLOCKED_EXTERNAL_QDRANT** until the user installs WSL 2 and Docker
   Desktop, starts it, and confirms `docker version`, `docker compose version`,
   and `docker run --rm hello-world` succeed.
2. **BLOCKED_EXTERNAL_QWEN_KEY** for the final live gate until the user locally
   configures the ignored `.env` or current process environment. Codex must
   inspect only configuration booleans, never the secret value.

## Next exact action

Commit this Phase 1 allowlist without `.codex/HANDOFF.md`; then Agent C audits
and implements the Phase 2 Provider/Gateway/Function Calling and quota changes
using deterministic tests only. Do not run a live request until Docker/Qdrant
and local Qwen configuration have been independently confirmed.
