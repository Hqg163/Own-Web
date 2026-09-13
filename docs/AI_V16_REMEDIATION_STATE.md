# Own-Web AI v1.6 remediation state

## Goal

Complete the v1.6 final experience and quality pass: a viewport-safe `/ai`
workspace, verified progressive Qwen streaming, safer query understanding,
better authorized evidence/recommendations, and full regression validation.

## Current phase

Phase 1–6 implementation is present and focused backend/unit checks pass.
Phase 7 browser progressive-stream validation is BLOCKED_BY_DEFECT: the mock
provider emits paced pieces, but the Playwright browser DOM still receives or
renders the full assistant answer only at completion. Runtime remains a single
Agent.

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
| Last passing checks | `typecheck`, `api:check`, RAG unit 19/19, agent/catalog 22/22, API 8/8, security 32/32; selection and XSS browser cases pass |
| Last failing check | `AI_E2E_ENABLED=1 npx playwright test tests/e2e/ai.spec.ts --project=desktop`: progressive-paint assertion sees final 397-character assistant content before its first observable partial DOM state |
| External status | Qwen/Qdrant doctor was PASS at baseline. The live stream doctor exceeded its 30-second command window twice and remains unverified; no secret was emitted. |
| Next exact action | Instrument the Vite proxy and browser `ReadableStream` chunk boundaries for `/api/ai/chat`, fix the layer that aggregates SSE (do not weaken the progressive assertion), then rerun focused desktop/mobile/dark UI tests and live stream doctor. |

## Required final gates

- `/ai` hides normal Footer and has only one primary message scrolling system.
- Real Qwen emits at least three deltas that paint in the browser before done;
  abort, follow-scroll, and return-to-latest work.
- Catalog, article discovery, chunk RAG, selected text, write/capability reply,
  LOW refusal, authorization and rate limits remain correct.
- All required build/API/AI/security/E2E/visual/performance/live checks report
  their actual result; skipped checks remain explicitly skipped.
