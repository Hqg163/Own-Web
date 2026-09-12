const SUMMARY_VERSION = 1;

function clean(value, maximum = 700) { return String(value || '').replace(/\s+/g, ' ').trim().slice(0, maximum); }

function normalizeStructuredSummary(value) {
  try {
    const parsed = typeof value === 'string' ? JSON.parse(value) : value;
    if (!parsed || parsed.version !== SUMMARY_VERSION) return null;
    return {
      version: SUMMARY_VERSION, topic: clean(parsed.topic, 240), userGoal: clean(parsed.userGoal, 400),
      confirmedFacts: Array.isArray(parsed.confirmedFacts) ? parsed.confirmedFacts.map((item) => clean(item, 300)).filter(Boolean).slice(0, 8) : [],
      preferences: Array.isArray(parsed.preferences) ? parsed.preferences.map((item) => clean(item, 200)).filter(Boolean).slice(0, 6) : [],
      references: Array.isArray(parsed.references) ? parsed.references.map((item) => clean(item, 240)).filter(Boolean).slice(0, 8) : [],
      openQuestions: Array.isArray(parsed.openQuestions) ? parsed.openQuestions.map((item) => clean(item, 300)).filter(Boolean).slice(0, 6) : [],
    };
  } catch (_) { return null; }
}

function buildStructuredSummary(messages, previous = null) {
  const prior = normalizeStructuredSummary(previous) || { version: SUMMARY_VERSION, topic: '', userGoal: '', confirmedFacts: [], preferences: [], references: [], openQuestions: [] };
  const userMessages = messages.filter((item) => item.role === 'user').map((item) => clean(item.content));
  const assistantMessages = messages.filter((item) => item.role === 'assistant').map((item) => clean(item.content));
  const latestUser = userMessages.at(-1) || prior.userGoal;
  const refs = assistantMessages.flatMap((item) => [...item.matchAll(/\[(?:S|C|D)\d+\]/g)].map((match) => match[0])).slice(-8);
  return {
    version: SUMMARY_VERSION, topic: clean(latestUser, 240), userGoal: clean(latestUser, 400),
    confirmedFacts: [...prior.confirmedFacts, ...assistantMessages.slice(-3)].map((item) => clean(item, 300)).filter(Boolean).slice(-8),
    preferences: prior.preferences, references: [...prior.references, ...refs].slice(-8),
    openQuestions: latestUser ? [clean(latestUser, 300)] : prior.openQuestions,
  };
}

function summaryToPrompt(value) {
  const summary = normalizeStructuredSummary(value);
  if (!summary) return '';
  return [
    summary.topic && `当前主题：${summary.topic}`,
    summary.userGoal && `用户目标：${summary.userGoal}`,
    summary.confirmedFacts.length && `已确认内容（仍须以本轮新证据为准）：${summary.confirmedFacts.join('；')}`,
    summary.preferences.length && `明确偏好：${summary.preferences.join('；')}`,
    summary.references.length && `重要引用标记：${summary.references.join('、')}`,
    summary.openQuestions.length && `待解决：${summary.openQuestions.join('；')}`,
  ].filter(Boolean).join('\n');
}

module.exports = { buildStructuredSummary, normalizeStructuredSummary, summaryToPrompt };
