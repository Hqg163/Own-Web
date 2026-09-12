# Own-Web AI v1.5 remediation state

## Goal

Convert the real v1 AI demo into a verified adaptive catalog/discovery/chunk
retrieval experience and a Chat-first workspace while preserving the Single
Runtime Agent and all existing Own-Web authorization behavior.

## Current phase

Phase 2 — article-level discovery index and permission-safe hybrid discovery
complete; Phase 3 evidence planner/runtime is next.

## Recovery record

| Item | Current evidence |
| --- | --- |
| Starting HEAD / remote | `1a7807f633ca6d2152d395921e2bdcdc7c2c0fa1`, identical locally and on `origin/codex/community-blog-v1` |
| User-owned staged file | `.codex/HANDOFF.md`; do not edit, unstage or commit it |
| Current live prerequisites | Docker Qdrant v1.19 healthy; Qwen/Qdrant v1.5 backfill completed with 4 posts, 32 chunks and 36 total points |
| Completed work | Phase 0 audit/plan, Phase 1 catalog/router contracts, plus Phase 2 stable article discovery documents, `source_type`-scoped hybrid discovery, MySQL freshness/authorization rehydration, article tombstones, related-article discovery and live dual-layer backfill |
| Phase 2 verification | `test:ai-rag` 16 PASS plus isolated Qdrant fixture PASS; `test:ai-agent` 16 PASS; `typecheck` PASS; `api:check` PASS; live `ai:index:backfill` reported 4 posts / 32 chunks / 36 points / 0 failures |
| Current architectural gaps | adaptive multi-source planner, bounded query rewrite, fallback-specific semantic confidence, structured conversation summary, expanded evaluation/trace and Chat-first workspace |
| Next exact action | implement the Phase 3 executable evidence plan and defer LOW refusal until all applicable sources complete |

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
