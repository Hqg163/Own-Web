function createMemoryStore({ db }) {
  const query = db.promise().query.bind(db.promise());

  async function settings(userId) {
    await query('INSERT IGNORE INTO ai_user_settings (user_id) VALUES (?)', [Number(userId)]);
    const [rows] = await query('SELECT memory_enabled,default_model FROM ai_user_settings WHERE user_id=?', [Number(userId)]);
    return { memoryEnabled: Boolean(rows[0]?.memory_enabled), defaultModel: rows[0]?.default_model || 'qwen-fast' };
  }

  async function updateSettings(userId, value = {}) {
    const current = await settings(userId);
    const memoryEnabled = value.memoryEnabled === undefined ? current.memoryEnabled : Boolean(value.memoryEnabled);
    const defaultModel = value.defaultModel === undefined ? current.defaultModel : String(value.defaultModel).slice(0, 80);
    await query('UPDATE ai_user_settings SET memory_enabled=?,default_model=? WHERE user_id=?', [memoryEnabled, defaultModel, Number(userId)]);
    return { memoryEnabled, defaultModel };
  }

  async function list(userId) {
    const [rows] = await query("SELECT id,memory_key,memory_value,confidence,created_at,updated_at FROM ai_memories WHERE user_id=? AND type='preference' ORDER BY updated_at DESC,id DESC", [Number(userId)]);
    return rows.map((row) => ({ id: row.id, key: row.memory_key, value: row.memory_value, confidence: Number(row.confidence), createdAt: row.created_at, updatedAt: row.updated_at }));
  }

  async function save(userId, { key, value, conversationId = null }) {
    const memoryKey = String(key || '').trim().slice(0, 120);
    const memoryValue = String(value || '').trim().slice(0, 2000);
    if (!memoryKey || !memoryValue) throw Object.assign(new Error('偏好内容不能为空'), { code: 'INVALID_MEMORY' });
    await query("INSERT INTO ai_memories (id,user_id,type,memory_key,memory_value,source_conversation_id) VALUES (UUID(),?,'preference',?,?,?) ON DUPLICATE KEY UPDATE memory_value=VALUES(memory_value),source_conversation_id=VALUES(source_conversation_id),updated_at=CURRENT_TIMESTAMP", [Number(userId), memoryKey, memoryValue, conversationId]);
    return { key: memoryKey, value: memoryValue };
  }

  async function remove(userId, memoryId) {
    const [result] = await query("DELETE FROM ai_memories WHERE id=? AND user_id=? AND type='preference'", [memoryId, Number(userId)]);
    return result.affectedRows > 0;
  }

  async function clear(userId) {
    const [result] = await query("DELETE FROM ai_memories WHERE user_id=? AND type='preference'", [Number(userId)]);
    return result.affectedRows;
  }

  return { settings, updateSettings, list, save, remove, clear };
}

module.exports = { createMemoryStore };
