'use strict';

const TARGETS = ['personal', 'main', 'secondary'];
const DEFAULT_POLICY = {
  lookaheadDays: 35,
  reserveTargets: { personal: 14, main: 10, secondary: 10 },
};

function scheduledFor(post, target) {
  return post.scheduledAt?.[target] || null;
}

function isReviewReady(post) {
  return post?.status === 'review'
    && post?.qa?.status === 'ready_for_human_review'
    && post?.qa?.approvalEligible === true
    && post?.qa?.publishPermission === false;
}

function isCurrentPolicy(post) {
  return post?.sourceType === 'performance_learning_v2';
}

function mondayKey(iso) {
  const date = new Date(iso || '');
  if (Number.isNaN(date.getTime())) return null;
  const local = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 12));
  const day = local.getUTCDay() || 7;
  local.setUTCDate(local.getUTCDate() - day + 1);
  return local.toISOString().slice(0, 10);
}

function evaluateSupply(posts = [], reservedIds = new Set(), now = Date.now(), policy = DEFAULT_POLICY) {
  const horizon = now + Number(policy.lookaheadDays || DEFAULT_POLICY.lookaheadDays) * 86400000;
  const result = {};
  for (const target of TARGETS) {
    const current = [];
    const legacy = [];
    const expired = [];
    for (const post of posts) {
      if (!isReviewReady(post) || !(post.targets || []).includes(target) || reservedIds.has(post.id)) continue;
      const dueAt = scheduledFor(post, target);
      const due = Date.parse(dueAt || '');
      if (!Number.isFinite(due)) continue;
      const row = { id: post.id, title: post.title, dueAt, week: mondayKey(dueAt), category: post.category, sourceType: post.sourceType };
      if (due <= now) {
        if (isCurrentPolicy(post)) expired.push(row);
        continue;
      }
      if (due > horizon) continue;
      if (isCurrentPolicy(post)) current.push(row);
      else legacy.push(row);
    }
    current.sort((a, b) => Date.parse(a.dueAt) - Date.parse(b.dueAt));
    legacy.sort((a, b) => Date.parse(a.dueAt) - Date.parse(b.dueAt));
    const byWeek = {};
    for (const row of current) byWeek[row.week] = (byWeek[row.week] || 0) + 1;
    const targetCount = Number(policy.reserveTargets?.[target] ?? DEFAULT_POLICY.reserveTargets[target]);
    result[target] = {
      current,
      legacy,
      expired,
      currentCount: current.length,
      legacyCount: legacy.length,
      reserveTarget: targetCount,
      gap: Math.max(0, targetCount - current.length),
      coverageRatio: targetCount > 0 ? current.length / targetCount : 1,
      byWeek,
    };
  }
  const gaps = Object.fromEntries(TARGETS.map((target) => [target, result[target].gap]));
  return {
    targets: result,
    gaps,
    totalGap: Object.values(gaps).reduce((sum, n) => sum + n, 0),
    green: Object.values(gaps).every((gap) => gap === 0),
  };
}

module.exports = { DEFAULT_POLICY, TARGETS, evaluateSupply, isCurrentPolicy, isReviewReady, mondayKey, scheduledFor };
