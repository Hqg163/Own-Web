# Own-Web AI v1.6 baseline audit

Audited on `codex/community-blog-v1` at `3eb1267` before v1.6 changes.
Evidence is source inspection plus a live `npm run ai:doctor` pass.

| Requirement | Baseline | Evidence | Required v1.6 action |
| --- | --- | --- | --- |
| Workspace/footer/scroll | WRONG | `Layout.vue` always renders Footer; `AiPage.vue` uses `min(760px, calc(100dvh - 190px))` | Route-aware workspace shell and Flex/Grid viewport layout; browser matrix validation |
| Chat-first proportions | PARTIAL | Assistant is already plain in workspace, but header model selector and composer controls are split | Consolidate composer, preserve readable 860–920px column |
| Context/Sources | PARTIAL | Generic context label and one card per citation | Authoritative display label, removable chip, grouped/deduplicated compact sources |
| Provider → Node stream | PARTIAL | provider parses SSE deltas and Express writes them | Add observed timing, flush/no-transform/no-delay/heartbeat and live doctor |
| Browser progressive paint | MISSING | client mutates content directly; no paint timing or progressive E2E | Batch deltas, verify partial DOM before done, test abort |
| Follow scrolling | WRONG | surface watches `messages.length`, not streaming content | Bottom-distance follow mode and return-to-latest control |
| Write/capability request | MISSING | intent enum has no write/capability intent | Deterministic read-only capability reply and tests |
| Ambiguous/multi-intent routing | PARTIAL | regex rules have count but no comparison/structured fallback | Strict bounded JSON Router for only ambiguous requests |
| Catalog evidence | PARTIAL | workflow currently sends title/slug/excerpt only | Include authorized metadata and bounded overview |
| Recommendation relevance | PARTIAL | discovery reranks then slices Top-K without relevance cutoff | Relative relevance filter and candidate-aware rerank policy |
| Citation presentation | PARTIAL | response composes catalog/discovery/chunks without semantic dedupe | Deduplicate/group by post and heading without breaking anchors |
| Timing/avoidable calls | PARTIAL | workflow has only aggregate duration trace | Stage timings, parallel independent lanes, conditional discovery rerank |
| Security and architecture | PASS BASELINE | v1.5 MySQL rehydrate, post access checks, Zod skills, HttpOnly/Origin/rate controls | Preserve and extend security regression coverage |

## Validation contract

The implementation records only numeric timings and counts: request start,
first status/provider/Express/client delta, delta count, largest delta,
provider done and request done, plus context/route/catalog/embedding/Qdrant/
rerank/tool/model timing. It does not record user text, article bodies,
credentials, Cookies, session tokens, anonymous identifiers, or hidden
reasoning.
