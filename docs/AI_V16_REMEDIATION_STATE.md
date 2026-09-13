# Own-Web AI v1.6 remediation state

## Goal

Complete the v1.6 final experience and quality pass: a viewport-safe `/ai`
workspace, verified progressive Qwen streaming, safer query understanding,
better authorized evidence/recommendations, and full regression validation.

## Current phase

Phase 1–6 implementation is present. Phase 7 targeted checks, the complete
four-project AI browser matrix, real Qwen acceptance, and real streaming
transport diagnostics now pass. Full project regression, the wider manual
viewport matrix, and final documentation review remain pending. Runtime
remains a single Agent.

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
| Last passing checks | `typecheck`, `api:check`, RAG unit 19/19, agent/catalog 23/23, API 8/8, security 32/32; AI E2E enabled paths pass on desktop, desktop-dark, mobile and mobile-dark (one intentional unavailable-shell skip per project) |
| Fixed stream root cause | Direct API and Vite proxy each delivered 15 chunks over about 3.4 seconds. Vue was mutating the raw assistant object after pushing it to a reactive array; it now mutates the proxied array entry, so every batched delta triggers DOM growth. |
| Live transport evidence | `AI_LIVE_TESTS=1 npm run ai:stream:doctor` PASS: status 85ms, first client delta 2668ms, 82 deltas, request complete 8868ms; direct prompt excludes RAG/tools so it measures Provider/Express stream transport. Qwen fast now sends `enable_thinking=false` because hidden reasoning is not product output. |
| Live acceptance | `AI_LIVE_TESTS=1 npm run ai:live:acceptance` PASS: real `search_articles` model tool call → validation/skill → tool result → second model call; RAG citation count 3; LOW refusal, complete catalog and article discovery all pass. |
| Browser evidence | `AI_E2E_ENABLED=1 npx playwright test tests/e2e/ai.spec.ts` passed the three enabled selection/XSS/progressive-growth checks in desktop, desktop-dark, mobile and mobile-dark; each project intentionally skips one disabled-shell state because that runner forces the mock-enabled fixture. |
| Next exact action | Commit the live-stream/router quality fix, then run the required full AI and project regression matrix and record every PASS/FAIL/SKIPPED result. |

## Required final gates

- `/ai` hides normal Footer and has only one primary message scrolling system.
- Real Qwen emits at least three deltas that paint in the browser before done;
  abort, follow-scroll, and return-to-latest work.
- Catalog, article discovery, chunk RAG, selected text, write/capability reply,
  LOW refusal, authorization and rate limits remain correct.
- All required build/API/AI/security/E2E/visual/performance/live checks report
  their actual result; skipped checks remain explicitly skipped.
