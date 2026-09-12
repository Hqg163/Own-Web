# Own-Web AI v1.5 baseline audit

Audit date: 2026-09-12. This document records code and runtime evidence, not
claims copied from prior release notes. It contains no credentials, cookies,
private article text, internal endpoints or provider response bodies.

## Source integrity

| Item | Evidence | Result |
| --- | --- | --- |
| Local branch / HEAD | `codex/community-blog-v1` at `1a7807f633ca6d2152d395921e2bdcdc7c2c0fa1` | PASS |
| Remote branch | `git ls-remote origin refs/heads/codex/community-blog-v1` returned the same commit | PASS |
| Unstaged source changes | `git diff --stat` was empty | PASS |
| Existing staged content | only `.codex/HANDOFF.md`, a user-owned file | Preserved; excluded from all AI v1.5 commits |
| Runtime readiness | local Qdrant 1.19 container healthy; opt-in `ai:doctor` passed configuration, two migrations, 32 points, embedding, rerank and chat | PASS |

## Mandatory source reconciliation

| Required check | Actual committed implementation | Result |
| --- | --- | --- |
| Qwen tools | `chat-provider.js` sends `tools` and `tool_choice`, parses non-stream `message.tool_calls`, accumulates stream deltas by index, returns normalized `toolCalls`, and reports `capabilities.tools=true` | PASS |
| Qwen rerank endpoint | `reranker-provider.js` posts to `${rerankBaseUrl}/reranks`; config derives the compatible API endpoint from the compatible-mode base URL | PASS |
| Permission scope | `scope.js` creates distinct public, owner, followed-author and authorized explicit-unlisted/article branches; `retriever.js` queries each valid top-level Qdrant filter and rehydrates/rechecks MySQL access | PASS |
| AI status dependencies | `server.js` constructs `aiQdrant` and supplies it to `mountAiRoutes`; routes use it for safe readiness | PASS |

## Confirmed v1.5 gaps

1. `intent-router.js` is primarily regex based. A query containing “本站/文章”
   falls into `SITE_QA`, so a catalog request is sent to chunk RAG.
2. `workflow.js` executes chunk retrieval before it can assemble structured
   catalog evidence and turns a semantic LOW result into an early refusal.
3. Existing Skills have article search/read/related/project/series functions,
   but no access-scoped complete `list_articles` catalog tool. Search still
   treats a natural-language request too much like a single text fragment.
4. Indexing creates only chunk documents. There is no article-level discovery
   representation for finding, comparing or recommending articles.
5. Rerank fallback is present but its confidence path still shares the
   rerank-oriented evidence evaluator rather than a rank-aware degraded one.
6. Conversation compaction is raw prior-message concatenation, not a bounded
   structured working summary.
7. `/ai` is functionally complete but retains a `1180px` outer limit, nested
   chat presentation, constrained message area and a fixed-height composer.

## Preserved v1 invariants

The v1.5 work remains additive. It keeps the Single Runtime Agent, existing
post access service, HttpOnly session/origin controls, MySQL rehydration before
external context, Zod-validated read-only tools, no arbitrary SQL/shell/URL
tools, existing Qdrant chunk RAG, Qwen as the default model, and the shared
floating panel implementation.
