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
    const mode = String(item?.mode || 'retrieval');
    if (!item?.id || ids.has(item.id) || !String(item.question || '').trim() || typeof item.answerable !== 'boolean' || !Array.isArray(item.expectedCitationSlugs) || !['retrieval', 'security'].includes(mode)) {
      throw new Error(`Invalid evaluation case: ${item?.id || 'unknown'}`);
    }
    if (mode === 'retrieval' && item.answerable && item.expectedCitationSlugs.length === 0) throw new Error(`Answerable retrieval case requires ground truth: ${item.id}`);
    if (!item.answerable && item.expectedCitationSlugs.length > 0) throw new Error(`Refusal case cannot require citations: ${item.id}`);
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
    for (const item of cases.filter((entry) => (entry.mode || 'retrieval') === 'retrieval')) {
      const startedAt = Date.now();
      const result = await retriever.retrieve(item.question, null, {});
      const slugs = result.citations.map((citation) => citation.slug).filter(Boolean);
      measurements.push({ id: item.id, answerable: item.answerable, expected: item.expectedCitationSlugs, actual: slugs, confidence: result.confidence.level, latencyMs: Date.now() - startedAt, degraded: result.degraded });
    }
  } finally { await db.promise().end(); }
  const withExpected = measurements.filter((item) => item.answerable && item.expected.length);
  const recalled = withExpected.filter((item) => item.expected.some((slug) => item.actual.includes(slug))).length;
  const cited = measurements.flatMap((item) => item.actual.map((slug) => ({ slug, valid: item.answerable && item.expected.includes(slug) })));
  const answerableCorrect = measurements.filter((item) => item.answerable ? item.confidence !== 'LOW' : (item.confidence === 'LOW' && item.actual.length === 0)).length;
  const refusalCases = measurements.filter((item) => !item.answerable);
  const unsupportedCitationLeakage = refusalCases.filter((item) => item.actual.length > 0).length;
  return {
    mode: 'live-retrieval', evaluatedCases: measurements.length, skippedCases: cases.length - measurements.length,
    metrics: {
      recallAt5: ratio(recalled, withExpected.length), citationCorrectness: ratio(cited.filter((item) => item.valid).length, cited.length),
      answerableAccuracy: ratio(answerableCorrect, measurements.length), hallucinationRate: null, permissionLeakageRate: null,
      retrievalLatencyMsP50: percentile(measurements.map((item) => item.latencyMs), 0.5), retrievalLatencyMsP95: percentile(measurements.map((item) => item.latencyMs), 0.95), rerankLatencyMsP95: null,
    },
    samples: measurements,
    note: `Unsupported-citation leakage across refusal retrieval cases: ${unsupportedCitationLeakage}/${refusalCases.length}. Hallucination and permission leakage require independent answer review and protected fixtures; they are intentionally not inferred from retrieval scores.`,
  };
}

async function main() {
  const cases = loadCases();
  const live = await liveEvaluation(cases);
  const categories = Object.fromEntries([...new Set(cases.map((item) => item.category))].map((category) => [category, cases.filter((item) => item.category === category).length]));
  console.log(JSON.stringify(live || {
    mode: 'mock-contract', evaluatedCases: 0, fixtureCases: cases.length, categories,
    metrics: { recallAt5: null, citationCorrectness: null, answerableAccuracy: null, hallucinationRate: null, permissionLeakageRate: null, retrievalLatencyMsP50: null, retrievalLatencyMsP95: null, rerankLatencyMsP95: null },
    note: 'Mock mode validates the 20–50-case evaluation contract only. Set AI_LIVE_TESTS=1 after indexed ground-truth fixtures are available; no live quality metric is fabricated without that calibration.',
  }, null, 2));
}

main().catch((error) => { console.error(`[ai:eval] ${error.message}`); process.exitCode = 1; });
