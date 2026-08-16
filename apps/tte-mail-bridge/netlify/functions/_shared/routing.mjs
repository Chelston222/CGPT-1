import { DEFAULTS } from './constants.mjs';
import { daysBetween, deterministicNoise, isFuture, minutesSince } from './util.mjs';

export function effectiveDailyCap(account, now = new Date()) {
  const hard = Math.max(0, Number(account.dailyCap ?? DEFAULTS.gmailDailyCap));
  if (account.status !== 'WARMING') return hard;
  const start = Number(account.warmup?.startCap ?? DEFAULTS.warmupStartCap);
  const step = Number(account.warmup?.step ?? DEFAULTS.warmupStep);
  const every = Math.max(1, Number(account.warmup?.stepEveryDays ?? DEFAULTS.warmupStepEveryDays));
  const max = Number(account.warmup?.maxCap ?? DEFAULTS.warmupMaxCap);
  const ageDays = daysBetween(account.warmup?.startedAt || account.connectedAt, now);
  return Math.min(hard, max, start + Math.floor(ageDays / every) * step);
}

export function accountEligibility(account, usage = {}, now = new Date()) {
  const reasons = [];
  if (!account || !['ACTIVE', 'WARMING'].includes(account.status)) reasons.push('not_active');
  if (account?.enabled === false) reasons.push('disabled');
  if (isFuture(account?.cooldownUntil, now)) reasons.push('cooldown');
  if (isFuture(account?.quarantinedUntil, now)) reasons.push('quarantined');
  const cap = effectiveDailyCap(account, now);
  if (Number(usage.sentToday || 0) >= cap) reasons.push('daily_cap');
  const rollingCap = Number(account.rolling24hCap ?? DEFAULTS.rolling24hCap);
  if (Number(usage.sentRolling24h || 0) >= rollingCap) reasons.push('rolling_24h_cap');
  const minGap = Number(account.minIntervalMinutes ?? DEFAULTS.minIntervalMinutes);
  if (minutesSince(usage.lastSentAt || account.lastSentAt, now) < minGap) reasons.push('minimum_interval');
  if (Number(usage.consecutiveFailures || account.health?.consecutiveFailures || 0) >= 3) reasons.push('failure_circuit_breaker');
  return { eligible: reasons.length === 0, reasons, cap, remainingToday: Math.max(0, cap - Number(usage.sentToday || 0)) };
}

export function selectSender({ accounts, usageByAccount = {}, leadId, continuityAccountId, now = new Date() }) {
  const diagnostics = [];
  for (const account of accounts || []) {
    const usage = usageByAccount[account.id] || {};
    const check = accountEligibility(account, usage, now);
    let score = -Infinity;
    if (check.eligible) {
      const healthScore = Math.max(0, Math.min(100, Number(account.health?.score ?? 100)));
      const remainingRatio = check.cap > 0 ? check.remainingToday / check.cap : 0;
      const continuity = continuityAccountId && continuityAccountId === account.id ? 60 : 0;
      const priority = Number(account.priority || 0);
      const idleBonus = Math.min(15, minutesSince(usage.lastSentAt || account.lastSentAt, now) / 10);
      const noise = deterministicNoise(`${leadId}|${account.id}|${now.toISOString().slice(0,10)}`) * 2;
      score = healthScore * 0.45 + remainingRatio * 25 + continuity + priority + idleBonus + noise;
    }
    diagnostics.push({ accountId: account.id, email: account.email, score, ...check });
  }
  diagnostics.sort((a, b) => b.score - a.score || a.accountId.localeCompare(b.accountId));
  return { selected: diagnostics.find((d) => d.eligible) || null, diagnostics };
}
