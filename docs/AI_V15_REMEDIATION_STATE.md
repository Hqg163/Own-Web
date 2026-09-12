# Own-Web AI v1.5 remediation state

## Goal

Convert the real v1 AI demo into a verified adaptive catalog/discovery/chunk
retrieval experience and a Chat-first workspace while preserving the Single
Runtime Agent and all existing Own-Web authorization behavior.

## Current phase

Phase 4 — live quality evaluation and real-provider acceptance complete;
Phase 5 Chat-first workspace UI is next.

## Recovery record

| Item | Current evidence |
| --- | --- |
| Starting HEAD / remote | `1a7807f633ca6d2152d395921e2bdcdc7c2c0fa1`, identical locally and on `origin/codex/community-blog-v1` |
| User-owned staged file | `.codex/HANDOFF.md`; do not edit, unstage or commit it |
| Current live prerequisites | Docker Qdrant v1.19 healthy; Qwen/Qdrant v1.5 backfill completed with 4 posts, 32 chunks and 36 total points |
| Completed work | Phases 0–3 plus a 25-case quality dataset, separate catalog/discovery evaluation, real Qwen Function Calling trace, real chunk citation/LOW refusal/catalog/discovery acceptance and updated evaluation documentation |
| Phase 4 verification | Mock contract: 25 cases. Live: Recall@5 1.0000, catalog completeness 1.0000, intent routing 1.0000, valid refusal 1.0000, discovery precision 0.5000 (correct targets first but broad Top-5 candidates retained), p50/p95 743/875ms. `ai:live:acceptance` PASS with model tool call → Zod Skill → tool result → second model call. |
| Current architectural gaps | Chat-first workspace visual/mobile/accessibility validation and final security/full regression/documentation delivery |
| Next exact action | audit `AiPage`, `AiChatSurface`, panel and selection components, then rebuild the `/ai` layout without changing existing site containers |

## Non-negotiable guardrails

- Runtime remains one Agent; no supervisor/research/critic runtime agents.
- Authorization is server-owned at catalog, discovery, chunk, tool and context
  paths. Qdrant never replaces MySQL rehydration/access checks.
- No arbitrary SQL, shell, URL or MCP tools; every Tool is fixed, Zod-validated,
  bounded and read-only.
- No secret, cookie, raw private content, raw anonymous ID or chain-of-thought
  in code, trace, report or commit.
- If live Qwen/Qdrant becomes unavailable, finish the current atomic action,
  run focused deterministic tests, record `BLOCKED_EXTERNAL` here with the
  exact recovery command, and do not mark this Goal complete.
