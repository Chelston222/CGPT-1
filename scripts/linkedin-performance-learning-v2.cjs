'use strict';

const base = require('./linkedin-performance-learning.cjs');

const STOPWORDS = new Set([
  'the','and','that','this','with','from','have','your','you','for','are','was','were','but','not','into','they','their','then','than','what','when','where','which','will','would','could','should','about','after','before','because','while','just','more','most','some','only','also','very','been','being','our','out','who','how','why','can','does','did','its','his','her','them','there','here','like','get','got','has','had','too','all','any','one','two','three','four','five','six','seven','eight','nine','ten'
]);

function safeNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function londonWeekday(iso) {
  const d = new Date(iso || '');
  if (Number.isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', weekday: 'short' }).format(d);
}

function londonHour(iso) {
  const d = new Date(iso || '');
  if (Number.isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', hour: '2-digit', hourCycle: 'h23' }).format(d);
}

function slotBucket(iso) {
  const day = londonWeekday(iso);
  const hour = londonHour(iso);
  return day && hour ? `${day}-${hour}` : null;
}

function recencyWeight(iso, now = Date.now(), halfLifeDays = 28) {
  const ts = Date.parse(iso || '');
  if (!Number.isFinite(ts) || ts > now) return 1;
  const ageDays = Math.max(0, (now - ts) / 86400000);
  return Math.pow(0.5, ageDays / Math.max(1, safeNumber(halfLifeDays, 28)));
}

function analyticsEligibility({ placement, measured, verifiedIds = new Set(), now = Date.now(), policy = {} }) {
  if (!placement?.bufferId) return { eligible: false, reason: 'missing_buffer_id' };
  if (!verifiedIds.has(placement.bufferId)) return { eligible: false, reason: 'publication_not_verified' };
  if (!measured) return { eligible: false, reason: 'analytics_missing' };
  const due = Date.parse(placement.dueAt || '');
  if (!Number.isFinite(due)) return { eligible: false, reason: 'missing_due_time' };
  const minimumAgeMs = safeNumber(policy.analyticsMinimumPostAgeHours, 24) * 3600000;
  if (now - due < minimumAgeMs) return { eligible: false, reason: 'analytics_immature' };
  const updated = Date.parse(measured.updatedAt || '');
  if (!Number.isFinite(updated)) return { eligible: false, reason: 'analytics_refresh_time_missing' };
  const graceMs = safeNumber(policy.analyticsFreshnessAfterDueMinutes, 5) * 60000;
  if (updated < due + graceMs) return { eligible: false, reason: 'analytics_predates_publication' };
  if (!measured.metrics || !Object.keys(measured.metrics).length) return { eligible: false, reason: 'analytics_empty' };
  return { eligible: true, reason: 'mature_verified_snapshot' };
}

function weightedAggregate(records, keyFn, policy, now = Date.now()) {
  const buckets = new Map();
  for (const row of records) {
    const keys = [].concat(keyFn(row) || []).filter(Boolean);
    for (const key of keys) {
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key).push(row);
    }
  }
  const priorScore = safeNumber(policy?.scoring?.priorScore, 50);
  const priorWeight = safeNumber(policy?.scoring?.priorWeight, 2);
  const halfLife = safeNumber(policy?.recencyHalfLifeDays, 28);
  const result = [];
  for (const [key, rows] of buckets) {
    const contributions = rows.map((row) => {
      const confidence = Math.max(0.1, safeNumber(row.confidence, 0));
      const recent = recencyWeight(row.dueAt, now, halfLife);
      return { row, weight: confidence * recent, recent };
    });
    const evidenceWeight = contributions.reduce((sum, x) => sum + x.weight, 0);
    const weighted = contributions.reduce((sum, x) => sum + safeNumber(x.row.score, priorScore) * x.weight, 0);
    const adjusted = (weighted + priorScore * priorWeight) / Math.max(0.0001, evidenceWeight + priorWeight);
    result.push({
      key,
      samples: rows.length,
      evidenceWeight: Number(evidenceWeight.toFixed(2)),
      adjustedScore: Number(adjusted.toFixed(2)),
      rawMean: Number((rows.reduce((sum, row) => sum + safeNumber(row.score, priorScore), 0) / rows.length).toFixed(2)),
    });
  }
  return result.sort((a, b) => b.adjustedScore - a.adjustedScore || b.evidenceWeight - a.evidenceWeight || b.samples - a.samples || String(a.key).localeCompare(String(b.key)));
}

function buildPerformanceModel(records = [], policy = {}, now = Date.now()) {
  const baseModel = base.buildPerformanceModel(records, policy);
  const scored = baseModel.scored.map((row) => {
    const recent = recencyWeight(row.dueAt, now, policy.recencyHalfLifeDays);
    const decisionScore = safeNumber(row.score, 50) * (0.65 + 0.35 * recent);
    return {
      ...row,
      recencyWeight: Number(recent.toFixed(4)),
      decisionScore: Number(decisionScore.toFixed(2)),
      weekdayBucket: row.weekdayBucket || londonWeekday(row.dueAt),
      slotBucket: row.slotBucket || slotBucket(row.dueAt),
    };
  });
  return {
    scored,
    categories: weightedAggregate(scored, (r) => r.category, policy, now),
    traits: weightedAggregate(scored, (r) => r.traits || [], policy, now),
    formats: weightedAggregate(scored, (r) => r.format, policy, now),
    hours: weightedAggregate(scored, (r) => r.hourBucket || londonHour(r.dueAt), policy, now),
    weekdays: weightedAggregate(scored, (r) => r.weekdayBucket || londonWeekday(r.dueAt), policy, now),
    slots: weightedAggregate(scored, (r) => r.slotBucket || slotBucket(r.dueAt), policy, now),
  };
}

function modelValue(rows, key, fallback = 50) {
  if (!key) return fallback;
  return rows?.find((row) => row.key === key)?.adjustedScore ?? fallback;
}

function scoreAgainstModel(candidate, model, policy = {}) {
  const prior = safeNumber(policy?.scoring?.priorScore, 50);
  const copy = candidate.copy?.default || candidate.copy || '';
  const traits = candidate.traits || base.inferTraits(copy);
  const traitScores = traits.map((trait) => modelValue(model.traits, trait, null)).filter(Number.isFinite);
  const traitScore = traitScores.length ? traitScores.reduce((a, b) => a + b, 0) / traitScores.length : prior;
  const category = modelValue(model.categories, candidate.category, prior);
  const format = modelValue(model.formats, candidate.format, prior);
  const hour = modelValue(model.hours, candidate.hourBucket || londonHour(candidate.scheduledAtResolved), prior);
  const weekday = modelValue(model.weekdays, candidate.weekdayBucket || londonWeekday(candidate.scheduledAtResolved), prior);
  const slot = modelValue(model.slots, candidate.slotBucket || slotBucket(candidate.scheduledAtResolved), prior);
  const score = 0.34 * category + 0.30 * traitScore + 0.08 * format + 0.10 * hour + 0.08 * weekday + 0.10 * slot;
  return { ...candidate, traits, candidateScore: Number(score.toFixed(2)) };
}

function scoreCandidateHierarchical(candidate, globalModel, localModel, localRecordCount, policy = {}) {
  const global = scoreAgainstModel(candidate, globalModel, policy);
  if (!localModel || localModel === globalModel || localRecordCount <= 0) return { ...global, globalScore: global.candidateScore, localScore: null, localEvidenceWeight: 0 };
  const local = scoreAgainstModel(candidate, localModel, policy);
  const fullStrength = Math.max(1, safeNumber(policy.localModelFullStrengthRecords, 20));
  const localWeight = Math.min(1, Math.sqrt(localRecordCount / fullStrength));
  const score = global.candidateScore * (1 - localWeight) + local.candidateScore * localWeight;
  return {
    ...local,
    candidateScore: Number(score.toFixed(2)),
    globalScore: global.candidateScore,
    localScore: local.candidateScore,
    localEvidenceWeight: Number(localWeight.toFixed(3)),
  };
}

function tokenSet(copy = '') {
  return new Set(String(copy).toLowerCase().replace(/[^a-z0-9£%]+/g, ' ').split(/\s+/).filter((word) => word.length >= 3 && !STOPWORDS.has(word)));
}

function jaccardSimilarity(a, b) {
  const A = a instanceof Set ? a : tokenSet(a);
  const B = b instanceof Set ? b : tokenSet(b);
  if (!A.size || !B.size) return 0;
  let intersection = 0;
  for (const token of A) if (B.has(token)) intersection += 1;
  const union = A.size + B.size - intersection;
  return union ? intersection / union : 0;
}

function applyFatiguePenalty(candidate, recentRecords = [], policy = {}) {
  const fatigue = policy.fatigue || {};
  const candidateCopy = candidate.copy?.default || candidate.copy || '';
  const candidateTokens = tokenSet(candidateCopy);
  let maxSimilarity = 0;
  for (const row of recentRecords) maxSimilarity = Math.max(maxSimilarity, jaccardSimilarity(candidateTokens, tokenSet(row.copy || '')));
  const categoryCount = recentRecords.filter((row) => row.category === candidate.category).length;
  const primaryTrait = candidate.traits?.[0] || null;
  const traitCount = primaryTrait ? recentRecords.filter((row) => (row.traits || [])[0] === primaryTrait).length : 0;
  const similarityThreshold = safeNumber(fatigue.similarityThreshold, 0.55);
  const similarityExcess = Math.max(0, maxSimilarity - similarityThreshold) / Math.max(0.01, 1 - similarityThreshold);
  const similarityPenalty = similarityExcess * safeNumber(fatigue.similarityPenaltyMax, 25);
  const categoryPenalty = Math.max(0, categoryCount - safeNumber(fatigue.categoryRecentSoftCap, 2)) * safeNumber(fatigue.categoryPenalty, 4);
  const traitPenalty = Math.max(0, traitCount - safeNumber(fatigue.primaryTraitSoftCap, 4)) * safeNumber(fatigue.primaryTraitPenalty, 2);
  const penalty = Math.min(40, similarityPenalty + categoryPenalty + traitPenalty);
  return {
    ...candidate,
    preFatigueScore: candidate.candidateScore,
    candidateScore: Number((candidate.candidateScore - penalty).toFixed(2)),
    fatiguePenalty: Number(penalty.toFixed(2)),
    maxRecentSimilarity: Number(maxSimilarity.toFixed(3)),
    recentCategoryCount: categoryCount,
    recentPrimaryTraitCount: traitCount,
  };
}

function passesCandidateFloor(candidate, lane, policy = {}) {
  const minimum = lane === 'EXPLORE'
    ? safeNumber(policy.exploreMinimumCandidateScore, 45)
    : safeNumber(policy.minimumCandidateScore, 48);
  return safeNumber(candidate.candidateScore, -Infinity) >= minimum;
}

module.exports = {
  ...base,
  analyticsEligibility,
  applyFatiguePenalty,
  buildPerformanceModel,
  jaccardSimilarity,
  londonHour,
  londonWeekday,
  passesCandidateFloor,
  recencyWeight,
  scoreAgainstModel,
  scoreCandidateHierarchical,
  slotBucket,
  tokenSet,
  weightedAggregate,
};
