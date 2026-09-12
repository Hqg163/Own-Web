const crypto = require('crypto');
const { buildStructuredSummary } = require('./conversation-summary');

function createConversationStore({ db, config }) {
  const query = db.promise().query.bind(db.promise());
  const id = () => crypto.randomUUID();

  async function create(userId, { title = '新对话', modelId = 'qwen-fast' } = {}) {
    const conversation = { id: id(), userId: Number(userId), title: String(title).trim().slice(0, 180) || '新对话', modelId };
    await query('INSERT INTO ai_conversations (id,user_id,title,selected_model) VALUES (?,?,?,?)', [conversation.id, conversation.userId, conversation.title, conversation.modelId]);
    return { id: conversation.id, title: conversation.title, selectedModel: conversation.modelId };
  }

  async function list(userId) {
    const [rows] = await query('SELECT id,title,selected_model,summary,created_at,updated_at,last_message_at FROM ai_conversations WHERE user_id=? ORDER BY last_message_at DESC,id DESC LIMIT 100', [Number(userId)]);
    return rows.map((row) => ({ id: row.id, title: row.title, selectedModel: row.selected_model, summary: row.summary || null, createdAt: row.created_at, updatedAt: row.updated_at, lastMessageAt: row.last_message_at }));
  }

  async function get(userId, conversationId, { includeMessages = true } = {}) {
    const [conversations] = await query('SELECT id,title,selected_model,summary,created_at,updated_at,last_message_at FROM ai_conversations WHERE id=? AND user_id=?', [conversationId, Number(userId)]);
    const conversation = conversations[0];
    if (!conversation) return null;
    let messages = [];
    if (includeMessages) {
      const [rows] = await query('SELECT id,role,content,model_provider,model_name,status,input_tokens,output_tokens,latency_ms,created_at FROM ai_messages WHERE conversation_id=? ORDER BY created_at ASC,id ASC LIMIT 200', [conversationId]);
      messages = rows.map((row) => ({ id: row.id, role: row.role, content: row.content, provider: row.model_provider, model: row.model_name, status: row.status, inputTokens: row.input_tokens, outputTokens: row.output_tokens, latencyMs: row.latency_ms, createdAt: row.created_at }));
    }
    return { id: conversation.id, title: conversation.title, selectedModel: conversation.selected_model, summary: conversation.summary || null, messages, createdAt: conversation.created_at, updatedAt: conversation.updated_at, lastMessageAt: conversation.last_message_at };
  }

  async function rename(userId, conversationId, title) {
    const value = String(title || '').trim().slice(0, 180);
    if (!value) throw Object.assign(new Error('会话标题不能为空'), { code: 'INVALID_TITLE' });
    const [result] = await query('UPDATE ai_conversations SET title=? WHERE id=? AND user_id=?', [value, conversationId, Number(userId)]);
    return result.affectedRows > 0 ? value : null;
  }

  async function update(userId, conversationId, { title, selectedModel }) {
    const assignments = [];
    const values = [];
    if (title !== undefined) {
      const value = String(title || '').trim().slice(0, 180);
      if (!value) throw Object.assign(new Error('会话标题不能为空'), { code: 'INVALID_TITLE' });
      assignments.push('title=?'); values.push(value);
    }
    if (selectedModel !== undefined) {
      assignments.push('selected_model=?'); values.push(String(selectedModel));
    }
    if (!assignments.length) return null;
    const [result] = await query(`UPDATE ai_conversations SET ${assignments.join(',')} WHERE id=? AND user_id=?`, [...values, conversationId, Number(userId)]);
    return result.affectedRows > 0;
  }

  async function remove(userId, conversationId) {
    const [result] = await query('DELETE FROM ai_conversations WHERE id=? AND user_id=?', [conversationId, Number(userId)]);
    return result.affectedRows > 0;
  }

  async function append(userId, conversationId, message) {
    const conversation = await get(userId, conversationId, { includeMessages: false });
    if (!conversation) throw Object.assign(new Error('会话不可用'), { code: 'CONVERSATION_NOT_FOUND' });
    const messageId = message.id || id();
    await query('INSERT INTO ai_messages (id,conversation_id,role,content,model_provider,model_name,status,input_tokens,output_tokens,latency_ms) VALUES (?,?,?,?,?,?,?,?,?,?)', [
      messageId, conversationId, message.role, String(message.content || ''), message.provider || null, message.model || null,
      message.status || 'complete', message.inputTokens ?? null, message.outputTokens ?? null, message.latencyMs ?? null,
    ]);
    await query('UPDATE ai_conversations SET last_message_at=NOW(),selected_model=? WHERE id=? AND user_id=?', [message.model || conversation.selectedModel, conversationId, Number(userId)]);
    return messageId;
  }

  async function updateMessage(userId, conversationId, messageId, patch) {
    const conversation = await get(userId, conversationId, { includeMessages: false });
    if (!conversation) return false;
    const [result] = await query('UPDATE ai_messages SET content=?,status=?,input_tokens=?,output_tokens=?,latency_ms=? WHERE id=? AND conversation_id=?', [
      String(patch.content || ''), patch.status || 'complete', patch.inputTokens ?? null, patch.outputTokens ?? null, patch.latencyMs ?? null, messageId, conversationId,
    ]);
    return result.affectedRows > 0;
  }

  async function context(userId, conversationId) {
    const conversation = await get(userId, conversationId);
    if (!conversation) return null;
    const recent = conversation.messages.slice(-config.limits.recentMessages).map((message) => ({ role: message.role, content: message.content }));
    return { conversation, summary: conversation.summary || '', recent };
  }

  async function updateSummary(userId, conversationId, summary) {
    const [result] = await query('UPDATE ai_conversations SET summary=? WHERE id=? AND user_id=?', [String(summary || '').slice(0, config.limits.contextChars), conversationId, Number(userId)]);
    return result.affectedRows > 0;
  }

  async function compact(userId, conversationId) {
    const conversation = await get(userId, conversationId);
    if (!conversation) return null;
    const keep = config.limits.recentMessages;
    if (conversation.messages.length <= keep) return conversation.summary || null;
    const summary = JSON.stringify(buildStructuredSummary(conversation.messages.slice(0, -keep), conversation.summary)).slice(0, config.limits.contextChars);
    await updateSummary(userId, conversationId, summary);
    return summary;
  }

  return { create, list, get, rename, update, remove, append, updateMessage, context, updateSummary, compact };
}

module.exports = { createConversationStore };
