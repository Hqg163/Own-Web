const { createModelRegistry, resolveModel } = require('../model-registry');
const { createMockChatProvider, createOpenAICompatibleProvider } = require('../providers/chat-provider');

function createModelGateway({ config, registry = createModelRegistry(config), providers: injectedProviders = null }) {
  const mock = createMockChatProvider();
  const defaults = {
    qwen: config.providerMode === 'mock' ? mock : createOpenAICompatibleProvider(config.qwen),
    deepseek: config.providerMode === 'mock' ? mock : createOpenAICompatibleProvider(config.deepseek),
  };
  const providers = { ...defaults, ...(injectedProviders || {}) };

  async function execute(method, request, options = {}) {
    const primary = resolveModel(registry, request.modelId, config.defaultModel);
    if (!primary) throw Object.assign(new Error('没有可用模型'), { code: 'MODEL_UNAVAILABLE' });
    const run = async (model) => {
      const provider = providers[model.provider];
      const result = await provider[method]({ ...request, model: model.model, maxTokens: config.limits.outputTokens }, options);
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
