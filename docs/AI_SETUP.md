# AI Agent / RAG v1 setup and operations

## Safe default

Keep the copied `.env` disabled until the dependencies are ready:

```dotenv
AI_ENABLED=false
AI_PROVIDER_MODE=mock
```

With that default, existing Own-Web behavior remains unchanged. `/ai` and the
global launcher remain discoverable, but show an explicit safe disabled state
and never send a model request.

For a local deterministic UI/API verification, set `AI_ENABLED=true` and keep `AI_PROVIDER_MODE=mock`; no third-party model key is used. Run `npm run test:ai` for the isolated Mock suite.

## Qdrant

The development Compose file pins `qdrant/qdrant:v1.19.0` and binds only `127.0.0.1:6333`:

```powershell
docker compose up -d qdrant
docker compose ps
```

The health endpoint is `http://127.0.0.1:6333/healthz`. `npm run ai:index:backfill` initializes the configured collection with a 1024-dimensional cosine `dense` vector and IDF-modified `bm25` sparse vector, then indexes both factual chunks and one article-discovery point per post. Use `npm run ai:index:post -- <postId>` for one post and `npm run ai:index:retry` for failed jobs. A normal v1.5 backfill reports `indexedChunks` plus the total Qdrant point count (chunks + articles).

For production, use `docker-compose.production.yml`, set a strong `QDRANT_API_KEY`, and place the Own-Web API on its `ai-internal` private network with `QDRANT_URL=http://qdrant:6333`. That profile publishes no host port and sets Qdrant's API key. Do not expose port 6333 through a reverse proxy or public firewall rule. Back up the named `qdrant_data` volume together with MySQL; restore MySQL first and then run a backfill whenever index consistency is uncertain.

`npm run test:ai-rag` starts the pinned Compose service, verifies an isolated
collection schema, multilingual BM25 terms and RRF, then removes the ephemeral
collection. It fails clearly when Docker Compose is unavailable; it never
reports a skipped Docker test as a pass.

## Live provider configuration

Set only the provider values you intend to use, outside source control:

```dotenv
AI_ENABLED=true
AI_PROVIDER_MODE=live
QDRANT_URL=http://127.0.0.1:6333
QDRANT_API_KEY=replace-with-qdrant-api-key
DASHSCOPE_API_KEY=replace-with-qwen-key
QWEN_BASE_URL=https://<WorkspaceId>.<region>.maas.aliyuncs.com/compatible-mode/v1
QWEN_RERANK_BASE_URL=https://<WorkspaceId>.<region>.maas.aliyuncs.com/compatible-api/v1
DEEPSEEK_API_KEY=replace-with-deepseek-key
```

The registry enables `qwen-fast` only with Qwen credentials and `deepseek-quality` only with DeepSeek credentials. Qwen is the fallback for a single failed DeepSeek request. `qwen-fast` explicitly uses Qwen's direct-answer mode (`enable_thinking=false`): Own-Web never renders or stores hidden reasoning, and the setting materially improves visible streaming latency. Set `CORS_ORIGIN` to the exact browser origin(s) in use; `localhost` and `127.0.0.1` are distinct origins.

Run live calibration only with an explicit environment opt-in:

```powershell
$env:AI_LIVE_TESTS='1'
npm run ai:eval
npm run ai:live:account
npm run ai:live:acceptance
npm run ai:live:security
```

`ai:live:account` creates a random temporary user, verifies a real Qwen
ordinary-chat response plus selected-model/explicit-Memory persistence and
cross-user isolation, then deletes the user and its cascade-owned AI rows.
`ai:live:acceptance` verifies a real Qwen Function Calling round trip, cited
RAG answer and LOW-confidence refusal. `ai:live:security` creates only
synthetic private/followers/unlisted fixtures, verifies guest denial and
authorized follower/share-token access, then removes its database rows and
Qdrant points even after a failure. All three commands output only request IDs,
check names and numeric counts. They are opt-in because they consume live
Provider quota; do not run them in routine CI.

Never place provider credentials, API keys, Cookies, raw guest IDs, or copied private article text in `.env.example`, evaluation fixtures, browser logs or commits.

For a Model Studio workspace-dedicated endpoint, the API Key must belong to
that exact workspace and region. Copy the **API Host** from Workspace Management
rather than guessing a region code. A 403 across chat, embedding and rerank
usually means the key's workspace/region, its custom model/IP access scope, or
its enabled state does not match that host. Do not send the key to Codex.
Instead, create or select a key in the same Region and Workspace, allow the
Qwen chat, embedding and rerank models (or use the workspace's default All
scope), and check the IPv4 allowlist for this machine. Model Studio documents
the [dedicated base URL contract](https://help.aliyun.com/en/model-studio/base-url)
and [API-key workspace/permission rules](https://help.aliyun.com/en/model-studio/get-api-key).

## Runtime checks and recovery

- API health: `GET /api/health`; Qdrant health: `GET /healthz` on its private endpoint.
- Run `npm run ai:doctor` for a secret-safe PASS/FAIL check of migration,
  collection/schema/count, embedding, rerank and chat. It emits only counts
  and a request ID, never endpoint values or response bodies.
- Run `AI_LIVE_TESTS=1 npm run ai:stream:doctor` after a Qwen configuration
  change. It uses a 260-character direct prompt (no RAG or tools) and reports
  only transport headers, event counts, first product status, first client
  delta and completion timing. A passing run requires at least three deltas
  before `done`; it never emits prompt text, generated text or credentials.
- Check Qdrant collection creation/indexing by running `npm run ai:index:backfill` and reviewing `ai_index_jobs` failures; application article edits are never rolled back because indexing failed.
- Rebuild after a content migration, lost Qdrant volume or embedding model change: stop writes if required, back up MySQL, recreate the collection, run backfill, then sample authorized article queries.
- Tune `AI_GUEST_DAILY_LIMIT`, `AI_USER_DAILY_LIMIT`, `AI_MAX_CONCURRENT_PER_USER`, `AI_GLOBAL_DAILY_REQUEST_LIMIT`, and `AI_GLOBAL_DAILY_TOKEN_LIMIT` before production. Defaults are deliberately conservative (5 guest, 50 user requests/day, two concurrent requests per subject).
- Tune `AI_CONFIDENCE_MIN_EVIDENCE_SCORE` (default `0.4`) and
  `AI_CONFIDENCE_MIN_LEXICAL_TERMS` (default `1`) through live calibration.
  These reject weak or lexically unsupported cross-article evidence; they do
  not replace permission checks or human answer review.
- Set `AI_DEVELOPER_TRACE=true` only for a protected development log sink. It
  adds a redacted intent/plan/source-count/tool-name/timing trace; it never
  includes prompt, answer text, selection, cookie, key or hidden reasoning.
