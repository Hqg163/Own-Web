# Own-Web AI v1.5 remediation state

## Goal

Convert the real v1 AI demo into a verified adaptive catalog/discovery/chunk
retrieval experience and a Chat-first workspace while preserving the Single
Runtime Agent and all existing Own-Web authorization behavior.

## Current phase

COMPLETED — all v1.5 implementation, live validation and regression gates have
finished. The only remaining operational follow-up is ordinary production
monitoring and calibration as the article corpus grows.

## Recovery record

| Item | Current evidence |
| --- | --- |
| Starting HEAD / remote | `1a7807f633ca6d2152d395921e2bdcdc7c2c0fa1`, identical locally and on `origin/codex/community-blog-v1` |
| User-owned staged file | `.codex/HANDOFF.md`; do not edit, unstage or commit it |
| Current live prerequisites | Docker Qdrant v1.19 healthy; Qwen/Qdrant v1.5 backfill completed with 4 posts, 32 chunks and 36 total points |
| Completed work | Phases 0–5 plus v1.5 architecture/setup/security docs, final real Qwen/Qdrant checks and an orphan-pruned production-shaped index |
| Phase 6 verification | `test:all` exit 0: 99 unit, AI focused suites, API/security, 133 E2E PASS / 19 configured skips, 20 visual PASS, Lighthouse PASS (Editor honestly `Needs Runtime Verification` without an auth cookie), plus API access smoke tests. Live `ai:live:acceptance`, `ai:live:security` and `ai:live:account` PASS. |
| Final runtime proof | Docker Desktop engine restarted after an external daemon stop; `ai:index:backfill` scanned 4 posts / indexed 32 chunks / pruned 24 temporary orphan points / left 36 points. Final `ai:doctor`: configuration, 3 migrations, Qdrant 36, embedding, rerank and chat all PASS. |
| Remaining calibrated follow-up | Article discovery Top-5 selection precision was 0.5000 on the four-post local corpus. Expected targets ranked first; re-evaluate after a larger corpus rather than masking broad candidates as perfect precision. |
| Next exact action | Normal operation: run `npm run ai:doctor` after deployments and `npm run ai:index:backfill` after data restore or vector-volume loss. |

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
