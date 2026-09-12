const { z } = require('zod');

const boolean = (value, fallback = false) => {
  if (value === undefined || value === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(String(value).trim().toLowerCase());
};

const integer = (value, fallback, minimum = 0) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= minimum ? parsed : fallback;
};
const decimal = (value, fallback, minimum = 0, maximum = 1) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= minimum && parsed <= maximum ? parsed : fallback;
};

const configSchema = z.object({
  enabled: z.boolean(),
  providerMode: z.enum(['live', 'mock']),
  defaultModel: z.string().min(1),
  qwen: z.object({ apiKey: z.string(), baseUrl: z.string(), chatBaseUrl: z.string(), embeddingBaseUrl: z.string(), rerankBaseUrl: z.string(), model: z.string() }),
  deepseek: z.object({ apiKey: z.string(), baseUrl: z.string(), model: z.string() }),
  embedding: z.object({ model: z.string(), dimensions: z.number().int().positive() }),
  rerank: z.object({ model: z.string(), enabled: z.boolean() }),
  qdrant: z.object({ url: z.string(), apiKey: z.string(), collection: z.string() }),
  limits: z.object({
    inputChars: z.number().int().positive(), selectedTextChars: z.number().int().positive(),
    outputTokens: z.number().int().positive(), recentMessages: z.number().int().positive(),
    contextChars: z.number().int().positive(), toolResultChars: z.number().int().positive(),
    toolRounds: z.number().int().positive(), guestDaily: z.number().int().positive(), userDaily: z.number().int().positive(),
    ipWindow: z.number().int().positive(), ipWindowMs: z.number().int().positive(), concurrentPerSubject: z.number().int().positive(),
    globalDailyRequests: z.number().int().positive(), globalDailyTokens: z.number().int().positive(), toolTimeoutMs: z.number().int().positive(),
  }),
  cache: z.object({ maxEntries: z.number().int().positive(), ttlMs: z.number().int().positive() }),
  confidence: z.object({ highThreshold: z.number().min(0).max(1), mediumThreshold: z.number().min(0).max(1) }),
});

function loadAiConfig(env = process.env) {
  const qwenBaseUrl = String(env.QWEN_BASE_URL || '');
  const compatibleRerankBase = qwenBaseUrl.replace(/\/compatible-mode\/v1\/?$/, '/compatible-api/v1');
  return configSchema.parse({
    enabled: boolean(env.AI_ENABLED, false),
    providerMode: String(env.AI_PROVIDER_MODE || 'mock').toLowerCase() === 'mock' ? 'mock' : 'live',
    defaultModel: String(env.AI_DEFAULT_MODEL || 'qwen-fast'),
    qwen: {
      apiKey: String(env.DASHSCOPE_API_KEY || ''), baseUrl: qwenBaseUrl,
      chatBaseUrl: String(env.QWEN_CHAT_BASE_URL || qwenBaseUrl),
      embeddingBaseUrl: String(env.QWEN_EMBEDDING_BASE_URL || qwenBaseUrl),
      rerankBaseUrl: String(env.QWEN_RERANK_BASE_URL || compatibleRerankBase),
      model: String(env.QWEN_CHAT_MODEL || 'qwen3.8-flash'),
    },
    deepseek: { apiKey: String(env.DEEPSEEK_API_KEY || ''), baseUrl: String(env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com'), model: String(env.DEEPSEEK_CHAT_MODEL || 'deepseek-v4-flash') },
    embedding: { model: String(env.AI_EMBEDDING_MODEL || 'text-embedding-v4'), dimensions: integer(env.AI_EMBEDDING_DIM, 1024, 1) },
    rerank: { model: String(env.AI_RERANK_MODEL || 'qwen3-rerank'), enabled: boolean(env.AI_ENABLE_RERANK, true) },
    qdrant: { url: String(env.QDRANT_URL || ''), apiKey: String(env.QDRANT_API_KEY || ''), collection: String(env.AI_QDRANT_COLLECTION || 'own_web_ai_content_v1') },
    limits: {
      inputChars: integer(env.AI_MAX_INPUT_CHARS, 8000, 1), selectedTextChars: integer(env.AI_MAX_SELECTED_TEXT_CHARS, 4000, 1),
      outputTokens: integer(env.AI_MAX_OUTPUT_TOKENS, 1200, 1), recentMessages: integer(env.AI_RECENT_MESSAGE_LIMIT, 8, 1),
      contextChars: integer(env.AI_MAX_CONTEXT_CHARS, 12000, 1), toolResultChars: integer(env.AI_MAX_TOOL_RESULT_CHARS, 6000, 1),
      toolRounds: integer(env.AI_MAX_TOOL_ROUNDS, 3, 1), guestDaily: integer(env.AI_GUEST_DAILY_LIMIT, 5, 1),
      userDaily: integer(env.AI_USER_DAILY_LIMIT, 50, 1), ipWindow: integer(env.AI_IP_WINDOW_LIMIT, 20, 1),
      ipWindowMs: integer(env.AI_IP_WINDOW_MS, 60 * 60 * 1000, 1000), concurrentPerSubject: integer(env.AI_MAX_CONCURRENT_PER_USER, 2, 1),
      globalDailyRequests: integer(env.AI_GLOBAL_DAILY_REQUEST_LIMIT, 1000, 1), globalDailyTokens: integer(env.AI_GLOBAL_DAILY_TOKEN_LIMIT, 500000, 1),
      toolTimeoutMs: integer(env.AI_TOOL_TIMEOUT_MS, 2500, 100),
    },
    cache: { maxEntries: integer(env.AI_CACHE_MAX_ENTRIES, 500, 1), ttlMs: integer(env.AI_CACHE_TTL_MS, 5 * 60 * 1000, 1000) },
    confidence: { highThreshold: decimal(env.AI_CONFIDENCE_HIGH, 0.55), mediumThreshold: decimal(env.AI_CONFIDENCE_MEDIUM, 0.25) },
  });
}

module.exports = { loadAiConfig };
