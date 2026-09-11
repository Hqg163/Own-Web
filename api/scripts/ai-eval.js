const fs = require('fs');
const path = require('path');

const fixturePath = path.join(__dirname, '..', 'ai', 'evals', 'own-web-eval.json');

function percentile(values, quantile) {
  if (!values.length) return null;
  const sorted = [...values].sort((left, right) => left - right);
  return Number(sorted[Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * quantile))].toFixed(2));
}
function ratio(numerator, denominator) { return denominator ? Number((numerator / denominator).toFixed(4)) : null; }
function loadCases() {
  const cases = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
  if (!Array.isArray(cases) || cases.length < 20 || cases.length > 50) throw new Error('Evaluation set must contain 20–50 cases');
  const ids = new Set();
  for (const item of cases) {
    if (!item?.id || ids.has(item.id) || !String(item.question || '').trim() || typeof item.answerable !== 'boolean' || !Array.isArray(item.expectedCitationSlugs)) {
      throw new Error(`Invalid evaluation case: ${item?.id || 'unknown'}`);
    }
    ids.add(item.id);
  }
  return cases;
}

async function liveEvaluation(cases) {
  if (process.env.AI_LIVE_TESTS !== '1') return null;
  const dotenv = require('dotenv');
  const mysql = require('mysql2');
  const { loadAiConfig } = require('../ai/config');
  const { createQdrantStore } = require('../ai/qdrant');
  const { createEmbeddingProvider } = require('../ai/providers/embedding-provider');
  const { createRerankerProvider } = require('../ai/providers/reranker-provider');
  const { createRetriever } = require('../ai/retrieval/retriever');
  const { TtlLruCache } = require('../ai/cache');
  dotenv.config({ path: path.join(__dirname, '..', '..', '.env') });
  const config = loadAiConfig();
  if (!config.enabled || config.providerMode !== 'live' || !config.qdrant.url) throw new Error('Live evaluation requires AI_ENABLED=true, AI_PROVIDER_MODE=live, and QDRANT_URL');
  const db = mysql.createPool({ host: process.env.DB_HOST, port: Number(process.env.DB_PORT || 3306), user: process.env.DB_USER, password: process.env.DB_PASSWORD, database: process.env.DB_NAME, timezone: 'Z' });
  const retriever = createRetriever({ db, config, qdrant: createQdrantStore(config), embeddingProvider: createEmbeddingProvider(config), rerankerProvider: createRerankerProvider(config), retrievalCache: new TtlLruCache(config.cache) });
  const measurements = [];
  try {
    for (const item of cases.filter((entry) => entry.expectedCitationSlugs.length)) {
      const startedAt = Date.now();
      const result = await retriever.retrieve(item.question, null, {});
      const slugs = result.citations.map((citation) => citation.slug).filter(Boolean);
      measurements.push({ id: item.id, answerable: item.answerable, expected: item.expectedCitationSlugs, actual: slugs, confidence: result.confidence.level, latencyMs: Date.now() - startedAt, degraded: result.degraded });
    }
  } finally { await db.promise().end(); }
  const withExpected = measurements.filter((item) => item.expected.length);
  const recalled = withExpected.filter((item) => item.expected.some((slug) => item.actual.includes(slug))).length;
  const cited = measurements.flatMap((item) => item.actual.map((slug) => ({ slug, valid: item.expected.includes(slug) })));
  const answerableCorrect = measurements.filter((item) => (item.confidence !== 'LOW') === item.answerable).length;
  return {
    mode: 'live-retrieval', evaluatedCases: measurements.length, skippedCases: cases.length - measurements.length,
    metrics: {
      recallAt5: ratio(recalled, withExpected.length), citationCorrectness: ratio(cited.filter((item) => item.valid).length, cited.length),
      answerableAccuracy: ratio(answerableCorrect, measurements.length), hallucinationRate: null, permissionLeakageRate: null,
      retrievalLatencyMsP50: percentile(measurements.map((item) => item.latencyMs), 0.5), retrievalLatencyMsP95: percentile(measurements.map((item) => item.latencyMs), 0.95), rerankLatencyMsP95: null,
    },
    samples: measurements,
    note: 'Hallucination and permission leakage require independent human review of answers and protected fixtures; they are intentionally not inferred from retrieval scores.',
  };
}

async function main() {
  const cases = loadCases();
  const live = await liveEvaluation(cases);
  const categories = Object.fromEntries([...new Set(cases.map((item) => item.category))].map((category) => [category, cases.filter((item) => item.category === category).length]));
  console.log(JSON.stringify(live || {
    mode: 'mock-contract', evaluatedCases: 0, fixtureCases: cases.length, categories,
    metrics: { recallAt5: null, citationCorrectness: null, answerableAccuracy: null, hallucinationRate: null, permissionLeakageRate: null, retrievalLatencyMsP50: null, retrievalLatencyMsP95: null, rerankLatencyMsP95: null },
    note: 'Mock mode validates the 20-case evaluation contract only. Set AI_LIVE_TESTS=1 after mapping expectedCitationSlugs to authorized, indexed public fixtures; no live quality metric is fabricated without that calibration.',
  }, null, 2));
}

main().catch((error) => { console.error(`[ai:eval] ${error.message}`); process.exitCode = 1; });
