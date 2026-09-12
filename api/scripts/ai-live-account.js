const crypto = require('crypto');
const path = require('path');
const dotenv = require('dotenv');
const mysql = require('mysql2');
const { installUtcPool } = require('../lib/utc-pool');
const { loadAiConfig } = require('../ai/config');
const { createQdrantStore } = require('../ai/qdrant');
const { createEmbeddingProvider } = require('../ai/providers/embedding-provider');
const { createRerankerProvider } = require('../ai/providers/reranker-provider');
const { createRetriever } = require('../ai/retrieval/retriever');
const { TtlLruCache } = require('../ai/cache');
const { createContextBuilder } = require('../ai/agent/context-builder');
const { createSkillRegistry } = require('../ai/agent/skills');
const { createConversationStore } = require('../ai/agent/conversation-store');
const { createMemoryStore } = require('../ai/agent/memory-store');
const { createModelGateway } = require('../ai/agent/model-gateway');
const { createAgentWorkflow } = require('../ai/agent/workflow');

dotenv.config({ path: path.join(__dirname, '..', '..', '.env') });

function fail(code) {
  throw Object.assign(new Error(code), { code });
}

async function main() {
  if (process.env.AI_LIVE_TESTS !== '1') fail('LIVE_TESTS_OPT_IN_REQUIRED');
  const config = loadAiConfig();
  if (!config.enabled || config.providerMode !== 'live') fail('LIVE_PROVIDER_REQUIRED');

  const db = mysql.createPool({
    host: process.env.DB_HOST, port: Number(process.env.DB_PORT || 3306), user: process.env.DB_USER,
    password: process.env.DB_PASSWORD, database: process.env.DB_NAME, timezone: 'Z', connectionLimit: 2,
  });
  installUtcPool(db);
  const query = db.promise().query.bind(db.promise());
  const suffix = crypto.randomUUID().replace(/-/g, '');
  let userId = null;

  try {
    const username = `ai_live_account_${suffix.slice(0, 12)}`;
    const [createdUser] = await query(
      "INSERT INTO users (username,email,password,blog_slug,profile_visibility) VALUES (?,?,?,?, 'private')",
      [username, `${username}@example.invalid`, crypto.randomBytes(24).toString('hex'), `${username}-blog`],
    );
    userId = Number(createdUser.insertId);
    const user = { id: userId, email: `${username}@example.invalid` };
    const conversations = createConversationStore({ db, config });
    const memories = createMemoryStore({ db });
    const workflow = createAgentWorkflow({
      contextBuilder: createContextBuilder({ db, config }),
      retriever: createRetriever({
        db, config, qdrant: createQdrantStore(config), embeddingProvider: createEmbeddingProvider(config),
        rerankerProvider: createRerankerProvider(config), retrievalCache: new TtlLruCache(config.cache),
      }),
      skills: createSkillRegistry({ db, config }), gateway: createModelGateway({ config }), memoryStore: memories, config,
    });

    const conversation = await conversations.create(userId, { title: 'AI live persistence verification', modelId: 'qwen-fast' });
    await conversations.update(userId, conversation.id, { selectedModel: 'qwen-fast' });
    await memories.updateSettings(userId, { memoryEnabled: true, defaultModel: 'qwen-fast' });
    await memories.save(userId, { key: 'response_language', value: '中文' });
    await conversations.append(userId, conversation.id, { role: 'user', content: '请用一句中文确认这是普通对话。', model: 'qwen-fast' });

    const result = await workflow.run({
      user, message: '请简短回答。', pageContext: {}, modelId: 'qwen-fast',
      conversation: await conversations.context(userId, conversation.id), onEvent: async () => {},
    });
    if (result.decision.intent !== 'DIRECT_CHAT' || result.model?.provider !== 'qwen' || !String(result.response?.content || '').trim()) fail('LIVE_CONVERSATION_FAILED');
    await conversations.append(userId, conversation.id, {
      role: 'assistant', content: result.response.content, provider: result.model.provider, model: result.model.id,
      inputTokens: result.usage.inputTokens, outputTokens: result.usage.outputTokens, status: 'complete',
    });

    const persisted = await conversations.get(userId, conversation.id);
    const settings = await memories.settings(userId);
    const savedMemories = await memories.list(userId);
    // Use a non-existent principal rather than a potentially adjacent real
    // account; the stores must still reject its conversation and memories.
    const isolatedUserId = userId + 1000000000;
    const otherConversation = await conversations.get(isolatedUserId, conversation.id);
    const otherMemories = await memories.list(isolatedUserId);
    if (persisted?.selectedModel !== 'qwen-fast' || persisted.messages.length !== 2 || !settings.memoryEnabled
      || !savedMemories.some((memory) => memory.key === 'response_language') || otherConversation || otherMemories.length) {
      fail('PERSISTENCE_OR_ISOLATION_FAILED');
    }

    console.log(JSON.stringify({
      requestId: crypto.randomUUID(), status: 'PASS',
      checks: [
        { name: 'live_logged_in_conversation', status: 'PASS', messageCount: persisted.messages.length },
        { name: 'selected_model_and_memory_persistence', status: 'PASS', memoryCount: savedMemories.length },
        { name: 'conversation_memory_idor_isolation', status: 'PASS' },
      ],
    }));
  } finally {
    if (userId) await query('DELETE FROM users WHERE id=?', [userId]);
    await db.promise().end();
  }
}

main().catch((error) => {
  console.error(`[ai:live-account] ${error.code || 'CHECK_FAILED'}`);
  process.exitCode = 1;
});
