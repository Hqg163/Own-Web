# Own-Web AI Agent / RAG v1 implementation record

## Phase 0 baseline

- Frontend: Vue 3 + TypeScript routes are declared in `src/components/router/index.ts`; the global public shell is `src/components/layouts/Layout.vue`.
- Backend: Express 5 starts from `api/server.js`. Blog routes mount before the legacy authenticated `/api` middleware because public reads use optional session resolution. AI routes will follow that additive mounting pattern.
- Content: `api/lib/content.js` owns Visual Blocks-to-Markdown conversion and safe HTML generation. `posts.content_markdown` is the AI text source; `content_html`, `content_format`, `content_blocks`, and `content_version` remain existing contracts.
- Access: posts use published/public, author-owned, followers-only, and unlisted share-token access. The policy now lives in `api/lib/post-access.js` for reuse by blog and AI code.
- Session/security: the site uses an HttpOnly JWT cookie, origin validation on state-changing `/api` requests, no-store API responses, and server-side ownership checks.
- Persistence: MySQL migrations are managed by `api/migrations.js`; no Qdrant or Docker Compose configuration existed before this work.
- UI: `src/style.css` owns shared warm-neutral/dark tokens and responsive breakpoints. New AI UI must use `AppIcon.vue` and the existing dialog/button patterns.
- Tests: Vitest, Supertest API checks, Playwright/axe, visual snapshots, Lighthouse, and `test:all` already exist.
- Git: implementation starts on `codex/community-blog-v1`. `.codex/HANDOFF.md` is user-owned and remains untracked/unmodified.

## Phase checkpoints

Each AI phase records targeted checks, `npm run typecheck`, `npm run api:check`, `npm run build`, and `git diff --check` before its single-purpose commit. Real provider checks remain opt-in through `AI_LIVE_TESTS=1`; routine tests use a deterministic provider.

### Phase 1 — configuration and persistence complete

- Added the additive AI v1 MySQL schema, server-side validated AI configuration, model registry, TTL/LRU cache and Qdrant collection client.
- Qdrant is declared in `docker-compose.yml` as `qdrant/qdrant:v1.19.0`, bound only to `127.0.0.1:6333`; the server remains functional when AI is disabled or Qdrant is absent.
- Fresh-migration smoke, configuration smoke, `typecheck`, `api:check`, `build`, and `git diff --check` passed. Docker was unavailable in this workspace, so a live Compose health check remains a deployment verification item.

### Phase 2 — RAG preparation and retrieval complete

- The only index text source is `posts.content_markdown`. Heading IDs use the same normalization contract as the client renderer. The chunker retains code, Mermaid and display math as atomic blocks; ordinary long prose is split before the configured limit.
- New and changed post content queues best-effort reindexing only after the existing article operation succeeds. Indexing writes dense (1024 dimensions) and Qdrant native multilingual BM25 vectors, then removes stale point IDs; it never rolls back a blog write.
- Retrieval builds the scope before Qdrant hybrid RRF, then rehydrates every candidate from MySQL and repeats the shared post-access decision before reranking or prompt use. Reranker failure falls back to RRF and marks the result degraded.
- `tests/unit/ai-rag.test.ts` covers heading IDs, chunk boundaries, deterministic IDs, mock embeddings, stale-point removal ordering, hybrid RRF shape, hydration and rerank fallback. `test:ai-rag`, `test:unit`, `api:check`, `typecheck`, `build`, and `git diff --check` passed. The existing `api` blog-access smoke was also run, but its shared `own_web_test` database contains leftover public fixtures and its strict single-item assertion failed before this feature can affect that route; it needs an isolated/reset test database. A live Qdrant fixture still requires Docker or an explicitly configured isolated Qdrant service.

### Phase 3 — single-agent workflow complete

- Added one deterministic workflow: context is reloaded and authorized first, then routed to direct chat, RAG, or one of five fixed read-only skills. It has no arbitrary SQL, shell, URL, MCP, multi-agent, or model-selected tool surface.
- The system prompt explicitly treats user and retrieved content as untrusted; low-confidence site questions stop before model generation. Long authorized article summaries use a section map instead of similarity search.
- Login-scoped conversation, summary, preference-memory and model-gateway services are ready for the API layer. Memory is only explicitly saved, always scoped by `user_id`, and never exists permanently for guests. The gateway allows registry models only and permits one DeepSeek-to-Qwen fallback.
- `test:ai-agent`, `test:unit`, `api:check`, `typecheck`, `build`, and `git diff --check` passed.

### Phase 4 — AI API and SSE complete

- `/api/ai/*` is mounted before the old mandatory API authentication middleware but after the established Origin and no-store middleware. It independently resolves the existing HttpOnly session cookie, allowing a limited guest flow without changing any legacy `/api` protection.
- Added model metadata, guest/login conversation CRUD, SSE chat, settings, explicit Memory and feedback endpoints. Login-bound rows always query through `user_id`; guest conversations remain in a process-only map, while only a HMAC of the browser-session guest ID may be stored in usage records.
- Chat emits `start`, `delta`, `citation`, `tool_start`, `tool_end`, `usage`, `done`, and `error`. Abort propagation marks the assistant record aborted and records actual or estimated use. Request logs deliberately omit message text, selected text, secrets and cookies.
- Per-IP window, daily guest/user, per-subject concurrency and global daily request/token limits are enforced before model work. Direct chat stays available during a Qdrant outage; site questions report that retrieval is unavailable.
- `test:ai-api`, `test:ai-agent`, `test:ai-rag`, `test:unit`, `api:check`, `typecheck`, `build`, and `git diff --check` passed.

### Phase 5 — shared AI experience complete

- Added a shared, safe Markdown-rendering chat state and surface to the global layout, `/ai`, the article selection action and logged-in Settings. The launcher hides when the AI server reports disabled, so an unconfigured installation preserves existing routes and visual baselines; `/ai` instead explains that the feature is unavailable.
- The panel is a focus-managed desktop side panel and mobile bottom sheet. It supports streaming status, stop, regenerate, safe copied output, source cards and model selection. `/ai` keeps the in-memory guest conversation or exposes the server-backed login history, with guarded rename/delete actions. Selection sends only the bounded selected text and identifying page metadata; the server repeats access authorization.
- A focused `test:ai-ui` starts the isolated test API with the explicit deterministic Mock provider. It covers actual POST/SSE streaming, desktop/mobile and light/dark projects, axe, Esc, dialog close and focus restoration. `typecheck`, `test:unit`, `api:check`, `build`, and `git diff --check` passed for this phase.

### Phase 6 — security, evaluation, and operations complete

- Added explicit AI security regression coverage for private/follower/unlisted access, Qdrant-candidate rehydration before rerank, static-tool enforcement, user-scoped Memory, prompt protections, upstream cancellation and hostile model-shaped HTML. The Mock browser test verifies that Markdown output cannot create an image or execute an event handler.
- Added the 20-case calibration set and `ai:eval`. Mock mode validates the contract but reports quality metrics as `null`; `AI_LIVE_TESTS=1` is the only route to live retrieval metrics after an operator maps authorized indexed fixture slugs. It deliberately does not invent production quality numbers.
- Added architecture/setup/security/evaluation documents, a Qdrant health check, private production Compose profile, and opt-in isolated Qdrant schema test. `test:ai`, `test:ai-security`, `typecheck`, `api:check`, `build`, `ai:eval`, and `git diff --check` passed. The deliberately opt-in Qdrant integration was attempted with `AI_RAG_INTEGRATION=1` and failed as designed because Docker is not installed (`spawnSync docker ENOENT`); no live provider, Compose health, production network, or live calibration claim is made.

### Phase 7 — final acceptance complete

- The full `npm run test:all` completed with exit code 0 after preserving the existing primary-navigation visual baseline (the AI route remains in the signed-in user menu and its enabled global panel). It includes 73 unit tests, the focused Mock AI suite (direct chat, hostile output, and real article-selection handoff across desktop/mobile light/dark), existing API/security checks, 129 passing E2E checks with 19 conditionally skipped checks, 20 passing visual snapshots, Lighthouse, and account/study/media/blog access smoke tests.
- Manual/Mock acceptance covered normal direct chat, product-level SSE status and selection Ask AI. Agent and API tests cover LOW-confidence refusal, shared post permission checks, request limits, cancellation and one-step provider fallback. A real article RAG answer, Qdrant collection health, live provider fallback, actual production quotas and live confidence calibration remain explicitly unverified because Docker/Qdrant and live credentials are not available in this workspace.
