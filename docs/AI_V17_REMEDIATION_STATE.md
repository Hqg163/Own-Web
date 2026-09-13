# Own-Web AI v1.7 remediation state

## Goal

Close the v1.7 assistant experience: make persisted conversation ordering deterministic,
create safe automatic first-prompt titles, compact the full chat workspace, and preserve
the verified v1.6 streaming, RAG, authorization, Skills, Memory, and Provider behavior.

## Recovery snapshot

- **State:** `IN_PROGRESS`
- **Phase:** P1 — first-prompt automatic conversation titles
- **HEAD at start:** `955697c docs(ai): record v1.6 validation evidence`
- **Branch:** `codex/community-blog-v1`
- **Protected user worktree item:** staged `.codex/HANDOFF.md`; never modify, unstage, or commit it.
- **External dependencies:** v1.6 recorded Qwen, Qdrant, embedding, and rerank as available. No external blocker has been encountered in v1.7 yet.

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

## Next exact action

Inspect title-update call sites and the model gateway's bounded generate path, then add the P1
automatic title policy without delaying the primary answer stream.
