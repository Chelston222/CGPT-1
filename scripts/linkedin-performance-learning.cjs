'use strict';

const DEFAULT_POLICY = {
  scoring: {
    engagementWeight: 0.50,
    interactionDensityWeight: 0.25,
    reachWeight: 0.15,
    impressionsWeight: 0.10,
    commercialWeight: 0.65,
    confidenceImpressions: 100,
    priorScore: 50,
    priorWeight: 2,
  },
  selection: {
    sameCategoryPenalty: 12,
    samePrimaryTraitPenalty: 6,
  },
};

function parseHeaders(body = '') {
  const out = {};
  for (const line of String(body).split(/\r?\n/)) {
    if (line.trim() === '---') break;
    const match = line.match(/^([A-Z][A-Z0-9_]+):\s*(.*)$/);
    if (match) out[match[1]] = match[2].trim();
  }
  return out;
}

function parseIssueCopy(body = '') {
  const lines = String(body).split(/\r?\n/);
  const i = lines.findIndex((line) => line.trim() === '---');
  return i < 0 ? '' : lines.slice(i + 1).join('\n').trim();
}

function normalizeMetricName(name = '') {
  const raw = String(name).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  if (raw === 'eng rate' || raw === 'engagement rate') return 'engagementRate';
  if (raw.includes('impression')) return 'impressions';
  if (raw === 'reach') return 'reach';
  if (raw.includes('reaction')) return 'reactions';
  if (raw.includes('comment')) return 'comments';
  if (raw.includes('click')) return 'clicks';
  if (raw.includes('save')) return 'saves';
  return raw.replace(/\s+(.)/g, (_, c) => c.toUpperCase());
}

function parseAnalyticsComment(body = '') {
  const text = String(body);
  const id = text.match(/LINKEDIN_ANALYTICS_CAPTURED bufferId=([^\s>]+)/)?.[1]
    || text.match(/Buffer post ID:\s*`([^`]+)`/)?.[1]
    || null;
  if (!id || !/analytics captured/i.test(text)) return null;
  const updatedAt = text.match(/metricsUpdatedAt=([^\s>]+)/)?.[1]
    || text.match(/Metrics refreshed:\s*\*\*([^*]+)\*\*/i)?.[1]
    || null;
  const metrics = {};
  const regex = /^-\s+([^:\n]+):\s+\*\*([-+]?\d+(?:\.\d+)?)\*\*(%)?/gm;
  let match;
  while ((match = regex.exec(text))) {
    const key = normalizeMetricName(match[1]);
    if (['bufferPostId', 'metricsRefreshed'].includes(key)) continue;
    metrics[key] = Number(match[2]);
  }
  return { bufferId: id, updatedAt, metrics };
}

function extractPlacements(comments = []) {
  const out = [];
  const regex = /^-\s+([a-z0-9-]+)@(\d+)\s+·\s+([^:\n]+):\s+Buffer post ID\s+`([^`]+)`(?:\s+—\s+([^\s\n]+))?/gmi;
  for (const comment of comments) {
    let match;
    const body = String(comment.body || '');
    while ((match = regex.exec(body))) out.push({
      queueId: match[1],
      revision: Number(match[2]),
      channelName: match[3].trim(),
      bufferId: match[4],
      dueAt: match[5] || null,
    });
  }
  return out;
}

function extractAnalyticsByBufferId(comments = []) {
  const map = new Map();
  for (const comment of comments) {
    const parsed = parseAnalyticsComment(comment.body || '');
    if (!parsed) continue;
    const previous = map.get(parsed.bufferId);
    const nextTs = Date.parse(parsed.updatedAt || comment.updated_at || comment.created_at || '') || 0;
    const prevTs = previous?._ts || 0;
    if (!previous || nextTs >= prevTs) map.set(parsed.bufferId, { ...parsed, _ts: nextTs });
  }
  return map;
}

function extractCommercialSignals(comments = []) {
  const map = new Map();
  const regex = /<!--\s*LINKEDIN_COMMERCIAL_SIGNAL\s+bufferId=([^\s>]+)\s+type=([a-z_]+)(?:\s+valueGbp=([0-9]+(?:\.[0-9]+)?))?\s*-->/gi;
  for (const comment of comments) {
    let match;
    while ((match = regex.exec(String(comment.body || '')))) {
      const signal = { type: match[2].toLowerCase(), valueGbp: match[3] ? Number(match[3]) : null };
      if (!map.has(match[1])) map.set(match[1], []);
      map.get(match[1]).push(signal);
    }
  }
  return map;
}

function commercialSignalValue(signals = []) {
  const weights = {
    dm: 1,
    reply: 1,
    enquiry: 2,
    relevant_response: 2,
    fit_check: 3,
    qualified: 4,
    revenue_recovery_check: 5,
    rrc: 5,
    growth_check: 6,
    proposal: 6,
    paid_progression: 7,
    paid: 9,
    buyer: 10,
  };
  let value = 0;
  for (const signal of signals || []) {
    value += weights[String(signal.type || '').toLowerCase()] || 0;
    if (Number.isFinite(signal.valueGbp) && signal.valueGbp > 0) value += Math.min(10, Math.log10(signal.valueGbp + 1) * 2);
  }
  return value;
}

function inferTraits(copy = '') {
  const text = String(copy).trim();
  const lower = text.toLowerCase();
  const first = text.split(/\n+/).find(Boolean) || '';
  const traits = new Set();
  const firstPerson = (lower.match(/\b(i|i'm|i’ve|i've|my|me)\b/g) || []).length;
  const questions = (text.match(/\?/g) || []).length;
  if (firstPerson >= 3) traits.add('founder_voice');
  if (/\b(not|isn[’']t|doesn[’']t|don[’']t|but|instead|rather than)\b/i.test(first)) traits.add('contrarian_hook');
  if (/\b(not|isn[’']t|doesn[’']t|don[’']t|but|instead|rather than)\b/i.test(text)) traits.add('contrarian');
  if (questions >= 2 || /\b(check|diagnos|ask|trace|where|what happened|why)\b/i.test(text)) traits.add('diagnostic');
  if (/^\s*\d+[.)]/m.test(text) || /\n\s*[-•]\s+/.test(text)) traits.add('structured_list');
  if (/\b(then|later|morning|week|yesterday|today|turns out|caught myself)\b/i.test(text) && firstPerson >= 2) traits.add('story');
  if (/£\s*\d|\b\d+(?:\.\d+)?%|\b\d{2,}\b/.test(text)) traits.add('specificity');
  if (/\b(client|customer|enquiry|booking|appointment|rebook|return)\b/i.test(text)) traits.add('customer_state');
  if (/\b(message me|comment|free revenue recovery check|tally\.so|dm me)\b/i.test(text)) traits.add('cta');
  if (/\bmore (?:leads|traffic)\b/i.test(text)) traits.add('more_leads_frame');
  if (/\b(automation|software|booking platform|booking system|crm)\b/i.test(text)) traits.add('system_contrast');

  // Hook OS first-impression traits. These describe the opening mechanism,
  // not whether the hook is commercially proven.
  if (/\?\s*$/.test(first.trim())) traits.add('hook_question');
  if (/^\s*(if|when|whenever|before|after)\b/i.test(first)) traits.add('hook_condition');
  if (/\b(what happens|how many|quick test|what brings|where does|why does|what currently happens)\b/i.test(first)) traits.add('hook_diagnostic');
  if (/\b(lose|lost|leak|leaking|missed|disappear|quiet|gap|fall out|drop off|no-show|lapsed)\b/i.test(first)) traits.add('hook_problem_loss');
  if (/\b(recover|return|rebook|bring back|more clients|more bookings|less chasing|fuller diary)\b/i.test(first)) traits.add('hook_outcome');
  if (/\b(vs\.?|versus|what usually happens|what should happen|before.+after|rather than|instead of)\b/i.test(first)) traits.add('hook_contrast');
  if (/\b(not|isn[’']t|doesn[’']t|don[’']t|but|instead|rather than|may not need)\b/i.test(first)) traits.add('hook_belief_shift');

  return [...traits];
}

function median(values = []) {
  const xs = values.filter(Number.isFinite).slice().sort((a, b) => a - b);
  if (!xs.length) return 0;
  const mid = Math.floor(xs.length / 2);
  return xs.length % 2 ? xs[mid] : (xs[mid - 1] + xs[mid]) / 2;
}

function percentileRank(value, values = []) {
  const xs = values.filter(Number.isFinite).slice().sort((a, b) => a - b);
  if (!xs.length) return 0.5;
  if (xs.length === 1) return 0.5;
  let below = 0;
  let equal = 0;
  for (const x of xs) {
    if (x < value) below += 1;
    else if (x === value) equal += 1;
  }
  return (below + 0.5 * equal) / xs.length;
}

function enrichPerformance(records = [], policy = DEFAULT_POLICY) {
  const engagementValues = records.map((record) => {
    const m = record.metrics || {};
    const impressions = Number(m.impressions || 0);
    const interactions = Number(m.reactions || 0) + Number(m.comments || 0) + Number(m.clicks || 0) + Number(m.saves || 0);
    return Number.isFinite(m.engagementRate) ? Number(m.engagementRate) : impressions > 0 ? (interactions / impressions) * 100 : null;
  }).filter(Number.isFinite);
  const baseline = median(engagementValues);
  const prelim = records.map((record) => {
    const m = record.metrics || {};
    const impressions = Math.max(0, Number(m.impressions || 0));
    const reach = Math.max(0, Number(m.reach || 0));
    const interactions = Math.max(0, Number(m.reactions || 0) + Number(m.comments || 0) + Number(m.clicks || 0) + Number(m.saves || 0));
    const observedEngagement = Number.isFinite(m.engagementRate) ? Number(m.engagementRate) : impressions > 0 ? (interactions / impressions) * 100 : baseline;
    const sample = Math.max(impressions, reach);
    const confidence = Math.min(1, Math.sqrt(sample / Math.max(1, policy.scoring.confidenceImpressions)));
    const shrunkEngagement = observedEngagement * confidence + baseline * (1 - confidence);
    const interactionDensity = (interactions / Math.max(1, reach || impressions)) * 100;
    const commercialValue = commercialSignalValue(record.commercialSignals || []);
    return { ...record, impressions, reach, interactions, observedEngagement, confidence, shrunkEngagement, interactionDensity, commercialValue };
  });
  const engagements = prelim.map((r) => r.shrunkEngagement);
  const densities = prelim.map((r) => r.interactionDensity);
  const commercialValues = prelim.map((r) => r.commercialValue);
  const hasCommercialEvidence = commercialValues.some((v) => v > 0);
  const maxReach = Math.max(1, ...prelim.map((r) => r.reach));
  const maxImpressions = Math.max(1, ...prelim.map((r) => r.impressions));
  return prelim.map((record) => {
    const s = policy.scoring;
    const rawCore = 100 * (
      s.engagementWeight * percentileRank(record.shrunkEngagement, engagements)
      + s.interactionDensityWeight * percentileRank(record.interactionDensity, densities)
      + s.reachWeight * (Math.log1p(record.reach) / Math.log1p(maxReach))
      + s.impressionsWeight * (Math.log1p(record.impressions) / Math.log1p(maxImpressions))
    );
    const evidenceCore = rawCore * record.confidence + Number(s.priorScore || 50) * (1 - record.confidence);
    const commercialWeight = hasCommercialEvidence ? Math.min(0.70, Math.max(0, Number(s.commercialWeight || 0))) : 0;
    const commercial = hasCommercialEvidence ? 100 * percentileRank(record.commercialValue, commercialValues) : 0;
    const score = evidenceCore * (1 - commercialWeight) + commercial * commercialWeight;
    const confidenceClass = Math.max(record.impressions, record.reach) >= 150 ? 'high' : Math.max(record.impressions, record.reach) >= 50 ? 'medium' : 'low';
    return { ...record, rawCoreScore: Number(rawCore.toFixed(2)), coreScore: Number(evidenceCore.toFixed(2)), commercialScore: Number(commercial.toFixed(2)), score: Number(score.toFixed(2)), confidenceClass };
  });
}

function aggregateBy(records = [], keyFn, policy = DEFAULT_POLICY) {
  const buckets = new Map();
  for (const record of records) {
    for (const key of [].concat(keyFn(record) || []).filter(Boolean)) {
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key).push(record);
    }
  }
  const out = [];
  for (const [key, rows] of buckets) {
    const weight = rows.reduce((sum, row) => sum + Math.max(0.1, row.confidence || 0), 0);
    const weighted = rows.reduce((sum, row) => sum + row.score * Math.max(0.1, row.confidence || 0), 0);
    const adjusted = (weighted + policy.scoring.priorScore * policy.scoring.priorWeight) / (weight + policy.scoring.priorWeight);
    out.push({ key, samples: rows.length, adjustedScore: Number(adjusted.toFixed(2)), rawMean: Number((rows.reduce((s, r) => s + r.score, 0) / rows.length).toFixed(2)) });
  }
  return out.sort((a, b) => b.adjustedScore - a.adjustedScore || b.samples - a.samples || a.key.localeCompare(b.key));
}

function buildPerformanceModel(records = [], policy = DEFAULT_POLICY) {
  const scored = enrichPerformance(records, policy);
  return {
    scored,
    categories: aggregateBy(scored, (r) => r.category, policy),
    traits: aggregateBy(scored, (r) => r.traits || [], policy),
    formats: aggregateBy(scored, (r) => r.format, policy),
    hours: aggregateBy(scored, (r) => r.hourBucket, policy),
  };
}

function scoreCandidate(candidate, model, policy = DEFAULT_POLICY) {
  const category = model.categories.find((x) => x.key === candidate.category)?.adjustedScore ?? policy.scoring.priorScore;
  const traits = candidate.traits || inferTraits(candidate.copy?.default || candidate.copy || '');
  const traitRows = traits.map((trait) => model.traits.find((x) => x.key === trait)?.adjustedScore).filter(Number.isFinite);
  const traitScore = traitRows.length ? traitRows.reduce((a, b) => a + b, 0) / traitRows.length : policy.scoring.priorScore;
  const format = model.formats.find((x) => x.key === candidate.format)?.adjustedScore ?? policy.scoring.priorScore;
  const hour = model.hours.find((x) => x.key === candidate.hourBucket)?.adjustedScore ?? policy.scoring.priorScore;
  return { ...candidate, traits, candidateScore: Number((0.42 * category + 0.33 * traitScore + 0.10 * format + 0.15 * hour).toFixed(2)) };
}

function selectDiverseCandidates(candidates = [], count = 5, policy = DEFAULT_POLICY) {
  const remaining = candidates.slice();
  const selected = [];
  const categoryCounts = new Map();
  const traitCounts = new Map();
  while (selected.length < count && remaining.length) {
    let bestIndex = -1;
    let bestAdjusted = -Infinity;
    remaining.forEach((candidate, index) => {
      const primaryTrait = candidate.traits?.[0] || null;
      const adjusted = candidate.candidateScore
        - (categoryCounts.get(candidate.category) || 0) * policy.selection.sameCategoryPenalty
        - (primaryTrait ? (traitCounts.get(primaryTrait) || 0) * policy.selection.samePrimaryTraitPenalty : 0);
      if (adjusted > bestAdjusted) { bestAdjusted = adjusted; bestIndex = index; }
    });
    const [winner] = remaining.splice(bestIndex, 1);
    winner.adjustedSelectionScore = Number(bestAdjusted.toFixed(2));
    selected.push(winner);
    categoryCounts.set(winner.category, (categoryCounts.get(winner.category) || 0) + 1);
    const primaryTrait = winner.traits?.[0] || null;
    if (primaryTrait) traitCounts.set(primaryTrait, (traitCounts.get(primaryTrait) || 0) + 1);
  }
  return selected;
}

module.exports = {
  DEFAULT_POLICY,
  parseHeaders,
  parseIssueCopy,
  parseAnalyticsComment,
  extractPlacements,
  extractAnalyticsByBufferId,
  extractCommercialSignals,
  commercialSignalValue,
  inferTraits,
  enrichPerformance,
  aggregateBy,
  buildPerformanceModel,
  scoreCandidate,
  selectDiverseCandidates,
};
