# Own-Web AI v1.7 remediation state

## Goal

Close the v1.7 assistant experience: make persisted conversation ordering deterministic,
create safe automatic first-prompt titles, compact the full chat workspace, and preserve
the verified v1.6 streaming, RAG, authorization, Skills, Memory, and Provider behavior.

## Recovery snapshot

- **State:** `COMPLETED`
- **Phase:** P7 — full regression and delivery recorded
- **HEAD at start:** `955697c docs(ai): record v1.6 validation evidence`
- **Branch:** `codex/community-blog-v1`
- **Protected user worktree item:** staged `.codex/HANDOFF.md`; never modify, unstage, or commit it.
- **External dependencies:** `npm run ai:doctor` passed on 2026-09-14 for configuration,
  migrations, Qdrant (1,230 points), embedding, rerank, and chat. No external blocker occurred.

## Confirmed baseline

- `api/ai/agent/conversation-store.js` reads persisted messages with
  `ORDER BY created_at ASC, id ASC`.
- `ai_messages.created_at` is a second-resolution MySQL `TIMESTAMP`; `id` is a random UUID.
  Messages written in the same second can therefore be returned in a UUID-derived, rather
  than turn-derived, order.
- User and assistant placeholders are written consecutively by `api/ai/routes.js`, so this
  is a real history and refresh defect, not a presentation-only issue.
- The current `/ai` workspace still contains a large page hero and the global AI launcher
  remains rendered by the shared layout while on `/ai`.

## Phase map

1. **P0:** Add a migrated, database-enforced message sequence; write same-second order tests.
2. **P1:** Add first-prompt automatic titles with local and provider fallback, preserving manual titles.
3. **P2–P4:** Compact the `/ai` workspace, hide its duplicate launcher, and validate turn spacing.
4. **P5–P6:** Run focused regression and real-browser checks across required sizes and themes.
5. **P7:** Run the available full suite, document results, and commit only v1.7 files.

## Current risks and decisions

- Historical rows cannot recover their original sub-second insertion chronology. The migration
  assigns each existing conversation one stable sequence using its current deterministic
  `(created_at, id)` order; all writes after migration receive transactionally allocated,
  unique sequence values.
- The server will allocate a user/assistant turn pair while holding the conversation row lock,
  so rapid requests cannot interleave their stored order.
- Automatic titles will never replace a title marked as manually changed.

## Completed P0 — deterministic persisted message order

- Added migration `20260913_ai_message_order_v17` with non-null
  `ai_messages.message_seq`, unique `(conversation_id, message_seq)`, and
  `ai_conversations.next_message_seq`.
- Added transactional `appendTurn()` in the persistent store. It locks the
  owner-scoped conversation row, allocates both the user and assistant
  sequences together, and only then releases the lock.
- Reads now use `ORDER BY message_seq ASC`; timestamp and UUID order no longer
  determine a conversation turn.
- Guest conversations now carry the same in-memory sequence invariant.
- Migration smoke runs with AI disabled/mock so it remains a schema test rather
  than inheriting a live Provider configuration. It now writes four messages,
  forces all their timestamps to the same second, and verifies the reread order.

## Tests recorded for P0

- PASS — focused Vitest: `tests/unit/ai-conversation-store.test.ts` and
  `tests/unit/ai-api.test.ts` (10 assertions)
- PASS — `npm run api:check`
- PASS — isolated MySQL migration/order smoke:
  `npx tsx tests/api/sixth-pass-migration.ts`
- PASS — `git diff --check`
- PASS — local schema presence check for migration, non-null columns, and the
  unique sequence index

## Completed P1 — first-prompt conversation titles

- Added migration `20260913_ai_conversation_title_v17`. Existing titles are
  conservatively marked `manual`; newly created default conversations are
  marked `auto`.
- The first non-regenerate user prompt receives an immediate deterministic
  title and a `title` value in its SSE `start` event. The sidebar and current
  conversation header update in-place without a page reload.
- Long prompts also start one bounded (`maxTokens: 36`), zero-temperature
  `qwen-fast` title refinement in parallel. It is never awaited by the answer
  stream. A failed Provider request keeps the immediate local title.
- Any explicit rename changes `title_source` to `manual`; automatic updates
  include that condition in SQL and cannot overwrite a manual choice.
- Guest session conversations preserve the same provenance and title behavior
  in memory.

## Tests recorded for P1

- PASS — focused Vitest title/API/store coverage (13 assertions), including
  C# title normalization, bounded Qwen request shape, title SSE, and manual
  title protection
- PASS — `npm run api:check`
- PASS — isolated MySQL migration/order/title smoke
- PASS — local v1.7 migrations applied without emitting configured secrets
- PASS — frontend typecheck process completed without diagnostics

## Completed P2–P4 — compact workspace and visual turn order

- Removed the duplicated `Own-Web AI / 站内助手` hero. The workspace now
  begins immediately beneath the site navigation with a compact conversation
  sidebar and a single compact chat header.
- Moved `新对话` into the sidebar, reduced desktop history width to 224px,
  and added an accessible desktop collapse control. Mobile keeps a dedicated
  history drawer and the chat itself retains the viewport.
- The shared layout no longer mounts `AiPanel` on route `Ai`; ordinary routes
  still mount it normally, so the full workspace has no duplicate bottom-right
  launcher.
- Kept assistant text card-free in the workspace, tightened turn gaps, and
  preserved the existing composer, source grouping, stop, copy, regenerate,
  focus-trap, and follow-latest implementation.
- Fixed an uncovered guest-history branch: the visitor note previously owned
  the same `v-if / v-else` chain as the list, making all guest session history
  invisible. It is now independent, and the currently active guest
  conversation remains visible while a proxy-set cookie/session settles.

## Browser evidence (local isolated Mock acceptance)

- PASS — 1664×912 light: compact header, 224px sidebar, no hero/footer/launcher,
  visible composer and correctly grouped user → assistant turn.
- PASS — 1920×1080 light and 1440×900 light: chat remains the visual primary
  surface and the composer stays in the workspace.
- PASS — 390×844 light/dark: mobile history is a drawer, composer remains
  reachable, and the header has no wasted hero area.
- PASS — 1664×912 dark: token-based contrast, user bubble, assistant body,
  sidebar, and composer remain legible.
- PASS — actual streaming first paint and title update: first prompt
  `C#主要是用于什么领域？` changed both chat header and sidebar to
  `C# 主要应用领域` before the mock answer completed.
- PASS — three follow-up turns appeared in DOM order as
  `user → assistant → user → assistant → user → assistant`; reloading the
  browser retained the session conversation in this acceptance environment.
- PASS — `/ai` has zero `data-testid="ai-launcher"` elements; `/` retains the
  panel launcher under its existing regression coverage.

## Tests recorded for P2–P4

- PASS — `npm run typecheck`
- PASS — `npm run build`
- PASS — `npm run test:ai-api` (11 tests)
- PASS — `npm run test:ai-agent` (25 tests)
- PASS — `npm run api:check`
- PASS — isolated MySQL migration/order/title smoke
- PASS — `git diff --check`

## Completed P5–P7 — full regression and delivery

- PASS — final `npm run test:all` (exit code 0) in fresh disposable database
  `own_web_v17_final3` using isolated ports 3303/5175. The port selection avoids
  the user's active local development server and does not change runtime defaults.
- PASS — `typecheck`, `build`, `api:check`, 111 unit tests, `test:ai-rag`
  (19 unit assertions plus Qdrant hybrid integration), `test:ai-agent` (25),
  `test:ai-api` (11), `test:ai-security` (36), database/API migration checks,
  and the existing security and access-control smoke suites.
- PASS — focused Mock browser acceptance: 12 AI interactions across desktop/mobile and light/dark;
  the 4 disabled-service cases were intentionally skipped by the Mock-enabled runner.
- PASS — full existing E2E: 133 passed, 19 explicitly skipped because the suite deliberately
  runs AI-disabled and privilege-dependent branches separately; no failures.
- PASS — visual suite: 20/20 fixed visual baselines across five viewports and both themes.
- PASS — performance/Lighthouse suite. Its editor check is explicitly reported as runtime
  verification needed when no real editor cookie is supplied; it is not fabricated as a pass.
- PASS — final `npm run ai:doctor`: configuration, three AI migrations, Qdrant, embedding,
  rerank, and live chat all passed without exposing credentials.

## Delivery checkpoint

- Commits: `7b2fe9a` (ordering), `29f8959` (titles), `e6545fb` (workspace), followed by
  the final P7 regression/isolation commit.
- `.codex/HANDOFF.md` remains staged user work and was neither modified nor included in any v1.7 commit.
- The only intentionally unverified performance item is the pre-existing editor-cookie scenario;
  the suite labels it **Needs Runtime Verification** rather than claiming a pass.
