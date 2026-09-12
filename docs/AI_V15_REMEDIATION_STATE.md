# Own-Web AI v1.5 remediation state

## Goal

Convert the real v1 AI demo into a verified adaptive catalog/discovery/chunk
retrieval experience and a Chat-first workspace while preserving the Single
Runtime Agent and all existing Own-Web authorization behavior.

## Current phase

Phase 3 — adaptive evidence planner/runtime safeguards complete; Phase 4 live
quality evaluation and acceptance is next.

## Recovery record

| Item | Current evidence |
| --- | --- |
| Starting HEAD / remote | `1a7807f633ca6d2152d395921e2bdcdc7c2c0fa1`, identical locally and on `origin/codex/community-blog-v1` |
| User-owned staged file | `.codex/HANDOFF.md`; do not edit, unstage or commit it |
| Current live prerequisites | Docker Qdrant v1.19 healthy; Qwen/Qdrant v1.5 backfill completed with 4 posts, 32 chunks and 36 total points |
| Completed work | Phases 0–2 plus Phase 3 bounded multilingual query rewrites, executable source plan, final-only LOW refusal, independent RRF-degraded confidence, structured conversation summaries, strengthened evidence prompts and opt-in redacted server trace |
| Phase 3 verification | `test:ai-agent` 18 PASS; `test:ai-rag` 17 PASS plus isolated Qdrant fixture PASS; `typecheck` PASS; `api:check` PASS; `build` PASS; `git diff --check` PASS; existing bundle-size advisory only |
| Current architectural gaps | expanded quality fixtures/metrics/live acceptance and Chat-first workspace visual/mobile/accessibility validation |
| Next exact action | audit existing evaluation and live acceptance scripts, then add v1.5 catalog/discovery/recommendation metrics and real-provider evidence traces |

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
