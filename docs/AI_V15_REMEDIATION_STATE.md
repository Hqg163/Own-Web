# Own-Web AI v1.5 remediation state

## Goal

Convert the real v1 AI demo into a verified adaptive catalog/discovery/chunk
retrieval experience and a Chat-first workspace while preserving the Single
Runtime Agent and all existing Own-Web authorization behavior.

## Current phase

Phase 1 — access-scoped catalog and deterministic query-understanding contract
complete; Phase 2 article-level discovery index is next.

## Recovery record

| Item | Current evidence |
| --- | --- |
| Starting HEAD / remote | `1a7807f633ca6d2152d395921e2bdcdc7c2c0fa1`, identical locally and on `origin/codex/community-blog-v1` |
| User-owned staged file | `.codex/HANDOFF.md`; do not edit, unstage or commit it |
| Current live prerequisites | Docker Qdrant v1.19 healthy; Qwen/Qdrant `ai:doctor` all PASS, collection count 32 |
| Completed work | Phase 0 audit/plan plus Phase 1 strict router decisions, deterministic catalog lane, access-scoped `list_articles`, normalized weighted article search, `EvidenceSet`-ready catalog citations and focused tests |
| Phase 1 verification | `test:ai-agent` 16 PASS, `typecheck` PASS, `api:check` PASS, `build` PASS, `git diff --check` PASS; existing bundle-size advisory only |
| Current architectural gaps | article-level discovery index, adaptive multi-source planner, fallback-specific semantic confidence, structured conversation summary, expanded evaluation/trace and Chat-first workspace |
| Next exact action | inspect index lifecycle/migration contracts, then implement article-level discovery documents and permission-safe discovery retrieval |

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
