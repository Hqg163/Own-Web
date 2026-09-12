function evaluateConfidence(candidates, options = {}) {
  const high = Number(options.highThreshold ?? 0.55);
  const medium = Number(options.mediumThreshold ?? 0.25);
  const minScoreGap = Number(options.minScoreGap ?? 0.05);
  const highCoverage = Number(options.highCoverage ?? 0.5);
  const mediumCoverage = Number(options.mediumCoverage ?? 0.25);
  const top = candidates[0];
  if (!top) return { level: 'LOW', reason: 'no_evidence' };
  const topScore = Number(top.rerankScore ?? top.score ?? 0);
  const nextScore = Number(candidates[1]?.rerankScore ?? candidates[1]?.score ?? 0);
  const sourceCount = new Set(candidates.map((candidate) => candidate.postId)).size;
  const supportChunkCount = candidates.length;
  const coverage = Math.min(1, supportChunkCount / 3);
  const scoreGap = topScore - nextScore;
  const details = { topScore, scoreGap, sourceCount, supportChunkCount, coverage };
  if (topScore >= high && coverage >= highCoverage && (scoreGap >= minScoreGap || sourceCount > 1)) return { level: 'HIGH', reason: 'strong_evidence', ...details };
  if (topScore >= medium && coverage >= mediumCoverage) return { level: 'MEDIUM', reason: 'partial_evidence', ...details };
  return { level: 'LOW', reason: 'weak_evidence', ...details };
}

// RRF ranks are not calibrated reranker probabilities. During a reranker
// outage, evaluate rank diversity/coverage instead of comparing raw RRF
// scores against the live-reranker thresholds above.
function evaluateRrfConfidence(candidates) {
  if (!candidates.length) return { level: 'LOW', reason: 'no_evidence', kind: 'rrf' };
  const sourceCount = new Set(candidates.map((candidate) => candidate.postId)).size;
  const supportChunkCount = candidates.length;
  const coverage = Math.min(1, supportChunkCount / 3);
  if (supportChunkCount >= 3 || (supportChunkCount >= 2 && sourceCount >= 2)) return { level: 'MEDIUM', reason: 'rrf_coverage', kind: 'rrf', sourceCount, supportChunkCount, coverage };
  return { level: 'LOW', reason: 'rrf_insufficient_coverage', kind: 'rrf', sourceCount, supportChunkCount, coverage };
}

module.exports = { evaluateConfidence, evaluateRrfConfidence };
