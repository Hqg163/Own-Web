function usageFromText(input, output) {
  return { inputTokens: Math.ceil(String(input || '').length / 4), outputTokens: Math.ceil(String(output || '').length / 4) };
}

function createMockChatProvider() {
  async function generate(request) {
    const text = String(request.mockResponse || `这是一个 Mock 模式回复：${request.userMessage || ''}`).trim();
    return { content: text, usage: usageFromText(JSON.stringify(request.messages || []), text) };
  }

  async function stream(request, { onDelta, signal } = {}) {
    const generated = await generate(request);
    for (const piece of generated.content.match(/.{1,24}/gu) || []) {
      if (signal?.aborted) throw Object.assign(new Error('请求已取消'), { code: 'ABORTED' });
      await onDelta?.(piece);
    }
    return generated;
  }

  return { capabilities: { stream: true, generate: true, tools: false }, generate, stream };
}

function createOpenAICompatibleProvider({ baseUrl, apiKey }) {
  const endpoint = `${String(baseUrl || '').replace(/\/$/, '')}/chat/completions`;
  const request = async (body, signal) => {
    if (!baseUrl || !apiKey) throw Object.assign(new Error('模型 Provider 未配置'), { code: 'MODEL_UNAVAILABLE' });
    const response = await fetch(endpoint, {
      method: 'POST', signal,
      headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` }, body: JSON.stringify(body),
    });
    if (!response.ok) throw Object.assign(new Error('模型 Provider 不可用'), { code: 'MODEL_UNAVAILABLE', status: response.status });
    return response;
  };
  const payloadFor = (input, stream) => ({ model: input.model, messages: input.messages, temperature: 0.2, max_tokens: input.maxTokens, stream });

  async function generate(input, { signal } = {}) {
    const response = await request(payloadFor(input, false), signal);
    const payload = await response.json();
    const content = String(payload.choices?.[0]?.message?.content || '');
    return { content, usage: { inputTokens: Number(payload.usage?.prompt_tokens || 0), outputTokens: Number(payload.usage?.completion_tokens || 0) } };
  }

  async function stream(input, { onDelta, signal } = {}) {
    const response = await request(payloadFor(input, true), signal);
    if (!response.body) return generate(input, { signal });
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '', content = '', usage = { inputTokens: 0, outputTokens: 0 };
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split(/\r?\n/); buffer = lines.pop() || '';
      for (const line of lines) {
        if (!line.startsWith('data:')) continue;
        const valueText = line.slice(5).trim();
        if (!valueText || valueText === '[DONE]') continue;
        try {
          const event = JSON.parse(valueText);
          const delta = String(event.choices?.[0]?.delta?.content || '');
          if (delta) { content += delta; await onDelta?.(delta); }
          if (event.usage) usage = { inputTokens: Number(event.usage.prompt_tokens || 0), outputTokens: Number(event.usage.completion_tokens || 0) };
        } catch (_) { /* malformed provider SSE events are ignored */ }
      }
    }
    return { content, usage };
  }

  return { capabilities: { stream: true, generate: true, tools: false }, generate, stream };
}

module.exports = { createMockChatProvider, createOpenAICompatibleProvider, usageFromText };
