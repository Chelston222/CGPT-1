'use strict';

const FREE_PLAN_MAX_SCHEDULED_PER_CHANNEL = 10;
const MAX_PLACEMENTS_PER_CHANNEL_PER_DAY = 5;
const MAX_PLACEMENTS_PER_DAY = 15;
const TARGETS = ['personal', 'main', 'secondary'];

const DEFAULT_CADENCE_POLICY = Object.freeze({
  personal: Object.freeze({ maxPerDay: 2, maxPerWeek: 14 }),
  main: Object.freeze({ maxPerDay: 1, maxPerWeek: 5 }),
  secondary: Object.freeze({ maxPerDay: 1, maxPerWeek: 5 }),
});

function placementKey(postId, revision, target) {
  return `${postId}@${revision}:${target}`;
}

function localDate(value, timeZone = 'Europe/London') {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}

function weekKeyFromLocalDate(local) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(local || '');
  if (!match) return '';
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((date - yearStart) / 86400000) + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

function placementDate(job, channel, timeZone = 'Europe/London') {
  const approvedSchedule = job.post.scheduledAt?.[channel.target];
  return approvedSchedule ? String(approvedSchedule).slice(0, 10) : localDate(channel.dueAt, timeZone);
}

function validateDailyPlacementLimit(jobs, limit = MAX_PLACEMENTS_PER_DAY, perChannelLimit = MAX_PLACEMENTS_PER_CHANNEL_PER_DAY, timeZone = 'Europe/London') {
  const counts = new Map();
  const channelCounts = new Map();
  for (const job of jobs) {
    if (job.request.mode === 'draft') continue;
    for (const channel of job.request.channels) {
      const date = placementDate(job, channel, timeZone);
      if (!date) throw new Error(`${job.post.id} / ${channel.target} has no scheduled date.`);
      counts.set(date, (counts.get(date) || 0) + 1);
      const channelKey = `${date}:${channel.target}`;
      channelCounts.set(channelKey, (channelCounts.get(channelKey) || 0) + 1);
    }
  }
  const overflow = [...counts.entries()].find(([, count]) => count > limit);
  if (overflow) throw new Error(`${overflow[0]} has ${overflow[1]} account placements; maximum is ${limit} across all channels.`);
  const channelOverflow = [...channelCounts.entries()].find(([, count]) => count > perChannelLimit);
  if (channelOverflow) {
    const [date, target] = channelOverflow[0].split(':');
    throw new Error(`${date} has ${channelOverflow[1]} placements for ${target}; maximum is ${perChannelLimit} per channel.`);
  }
  return Object.fromEntries([...counts.entries()].sort());
}

function validateCadenceContract(jobs, policy = DEFAULT_CADENCE_POLICY, timeZone = 'Europe/London') {
  const daily = new Map();
  const weekly = new Map();

  for (const job of jobs) {
    if (job.request.mode === 'draft') continue;
    for (const channel of job.request.channels) {
      const targetPolicy = policy[channel.target];
      if (!targetPolicy) throw new Error(`${job.post.id} uses unknown cadence target ${channel.target}.`);
      const date = placementDate(job, channel, timeZone);
      if (!date) throw new Error(`${job.post.id} / ${channel.target} has no scheduled date.`);
      const week = weekKeyFromLocalDate(date);
      const dailyKey = `${date}:${channel.target}`;
      const weeklyKey = `${week}:${channel.target}`;
      daily.set(dailyKey, (daily.get(dailyKey) || 0) + 1);
      weekly.set(weeklyKey, (weekly.get(weeklyKey) || 0) + 1);
    }
  }

  for (const [key, count] of daily.entries()) {
    const target = key.split(':').at(-1);
    const maximum = Number(policy[target].maxPerDay);
    if (count > maximum) throw new Error(`${key} has ${count} placements; new cadence maximum is ${maximum} per day.`);
  }

  for (const [key, count] of weekly.entries()) {
    const target = key.split(':').at(-1);
    const maximum = Number(policy[target].maxPerWeek);
    if (count > maximum) throw new Error(`${key} has ${count} placements; new cadence maximum is ${maximum} per week.`);
  }

  return {
    daily: Object.fromEntries([...daily.entries()].sort()),
    weekly: Object.fromEntries([...weekly.entries()].sort()),
  };
}

function planCapacityWindow(jobs, occupancy = {}, acceptedKeys = new Set(), perChannelLimit = FREE_PLAN_MAX_SCHEDULED_PER_CHANNEL) {
  const available = Object.fromEntries(TARGETS.map((target) => [target, Math.max(0, perChannelLimit - Number(occupancy[target] || 0))]));
  const dispatch = [];
  const waiting = [];
  const alreadyAccepted = [];

  const placements = jobs.flatMap((job) => job.request.channels.map((channel) => ({
    job,
    channel,
    key: placementKey(job.post.id, job.post.revision, channel.target),
  }))).sort((a, b) => String(a.channel.dueAt).localeCompare(String(b.channel.dueAt)) || a.key.localeCompare(b.key));

  for (const placement of placements) {
    if (acceptedKeys.has(placement.key)) {
      alreadyAccepted.push(placement);
    } else if (placement.job.request.mode === 'draft') {
      dispatch.push(placement);
    } else if (available[placement.channel.target] > 0) {
      dispatch.push(placement);
      available[placement.channel.target] -= 1;
    } else {
      waiting.push(placement);
    }
  }
  return { dispatch, waiting, alreadyAccepted, available };
}

function parseAcceptedMarkers(comments = [], trustedLogin = 'github-actions[bot]') {
  const keys = new Set();
  const pattern = /<!--\s*BUFFER_ACCEPTED\s+([^\s]+)\s*-->/g;
  for (const comment of comments) {
    if (typeof comment !== 'string' && comment.user?.login !== trustedLogin) continue;
    const body = typeof comment === 'string' ? comment : String(comment.body || '');
    for (const match of body.matchAll(pattern)) keys.add(match[1]);
  }
  return keys;
}

function acceptedMarker(key) {
  return `<!-- BUFFER_ACCEPTED ${key} -->`;
}

function classifyBufferFailure({ status = 0, messages = [], headers = {} } = {}) {
  const text = messages.join(' ').toLowerCase();
  if (status === 429 || text.includes('rate limit')) {
    return { code: 'rate_limited', retryable: true, retryAfter: headers['retry-after'] || null };
  }
  if ([500, 502, 503, 504].includes(status) || text.includes('temporar') || text.includes('server')) {
    return { code: 'temporary_buffer_failure', retryable: true, retryAfter: null };
  }
  if (text.includes('authorization') || text.includes('authorisation') || text.includes('unauthorized') || status === 401 || status === 403) {
    return { code: 'channel_authorisation_required', retryable: false, retryAfter: null };
  }
  if (text.includes('queue') && (text.includes('full') || text.includes('limit'))) {
    return { code: 'buffer_queue_full', retryable: true, retryAfter: null };
  }
  if (text.includes('media') || text.includes('document') || text.includes('pdf')) {
    return { code: 'media_rejected', retryable: false, retryAfter: null };
  }
  return { code: 'buffer_rejected', retryable: false, retryAfter: null };
}

module.exports = {
  DEFAULT_CADENCE_POLICY,
  FREE_PLAN_MAX_SCHEDULED_PER_CHANNEL,
  MAX_PLACEMENTS_PER_CHANNEL_PER_DAY,
  MAX_PLACEMENTS_PER_DAY,
  acceptedMarker,
  classifyBufferFailure,
  localDate,
  parseAcceptedMarkers,
  placementKey,
  planCapacityWindow,
  validateCadenceContract,
  validateDailyPlacementLimit,
  weekKeyFromLocalDate,
};
