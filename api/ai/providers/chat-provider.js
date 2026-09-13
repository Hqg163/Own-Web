function usageFromText(input, output) {
  return { inputTokens: Math.ceil(String(input || '').length / 4), outputTokens: Math.ceil(String(output || '').length / 4) };
}

function normalizeToolCalls(calls) {
  return (Array.isArray(calls) ? calls : []).map((call, index) => {
    const fn = call?.function || {};
    return {
      id: String(call?.id || `tool-${index}`), index: Number.isInteger(call?.index) ? call.index : index, type: 'function',
      function: { name: String(fn.name || ''), arguments: String(fn.arguments || '') },
    };
  }).filter((call) => call.function.name);
}

function createMockChatProvider() {
  async function generate(request) {
    const text = String(request.mockResponse || `这是一个 Mock 模式回复：${request.userMessage || ''}`).trim();
    return { content: text, toolCalls: normalizeToolCalls(request.mockToolCalls), usage: usageFromText(JSON.stringify(request.messages || []), text) };
  }

  async function stream(request, { onDelta, onToolCallDelta, signal } = {}) {
    const generated = await generate(request);
    for (const call of generated.toolCalls) await onToolCallDelta?.({ index: call.index, id: call.id, name: call.function.name, argumentsDelta: call.function.arguments });
    const delayMs = Math.max(0, Math.min(1000, Number(request.mockStreamDelayMs ?? process.env.AI_MOCK_STREAM_DELAY_MS ?? 24) || 0));
    for (const piece of generated.content.match(/.{1,8}/gu) || []) {
      if (signal?.aborted) throw Object.assign(new Error('请求已取消'), { code: 'ABORTED' });
      if (delayMs) await new Promise((resolve) => setTimeout(resolve, delayMs));
      await onDelta?.(piece);
    }
    return generated;
  }

  return { capabilities: { stream: true, generate: true, tools: true }, generate, stream };
}

function createOpenAICompatibleProvider({ baseUrl, apiKey, extraBody = {} }) {
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
  const payloadFor = (input, stream) => ({
    model: input.model, messages: input.messages, temperature: input.temperature ?? 0.2, max_tokens: input.maxTokens, stream,
    ...extraBody,
    ...(input.responseFormat === 'json_object' ? { response_format: { type: 'json_object' } } : {}),
    ...(Array.isArray(input.tools) && input.tools.length ? { tools: input.tools, tool_choice: input.toolChoice || 'auto' } : {}),
  });

  async function generate(input, { signal } = {}) {
    const response = await request(payloadFor(input, false), signal);
    const payload = await response.json();
    const message = payload.choices?.[0]?.message || {};
    return {
      content: String(message.content || ''), toolCalls: normalizeToolCalls(message.tool_calls),
      usage: { inputTokens: Number(payload.usage?.prompt_tokens || 0), outputTokens: Number(payload.usage?.completion_tokens || 0) },
    };
  }

  async function stream(input, { onDelta, onToolCallDelta, signal } = {}) {
    const response = await request(payloadFor(input, true), signal);
    if (!response.body) return generate(input, { signal });
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    const callsByIndex = new Map();
    let buffer = '', content = '', usage = { inputTokens: 0, outputTokens: 0 };
    const accept = async (event) => {
      const delta = String(event.choices?.[0]?.delta?.content || '');
      if (delta) { content += delta; await onDelta?.(delta); }
      for (const part of event.choices?.[0]?.delta?.tool_calls || []) {
        const index = Number.isInteger(part.index) ? part.index : callsByIndex.size;
        const current = callsByIndex.get(index) || { id: '', index, type: 'function', function: { name: '', arguments: '' } };
        if (part.id) current.id = String(part.id);
        if (part.type) current.type = String(part.type);
        if (part.function?.name) current.function.name += String(part.function.name);
        const argumentsDelta = part.function?.arguments === undefined ? '' : String(part.function.arguments);
        if (argumentsDelta) current.function.arguments += argumentsDelta;
        callsByIndex.set(index, current);
        await onToolCallDelta?.({ index, ...(part.id ? { id: current.id } : {}), ...(part.function?.name ? { name: String(part.function.name) } : {}), ...(argumentsDelta ? { argumentsDelta } : {}) });
      }
      if (event.usage) usage = { inputTokens: Number(event.usage.prompt_tokens || 0), outputTokens: Number(event.usage.completion_tokens || 0) };
    };
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split(/\r?\n/); buffer = lines.pop() || '';
      for (const line of lines) {
        if (!line.startsWith('data:')) continue;
        const valueText = line.slice(5).trim();
        if (!valueText || valueText === '[DONE]') continue;
        try { await accept(JSON.parse(valueText)); } catch (_) { /* malformed provider SSE events are ignored */ }
      }
    }
    if (buffer.startsWith('data:')) {
      const valueText = buffer.slice(5).trim();
      if (valueText && valueText !== '[DONE]') try { await accept(JSON.parse(valueText)); } catch (_) { /* ignored */ }
    }
    return { content, toolCalls: normalizeToolCalls([...callsByIndex.values()]), usage };
  }

  return { capabilities: { stream: true, generate: true, tools: true }, generate, stream };
}

module.exports = { createMockChatProvider, createOpenAICompatibleProvider, usageFromText, normalizeToolCalls };
