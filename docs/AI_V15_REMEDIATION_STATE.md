# Own-Web AI v1.5 remediation state

## Goal

Convert the real v1 AI demo into a verified adaptive catalog/discovery/chunk
retrieval experience and a Chat-first workspace while preserving the Single
Runtime Agent and all existing Own-Web authorization behavior.

## Current phase

Phase 5 — Chat-first workspace UI complete; Phase 6 final security,
documentation and full-regression acceptance is next.

## Recovery record

| Item | Current evidence |
| --- | --- |
| Starting HEAD / remote | `1a7807f633ca6d2152d395921e2bdcdc7c2c0fa1`, identical locally and on `origin/codex/community-blog-v1` |
| User-owned staged file | `.codex/HANDOFF.md`; do not edit, unstage or commit it |
| Current live prerequisites | Docker Qdrant v1.19 healthy; Qwen/Qdrant v1.5 backfill completed with 4 posts, 32 chunks and 36 total points |
| Completed work | Phases 0–4 plus a shared `panel`/`workspace` chat surface, full-height `/ai` reading workspace, responsive history drawer, centered message column, automatic capped composer, compact assistant presentation and preserved source/action/context behaviors |
| Phase 5 verification | `typecheck` PASS, `build` PASS. AI Playwright suite: 12 PASS across desktop/mobile/light/dark; 4 intentionally skipped unavailable-shell cases. AI security/API/agent suite: 29 PASS. Existing build-size advisory only. |
| Current architectural gaps | final documentation/security/full regression and visual/performance acceptance |
| Next exact action | run v1.5-focused tests plus API/E2E/visual/performance/full suite, update operational/security documentation and record every pass, skip or external block honestly |

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
