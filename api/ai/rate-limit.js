const crypto = require('crypto');

function utcDay() { return new Date().toISOString().slice(0, 10); }

function createAiRateLimiter({ db, config }) {
  const pool = db.promise();
  const query = pool.query.bind(pool);
  const ipWindows = new Map();
  const active = new Map();
  let fallbackReservation = Promise.resolve();

  function allowIp(ip) {
    const now = Date.now();
    const key = String(ip || 'unknown');
    const events = (ipWindows.get(key) || []).filter((time) => now - time < config.limits.ipWindowMs);
    if (events.length >= config.limits.ipWindow) return false;
    events.push(now); ipWindows.set(key, events); return true;
  }

  function subjectParts(subject) {
    return subject.userId
      ? { column: 'user_id', value: Number(subject.userId), userId: Number(subject.userId), sessionHash: null, key: `user:${Number(subject.userId)}` }
      : { column: 'session_hash', value: String(subject.sessionHash), userId: null, sessionHash: String(subject.sessionHash), key: `guest:${String(subject.sessionHash)}` };
  }

  async function usage(executor, subject) {
    const identity = subjectParts(subject);
    const [rows] = await executor(`SELECT COUNT(*) AS requests,COALESCE(SUM(total_tokens),0) AS tokens FROM ai_usage WHERE ${identity.column}=? AND DATE(created_at)=UTC_DATE()`, [identity.value]);
    const [[global]] = await executor('SELECT COUNT(*) AS requests,COALESCE(SUM(total_tokens),0) AS tokens FROM ai_usage WHERE DATE(created_at)=UTC_DATE()');
    return { requests: Number(rows[0]?.requests || 0), tokens: Number(rows[0]?.tokens || 0), globalRequests: Number(global?.requests || 0), globalTokens: Number(global?.tokens || 0) };
  }

  function reservedTokens() {
    return Math.ceil(config.limits.inputChars / 4) + config.limits.outputTokens;
  }

  async function reserve(executor, subject, requestId) {
    const totals = await usage(executor, subject);
    const dailyLimit = subject.userId ? config.limits.userDaily : config.limits.guestDaily;
    if (totals.requests >= dailyLimit) throw Object.assign(new Error('今日 AI 使用额度已用完'), { code: 'QUOTA_EXCEEDED', status: 429 });
    if (totals.globalRequests >= config.limits.globalDailyRequests || totals.globalTokens + reservedTokens() > config.limits.globalDailyTokens) {
      throw Object.assign(new Error('AI 服务今日额度已用完'), { code: 'GLOBAL_QUOTA_EXCEEDED', status: 503 });
    }
    const identity = subjectParts(subject);
    await executor('INSERT INTO ai_usage (request_id,user_id,session_hash,input_tokens,output_tokens,total_tokens,status,route_type,tool_calls) VALUES (?,?,?,?,?,?,?,?,?)', [
      requestId, identity.userId, identity.sessionHash, 0, 0, reservedTokens(), 'reserved', 'pending', 0,
    ]);
  }

  async function reserveTransaction(subject, requestId) {
    if (typeof pool.getConnection !== 'function') {
      const previous = fallbackReservation;
      let releaseQueue;
      fallbackReservation = new Promise((resolve) => { releaseQueue = resolve; });
      await previous;
      try { await reserve(query, subject, requestId); } finally { releaseQueue(); }
      return;
    }
    const connection = await pool.getConnection();
    const lockName = `own-web-ai-quota:${utcDay()}`;
    let locked = false;
    try {
      await connection.beginTransaction();
      const [[lock]] = await connection.query('SELECT GET_LOCK(?, 2) AS acquired', [lockName]);
      if (Number(lock?.acquired || 0) !== 1) throw Object.assign(new Error('AI 配额服务繁忙'), { code: 'QUOTA_RESERVATION_UNAVAILABLE', status: 503 });
      locked = true;
      await reserve(connection.query.bind(connection), subject, requestId);
      await connection.commit();
    } catch (error) {
      await connection.rollback().catch(() => {});
      throw error;
    } finally {
      if (locked) await connection.query('SELECT RELEASE_LOCK(?)', [lockName]).catch(() => {});
      connection.release();
    }
  }

  async function begin(subject, ip, requestId = crypto.randomUUID()) {
    if (!allowIp(ip)) throw Object.assign(new Error('请求过于频繁，请稍后再试'), { code: 'RATE_LIMITED', status: 429 });
    const identity = subjectParts(subject);
    if ((active.get(identity.key) || 0) >= config.limits.concurrentPerSubject) throw Object.assign(new Error('已有生成请求正在进行'), { code: 'CONCURRENCY_LIMITED', status: 429 });
    active.set(identity.key, (active.get(identity.key) || 0) + 1);
    try { await reserveTransaction(subject, requestId); }
    catch (error) {
      const remaining = (active.get(identity.key) || 1) - 1;
      if (remaining > 0) active.set(identity.key, remaining); else active.delete(identity.key);
      throw error;
    }
    return () => {
      const remaining = (active.get(identity.key) || 1) - 1;
      if (remaining > 0) active.set(identity.key, remaining); else active.delete(identity.key);
      return query(`DELETE FROM ai_usage WHERE request_id=? AND ${identity.column}=? AND status='reserved'`, [requestId, identity.value]).catch(() => {});
    };
  }

  async function record({ requestId, subject, provider, model, inputTokens, outputTokens, latencyMs, status, intent, toolCalls }) {
    const identity = subjectParts(subject);
    const input = Math.max(0, Number(inputTokens || 0));
    const output = Math.max(0, Number(outputTokens || 0));
    const total = input + output;
    const [updated] = await query(`UPDATE ai_usage SET provider=?,model=?,input_tokens=?,output_tokens=?,total_tokens=?,latency_ms=?,status=?,route_type=?,tool_calls=? WHERE request_id=? AND ${identity.column}=? AND status='reserved'`, [
      provider || null, model || null, input, output, total, Math.max(0, Number(latencyMs || 0)), status || 'complete', intent || null, Math.max(0, Number(toolCalls || 0)), requestId, identity.value,
    ]);
    if (updated.affectedRows > 0) return;
    await query('INSERT INTO ai_usage (request_id,user_id,session_hash,provider,model,input_tokens,output_tokens,total_tokens,latency_ms,status,route_type,tool_calls) VALUES (?,?,?,?,?,?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE provider=VALUES(provider),model=VALUES(model),input_tokens=VALUES(input_tokens),output_tokens=VALUES(output_tokens),total_tokens=VALUES(total_tokens),latency_ms=VALUES(latency_ms),status=VALUES(status),route_type=VALUES(route_type),tool_calls=VALUES(tool_calls)', [
      requestId, identity.userId, identity.sessionHash, provider || null, model || null, input, output, total, Math.max(0, Number(latencyMs || 0)), status || 'complete', intent || null, Math.max(0, Number(toolCalls || 0)),
    ]);
  }

  return { begin, record, activeCount: (subject) => active.get(subjectParts(subject).key) || 0, utcDay };
}

module.exports = { createAiRateLimiter };
