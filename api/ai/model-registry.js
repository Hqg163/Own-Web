function createModelRegistry(config) {
  const mock = config.providerMode === 'mock';
  const models = [
    {
      id: 'qwen-fast', label: '快速 · Qwen 3.8 Flash', provider: 'qwen', model: config.qwen.model,
      supportsTools: true, supportsStructuredOutput: true, supportsReasoning: false, supportsVision: false,
      contextWindow: 1000000, enabled: mock || Boolean(config.qwen.apiKey && config.qwen.chatBaseUrl), fallbackId: null,
    },
    {
      id: 'deepseek-quality', label: '高质量 · DeepSeek Flash', provider: 'deepseek', model: config.deepseek.model,
      supportsTools: true, supportsStructuredOutput: true, supportsReasoning: false, supportsVision: false,
      contextWindow: 1000000, enabled: mock || Boolean(config.deepseek.apiKey && config.deepseek.baseUrl), fallbackId: 'qwen-fast',
    },
  ];
  return models;
}

function getEnabledModels(registry) { return registry.filter((model) => model.enabled); }

function resolveModel(registry, id, defaultId) {
  const model = registry.find((entry) => entry.id === (id || defaultId) && entry.enabled);
  if (model) return model;
  return registry.find((entry) => entry.id === defaultId && entry.enabled) || null;
}

module.exports = { createModelRegistry, getEnabledModels, resolveModel };
