# Own-Web AI v1.6 remediation state

## Goal

Complete the v1.6 final experience and quality pass: a viewport-safe `/ai`
workspace, verified progressive Qwen streaming, safer query understanding,
better authorized evidence/recommendations, and full regression validation.

## Current phase

Phase 0 — baseline frozen; Phase 1–6 implementation is in progress in
separate, non-overlapping work areas. Runtime remains a single Agent.

## Recovery record

| Item | Current evidence |
| --- | --- |
| Branch / starting HEAD | `codex/community-blog-v1` / `3eb1267` |
| User-owned staged file | `.codex/HANDOFF.md`; never edit, unstage, or commit it |
| Live prerequisites | `npm run ai:doctor` PASS: configuration, 3 migrations, Qdrant (36 points), embedding, rerank and chat |
| Confirmed UI defects | `/ai` uses a viewport magic height and the shell always renders the Footer; this can create Footer/Composer overlap and competing document/chat scrolling |
| Confirmed stream defects | client appends every delta directly and renders complete Markdown per render; there is no stream timing doctor, buffered rendering, or content-growth follow-scroll |
| Confirmed intent gaps | deterministic router lacks write/capability intents and a bounded structured fallback for ambiguous multi-intent requests |
| Security boundary | Server owns post/conversation authorization. Tools stay Zod-validated and read-only; no secret, cookie, private raw content, raw guest ID, or reasoning trace is logged. |
| Context / usage | No visible token-limit figure is exposed by the runtime. Check State before resuming after a compaction or quota warning. |
| Next exact action | Review the three scoped implementation diffs, run focused tests, then perform Phase 7 live browser and Qwen acceptance. |

## Required final gates

- `/ai` hides normal Footer and has only one primary message scrolling system.
- Real Qwen emits at least three deltas that paint in the browser before done;
  abort, follow-scroll, and return-to-latest work.
- Catalog, article discovery, chunk RAG, selected text, write/capability reply,
  LOW refusal, authorization and rate limits remain correct.
- All required build/API/AI/security/E2E/visual/performance/live checks report
  their actual result; skipped checks remain explicitly skipped.
