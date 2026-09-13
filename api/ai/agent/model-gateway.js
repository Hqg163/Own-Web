const { createModelRegistry, resolveModel } = require('../model-registry');
const { createMockChatProvider, createOpenAICompatibleProvider } = require('../providers/chat-provider');

function createModelGateway({ config, registry = createModelRegistry(config), providers: injectedProviders = null }) {
  const mock = createMockChatProvider();
  const defaults = {
    // Qwen 3.8 Flash enables deep reasoning by default. The assistant does
    // not expose hidden reasoning, so opt into direct-answer mode to improve
    // visible first-token latency without weakening source/citation checks.
    qwen: config.providerMode === 'mock' ? mock : createOpenAICompatibleProvider({ ...config.qwen, baseUrl: config.qwen.chatBaseUrl || config.qwen.baseUrl, extraBody: { enable_thinking: false, preserve_thinking: false } }),
    deepseek: config.providerMode === 'mock' ? mock : createOpenAICompatibleProvider(config.deepseek),
  };
  const providers = { ...defaults, ...(injectedProviders || {}) };

  async function execute(method, request, options = {}) {
    const primary = resolveModel(registry, request.modelId, config.defaultModel);
    if (!primary) throw Object.assign(new Error('没有可用模型'), { code: 'MODEL_UNAVAILABLE' });
    const run = async (model) => {
      const provider = providers[model.provider];
      if (!provider || typeof provider[method] !== 'function') throw Object.assign(new Error('模型能力不可用'), { code: 'MODEL_UNAVAILABLE' });
      if (Array.isArray(request.tools) && request.tools.length && model.supportsTools === false) throw Object.assign(new Error('模型不支持工具调用'), { code: 'MODEL_TOOLS_UNAVAILABLE' });
      if (Array.isArray(request.tools) && request.tools.length && provider.capabilities?.tools === false) throw Object.assign(new Error('模型不支持工具调用'), { code: 'MODEL_TOOLS_UNAVAILABLE' });
      const requestedMaxTokens = Number(request.maxTokens);
      const maxTokens = Number.isFinite(requestedMaxTokens) && requestedMaxTokens > 0
        ? Math.min(config.limits.outputTokens, Math.floor(requestedMaxTokens))
        : config.limits.outputTokens;
      const result = await provider[method]({ ...request, model: model.model, maxTokens }, options);
      return { ...result, model, fallbackFrom: null };
    };
    try { return await run(primary); } catch (error) {
      const fallback = primary.fallbackId ? resolveModel(registry, primary.fallbackId, config.defaultModel) : null;
      if (!fallback || fallback.id === primary.id) throw error;
      try {
        const result = await run(fallback);
        return { ...result, fallbackFrom: primary.id };
      } catch (_) { throw error; }
    }
  }

  return {
    registry,
    models: () => registry.filter((model) => model.enabled).map(({ id, label, supportsReasoning, supportsTools }) => ({ id, label, supportsReasoning, supportsTools })),
    generate: (request, options) => execute('generate', request, options),
    stream: (request, options) => execute('stream', request, options),
  };
}

module.exports = { createModelGateway };
