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
