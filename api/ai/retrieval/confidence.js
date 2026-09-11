function evaluateConfidence(candidates, options = {}) {
  const high = Number(options.highThreshold ?? 0.55);
  const medium = Number(options.mediumThreshold ?? 0.25);
  const top = candidates[0];
  if (!top) return { level: 'LOW', reason: 'no_evidence' };
  const topScore = Number(top.rerankScore ?? top.score ?? 0);
  const nextScore = Number(candidates[1]?.rerankScore ?? candidates[1]?.score ?? 0);
  const sourceCount = new Set(candidates.map((candidate) => candidate.postId)).size;
  if (topScore >= high && (topScore - nextScore >= 0.05 || sourceCount > 1)) return { level: 'HIGH', reason: 'strong_evidence', topScore, sourceCount };
  if (topScore >= medium) return { level: 'MEDIUM', reason: 'partial_evidence', topScore, sourceCount };
  return { level: 'LOW', reason: 'weak_evidence', topScore, sourceCount };
}

module.exports = { evaluateConfidence };
