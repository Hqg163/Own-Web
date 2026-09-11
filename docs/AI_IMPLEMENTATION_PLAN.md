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
