# AI Agent / RAG v1 setup and operations

## Safe default

Keep the copied `.env` disabled until the dependencies are ready:

```dotenv
AI_ENABLED=false
AI_PROVIDER_MODE=mock
```

With that default, existing Own-Web behavior remains unchanged. `/ai` returns an explicit disabled state and the global launcher disappears after its availability check.

For a local deterministic UI/API verification, set `AI_ENABLED=true` and keep `AI_PROVIDER_MODE=mock`; no third-party model key is used. Run `npm run test:ai` for the isolated Mock suite.

## Qdrant

The development Compose file pins `qdrant/qdrant:v1.19.0` and binds only `127.0.0.1:6333`:

```powershell
docker compose up -d qdrant
docker compose ps
```

The health endpoint is `http://127.0.0.1:6333/healthz`. `npm run ai:index:backfill` initializes the configured collection with a 1024-dimensional cosine `dense` vector and IDF-modified `bm25` sparse vector, then indexes posts. Use `npm run ai:index:post -- <postId>` for one post and `npm run ai:index:retry` for failed jobs.

For production, use `docker-compose.production.yml`, set a strong `QDRANT_API_KEY`, and place the Own-Web API on its `ai-internal` private network with `QDRANT_URL=http://qdrant:6333`. That profile publishes no host port and sets Qdrant's API key. Do not expose port 6333 through a reverse proxy or public firewall rule. Back up the named `qdrant_data` volume together with MySQL; restore MySQL first and then run a backfill whenever index consistency is uncertain.

`npm run test:ai-rag-integration` is intentionally opt-in. Run it with `AI_RAG_INTEGRATION=1`; it starts the pinned Compose service, verifies an isolated collection schema and removes that ephemeral collection. It fails clearly when Docker Compose is unavailable.

## Live provider configuration

Set only the provider values you intend to use, outside source control:

```dotenv
AI_ENABLED=true
AI_PROVIDER_MODE=live
QDRANT_URL=http://127.0.0.1:6333
QDRANT_API_KEY=replace-with-qdrant-api-key
DASHSCOPE_API_KEY=replace-with-qwen-key
QWEN_BASE_URL=https://your-compatible-provider.example/v1
DEEPSEEK_API_KEY=replace-with-deepseek-key
```

The registry enables `qwen-fast` only with Qwen credentials and `deepseek-quality` only with DeepSeek credentials. Qwen is the fallback for a single failed DeepSeek request. Set `CORS_ORIGIN` to the exact browser origin(s) in use; `localhost` and `127.0.0.1` are distinct origins.

Run live calibration only with an explicit environment opt-in:

```powershell
$env:AI_LIVE_TESTS='1'
npm run ai:eval
```

Never place provider credentials, API keys, Cookies, raw guest IDs, or copied private article text in `.env.example`, evaluation fixtures, browser logs or commits.

## Runtime checks and recovery

- API health: `GET /api/health`; Qdrant health: `GET /healthz` on its private endpoint.
- Check Qdrant collection creation/indexing by running `npm run ai:index:backfill` and reviewing `ai_index_jobs` failures; application article edits are never rolled back because indexing failed.
- Rebuild after a content migration, lost Qdrant volume or embedding model change: stop writes if required, back up MySQL, recreate the collection, run backfill, then sample authorized article queries.
- Tune `AI_GUEST_DAILY_LIMIT`, `AI_USER_DAILY_LIMIT`, `AI_MAX_CONCURRENT_PER_USER`, `AI_GLOBAL_DAILY_REQUEST_LIMIT`, and `AI_GLOBAL_DAILY_TOKEN_LIMIT` before production. Defaults are deliberately conservative (5 guest, 50 user requests/day, two concurrent requests per subject).
