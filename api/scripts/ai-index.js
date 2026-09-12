const path = require('path');
const dotenv = require('dotenv');
const mysql = require('mysql2');
const { runMigrations } = require('../migrations');
const { installUtcPool } = require('../lib/utc-pool');
const { loadAiConfig } = require('../ai/config');
const { createQdrantStore } = require('../ai/qdrant');
const { createEmbeddingProvider } = require('../ai/providers/embedding-provider');
const { createIndexer, createIndexQueue } = require('../ai/retrieval/indexer');

dotenv.config({ path: path.join(__dirname, '..', '..', '.env') });

async function main() {
  const command = process.argv[2];
  const postId = Number(process.argv[3]);
  if (!['backfill', 'post', 'retry'].includes(command) || (command === 'post' && (!Number.isSafeInteger(postId) || postId <= 0))) {
    throw new Error('Usage: node scripts/ai-index.js <backfill|post <postId>|retry>');
  }
  const config = loadAiConfig();
  if (!config.enabled) throw new Error('AI_ENABLED=true is required for indexing');
  if (!config.qdrant.url) throw new Error('QDRANT_URL is required for indexing');
  const pool = mysql.createPool({
    host: process.env.DB_HOST, port: Number(process.env.DB_PORT || 3306), user: process.env.DB_USER,
    password: process.env.DB_PASSWORD, database: process.env.DB_NAME, timezone: 'Z', connectionLimit: 2,
  });
  installUtcPool(pool);
  try {
    await runMigrations(pool);
    const qdrant = createQdrantStore(config);
    await qdrant.ensureCollection();
    const indexer = createIndexer({ db: pool, config, qdrant, embeddingProvider: createEmbeddingProvider(config) });
    if (command === 'backfill') {
      console.log(JSON.stringify(await indexer.backfill()));
      return;
    }
    if (command === 'post') {
      console.log(JSON.stringify(await indexer.indexPost(postId)));
      return;
    }
    const queue = createIndexQueue({ db: pool, config, indexer });
    const retried = await queue.retryFailed();
    console.log(JSON.stringify({ retried, processed: await queue.drain() }));
  } finally {
    await pool.promise().end();
  }
}

main().catch((error) => {
  console.error(`[ai:index] ${error.message}`);
  process.exitCode = 1;
});
