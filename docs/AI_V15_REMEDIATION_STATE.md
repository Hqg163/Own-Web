# Own-Web AI v1.5 remediation state

## Goal

Convert the real v1 AI demo into a verified adaptive catalog/discovery/chunk
retrieval experience and a Chat-first workspace while preserving the Single
Runtime Agent and all existing Own-Web authorization behavior.

## Current phase

Phase 0 — baseline audit and implementation plan complete; Phase 1 is next.

## Recovery record

| Item | Current evidence |
| --- | --- |
| Starting HEAD / remote | `1a7807f633ca6d2152d395921e2bdcdc7c2c0fa1`, identical locally and on `origin/codex/community-blog-v1` |
| User-owned staged file | `.codex/HANDOFF.md`; do not edit, unstage or commit it |
| Current live prerequisites | Docker Qdrant v1.19 healthy; Qwen/Qdrant `ai:doctor` all PASS, collection count 32 |
| Completed work | baseline source audit and full v1.5 phased plan written in this docs set |
| Current architectural gaps | regex routing, chunk-only discovery, early LOW, no complete catalog tool, raw conversation compaction, constrained Card-based workspace |
| Next exact action | inspect existing post lifecycle and AI migration/index contracts, then implement Phase 1 query understanding and access-scoped catalog service |

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
