# Own-Web AI Agent / RAG v1 architecture

## Scope and trust boundary

AI is an additive feature. The public blog and private workspace retain their existing APIs, routes, sessions and visibility semantics. `AI_ENABLED=false` is the default: the API returns a product-disabled state, `/ai` explains that state, and the global launcher hides after the availability check.

```text
Vue panel / /ai / article selection
             │ limited page metadata, never article authority
             ▼
POST /api/ai/chat (SSE) ── optional existing HttpOnly session
             │
             ▼
ContextBuilder ── MySQL post reload + shared post-access policy
             │
             ▼
IntentRouter ── Direct | RAG | fixed read-only Skill | summary
             │                    │
             │                    ├─ MySQL authorization / size limits
             │                    └─ Qdrant dense + BM25 → RRF → rerank
             │                                      │
             │                         MySQL rehydrate + authorization again
             ▼
ModelGateway (registry only; at most one DeepSeek → Qwen fallback)
             │
             ▼
ResponseComposer ── citations, product status, no hidden reasoning
```

The browser can send an article ID, route, title/heading/anchor and at most 4,000 selected characters. It cannot assert article body, author, visibility, permission, conversation owner or model capability. Those values are reloaded on the server.

## RAG path

`posts.content_markdown` is the only index source. The chunker preserves headings, lists, quotes, links, image alt text, code fences, Mermaid and display math; it emits deterministic IDs based on post, heading path, chunk index and content hash. The heading ID function is shared with the renderer so a citation points at `/posts/:slug#heading-anchor`.

At query time, scope is built first: public published content for guests; author-owned content and followed published follower content for a signed-in user; an unlisted/current article only after its valid share token or ordinary access check. Qdrant receives dense Top 20 and multilingual BM25 Top 20 prefilters, then equal-weight RRF Top 20. Reranking produces Top 5 (maximum three normal chunks per article; the active article may provide five). A reranker failure returns the RRF result with `degraded=true`.

Every Qdrant candidate is reloaded from `ai_index_chunks JOIN posts` and checked with `api/lib/post-access.js` before any reranker or provider sees text. LOW confidence returns a refusal rather than a site-fact answer. Query and embedding caches include scope hash and index version; answers are never semantically cached.

## Agent and model boundary

The workflow is deterministic and deliberately not a multi-agent/tool-execution platform. Registered skills are `search_articles`, `get_article`, `get_related_articles`, `search_projects`, and `get_series`; each has a Zod schema, server-side access check, timeout and output bound. At most three tool rounds are allowed. There is no shell, SQL, URL, MCP or arbitrary-tool capability.

The model registry exposes `qwen-fast` (Qwen 3.8 Flash) and `deepseek-quality` (DeepSeek V4 Flash). The normal test provider is deterministic Mock. Real providers use the OpenAI-compatible gateway only when configured. DeepSeek tool/thinking is disabled; a failed selected DeepSeek request may make one Qwen fallback, which becomes an explicit degraded product status.

## Persistence and events

Signed-in conversations, messages, sources, explicit Memory, settings, feedback, usage and index jobs live in the additive `ai_*` MySQL tables. Guest conversations and preferences live only in process memory for the browser-session cookie lifetime. The database records only a HMAC of the guest ID for quota accounting, never the raw value. No chain-of-thought, secret, Cookie or raw anonymous ID is persisted.

`POST /api/ai/chat` is a `fetch` readable stream rather than EventSource. It emits `start`, `delta`, `citation`, `tool_start`, `tool_end`, `usage`, `done`, and `error`. An aborted browser request aborts the upstream signal, marks its assistant row aborted where applicable, and records actual or estimated usage.
