function utcDay() { return new Date().toISOString().slice(0, 10); }

function createAiRateLimiter({ db, config }) {
  const query = db.promise().query.bind(db.promise());
  const ipWindows = new Map();
  const active = new Map();

  function allowIp(ip) {
    const now = Date.now();
    const key = String(ip || 'unknown');
    const events = (ipWindows.get(key) || []).filter((time) => now - time < config.limits.ipWindowMs);
    if (events.length >= config.limits.ipWindow) return false;
    events.push(now); ipWindows.set(key, events); return true;
  }

  async function usage(subject) {
    const subjectColumn = subject.userId ? 'user_id' : 'session_hash';
    const value = subject.userId || subject.sessionHash;
    const [rows] = await query(`SELECT COUNT(*) AS requests,COALESCE(SUM(total_tokens),0) AS tokens FROM ai_usage WHERE ${subjectColumn}=? AND DATE(created_at)=UTC_DATE()`, [value]);
    const [[global]] = await query('SELECT COUNT(*) AS requests,COALESCE(SUM(total_tokens),0) AS tokens FROM ai_usage WHERE DATE(created_at)=UTC_DATE()');
    return { requests: Number(rows[0]?.requests || 0), tokens: Number(rows[0]?.tokens || 0), globalRequests: Number(global?.requests || 0), globalTokens: Number(global?.tokens || 0) };
  }

  async function begin(subject, ip) {
    if (!allowIp(ip)) throw Object.assign(new Error('请求过于频繁，请稍后再试'), { code: 'RATE_LIMITED', status: 429 });
    const key = subject.userId ? `user:${subject.userId}` : `guest:${subject.sessionHash}`;
    if ((active.get(key) || 0) >= config.limits.concurrentPerSubject) throw Object.assign(new Error('已有生成请求正在进行'), { code: 'CONCURRENCY_LIMITED', status: 429 });
    const totals = await usage(subject);
    const dailyLimit = subject.userId ? config.limits.userDaily : config.limits.guestDaily;
    if (totals.requests >= dailyLimit) throw Object.assign(new Error('今日 AI 使用额度已用完'), { code: 'QUOTA_EXCEEDED', status: 429 });
    if (totals.globalRequests >= config.limits.globalDailyRequests || totals.globalTokens >= config.limits.globalDailyTokens) throw Object.assign(new Error('AI 服务今日额度已用完'), { code: 'GLOBAL_QUOTA_EXCEEDED', status: 503 });
    active.set(key, (active.get(key) || 0) + 1);
    return () => {
      const remaining = (active.get(key) || 1) - 1;
      if (remaining > 0) active.set(key, remaining); else active.delete(key);
    };
  }

  async function record({ requestId, subject, provider, model, inputTokens, outputTokens, latencyMs, status, intent, toolCalls }) {
    const total = Math.max(0, Number(inputTokens || 0) + Number(outputTokens || 0));
    await query('INSERT INTO ai_usage (request_id,user_id,session_hash,provider,model,input_tokens,output_tokens,total_tokens,latency_ms,status,route_type,tool_calls) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)', [
      requestId, subject.userId || null, subject.sessionHash || null, provider || null, model || null,
      Math.max(0, Number(inputTokens || 0)), Math.max(0, Number(outputTokens || 0)), total, Math.max(0, Number(latencyMs || 0)), status, intent || null, Math.max(0, Number(toolCalls || 0)),
    ]);
  }

  return { begin, record, activeCount: (subject) => active.get(subject.userId ? `user:${subject.userId}` : `guest:${subject.sessionHash}`) || 0, utcDay };
}

module.exports = { createAiRateLimiter };
